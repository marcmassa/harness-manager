// ============================================================================
// harnessConfig.ts — FEAT-026 T1/T2
//
// Reads the local workspace configuration from
// `<workspace-root>/.harness-dashboard/config.json` and exposes a cached
// value that is invalidated when the file changes on disk.
//
// R2 — schema:
//   interface HarnessDashboardConfig {
//     adapters?: Record<string, { hooksPath?: string; steeringPath?: string }>;
//     extraPaths?: Record<string, { hooks?: string[]; steering?: string[] }>;
//   }
//
// R4 — Malformed JSON: log a one-line warning to the supplied OutputChannel
// and fall back to an empty config (the user fixes the file themselves).
//
// The file may not exist; the first call to `read()` simply returns an
// empty config. The companion command
// `Harness Dashboard: Open Local Configuration` creates the file with
// the empty schema the first time the user invokes it.
// ============================================================================

import * as vscode from 'vscode';

export interface HarnessDashboardConfig {
    /** Per-adapter overrides (relative to workspace root). */
    adapters?: Record<string, {
        /** Override the hooks directory for this adapter. */
        hooksPath?: string;
        /** Override the steering directory for this adapter. */
        steeringPath?: string;
    }>;
    /** Per-adapter extra discovery globs (relative to workspace root). */
    extraPaths?: Record<string, {
        hooks?: string[];
        steering?: string[];
    }>;
}

export const EMPTY_HARNESS_CONFIG: HarnessDashboardConfig = Object.freeze({});

export const HARNESS_CONFIG_RELATIVE_PATH = '.harness-dashboard/config.json';
export const HARNESS_CONFIG_DIR = '.harness-dashboard';

const EMPTY_CONTENT = '';

/**
 * Read-once, watcher-driven cache for the local config file. Production
 * code calls `read(root)` (which returns the cached value or loads the
 * file on first access for the given root). Test code can use
 * `invalidate()` to clear state between cases.
 *
 * The I/O path uses `vscode.workspace.fs.*` so that the existing test
 * `vi.mock('vscode')` pattern in the codebase continues to work without
 * a second mock layer. Reads are async (VS Code's API is async-only).
 */
export class HarnessConfig {
    private _cacheByRoot = new Map<string, HarnessDashboardConfig>();
    private _pendingByRoot = new Map<string, Promise<HarnessDashboardConfig>>();
    private _watchers: vscode.FileSystemWatcher[] = [];
    private _watchedRoots = new Set<string>();
    private readonly _listeners = new Set<() => void>();
    private _disposed = false;

    public constructor(private readonly _output: vscode.OutputChannel) {}

    /**
     * Read the local config for the given workspace root. Returns an
     * empty config when the file is missing, empty, or malformed (the
     * latter triggers a warning to the OutputChannel).
     */
    public async read(root: vscode.Uri): Promise<HarnessDashboardConfig> {
        if (this._disposed) return EMPTY_HARNESS_CONFIG;
        const key = root.fsPath;
        if (this._cacheByRoot.has(key)) {
            return this._cacheByRoot.get(key)!;
        }
        if (this._pendingByRoot.has(key)) {
            return this._pendingByRoot.get(key)!;
        }
        const load = this._loadFromDisk(root);
        this._pendingByRoot.set(key, load);
        try {
            const loaded = await load;
            this._cacheByRoot.set(key, loaded);
            this._ensureWatcher(root);
            return loaded;
        } finally {
            this._pendingByRoot.delete(key);
        }
    }

    /**
     * Subscribe to invalidation events. Called whenever the underlying
     * file changes on disk. The cache is cleared before listeners fire.
     */
    public onDidChange(listener: () => void): vscode.Disposable {
        this._listeners.add(listener);
        return new vscode.Disposable(() => { this._listeners.delete(listener); });
    }

    /**
     * Drop the cache for a given root. Tests use this to simulate a
     * file change without having to fire a real watcher event.
     */
    public invalidate(root?: vscode.Uri): void {
        if (root) {
            this._cacheByRoot.delete(root.fsPath);
            this._pendingByRoot.delete(root.fsPath);
        } else {
            this._cacheByRoot.clear();
            this._pendingByRoot.clear();
        }
        for (const l of this._listeners) {
            try { l(); } catch { /* swallow — listener errors must not break the cache */ }
        }
    }

    public dispose(): void {
        this._disposed = true;
        for (const w of this._watchers) w.dispose();
        this._watchers = [];
        this._watchedRoots.clear();
        this._cacheByRoot.clear();
        this._pendingByRoot.clear();
        this._listeners.clear();
    }

    // ----- internals -----

    private async _loadFromDisk(root: vscode.Uri): Promise<HarnessDashboardConfig> {
        const configUri = vscode.Uri.joinPath(root, HARNESS_CONFIG_RELATIVE_PATH);
        let bytes: Uint8Array;
        try {
            bytes = await vscode.workspace.fs.readFile(configUri);
        } catch {
            // File does not exist → empty config (R2).
            return EMPTY_HARNESS_CONFIG;
        }
        const text = Buffer.from(bytes).toString('utf8');
        if (text.trim() === EMPTY_CONTENT) {
            return EMPTY_HARNESS_CONFIG;
        }
        try {
            return JSON.parse(text) as HarnessDashboardConfig;
        } catch (e: any) {
            // R4: malformed JSON → warning + empty config. We do NOT
            // show a UI notification (the user is presumably editing
            // the file); the OutputChannel is enough.
            this._output.appendLine(
                `[HarnessConfig] Failed to parse ${HARNESS_CONFIG_RELATIVE_PATH}: ${e?.message ?? String(e)}. Falling back to empty config.`
            );
            return EMPTY_HARNESS_CONFIG;
        }
    }

    private _ensureWatcher(root: vscode.Uri): void {
        const key = root.fsPath;
        if (this._watchedRoots.has(key)) return;
        this._watchedRoots.add(key);
        const pattern = new vscode.RelativePattern(root, HARNESS_CONFIG_RELATIVE_PATH);
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const invalidate = () => this.invalidate(root);
        watcher.onDidChange(invalidate);
        watcher.onDidCreate(invalidate);
        watcher.onDidDelete(invalidate);
        this._watchers.push(watcher);
    }
}
