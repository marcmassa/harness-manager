// FEAT-045 T1 — wires the scan scheduler to the host (R12–R16).
// Constructing this registers listeners only: no file read, no process, no scan.
import * as vscode from 'vscode';
import type { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import type { AgenticDetector } from '../agentic-detector/agenticDetector.js';
import type { GraphContext } from '../agentic-detector/types.js';
import type { HarnessDashboardProvider } from '../HarnessDashboardProvider.js';
import { HARNESS_CONFIG_RELATIVE_PATH } from '../config/harnessConfig.js';
import { ScanScheduler, type DashboardState } from './scanScheduler.js';

/** Context key read by `viewsWelcome` and menus (FEAT-045 R8). */
export const STATE_CONTEXT_KEY = 'harnessDashboard.state';
/** The view that shows scan progress (R16). */
export const PROGRESS_VIEW_ID = 'harness-dashboard.sources';

export interface StartupDeps {
    context: vscode.ExtensionContext;
    log: vscode.LogOutputChannel;
    registry: AdapterRegistry;
    provider: HarnessDashboardProvider;
    agenticDetector: AgenticDetector;
    syncProfiles: () => Promise<void>;
    graphContext: () => GraphContext;
    progressViewId?: string;
    /** Called after every scan (the tree views refresh). */
    onScanned?: () => void;
}

export interface Startup {
    ensureScanned(): Promise<void>;
    refresh(): Promise<void>;
    onChange(): void;
    /** Providers registered or disposed: rebuild watchers, then treat as a change. */
    onProvidersChanged(): void;
    readonly scheduler: ScanScheduler;
}

export function createStartup(deps: StartupDeps): Startup {
    const { context, log, registry, provider, agenticDetector } = deps;
    let watchers: vscode.Disposable[] = [];
    let watching = false;

    const startWatchers = () => {
        watching = true;
        for (const w of watchers) w.dispose();
        const root = vscode.workspace.workspaceFolders![0].uri;
        const globs = new Set([...registry.watchGlobs(), ...agenticDetector.watchGlobs(), HARNESS_CONFIG_RELATIVE_PATH]);
        watchers = [...globs].map(glob => {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, glob));
            const changed = () => scheduler.onChange();
            watcher.onDidCreate(changed);
            watcher.onDidChange(changed);
            watcher.onDidDelete(changed);
            return watcher;
        });
        log.info(`[Startup] Watching ${globs.size} patterns after the first scan`);
    };

    const scheduler = new ScanScheduler({
        scan: async () => {
            await deps.syncProfiles();
            const data = await provider.refresh();
            await agenticDetector.scan(deps.graphContext());
            await provider.optimizerCoordinator.refresh(msg => provider.postToWebview(msg));
            deps.onScanned?.();
            return { empty: (data?.detectedProviders?.length ?? 0) === 0 };
        },
        startWatchers,
        setState: (state: DashboardState) => { void vscode.commands.executeCommand('setContext', STATE_CONTEXT_KEY, state); },
        withProgress: task => Promise.resolve(vscode.window.withProgress(
            { location: { viewId: deps.progressViewId ?? PROGRESS_VIEW_ID }, title: 'Scanning harness' },
            task,
        )),
        log: message => log.warn(message),
    });

    provider.setVisibilityListener((surface, visible) => scheduler.setVisible(surface, visible));
    context.subscriptions.push({ dispose: () => { scheduler.dispose(); for (const w of watchers) w.dispose(); } });

    return {
        scheduler,
        ensureScanned: () => scheduler.ensureScanned(),
        refresh: () => scheduler.refresh(),
        onChange: () => scheduler.onChange(),
        onProvidersChanged: () => {
            if (watching) startWatchers();
            scheduler.onChange();
        },
    };
}
