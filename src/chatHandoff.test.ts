import { describe, it, expect } from 'vitest';
import { CHAT_HANDOFF_ADAPTERS, selectChatAdapter } from './chatHandoff.js';

const kiro = 'kiroAgent.focusChatInput';
const code = 'workbench.action.chat.open';

describe('selectChatAdapter — runtime probing, not product sniffing', () => {
    it('returns undefined when the host exposes no known chat command', () => {
        // Antigravity: verified to ship 22 commands, none chat-related, because
        // its agent lives outside the extension host entirely.
        expect(selectChatAdapter(['antigravity.login', 'antigravity.copyApiKey'])).toBeUndefined();
    });

    it('picks Kiro when its native command is present', () => {
        expect(selectChatAdapter([kiro])?.id).toBe('kiro');
    });

    it('picks the built-in chat action in plain VS Code', () => {
        expect(selectChatAdapter([code])?.id).toBe('vscode-chat');
    });

    it('prefers the fork native agent over the generic action when both exist', () => {
        // A Kiro window may register both; the user is logged into Kiro's.
        expect(selectChatAdapter([code, kiro])?.id).toBe('kiro');
    });

    it('does not throw on an empty command list', () => {
        expect(selectChatAdapter([])).toBeUndefined();
    });
});

describe('buildArgs — payload shapes match each host', () => {
    const byId = (id: string) => CHAT_HANDOFF_ADAPTERS.find(a => a.id === id)!;

    it('Kiro takes { prompt, newSession, submit } — the shape its own actions use', () => {
        // Regression: `{ prompt, clear: true }` was copied from a different call
        // site and only landed when the chat input was empty. `clear` does not
        // replace an in-progress draft; `newSession` avoids the collision.
        expect(byId('kiro').buildArgs('hello', false))
            .toEqual([{ prompt: 'hello', newSession: true, submit: false }]);
    });

    it('Kiro honours the submit flag', () => {
        expect(byId('kiro').buildArgs('hello', true))
            .toEqual([{ prompt: 'hello', newSession: true, submit: true }]);
    });

    it('never sends clear, which does not do what it appears to', () => {
        for (const a of CHAT_HANDOFF_ADAPTERS) {
            expect(JSON.stringify(a.buildArgs('x', false))).not.toContain('clear');
        }
    });

    it('VS Code takes { query, isPartialQuery } and prefills when not submitting', () => {
        expect(byId('vscode-chat').buildArgs('hello', false))
            .toEqual([{ query: 'hello', isPartialQuery: true }]);
    });

    it('VS Code submits when asked to', () => {
        expect(byId('vscode-chat').buildArgs('hello', true))
            .toEqual([{ query: 'hello', isPartialQuery: false }]);
    });

    it('every adapter has a unique id and a command id', () => {
        const ids = CHAT_HANDOFF_ADAPTERS.map(a => a.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(CHAT_HANDOFF_ADAPTERS.every(a => a.commandId.length > 0)).toBe(true);
    });
});
