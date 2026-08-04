// FEAT-034 — Component Optimizer — host coordinator (design.md §I)
//
// Follows the same contract as the other four coordinators:
// `handle(msg, postMessage, sendData): Promise<boolean>`, returning false for
// message types it does not own so the caller can fall through the chain.

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { sendWhenShellReady } from '../terminalUtils.js';
import type { HarnessWriter } from '../harnessWriter.js';
import type { DashboardData, WebviewMessage } from '../types.js';
import { loadComponents } from '../optimizer/componentLoader.js';
import { scan, type GraphEdge } from '../optimizer/optimizerEngine.js';
import { computeFix } from '../optimizer/quickFix.js';
import { buildRefinePrompt, normalizeRefineResponse } from '../optimizer/aiRefine.js';
import { buildDelegateTask, type DelegateScope } from '../optimizer/delegateTask.js';
import { sendPromptToHostChat, detectChatHost } from '../chatHandoffHost.js';
import { createProviderChain, vscodeLmProvider, createOpenAiCompatibleProvider } from '../lmUtils.js';
import type { RunAdapterRegistry } from '../run/runAdapterRegistry.js';
import { OptimizerDiffProvider } from '../optimizer/optimizerDiffProvider.js';
import type {
    ComponentSource,
    OptimizerConfig,
    OptimizerFinding,
    OptimizerReport,
    QuickFix,
} from '../optimizer/types.js';
import {
    DISMISSED_FINDINGS_KEY,
    OPTIMIZER_DIFF_SCHEME,
    dismissalKey,
    disabledReport,
    readOptimizerConfig,
    buildRefineProviderOptions,
} from './optimizerConfig.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;
type SendDataFn = (postMessage?: PostMessageFn) => Promise<void>;

/** R12 — abandon a refine that has not returned in this long. */
const REFINE_TIMEOUT_MS = 30_000;
/** R20 — batches larger than this need a second confirmation. */
const MAX_DELEGATE_COMPONENTS = 20;
/** R7 — per-workspace model override for the optimizer specifically. */
const AI_MODEL_KEY = 'harness-dashboard.optimizer.aiModel';

// Re-exported so existing import sites can keep pointing at the coordinator.
export {
    DISMISSED_FINDINGS_KEY,
    OPTIMIZER_DIFF_SCHEME,
    dismissalKey,
    disabledReport,
    readOptimizerConfig,
};
export type { ConfigReader } from './optimizerConfig.js';



export class OptimizerCoordinator {
    private _cachedReport: OptimizerReport | null = null;
    private _cachedSources: ComponentSource[] = [];
    private _scheduleScan?: () => void;
    private _runRegistry?: RunAdapterRegistry;
    /** R12 — one refine in flight per finding. */
    private readonly _refinesInFlight = new Set<string>();
    public readonly diffProvider = new OptimizerDiffProvider();

    constructor(
        private readonly _writer: HarnessWriter,
        private readonly _context: vscode.ExtensionContext,
        private readonly _workspaceRoot: vscode.Uri,
        private readonly _log: vscode.LogOutputChannel,
        private readonly _getCachedData: () => DashboardData | null,
    ) {}

    setScheduleScan(fn: () => void): void {
        this._scheduleScan = fn;
    }

    /** T16 — the terminal adapters FEAT-033 already detects (R14). */
    setRunRegistry(registry: RunAdapterRegistry): void {
        this._runRegistry = registry;
    }

    getCachedReport(): OptimizerReport | null {
        return this._cachedReport;
    }

    private _config(): OptimizerConfig {
        return readOptimizerConfig(vscode.workspace.getConfiguration('harness-dashboard'));
    }

    private _dismissed(): Set<string> {
        return new Set(this._context.workspaceState.get<string[]>(DISMISSED_FINDINGS_KEY, []));
    }

