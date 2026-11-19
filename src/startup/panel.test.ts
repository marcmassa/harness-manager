// FEAT-045 T4 — one restorable editor panel (R5, R6, R20) and the manifest (R1, R12).
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const commands = new Map<string, (...a: unknown[]) => unknown>();
const serializers = new Map<string, { deserializeWebviewPanel(p: unknown, s: unknown): Promise<void> }>();
const panels: Array<{ options: Record<string, unknown>; reveal: ReturnType<typeof vi.fn>; html: string; posted: unknown[] }> = [];

function fakePanel(options: Record<string, unknown> = {}) {
    const posted: unknown[] = [];
    const webview = {
        options, html: '', cspSource: 'csp', asWebviewUri: (u: unknown) => u,
        onDidReceiveMessage: () => ({ dispose() {} }), postMessage: (m: unknown) => { posted.push(m); return Promise.resolve(true); },
    };
    const panel = { webview, visible: true, reveal: vi.fn(), onDidChangeViewState: () => ({ dispose() {} }), onDidDispose: () => ({ dispose() {} }), get html() { return webview.html; }, options, posted };
    Object.defineProperty(panel, 'options', { get: () => webview.options });
    panels.push(panel as never);
    return panel;
}

vi.mock('vscode', () => {
    function any(): unknown {
        return new Proxy(function () { /* noop */ }, {
            get: (_t, p) => (p === 'then' ? undefined : p === 'visible' ? false : p === 'dispose' ? () => undefined : any()),
            apply: () => any(), construct: () => any() as object,
        });
    }
    const ns = (members: Record<string, unknown>) => new Proxy(members, { get: (t, p) => (p in t ? t[p as string] : any()) });
    return {
        workspace: ns({ workspaceFolders: [{ uri: { fsPath: '/w', path: '/w', scheme: 'file', toString: () => 'file:///w' } }], isTrusted: true }),
        window: ns({
            createWebviewPanel: (_type: string, _title: string, _col: unknown, options: Record<string, unknown>) => fakePanel(options),
            registerWebviewPanelSerializer: (type: string, s: never) => { serializers.set(type, s); return { dispose() {} }; },
        }),
        commands: ns({ registerCommand: (id: string, fn: (...a: unknown[]) => unknown) => { commands.set(id, fn); return { dispose() {} }; }, executeCommand: async () => undefined }),
        Uri: ns({ joinPath: (b: { path: string }, ...p: string[]) => ({ path: [b.path, ...p].join('/'), fsPath: [b.path, ...p].join('/') }), file: (p: string) => ({ fsPath: p, path: p }) }),
        ViewColumn: { Beside: -2 },
        ...Object.fromEntries(['EventEmitter', 'RelativePattern', 'ThemeIcon', 'TreeItem', 'TreeItemCollapsibleState', 'Disposable', 'FileType', 'ProgressLocation', 'Position', 'Range', 'env', 'extensions', 'languages', 'lm', 'CancellationTokenSource', 'LanguageModelChatMessage', 'version'].map(n => [n, any()])),
    };
});

const context = { subscriptions: [] as unknown[], extensionUri: { fsPath: '/ext', path: '/ext' },
    workspaceState: { get: (_k: string, d: unknown) => d, update: async () => undefined, keys: () => [] }, globalState: { get: (_k: string, d: unknown) => d, update: async () => undefined } };

describe('editor panel (R5, R6)', () => {
    it('opens one panel and reveals it instead of creating another', async () => {
        const { activate } = await import('../extension.js');
        activate(context as never);
        await commands.get('harness-dashboard.openDashboard')!();
        await commands.get('harness-dashboard.openDashboard')!();
        expect(panels).toHaveLength(1);
        expect(panels[0].reveal).toHaveBeenCalledTimes(1);
        expect(panels[0].options.retainContextWhenHidden).toBeUndefined();
        expect(panels[0].options.enableScripts).toBe(true);
    });

    it('restores a panel through its serializer, on its saved tab', async () => {
        const serializer = serializers.get('harness-dashboard.fullDashboard');
        expect(serializer).toBeDefined();
        const restored = fakePanel();
        await serializer!.deserializeWebviewPanel(restored, { tab: 'optimizer' });
        expect(restored.webview.html).toContain('window.__harness_initial_tab = "optimizer"');
        expect(restored.webview.options).not.toHaveProperty('retainContextWhenHidden');
        const forged = fakePanel();
        await serializer!.deserializeWebviewPanel(forged, { tab: '"; alert(1); "' });
        expect(forged.webview.html).toContain('window.__harness_initial_tab = "whiteboard"');
    });
});

describe('manifest (R1, R12) and state keys (R20)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    it('contributes no webview view and activates only on the panel, views and commands', () => {
        expect(pkg.contributes.views['harness-dashboard'].some((v: { type?: string }) => v.type === 'webview')).toBe(false);
        expect(pkg.activationEvents).toEqual(['onWebviewPanel:harness-dashboard.fullDashboard']);
        for (const forbidden of ['*', 'onStartupFinished']) expect(pkg.activationEvents).not.toContain(forbidden);
        expect(pkg.activationEvents.some((e: string) => e.startsWith('workspaceContains'))).toBe(false);
    });

    it('keeps the workspace-state keys that hold positions, dismissals and disabled connections', () => {
        const src = readFileSync('src/HarnessDashboardProvider.ts', 'utf8');
        for (const key of ['harness-dashboard.dismissedSuggestions', 'harness-dashboard.disabledConnections']) expect(src).toContain(`'${key}'`);
        const relations = readFileSync('src/coordinators/viewRelations.ts', 'utf8');
        for (const key of ['harness-dashboard.customUsesEdges', 'harness-dashboard.customEdges']) expect(relations).toContain(`'${key}'`);
    });
});
