// FEAT-035 — delegate Optimizer findings to an installed terminal agent
// (R14–R20), extracted from OptimizerCoordinator. The weaker contract — the
// agent edits files directly, no diff preview — is stated before handoff.

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { sendWhenShellReady } from '../terminalUtils.js';
import type { WebviewMessage } from '../types.js';
import type { OptimizerFinding } from '../optimizer/types.js';
import { buildDelegateTask, type DelegateScope } from '../optimizer/delegateTask.js';
import type { RunAdapterRegistry } from '../run/runAdapterRegistry.js';
import type { AuthorizeFn } from './WhiteboardCoordinator.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;

/** R20 — batches larger than this need a second confirmation. */
const MAX_DELEGATE_COMPONENTS = 20;

export interface DelegationDeps {
    assistAllowed(kind: 'ai' | 'delegate'): boolean;
    runRegistry?: RunAdapterRegistry;
    findings: readonly OptimizerFinding[];
    workspaceRoot: vscode.Uri;
    scheduleScan?: () => void;
    authorize?: AuthorizeFn;
    /** A reason when any listed component's file no longer matches the scan. */
    staleSource?: (nodeIds: string[]) => Promise<string | null>;
    log: vscode.LogOutputChannel;
}

// ── FEAT-035 — Delegate to a terminal agent (R14–R20) ───────────────────

/**
 * R16 — is the working tree dirty? Delegation writes to it directly, so git
 * is the user's only way back. A missing binary or a non-repo is reported as
 * "no version control detected", never as an error.
 */
export async function gitState(root: vscode.Uri): Promise<'clean' | 'dirty' | 'no-vcs'> {
    return new Promise(resolve => {
        try {
            const child = spawn('git', ['status', '--porcelain'], {
                cwd: root.fsPath,
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

export function buildScope(msg: WebviewMessage, findings: readonly OptimizerFinding[]): DelegateScope | null {
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

export async function delegateFindings(msg: WebviewMessage, postMessage: PostMessageFn, deps: DelegationDeps): Promise<void> {
    const fail = (reason: string) => postMessage({ type: 'delegateResult', ok: false, reason });

    if (!deps.assistAllowed('delegate')) return fail('assisted fixes are disabled');

    const adapters = (await deps.runRegistry?.detect()) ?? [];
    const usable = adapters.filter(a => a.id !== 'generic');
    if (usable.length === 0) return fail('no terminal agent CLI detected');

    const scope = buildScope(msg, deps.findings);
    if (!scope) return fail('findings not found — re-scan and try again');

    // R4: authorize every component the scope resolved to, not just the message.
    const scopeNodes = [...new Set((scope.kind === 'finding' ? [scope.finding] : scope.findings).map(f => f.nodeId))];
    const authorizeScope = () => deps.authorize?.({ type: 'delegateFinding', nodeIds: scopeNodes });
    const first = await authorizeScope();
    if (first && !first.ok) return fail(first.reason);
    // R6: never hand an agent a component whose file changed since the scan it was judged on.
    const stale = await deps.staleSource?.(scopeNodes);
    if (stale) return fail(stale);

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

    const git = await gitState(deps.workspaceRoot);
    const vcsNote =
        git === 'dirty'
            ? 'Your working tree has uncommitted changes. The agent edits files directly and there is no diff preview — git is the only way back, and uncommitted work is not protected.'
            : git === 'no-vcs'
                ? 'No version control was detected in this workspace. The agent edits files directly and there is no diff preview, so these changes cannot be reverted.'
                : 'The agent edits files directly. There is no diff preview; your working tree is clean, so git can revert the result.';

    // R17 — the weaker contract is stated, not hidden.
    // FEAT-043 review: the runner comes from the detected CLIs only, never from any registered id.
    const requested = msg.adapterId as string | undefined;
    const adapter = requested ? usable.find(a => a.id === requested) : usable[0];
    if (!adapter) return fail(`agent CLI "${requested}" is not installed`);
    const go = await vscode.window.showWarningMessage(
        `Delegate ${task.componentCount} component${task.componentCount === 1 ? '' : 's'} to ${adapter.name}?`,
        { modal: true, detail: vcsNote },
        'Delegate',
    );
    if (go !== 'Delegate') return fail('cancelled');
    const again = await authorizeScope();
    if (again && !again.ok) return fail(again.reason);

    try {
        const terminal = vscode.window.createTerminal({
            name: `Optimizer → ${adapter.name}`,
            cwd: deps.workspaceRoot.fsPath,
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
                deps.scheduleScan?.();
                sub.dispose();
            }
        });

        postMessage({ type: 'delegateResult', ok: true, adapterId: adapter.id, componentCount: task.componentCount });
    } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e);
        deps.log.error(`[Optimizer] Delegation failed: ${reason}`);
        fail(reason);
    }
}
