// FEAT-035 — AI Refine provider call (R5–R13), extracted from
// OptimizerCoordinator. Only proposes text; the coordinator shows the diff
// and writes nothing before the user confirms.

import * as vscode from 'vscode';
import { createProviderChain, vscodeLmProvider, createOpenAiCompatibleProvider } from '../lmUtils.js';
import { buildRefineProviderOptions } from './optimizerConfig.js';
import { buildRefinePrompt } from '../optimizer/aiRefine.js';
import { sendPromptToHostChat } from '../chatHandoffHost.js';
import type { WebviewMessage } from '../types.js';
import type { ComponentSource, OptimizerFinding } from '../optimizer/types.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;

export interface HandoffDeps {
    assistAllowed(kind: 'ai' | 'delegate'): boolean;
    sources: readonly ComponentSource[];
    findings: readonly OptimizerFinding[];
    log: vscode.LogOutputChannel;
}

/** R12 — abandon a refine that has not returned in this long. */
const REFINE_TIMEOUT_MS = 30_000;

export type RefineResult =
    | { ok: true; text: string; provider: string }
    | { ok: false; error: string; reason: string };

export async function requestRefine(prompt: string, selectedFamily: string): Promise<RefineResult> {
    const cfg = vscode.workspace.getConfiguration('harness-dashboard');
    const apiKey = cfg.get<string>('ai.apiKey', '');
    const endpoint = cfg.get<string>('ai.endpoint', 'https://api.openai.com/v1/chat/completions');

    // See buildRefineProviderOptions: the editor's model families and the
    // HTTP provider's model names are different namespaces.
    const { chainOptions, httpOptions } = buildRefineProviderOptions({
        selectedFamily,
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
        chain.tryGenerate(prompt),
        new Promise<{ ok: false; error: string }>(resolve =>
            setTimeout(() => resolve({ ok: false, error: 'timed out after 30s' }), REFINE_TIMEOUT_MS),
        ),
    ]);
    if (result.ok) return { ok: true, text: result.text, provider: chain.name };

    // The chain reports only its LAST provider's error, so a missing API key
    // masks the more useful fact that the editor exposed no model at all. Say
    // what the user can actually act on.
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
    return { ok: false, error: result.error, reason };
}

// ── FEAT-035 — hand the prompt to the host's own chat agent ─────────────

export async function handoffToChat(msg: WebviewMessage, postMessage: PostMessageFn, deps: HandoffDeps): Promise<void> {
    const nodeId = msg.nodeId as string;
    const ruleId = msg.ruleId as string;
    const post = (r: { ok: boolean; host?: string; reason?: string }) =>
        postMessage({ type: 'handoffResult', ...r, ruleId, nodeId });

    if (!deps.assistAllowed('ai')) return post({ ok: false, reason: 'assisted fixes are disabled' });

    const source = deps.sources.find(s => s.nodeId === nodeId);
    const finding = deps.findings.find(f => f.ruleId === ruleId && f.nodeId === nodeId);
    if (!source || !finding) {
        return post({ ok: false, reason: 'component or finding not found — re-scan and try again' });
    }

    post(await sendPromptToHostChat(buildRefinePrompt({ source, finding }), {
        log: deps.log,
        context: 'Optimizer',
    }));
}
