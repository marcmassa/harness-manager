// FEAT-045 R17 — without a folder every contributed command resolves, and
// checkLM gets its real handler, not the "open a folder" message.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const handlers = new Map<string, unknown>();
const shown = vi.fn();
vi.mock('vscode', () => {
    function any(): unknown {
        return new Proxy(function () { /* noop */ }, { get: (_t, p) => (p === 'then' ? undefined : any()), apply: () => any(), construct: () => any() as object });
    }
    const ns = (members: Record<string, unknown>) => new Proxy(members, { get: (t, p) => (p in t ? t[p as string] : any()) });
    return {
        workspace: ns({ workspaceFolders: undefined, getConfiguration: () => ({ get: (_k: string, d: unknown) => d }) }),
        window: ns({ showInformationMessage: shown, createOutputChannel: () => ({ info() {}, warn() {}, dispose() {}, show() {} }) }),
        commands: ns({ registerCommand: (id: string, fn: unknown) => { handlers.set(id, fn); return { dispose() {} }; }, executeCommand: async () => undefined }),
        ...Object.fromEntries(['EventEmitter', 'Uri', 'lm', 'env', 'extensions', 'version', 'LanguageModelChatMessage', 'CancellationTokenSource'].map(n => [n, any()])),
    };
});

describe('activation without a folder (R17)', () => {
    it('registers every contributed command, checkLM with its real handler', async () => {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
        const { activate } = await import('../extension.js');
        activate({ subscriptions: [], extension: { packageJSON: pkg } } as never);
        for (const c of pkg.contributes.commands) expect(handlers.has(c.command), c.command).toBe(true);
        const { FOLDERLESS_MESSAGE } = await import('./folderless.js');
        (handlers.get('harness-dashboard.openDashboard') as () => void)();
        expect(shown).toHaveBeenCalledWith(FOLDERLESS_MESSAGE);
        shown.mockClear();
        expect(String(handlers.get('harness-dashboard.checkLM'))).not.toContain('FOLDERLESS_MESSAGE');
        void (handlers.get('harness-dashboard.checkLM') as () => Promise<void>)().catch(() => undefined);
        expect(shown).not.toHaveBeenCalledWith(FOLDERLESS_MESSAGE);
    });
});
