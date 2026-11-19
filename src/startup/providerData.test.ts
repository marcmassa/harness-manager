// FEAT-045 pre-review — the scheduler's scan gets the newest graph even when a
// webview's `ready` supersedes it (R8, R14), every graph change reaches the
// views (R3), and a reloaded webview is answered from the cache (R15).
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => {
    function any(): unknown {
        return new Proxy(function () { /* noop */ }, { get: (_t, p) => (p === 'then' ? undefined : any()), apply: () => any(), construct: () => any() as object });
    }
    const ns = (members: Record<string, unknown>) => new Proxy(members, { get: (t, p) => (p in t ? t[p as string] : any()) });
    return {
        workspace: ns({ workspaceFolders: [{ uri: { fsPath: '/w', path: '/w' } }] }),
        ...Object.fromEntries(['window', 'commands', 'Uri', 'EventEmitter', 'RelativePattern', 'Disposable', 'FileType', 'env', 'extensions', 'lm', 'version', 'ViewColumn', 'LanguageModelChatMessage', 'CancellationTokenSource'].map(n => [n, any()])),
    };
});

const { HarnessDashboardProvider } = await import('../HarnessDashboardProvider.js');
const { AdapterRegistry } = await import('../adapters/AdapterRegistry.js');

const log = { info() {}, warn() {}, error() {}, debug() {} };
const context = { subscriptions: [], workspaceState: { get: (_k: string, d: unknown) => d, update: async () => undefined, keys: () => [] } };
const graph = (id: string) => ({ graph: { nodes: [{ id, type: 'agent', label: id, metadata: {} }], edges: [] }, milestones: [] });

function make() {
    const provider = new HarnessDashboardProvider({ fsPath: '/ext', path: '/ext' } as never, { fsPath: '/w', path: '/w' } as never, context as never, log as never, new AdapterRegistry([], log as never));
    const releases: Array<() => void> = [];
    let parses = 0;
    (provider as unknown as { _parser: unknown })._parser = {
        parse: () => { parses += 1; const n = parses; return new Promise(r => releases.push(() => r(graph(`n${n}`)))); },
    };
    return { provider, releases, parses: () => parses };
}

describe('provider data (FEAT-045 pre-review)', () => {
    it('returns the newest graph when a later parse supersedes the scan, and tells the views', async () => {
        const { provider, releases } = make();
        const changed = vi.fn();
        provider.onResultsChanged(changed);
        const scan = provider.refresh();                                          // gen 1
        await Promise.resolve();
        const ready = (provider as unknown as { _sendDataTo(p: () => void): Promise<void> })._sendDataTo(() => undefined); // gen 2
        releases[0]();                                                            // gen 1 finishes first: dropped
        await new Promise(r => setTimeout(r, 0));
        releases[1]();
        await ready;
        const data = await scan;
        expect(data?.graph.nodes[0].id).toBe('n2');
        expect(changed).toHaveBeenCalledTimes(1);
    });

    it('answers a reloaded webview from the cache instead of parsing again', async () => {
        const { provider, releases, parses } = make();
        const first = provider.refresh();
        await Promise.resolve();
        releases[0]();
        await first;
        const posted: Array<{ type: string }> = [];
        await (provider as unknown as { _handleWebviewMessage(d: unknown, p: (m: unknown) => void): Promise<void> })
            ._handleWebviewMessage({ type: 'ready' }, m => { posted.push(m as { type: string }); });
        expect(parses()).toBe(1);
        expect(posted.find(m => m.type === 'init')).toBeDefined();
    });

    it('tells the views after every Optimizer scan, whoever started it', async () => {
        const { provider } = make();
        const changed = vi.fn();
        provider.optimizerCoordinator.setReportListener(changed);
        await provider.optimizerCoordinator.runScan();
        await provider.optimizerCoordinator.handle({ type: 'runOptimizerScan' } as never, () => undefined, async () => undefined);
        expect(changed).toHaveBeenCalledTimes(2);
    });
});
