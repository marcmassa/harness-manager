// FEAT-045 T4 — one restorable editor panel (R5, R6, R20) and the manifest (R1, R12).
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const commands = new Map<string, (...a: unknown[]) => unknown>();
const serializers = new Map<string, { deserializeWebviewPanel(p: unknown, s: unknown): Promise<void> }>();
const panels: Array<{ options: Record<string, unknown>; reveal: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; html: string; posted: unknown[]; webview: { html: string }; receive(m: unknown): Promise<void> | undefined }> = [];

function fakePanel(options: Record<string, unknown> = {}) {
    const posted: unknown[] = [];
    let handler: ((m: unknown) => Promise<void>) | undefined;
    const webview = {
        options, html: '', cspSource: 'csp', asWebviewUri: (u: unknown) => u,
        onDidReceiveMessage: (fn: (m: unknown) => Promise<void>) => { handler = fn; return { dispose() {} }; }, postMessage: (m: unknown) => { posted.push(m); return Promise.resolve(true); },
    };
    let onDispose: (() => void) | undefined;
    const panel = { webview, visible: true, reveal: vi.fn(), onDidChangeViewState: () => ({ dispose() {} }),
        onDidDispose: (fn: () => void) => { onDispose = fn; return { dispose() {} }; }, dispose: vi.fn(() => onDispose?.()),
        get html() { return webview.html; }, options, posted, receive: (m: unknown) => handler?.(m) };
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
        panels[0].dispose();
        const restored = fakePanel();
        await serializer!.deserializeWebviewPanel(restored, { tab: 'optimizer' });
        expect(restored.webview.html).toContain('window.__harness_initial_tab = "optimizer"');
        expect(restored.webview.options).not.toHaveProperty('retainContextWhenHidden');
        restored.dispose();
        const forged = fakePanel();
        await serializer!.deserializeWebviewPanel(forged, { tab: '"; alert(1); "' });
        expect(forged.webview.html).toContain('window.__harness_initial_tab = "whiteboard"');
    });

    it('keeps one panel when VS Code restores several from an older release', async () => {
        const serializer = serializers.get('harness-dashboard.fullDashboard')!;
        const extra = fakePanel();
        await serializer.deserializeWebviewPanel(extra, { tab: 'advisory' });
        expect(extra.dispose).toHaveBeenCalledTimes(1);
        expect(extra.webview.html).toBe('');
    });

    it('activates a requested tab once a hidden panel reloads and reports ready', async () => {
        const { HarnessDashboardProvider } = await import('../HarnessDashboardProvider.js');
        const { AdapterRegistry } = await import('../adapters/AdapterRegistry.js');
        const log = { info() {}, warn() {}, error() {}, debug() {} };
        const provider = new HarnessDashboardProvider(context.extensionUri as never, { fsPath: '/w', path: '/w' } as never, context as never, log as never, new AdapterRegistry([], log as never));
        const panel = fakePanel();
        provider.adoptPanel(panel as never);
        Object.assign(panel, { visible: false });
        await provider.openFullWindowPanel('optimizer');
        panel.posted.length = 0;                       // the reload drops what was posted before
        await panel.receive({ type: 'ready' });
        expect(panel.posted[0]).toEqual({ type: 'activateTab', tab: 'optimizer' });
        panel.posted.length = 0;
        await panel.receive({ type: 'ready' });
        expect(panel.posted.some(m => (m as { type: string }).type === 'activateTab')).toBe(false);
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
