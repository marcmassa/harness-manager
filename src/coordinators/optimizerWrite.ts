// FEAT-035 T11 / FEAT-043 R5, R7 — the shared tail of every Optimizer write
// path: check → stage → diff → modal → recheck → write → rescan → clear.
//
// Extracted so the deterministic fixes and AI Refine cannot drift apart. This
// is the single place that enforces FEAT-034 R32 (nothing reaches disk before
// the user confirms) and FEAT-043 R5 (owner, permission and source version are
// revalidated after the confirmation, for every destination file).

import * as vscode from 'vscode';
import type { HarnessWriter } from '../harnessWriter.js';
import type { ComponentSource } from '../optimizer/types.js';
import type { OptimizerDiffProvider } from '../optimizer/optimizerDiffProvider.js';
import type { AuthorizeFn } from './WhiteboardCoordinator.js';
import { OPTIMIZER_DIFF_SCHEME } from './optimizerConfig.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;

export interface PreviewWriteOptions {
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
}

export interface PreviewWriteDeps {
    diffProvider: OptimizerDiffProvider;
    workspaceRoot: vscode.Uri;
    writer: HarnessWriter;
    readFile(rel: string): Promise<string | null>;
    authorize?: AuthorizeFn;
    scheduleScan?: () => void;
    log: vscode.LogOutputChannel;
}

const folderOf = (path: string) => path.split('/').slice(0, -1).join('/');

/**
 * A secondary file is the same owner's only when it stays in the component's
 * own folder: the reviewed edit then lands in one native layout, consistently.
 */
export function secondaryFileProblem(source: ComponentSource, relPath: string): string | null {
    const path = relPath.replace(/\\/g, '/');
    const folder = folderOf(source.filePath.replace(/\\/g, '/'));
    if (!path || path.startsWith('/') || path.split('/').includes('..')) return `secondary file ${relPath} escapes the workspace`;
    if (!folder || !path.startsWith(folder + '/')) return `secondary file ${relPath} is outside ${source.label}'s folder, so its owner cannot be confirmed`;
    // Only a folder-per-component format keeps a second file inside the component;
    // anywhere else the owner's adapter would scan it as a component of its own.
    if (!/(?:^|\/)(?:SKILL|SUBAGENT)\.md$/i.test(source.filePath)) return `${source.label}'s format has no per-component folder, so a second file would become a component of its own`;
    return null;
}

export async function previewAndWrite(opts: PreviewWriteOptions, deps: PreviewWriteDeps): Promise<void> {
    const { source, ruleId, content, extraFile, title, prompt, resultType, warnings, provider, postMessage } = opts;
    const fail = (reason: string) => postMessage({ type: resultType, ok: false, reason, ruleId, nodeId: source.nodeId });
    let virtualUri: vscode.Uri | undefined;

    try {
        // R7: reject before any side effect — a stale base or a foreign secondary file.
        const base = await deps.readFile(source.filePath);
        if (base === null || base !== source.raw) return fail('the file changed since the last scan — re-scan and try again');
        const secondary = extraFile ? secondaryFileProblem(source, extraFile.relPath) : null;
        if (secondary) return fail(secondary);

        virtualUri = vscode.Uri.parse(`${OPTIMIZER_DIFF_SCHEME}:/${source.nodeId}/${ruleId}.md`);
        deps.diffProvider.stage(virtualUri, content);

        const fileUri = vscode.Uri.joinPath(deps.workspaceRoot, ...source.filePath.split('/'));
        await vscode.commands.executeCommand('vscode.diff', fileUri, virtualUri, title);

        const detail = [
            ...(warnings ?? []),
            'The proposed content is shown in the diff editor. Nothing has been written yet.',
        ].join('\n\n');

        const choice = await vscode.window.showInformationMessage(prompt, { modal: true, detail }, 'Apply');
        if (choice !== 'Apply') return fail('cancelled');

        // R5: ownership, permission and version may all have changed while the modal was open.
        const again = await deps.authorize?.({ type: 'applyQuickFix', nodeId: source.nodeId });
        if (again && !again.ok) return fail(again.reason);
        if ((await deps.readFile(source.filePath)) !== base) return fail('the file changed while the preview was open — nothing was written');
        if (extraFile && (await deps.readFile(extraFile.relPath)) !== null) return fail(`${extraFile.relPath} appeared while the preview was open — nothing was written`);

        await deps.writer.writeFileAtPath(source.filePath, content);
        // extract-to-references is the only fix that produces a second file;
        // writing the trimmed component without it would lose the content.
        if (extraFile) await deps.writer.writeFileAtPath(extraFile.relPath, extraFile.content);

        deps.scheduleScan?.();
        postMessage({ type: resultType, ok: true, ruleId, nodeId: source.nodeId, provider });
    } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e);
        deps.log.error(`[Optimizer] ${resultType} ${ruleId} on ${source.nodeId} failed: ${reason}`);
        fail(reason);
    } finally {
        if (virtualUri) deps.diffProvider.clear(virtualUri);
    }
}
