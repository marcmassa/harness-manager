// FEAT-034 — Component Optimizer — host coordinator (design.md §I)
//
// Follows the same contract as the other four coordinators:
// `handle(msg, postMessage, sendData): Promise<boolean>`, returning false for
// message types it does not own so the caller can fall through the chain.

import * as vscode from 'vscode';
import type { HarnessWriter } from '../harnessWriter.js';
import type { DashboardData, WebviewMessage } from '../types.js';
import { loadComponents } from '../optimizer/componentLoader.js';
import { scan, type GraphEdge } from '../optimizer/optimizerEngine.js';
import { computeFix } from '../optimizer/quickFix.js';
import { buildRefinePrompt, normalizeRefineResponse } from '../optimizer/aiRefine.js';
import { delegateFindings } from './optimizerDelegation.js';
import { handoffToChat, requestRefine } from './optimizerRefine.js';
import { detectChatHost } from '../chatHandoffHost.js';
import type { RunAdapterRegistry } from '../run/runAdapterRegistry.js';
import { OptimizerDiffProvider } from '../optimizer/optimizerDiffProvider.js';
import type {
    ComponentSource,
    OptimizerConfig,
    OptimizerFinding,
    OptimizerReport,
    QuickFix,
} from '../optimizer/types.js';
import type { AuthorizeFn } from './WhiteboardCoordinator.js';
import {
    DISMISSED_FINDINGS_KEY,
    OPTIMIZER_DIFF_SCHEME,
    dismissalKey,
    disabledReport,
    readOptimizerConfig,
} from './optimizerConfig.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;
type SendDataFn = (postMessage?: PostMessageFn) => Promise<void>;

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

    private _authorize?: AuthorizeFn;

    setAuthorize(fn: AuthorizeFn): void {
        this._authorize = fn;
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
                await handoffToChat(msg, postMessage, {
                    assistAllowed: kind => this._assistAllowed(kind),
                    sources: this._cachedSources,
                    findings: this._cachedReport?.findings ?? [],
                    log: this._log,
                });
                return true;

            case 'delegateFinding':
                await delegateFindings(msg, postMessage, {
                    assistAllowed: kind => this._assistAllowed(kind),
                    runRegistry: this._runRegistry,
                    findings: this._cachedReport?.findings ?? [],
                    workspaceRoot: this._workspaceRoot,
                    scheduleScan: this._scheduleScan,
                    authorize: this._authorize,
                    log: this._log,
                });
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

            // FEAT-041 T3 (R4): ownership may have changed while the modal was open.
            const again = await this._authorize?.({ type: 'applyQuickFix', nodeId: source.nodeId });
            if (again && !again.ok) {
                postMessage({ type: resultType, ok: false, reason: again.reason, ruleId, nodeId: source.nodeId });
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
            const selected = this._context.workspaceState.get<string>(AI_MODEL_KEY, '');
            const result = await requestRefine(buildRefinePrompt({ source, finding }), selected);
            if (!result.ok) {
                this._log.error(`[Optimizer] AI refine ${key} failed: ${result.error}`);
                postMessage({ type: 'aiRefineResult', ok: false, reason: result.reason, ruleId, nodeId });
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
                provider: result.provider,
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
}
