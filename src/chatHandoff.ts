// FEAT-035 — hand a prompt to the host editor's own chat agent.
//
// WHY THIS EXISTS
// `vscode.lm` is not the universal contract it looks like. Verified against the
// installed editors: Kiro runs on VS Code 1.94+ (so the API exists) but its
// bundled agent neither registers a chat-model provider nor consumes
// `selectChatModels` — it has entirely separate model plumbing, and exposes no
// extension API. So AI Refine, which needs a response back, cannot work there at
// all without the user supplying an API key.
//
// But every one of these editors already has the user logged in, with a model
// picked in its own UI. We do not need their model — we need their *chat input*.
// Pushing a prompt there costs no credentials, no configuration and no per-host
// model plumbing.
//
// THE TRADE, STATED PLAINLY
// Nothing comes back. This is strictly one-way: we place the prompt, the user
// drives from there. That makes it the *safest* of the three assisted modes —
// we never write a file — and the least automated. It is not a substitute for
// AI Refine where AI Refine works; it is what remains possible where it does not.

/** A host editor we know how to push a prompt into. */
export interface ChatHandoffAdapter {
    id: string;
    name: string;
    /** Probed at runtime against `vscode.commands.getCommands()`. */
    commandId: string;
    /**
     * Arguments for `executeCommand`. Pure, so the payload shape for each host
     * is pinned by tests rather than discovered in production.
     *
     * @param submit when true, ask the host to send the prompt immediately;
     *        when false, prefill its input and let the user read it first.
     */
    buildArgs(prompt: string, submit: boolean): unknown[];
}

/**
 * Ordered by specificity: a fork that ships its own agent is matched before the
 * generic VS Code chat action, because a Kiro or Cursor window may expose both
 * and the native one is the one the user is actually logged into.
 */
export const CHAT_HANDOFF_ADAPTERS: readonly ChatHandoffAdapter[] = [
    {
        id: 'kiro',
        name: 'Kiro',
        commandId: 'kiroAgent.focusChatInput',
        buildArgs(prompt, submit) {
            // Mirrors the payload Kiro's OWN editor actions build
            // (buildEditorActionPayload in its bundle):
            //   { prompt, reference, newSession: true, submit: autoSubmit ?? false }
            //
            // `newSession: true` is the part that matters. An earlier version sent
            // `{ prompt, clear: true }` — copied from a different call site — and
            // smoke testing showed it only landed when the chat input was already
            // empty: `clear` does not replace an in-progress draft in an existing
            // session. Starting a new session sidesteps that entirely, which is
            // exactly why Kiro's own actions do it.
            //
            // `reference` is omitted: it attaches an editor selection, and this
            // prompt already carries the component's full text.
            return [{ prompt, newSession: true, submit }];
        },
    },
    {
        id: 'vscode-chat',
        name: 'Editor chat',
        // VS Code's built-in chat action. `isPartialQuery: true` sets the input
        // without sending — see workbench.desktop.main.js:
        //   isPartialQuery ? (…, b.setInput(t.query)) : (… submit …)
        commandId: 'workbench.action.chat.open',
        buildArgs(prompt, submit) {
            return [{ query: prompt, isPartialQuery: !submit }];
        },
    },
];

/**
 * Pick the first adapter whose command the running host actually registers.
 *
 * Probing the live command list rather than sniffing the product name means an
 * unknown fork degrades to "no handoff offered" instead of throwing, and a fork
 * that later adds a known command starts working with no change here.
 */
export function selectChatAdapter(
    availableCommands: readonly string[],
    adapters: readonly ChatHandoffAdapter[] = CHAT_HANDOFF_ADAPTERS,
): ChatHandoffAdapter | undefined {
    const present = new Set(availableCommands);
    return adapters.find(a => present.has(a.commandId));
}
