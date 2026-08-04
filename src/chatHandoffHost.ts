// Host-side half of the chat handoff.
//
// `chatHandoff.ts` stays pure — the adapter table and the selection rule are
// testable with plain fixtures. This file is the thin part that needs `vscode`:
// resolving the live command list and firing the command.
//
// It exists so the flow lives in ONE place. The optimizer panel and the SDD panel
// both hand prompts to the host chat, and a third caller is likely (the whiteboard
// node menu is the obvious next one). Each one re-implementing "resolve adapter →
// executeCommand → shape a result" would mean three chances to get the payload or
// the error handling subtly different — which is exactly how the `clear: true`
// defect survived: one call site copied from another.

import * as vscode from 'vscode';
import { selectChatAdapter, type ChatHandoffAdapter } from './chatHandoff.js';

export interface HandoffOutcome {
    ok: boolean;
    /** Display name of the host that received the prompt. */
    host?: string;
    reason?: string;
}

/** The adapter for the running host, or undefined if it exposes no known chat. */
export async function detectChatHost(): Promise<ChatHandoffAdapter | undefined> {
    try {
        return selectChatAdapter(await vscode.commands.getCommands(true));
    } catch {
        return undefined;
    }
}

/** Display name of the host's chat agent, for labelling a button. */
export async function detectChatHostName(): Promise<string | undefined> {
    return (await detectChatHost())?.name;
}

/**
 * Put `prompt` in the host editor's chat input.
 *
 * Defaults to prefilling rather than submitting: these prompts can carry a whole
 * component or spec template and are billed to the user's own account, so they
 * see the text before it is sent. Callers that genuinely want auto-send must ask
 * for it explicitly.
 */
export async function sendPromptToHostChat(
    prompt: string,
    opts: { submit?: boolean; log?: vscode.LogOutputChannel; context?: string } = {},
): Promise<HandoffOutcome> {
    const { submit = false, log, context = 'chat handoff' } = opts;

    if (!prompt) {
        return { ok: false, reason: 'could not build the prompt' };
    }

    const adapter = await detectChatHost();
    if (!adapter) {
        return { ok: false, reason: 'this editor exposes no chat command' };
    }

    try {
        await vscode.commands.executeCommand(adapter.commandId, ...adapter.buildArgs(prompt, submit));
        return { ok: true, host: adapter.name };
    } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e);
        log?.error(`[${context}] handoff to ${adapter.id} failed: ${reason}`);
        return { ok: false, host: adapter.name, reason };
    }
}