    /** Distinguishes a directory from an absent path — see OPT-D01. */
    private async _statPath(rel: string): Promise<'file' | 'directory' | 'missing'> {
        try {
            const uri = vscode.Uri.joinPath(this._workspaceRoot, ...rel.split('/'));
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type & vscode.FileType.Directory) return 'directory';
            return 'file';
        } catch {
            return 'missing';
        }
    }

    private async _readFile(rel: string): Promise<string | null> {
        try {
            const uri = vscode.Uri.joinPath(this._workspaceRoot, ...rel.split('/'));
            const bytes = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(bytes).toString('utf8');
        } catch {
            return null;
        }
    }

    /**
     * Collect the workspace-relative paths of every file the graph knows about.
     * Rules use this to resolve steering globs, reference targets and links
     * without doing I/O of their own.
     */
    private _existingPaths(data: DashboardData): Set<string> {
        const paths = new Set<string>();
        for (const node of data.graph.nodes) {
            const p = (node.metadata as Record<string, unknown>)._filePath;
            if (typeof p === 'string' && p.length > 0) paths.add(p.replace(/\\/g, '/'));
        }
        return paths;
    }

    /**
     * Run a full scan and cache the result. Never throws — the engine already
     * guarantees that, and the load step is guarded here (R53).
     */
    async runScan(): Promise<OptimizerReport> {
        const config = this._config();
        // R50: when disabled we do not scan at all, rather than scan and discard.
        if (!config.enabled) {
            this._cachedReport = disabledReport();
            this._cachedSources = [];
            return this._cachedReport;
        }

        const data = this._getCachedData();
        if (!data) {
            this._cachedReport = disabledReport();
            this._cachedSources = [];
            return this._cachedReport;
        }

        try {
            const sources = await loadComponents(
                data.graph.nodes,
                this._workspaceRoot.fsPath,
                rel => this._readFile(rel),
                rel => this._statPath(rel),
            );
            const edges: GraphEdge[] = data.graph.edges.map(e => ({
                source: e.source,
                target: e.target,
                label: e.label ?? '',
            }));
            const nodeIds = new Set(data.graph.nodes.map(n => n.id));
            const report = scan(
                sources,
                edges,
                nodeIds,
                this._existingPaths(data),
                config,
                this._dismissed(),
            );
            this._cachedSources = sources;
            this._cachedReport = report;
            return report;
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            this._log.error(`[Optimizer] Scan failed: ${error}`);
            this._cachedReport = { ...disabledReport(), ok: false, error };
            return this._cachedReport;
        }
    }

    /**
     * The report message envelope. The webview cannot read settings or detect
     * CLIs, so the flags that decide which actions render travel with the report.
     */
    private async _reportMessage(report: OptimizerReport): Promise<Record<string, unknown>> {
        const cfg = this._config();
        let hasTerminalAgent = false;
        try {
            const adapters = (await this._runRegistry?.detect()) ?? [];
            hasTerminalAgent = adapters.some(a => a.id !== 'generic');
        } catch {
            hasTerminalAgent = false;
        }
        const chat = await detectChatHost();
        return {
            type: 'optimizerReport',
            report,
            enabled: cfg.enabled,
            assistedEnabled: cfg.assistedFixes.enabled,
            assistedMode: cfg.assistedFixes.mode,
            hasTerminalAgent,
            chatHostName: chat?.name,
        };
    }

    /** Recompute and broadcast — used by the shared scheduleScan path (R47). */
    async refresh(post: (msg: unknown) => void): Promise<void> {
        const report = await this.runScan();
        post(await this._reportMessage(report));
    }

    async handle(
        msg: WebviewMessage,
        postMessage: PostMessageFn,
        _sendData: SendDataFn,
    ): Promise<boolean> {
        switch (msg.type) {
            case 'getOptimizerReport': {
                const report = this._cachedReport ?? await this.runScan();
                postMessage(await this._reportMessage(report));
                return true;
            }

            case 'runOptimizerScan': {
                const report = await this.runScan();
                postMessage(await this._reportMessage(report));
                return true;
            }

            case 'dismissOptimizerFinding': {
                const ruleId = msg.ruleId as string;
                const nodeId = msg.nodeId as string;
                if (ruleId && nodeId) {
                    const key = dismissalKey(ruleId, nodeId);
                    const current = this._context.workspaceState.get<string[]>(DISMISSED_FINDINGS_KEY, []);
                    if (!current.includes(key)) {
                        await this._context.workspaceState.update(DISMISSED_FINDINGS_KEY, [...current, key]);
                    }
                }
                postMessage(await this._reportMessage(await this.runScan()));
                return true;
            }

            case 'restoreOptimizerFindings': {
                await this._context.workspaceState.update(DISMISSED_FINDINGS_KEY, []);
                postMessage(await this._reportMessage(await this.runScan()));
                return true;
            }

            case 'applyQuickFix':
                await this._applyQuickFix(msg, postMessage);
                return true;

            case 'getOptimizerAiModels': {
                let families: string[] = [];
                try {
                    const models = await vscode.lm.selectChatModels();
                    families = [...new Set((models ?? []).map(m => m.family))];
                } catch {
                    // No models available — "Auto" alone is a valid list.
                }
                postMessage({
                    type: 'optimizerAiModels',
                    models: families,
                    selected: this._context.workspaceState.get<string>(AI_MODEL_KEY, ''),
                });
                return true;
            }

            case 'setOptimizerAiModel': {
                await this._context.workspaceState.update(AI_MODEL_KEY, (msg.model as string) ?? '');
                return true;
            }

            case 'aiRefineFinding':
                await this._aiRefine(msg, postMessage);
                return true;

            case 'handoffToChat':
                await this._handoffToChat(msg, postMessage);
                return true;

            case 'delegateFinding':
                await this._delegate(msg, postMessage);
                return true;

            default:
                return false;
        }
    }

    /**
     * T39 — quick-fix flow. Order matters: nothing reaches disk before the
     * user has seen the diff and explicitly confirmed (R32).
     */
    private async _applyQuickFix(msg: WebviewMessage, postMessage: PostMessageFn): Promise<void> {
        const nodeId = msg.nodeId as string;
        const ruleId = msg.ruleId as string;
        const fix = msg.fix as QuickFix | undefined;

        const source = this._cachedSources.find(s => s.nodeId === nodeId);
        if (!source || !fix) {
            postMessage({ type: 'quickFixResult', ok: false, reason: 'component or fix not found — re-scan and try again' });
            return;
        }

        const data = this._getCachedData();
        const existingPaths = data ? this._existingPaths(data) : new Set<string>();

        const result = computeFix(source, fix, existingPaths);
        if (!result.ok) {
            postMessage({ type: 'quickFixResult', ok: false, reason: result.reason });
            return;
        }

        await this._previewAndWrite({
            source,
            ruleId,
            content: result.content,
            extraFile: result.extraFile,
            title: `${source.label}: ${fix.label} (${ruleId})`,
            prompt: `Apply "${fix.label}" to ${source.label}?`,
            resultType: 'quickFixResult',
            postMessage,
        });
    }

    /**
     * FEAT-035 T11 — the shared tail of every write path: stage → diff → modal
     * → write → rescan → clear.
     *
     * Extracted so the deterministic fixes and AI Refine cannot drift apart.
     * They must not: this function is the single place that enforces FEAT-034
     * R32, that nothing reaches disk before the user confirms.
     */
    private async _previewAndWrite(opts: {
        source: ComponentSource;
        ruleId: string;
        content: string;
        extraFile?: { relPath: string; content: string };
        title: string;
        prompt: string;
        /** Which message type the webview is listening for on this path. */
        resultType: 'quickFixResult' | 'aiRefineResult';
        /** Non-blocking notices shown in the modal before the user decides (R11). */
        warnings?: string[];
        provider?: string;
        postMessage: PostMessageFn;
    }): Promise<void> {
        const { source, ruleId, content, extraFile, title, prompt, resultType, warnings, provider, postMessage } = opts;
        let virtualUri: vscode.Uri | undefined;

        try {
            virtualUri = vscode.Uri.parse(`${OPTIMIZER_DIFF_SCHEME}:/${source.nodeId}/${ruleId}.md`);
            this.diffProvider.stage(virtualUri, content);

            const fileUri = vscode.Uri.joinPath(this._workspaceRoot, ...source.filePath.split('/'));
            await vscode.commands.executeCommand('vscode.diff', fileUri, virtualUri, title);

            const detail = [
                ...(warnings ?? []),
                'The proposed content is shown in the diff editor. Nothing has been written yet.',
            ].join('\n\n');

            const choice = await vscode.window.showInformationMessage(
                prompt,
                { modal: true, detail },
                'Apply',
            );

            if (choice !== 'Apply') {
                postMessage({ type: resultType, ok: false, reason: 'cancelled', ruleId, nodeId: source.nodeId });
                return;
            }

            await this._writer.writeFileAtPath(source.filePath, content);
            // extract-to-references is the only fix that produces a second file;
            // writing the trimmed component without it would lose the content.
            if (extraFile) {
                await this._writer.writeFileAtPath(extraFile.relPath, extraFile.content);
            }

            this._scheduleScan?.();
            postMessage({ type: resultType, ok: true, ruleId, nodeId: source.nodeId, provider });
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : String(e);
            this._log.error(`[Optimizer] ${resultType} ${ruleId} on ${source.nodeId} failed: ${reason}`);
            postMessage({ type: resultType, ok: false, reason, ruleId, nodeId: source.nodeId });
        } finally {
            if (virtualUri) this.diffProvider.clear(virtualUri);
        }
    }

    // ── FEAT-035 — AI Refine (R5–R13) ───────────────────────────────────────

    private _assistAllowed(kind: 'ai' | 'delegate'): boolean {
        const { enabled, mode } = this._config().assistedFixes;
        if (!enabled) return false;                        // R26
        if (mode === 'ai-only') return kind === 'ai';
        if (mode === 'delegate-only') return kind === 'delegate';
        return true;
    }

    private async _aiRefine(msg: WebviewMessage, postMessage: PostMessageFn): Promise<void> {
        const nodeId = msg.nodeId as string;
        const ruleId = msg.ruleId as string;
        const key = `${ruleId}::${nodeId}`;

        if (!this._assistAllowed('ai')) {
            postMessage({ type: 'aiRefineResult', ok: false, reason: 'assisted fixes are disabled', ruleId, nodeId });
            return;
        }
        // R12: a second refine on the same finding would race two writes to one file.
        if (this._refinesInFlight.has(key)) {
            postMessage({ type: 'aiRefineResult', ok: false, reason: 'a refine is already running for this finding', ruleId, nodeId });
            return;
        }

        const source = this._cachedSources.find(s => s.nodeId === nodeId);
        const finding = this._cachedReport?.findings.find(f => f.ruleId === ruleId && f.nodeId === nodeId);
        if (!source || !finding) {
            postMessage({ type: 'aiRefineResult', ok: false, reason: 'component or finding not found — re-scan and try again', ruleId, nodeId });
            return;
        }

        this._refinesInFlight.add(key);
        try {
            const cfg = vscode.workspace.getConfiguration('harness-dashboard');
            const selected = this._context.workspaceState.get<string>(AI_MODEL_KEY, '');
            const apiKey = cfg.get<string>('ai.apiKey', '');
            const endpoint = cfg.get<string>('ai.endpoint', 'https://api.openai.com/v1/chat/completions');

            // See buildRefineProviderOptions: the editor's model families and the
            // HTTP provider's model names are different namespaces.
            const { chainOptions, httpOptions } = buildRefineProviderOptions({
                selectedFamily: selected,
                apiKey,
                endpoint,
                httpModel: cfg.get<string>('ai.model', 'gpt-4o-mini'),
            });
            const chain = createProviderChain(
                [vscodeLmProvider, createOpenAiCompatibleProvider(httpOptions)],
                chainOptions,
            );

            // R12: abandon rather than hang. Losing the response is fine — nothing
            // has been written at this point.
            const result = await Promise.race([
                chain.tryGenerate(buildRefinePrompt({ source, finding })),
                new Promise<{ ok: false; error: string }>(resolve =>
                    setTimeout(() => resolve({ ok: false, error: 'timed out after 30s' }), REFINE_TIMEOUT_MS),
                ),
            ]);

            if (!result.ok) {
                // The chain reports only its LAST provider's error, so a missing
                // API key masks the more useful fact that the editor exposed no
                // model at all. Say what the user can actually act on.
                let reason = result.error;
                if (!apiKey) {
                    let editorModels = 0;
                    try {
                        editorModels = (await vscode.lm.selectChatModels()).length;
                    } catch {
                        editorModels = 0;
                    }
                    reason = editorModels === 0
                        ? 'no language model available from this editor, and no API key configured — pick a model in your editor (Copilot/Kiro) or set harness-dashboard.ai.apiKey'
                        : `the editor has ${editorModels} model(s) but the request failed: ${result.error}`;
                }
                this._log.error(`[Optimizer] AI refine ${key} failed: ${result.error}`);
                postMessage({ type: 'aiRefineResult', ok: false, reason, ruleId, nodeId });
                return;
            }

            const normalized = normalizeRefineResponse(result.text, source);
            if (!normalized.ok) {
                postMessage({ type: 'aiRefineResult', ok: false, reason: normalized.reason, ruleId, nodeId });
                return;
            }

            await this._previewAndWrite({
                source,
                ruleId,
                content: normalized.content,
                title: `${source.label}: AI refine (${ruleId})`,
                prompt: `Apply the AI proposal to ${source.label}?`,
                resultType: 'aiRefineResult',
                warnings: normalized.warnings,
                provider: chain.name,
                postMessage,
            });
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : String(e);
            this._log.error(`[Optimizer] AI refine ${key} threw: ${reason}`);
            postMessage({ type: 'aiRefineResult', ok: false, reason, ruleId, nodeId });
        } finally {
            this._refinesInFlight.delete(key);
        }
    }

    // ── FEAT-035 — Delegate to a terminal agent (R14–R20) ───────────────────

    /**
     * R16 — is the working tree dirty? Delegation writes to it directly, so git
     * is the user's only way back. A missing binary or a non-repo is reported as
     * "no version control detected", never as an error.
     */
    private async _gitState(): Promise<'clean' | 'dirty' | 'no-vcs'> {
        return new Promise(resolve => {
            try {
                const child = spawn('git', ['status', '--porcelain'], {
                    cwd: this._workspaceRoot.fsPath,
                    timeout: 5000,
                });
                let out = '';
                child.stdout.on('data', (c: Buffer) => { out += c.toString('utf8'); });
                child.on('error', () => resolve('no-vcs'));
                child.on('close', code => {
                    if (code !== 0) return resolve('no-vcs');
                    resolve(out.trim().length > 0 ? 'dirty' : 'clean');
                });
            } catch {
                resolve('no-vcs');
            }
        });
    }

    private _buildScope(msg: WebviewMessage): DelegateScope | null {
        const findings = this._cachedReport?.findings ?? [];
        const scopeKind = msg.scope as string | undefined;
        const nodeId = msg.nodeId as string | undefined;
        const ruleId = msg.ruleId as string | undefined;

        if (scopeKind === 'component' && nodeId) {
            const own = findings.filter(f => f.nodeId === nodeId);
            return own.length > 0 ? { kind: 'component', nodeId, findings: own } : null;
        }
        if (scopeKind === 'rule' && ruleId) {
            const same = findings.filter(f => f.ruleId === ruleId);
            return same.length > 0 ? { kind: 'rule', ruleId, findings: same } : null;
        }
        const one = findings.find(f => f.ruleId === ruleId && f.nodeId === nodeId);
        return one ? { kind: 'finding', finding: one } : null;
    }

    private async _delegate(msg: WebviewMessage, postMessage: PostMessageFn): Promise<void> {
        const fail = (reason: string) => postMessage({ type: 'delegateResult', ok: false, reason });

        if (!this._assistAllowed('delegate')) return fail('assisted fixes are disabled');

        const adapters = (await this._runRegistry?.detect()) ?? [];
        const usable = adapters.filter(a => a.id !== 'generic');
        if (usable.length === 0) return fail('no terminal agent CLI detected');

        const scope = this._buildScope(msg);
        if (!scope) return fail('findings not found — re-scan and try again');

        const task = buildDelegateTask(scope);
        if (task.filePaths.length === 0) return fail('no resolvable file paths in this scope');

        // R20 — a batch large enough to rewrite much of the architecture gets a
        // second, explicit confirmation naming the count.
        if (task.componentCount > MAX_DELEGATE_COMPONENTS) {
            const proceed = await vscode.window.showWarningMessage(
                `Delegate across ${task.componentCount} components?`,
                { modal: true, detail: `This exceeds the ${MAX_DELEGATE_COMPONENTS}-component threshold. The agent will edit all of them directly.` },
                'Continue',
            );
            if (proceed !== 'Continue') return fail('cancelled');
        }

        const git = await this._gitState();
        const vcsNote =
            git === 'dirty'
                ? 'Your working tree has uncommitted changes. The agent edits files directly and there is no diff preview — git is the only way back, and uncommitted work is not protected.'
                : git === 'no-vcs'
                    ? 'No version control was detected in this workspace. The agent edits files directly and there is no diff preview, so these changes cannot be reverted.'
                    : 'The agent edits files directly. There is no diff preview; your working tree is clean, so git can revert the result.';

        // R17 — the weaker contract is stated, not hidden.
        const adapterId = (msg.adapterId as string) || usable[0].id;
        const adapter = this._runRegistry?.getById(adapterId) ?? usable[0];
        const go = await vscode.window.showWarningMessage(
            `Delegate ${task.componentCount} component${task.componentCount === 1 ? '' : 's'} to ${adapter.name}?`,
            { modal: true, detail: vcsNote },
            'Delegate',
        );
        if (go !== 'Delegate') return fail('cancelled');

        try {
            const terminal = vscode.window.createTerminal({
                name: `Optimizer → ${adapter.name}`,
                cwd: this._workspaceRoot.fsPath,
            });
            terminal.show();

            // `interactive: false` is required, not cosmetic. The adapters default
            // to interactive, which for Claude Code emits a bare `claude` and drops
            // the task entirely — the CLI would open with no instructions at all.
            // Only the non-interactive form passes the task through (`--print`).
            const command = adapter.buildCommand(
                { id: scope.kind, type: 'skill', name: 'component-optimizer', filePath: task.filePaths[0] },
                { task: task.text, interactive: false },
            );

            await sendWhenShellReady(terminal, command);

            // R19 — whatever the agent changed becomes visible on the next scan.
            const sub = vscode.window.onDidCloseTerminal(closed => {
                if (closed === terminal) {
                    this._scheduleScan?.();
                    sub.dispose();
                }
            });

            postMessage({ type: 'delegateResult', ok: true, adapterId: adapter.id, componentCount: task.componentCount });
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : String(e);
            this._log.error(`[Optimizer] Delegation failed: ${reason}`);
            fail(reason);
        }
    }

    // ── FEAT-035 — hand the prompt to the host's own chat agent ─────────────

    private async _handoffToChat(msg: WebviewMessage, postMessage: PostMessageFn): Promise<void> {
        const nodeId = msg.nodeId as string;
        const ruleId = msg.ruleId as string;
        const post = (r: { ok: boolean; host?: string; reason?: string }) =>
            postMessage({ type: 'handoffResult', ...r, ruleId, nodeId });

        if (!this._assistAllowed('ai')) return post({ ok: false, reason: 'assisted fixes are disabled' });

        const source = this._cachedSources.find(s => s.nodeId === nodeId);
        const finding = this._cachedReport?.findings.find(f => f.ruleId === ruleId && f.nodeId === nodeId);
        if (!source || !finding) {
            return post({ ok: false, reason: 'component or finding not found — re-scan and try again' });
        }

        post(await sendPromptToHostChat(buildRefinePrompt({ source, finding }), {
            log: this._log,
            context: 'Optimizer',
        }));
    }

}
