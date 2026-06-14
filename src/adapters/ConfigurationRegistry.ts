import * as vscode from 'vscode';

/**
 * Default detection paths for configurable adapters.
 *
 * These are the canonical, well-known directories for each
 * agent framework. Adapters that opt in to path configuration
 * (`isPathConfigurable() === true`) use these defaults when
 * the user has not overridden the corresponding VS Code
 * setting.
 *
 * `harness-sdd` and `opencode` are intentionally absent:
 * their detection files (`.agents/agentic.json` and
 * `opencode.json`/`opencode.jsonc` respectively) are the
 * framework's own canonical entry points and must not be
 * remapped.
 */
const DEFAULT_PATHS: Record<string, string> = {
    'claude-code': '.claude',
    'cursor': '.cursor',
    'gemini-cli': '.gemini',
    'copilot': '.github',
    'windsurf': '.windsurf',
    'kiro': '.kiro',
};

const FALLBACK = ''; // sentinel: use the framework's own default

const CONFIG_SECTION = 'harness-dashboard';

/**
 * Process-wide singleton that exposes each adapter's
 * detection path to its runtime code.
 *
 * The registry is **lazy**: it reads the VS Code setting on
 * the first call and caches the value. If the user changes
 * the setting at runtime, VS Code fires an
 * `onDidChangeConfiguration` event, which the registry
 * listens to and invalidates the cache. So a runtime setting
 * change is reflected on the next parse (no restart needed).
 *
 * Lifecycle: constructed once at extension activation (in
 * `src/extension.ts` via `initConfigurationRegistry`).
 * Disposed in the extension's `deactivate()` hook.
 */
export class ConfigurationRegistry {
    private static _instance: ConfigurationRegistry | undefined;
    private _cache = new Map<string, string>();
    private _disposable: vscode.Disposable | undefined;
    private _log: vscode.OutputChannel | undefined;

    private constructor(log?: vscode.OutputChannel) {
        this._log = log;
        // Listen to setting changes at runtime; refresh the cache.
        this._disposable = vscode.workspace.onDidChangeConfiguration(
            (e) => {
                if (e.affectsConfiguration(`${CONFIG_SECTION}.adapters`)) {
                    this._cache.clear();
                }
            }
        );
    }

    /**
     * Return the process-wide singleton instance, constructing
     * it on first call.
     */
    public static getInstance(): ConfigurationRegistry {
        if (!ConfigurationRegistry._instance) {
            ConfigurationRegistry._instance = new ConfigurationRegistry();
        }
        return ConfigurationRegistry._instance;
    }

    /**
     * Construct the singleton with an OutputChannel for R6
     * warnings. Subsequent calls return the existing
     * instance. If a different `log` is passed, the channel
     * is updated on the existing instance.
     */
    public static init(log?: vscode.OutputChannel): ConfigurationRegistry {
        if (!ConfigurationRegistry._instance) {
            ConfigurationRegistry._instance = new ConfigurationRegistry(log);
        } else if (log) {
            ConfigurationRegistry._instance._log = log;
        }
        return ConfigurationRegistry._instance;
    }

    /**
     * Drop the singleton (used in tests to reset state between
     * cases). After this call, the next `getInstance()` returns
     * a fresh instance with an empty cache.
     */
    public static resetInstance(): void {
        if (ConfigurationRegistry._instance) {
            ConfigurationRegistry._instance.dispose();
            ConfigurationRegistry._instance = undefined;
        }
    }

    public dispose(): void {
        this._disposable?.dispose();
        this._disposable = undefined;
        this._cache.clear();
    }

    public isPathConfigurable(adapterId: string): boolean {
        return adapterId in DEFAULT_PATHS;
    }

    /**
     * Return the configured detection path for an adapter,
     * falling back to the framework's default if the user has
     * not configured it or if the configured value is empty.
     *
     * The lookup goes:
     *  1. cache (populated on the first call for this id)
     *  2. if `isPathConfigurable(adapterId) === false`,
     *     return FALLBACK (the adapter opted out — no
     *     setting is registered, no user-facing surface)
     *  3. `harness-dashboard.adapters.<id>.path` setting
     *  4. `DEFAULT_PATHS[adapterId]` if the setting is empty
     *     or absent
     */
    public getPathFor(adapterId: string): string {
        if (this._cache.has(adapterId)) {
            return this._cache.get(adapterId)!;
        }
        if (!this.isPathConfigurable(adapterId)) {
            // Adapters that opt out (e.g., `harness-sdd`,
            // `opencode`) have no surface registered with VS
            // Code's settings UI — return FALLBACK and skip the
            // setting read.
            this._cache.set(adapterId, FALLBACK);
            return FALLBACK;
        }
        const configured = vscode.workspace
            .getConfiguration(CONFIG_SECTION)
            .get<string>(`adapters.${adapterId}.path`, FALLBACK)
            .trim();
        const value = configured === '' || configured === FALLBACK
            ? DEFAULT_PATHS[adapterId] ?? FALLBACK
            : configured;
        this._cache.set(adapterId, value);
        return value;
    }

    /**
     * Return true iff the path exists on disk and is a
     * directory. Used by adapters' `detect()` to gracefully
     * skip a misconfigured path (R6).
     */
    public async isValidPath(uri: vscode.Uri, path: string): Promise<boolean> {
        if (path === '') return false;
        const target = vscode.Uri.joinPath(uri, path);
        try {
            const stat = await vscode.workspace.fs.stat(target);
            return stat.type === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }

    /**
     * Resolve a configured path with R6 semantics:
     *
     *  - If the user has not overridden the default, return
     *    the path as-is (no validation, no warning — the
     *    user is expected to potentially lack the directory
     *    if they don't use that framework).
     *  - If the user HAS overridden the default with a path
     *    that is invalid (does not exist or is not a
     *    directory), emit a one-line warning on the
     *    OutputChannel and fall back to the framework's
     *    default path.
     *
     * Used by adapters' `detect()` and `parse()` methods.
     */
    public async resolvePath(adapterId: string, rootUri: vscode.Uri): Promise<string> {
        const path = this.getPathFor(adapterId);
        const defaultPath = DEFAULT_PATHS[adapterId] ?? FALLBACK;
        const isUserOverride = path !== defaultPath;

        if (!isUserOverride) {
            return path;
        }

        if (await this.isValidPath(rootUri, path)) {
            return path;
        }

        if (this._log) {
            this._log.appendLine(
                `[ConfigurationRegistry] Configured path '${path}' for adapter '${adapterId}' does not exist or is not a directory; using default detection ('${defaultPath}').`
            );
        }
        return defaultPath;
    }
}

/**
 * Construct (or return the existing) singleton with an
 * OutputChannel. Convenience for `extension.ts`, which calls
 * this early in `activate()`.
 */
export function initConfigurationRegistry(log?: vscode.OutputChannel): ConfigurationRegistry {
    return ConfigurationRegistry.init(log);
}
