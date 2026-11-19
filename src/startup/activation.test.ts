// FEAT-045 T1 (R11, R12, R13) — activate() registers and returns the API; it
// reads no workspace file, finds no files, starts no watcher or process, and
// opens no webview, walkthrough or notification.
import { describe, expect, it, vi } from 'vitest';

const effects: string[] = [];
const { spawnSpy, execSpy } = vi.hoisted(() => ({ spawnSpy: vi.fn(), execSpy: vi.fn() }));

vi.mock('child_process', async importOriginal => ({ ...(await importOriginal<object>()), spawn: spawnSpy, exec: execSpy, execFile: execSpy }));

vi.mock('vscode', () => {
    const recorded = (name: string) => (..._args: unknown[]) => { effects.push(name); return disposable(); };
    function disposable(): unknown {
        return new Proxy(function () { /* noop */ }, {
            get: (_t, p) => (p === 'then' ? undefined : p === 'dispose' ? () => undefined : p === 'visible' ? false : disposable()),
            apply: () => disposable(),
            construct: () => disposable() as object,
        });
    }
    const spied: Record<string, (...a: unknown[]) => unknown> = {
        'workspace.fs.readFile': recorded('fs.readFile'),
        'workspace.fs.stat': recorded('fs.stat'),
        'workspace.findFiles': recorded('findFiles'),
        'workspace.createFileSystemWatcher': recorded('createFileSystemWatcher'),
        'window.createWebviewPanel': recorded('createWebviewPanel'),
        'window.showInformationMessage': recorded('notification'),
        'window.showWarningMessage': recorded('notification'),
        'window.createTerminal': recorded('createTerminal'),
        'window.withProgress': recorded('withProgress'),
    };
    const node = (path: string): unknown => new Proxy(function () { /* noop */ }, {
        get: (_t, p) => {
            if (p === 'then') return undefined;
            if (typeof p === 'symbol') return undefined;
            const next = `${path}.${String(p)}`;
            if (next === 'workspace.workspaceFolders') return [{ uri: { fsPath: '/w', path: '/w', scheme: 'file', toString: () => 'file:///w' } }];
            if (next === 'workspace.isTrusted') return true;
            // Views start hidden: activation without a visible surface must not scan (R14).
            if (String(p) === 'visible') return false;
            if (spied[next]) return spied[next];
            if (next === 'commands.executeCommand') return (cmd: string) => { effects.push(`command:${cmd}`); return Promise.resolve(); };
            return node(next);
        },
        apply: () => disposable(),
        construct: () => disposable() as object,
    });
    // An object (vitest requires one) whose every member is a recording proxy.
    // An object (vitest requires named exports) whose every member is a recording proxy.
    const NAMES = ["CancellationToken", "CancellationTokenSource", "Disposable", "Event", "EventEmitter", "Extension", "ExtensionContext", "FileSystemWatcher", "FileType", "GlobPattern", "LanguageModelChat", "LanguageModelChatMessage", "LogOutputChannel", "Memento", "OutputChannel", "Position", "Range", "RelativePattern", "TabInputText", "Terminal", "TextDocumentContentProvider", "TextDocumentShowOptions", "ThemeColor", "ThemeIcon", "TreeDataProvider", "TreeItem", "TreeItemCollapsibleState", "Uri", "ViewColumn", "Webview", "WebviewPanel", "WebviewView", "WebviewViewProvider", "WebviewViewResolveContext", "WorkspaceConfiguration", "WorkspaceEdit", "commands", "diff", "extensions", "languages", "lm", "postMessage", "version", "window", "workspace"];
    return Object.fromEntries(NAMES.map(n => [n, node(n)]));
});

describe('activation (FEAT-045 R11–R13)', () => {
    it('does no scan, read, watch, launch or unsolicited UI', async () => {
        const { activate } = await import('../extension.js');
        const context = { subscriptions: [] as unknown[], extensionUri: { fsPath: '/ext', path: '/ext' }, workspaceState: { get: (_k: string, d: unknown) => d, update: async () => undefined, keys: () => [] }, globalState: { get: (_k: string, d: unknown) => d, update: async () => undefined } };
        const api = activate(context as never);
        await new Promise(r => setTimeout(r, 50)); // let any fire-and-forget work surface
        expect(api.apiVersion).toBe(1);
        expect(context.subscriptions.length).toBeGreaterThan(0);
        const forbidden = effects.filter(e => /^(fs\.|findFiles|createFileSystemWatcher|createWebviewPanel|notification|createTerminal|withProgress)/.test(e)
            || e === 'command:workbench.action.openWalkthrough');
        expect(forbidden).toEqual([]);
        expect(spawnSpy).not.toHaveBeenCalled();
        expect(execSpy).not.toHaveBeenCalled();
    });
});
