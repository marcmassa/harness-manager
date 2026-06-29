import * as vscode from 'vscode';

import { SignalScanner, EXCLUDED_GLOB_PATTERNS } from './signalScanner.js';
import { classify } from './maturityClassifier.js';
import { analyze } from './patternAnalyzer.js';
import { generate } from './advisoryEngine.js';
import { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../adapters/index.js';
import type {
  AgenticProfile,
  CLIInstall,
  GraphContext,
  MethodologyInfo,
} from './types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENTIC_DISMISSED_KEY = 'agenticDetector.dismissedSuggestionIds';
const AGENTIC_ACKNOWLEDGED_KEY = 'agenticDetector.acknowledgedNodeIds';

/**
 * Known CLI definitions for Layer-1 detection.
 * Each entry lists characteristic configuration file globs that signal
 * the presence of a particular agentic command-line tool.
 */
const CLI_DEFINITIONS: Array<{ id: string; name: string; patterns: string[] }> = [
  { id: 'claude-code',      name: 'Claude Code',      patterns: ['CLAUDE.md', '.claude/**'] },
  { id: 'cursor',           name: 'Cursor',            patterns: ['.cursorrules', '.cursor/**'] },
  { id: 'kiro',             name: 'Kiro',              patterns: ['kiro.json', '.kiro/**'] },
  { id: 'opencode',         name: 'OpenCode',          patterns: ['opencode.json', 'opencode.jsonc', '.opencode/**'] },
  { id: 'github-copilot',   name: 'GitHub Copilot',    patterns: ['.github/copilot-instructions.md'] },
  { id: 'continue',         name: 'Continue',          patterns: ['continue.json', '.continue/**'] },
  { id: 'windsurf',         name: 'Windsurf',          patterns: ['.windsurfrules'] },
  { id: 'codebuff',         name: 'Codebuff',          patterns: ['.codebuff/**'] },
];

// ─── Lightweight EventEmitter ───────────────────────────────────────────────
//
// The VS Code extension host provides full Node.js built-ins at runtime,
// including the 'events' module.  However, @types/node is not installed
// in this project.  We define a minimal EventEmitter here so the class
// compiles without a dependency on external type declarations.
//
// The VS Code extension host instantiates Node's EventEmitter under the
// hood via the JavaScript engine; this local class mirrors its API.

interface ListenerEntry {
  listener: (...args: any[]) => void;
  once: boolean;
}

/**
 * Minimal EventEmitter compatible with the Node.js API subset needed
 * by AgenticDetector (on, emit, removeAllListeners).
 */
class EventEmitter {
  private _events = new Map<string | symbol, ListenerEntry[]>();

  /** Register a permanent listener. */
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return this._addListener(event, listener, false);
  }

  /** Register a one-shot listener. */
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    return this._addListener(event, listener, true);
  }

  /** Emit an event to all registered listeners. */
  emit(event: string | symbol, ...args: any[]): boolean {
    const entries = this._events.get(event);
    if (!entries || entries.length === 0) return false;

    // Iterate over a snapshot so listeners can safely remove themselves
    // during emission.
    for (const entry of [...entries]) {
      entry.listener(...args);
    }

    // Sweep one-shot listeners after emission
    const remaining = (this._events.get(event) ?? []).filter(e => !e.once);
    if (remaining.length > 0) {
      this._events.set(event, remaining);
    } else {
      this._events.delete(event);
    }

    return true;
  }

  /** Remove all listeners, optionally for a specific event only. */
  removeAllListeners(event?: string | symbol): this {
    if (event !== undefined) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }

  // ── Private ──

  private _addListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
    once: boolean,
  ): this {
    const entries = this._events.get(event) ?? [];
    entries.push({ listener, once });
    this._events.set(event, entries);
    return this;
  }
}

// ─── AgenticDetector ─────────────────────────────────────────────────────────

/**
 * Singleton that orchestrates all three layers of agentic detection:
 *
 *   **Layer 1** – CLI install detection (config-file heuristics)
 *   **Layer 2** – Signal scanning (`SignalScanner` + `SignalCatalog`)
 *   **Layer 3** – Methodology detection (Harness SDD, custom SDD, etc.)
 *
 * Emits:
 *   - `'scanComplete'` with `(profile: AgenticProfile)` after every
 *      successful full scan
 *   - `'scanError'`    with `(error: Error)` when a scan fails
 *
 * The detector integrates a debounced file-system watcher so that any
 * relevant file change triggers an automatic re-scan after a 500 ms
 * quiet period.
 */
export class AgenticDetector extends EventEmitter {
  /** Cached profile from the last successful scan. */
  private _profile: AgenticProfile | null = null;

  /** Disposables owned by this instance (watchers, subscriptions). */
  private _disposables: vscode.Disposable[] = [];

  /** Active file-system watchers (one per unique watch glob). */
  private _watchers: vscode.FileSystemWatcher[] = [];

  /** Debounce timer handle for coalescing rapid file changes. */
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** GraphContext stored by the most recent scheduleScan() call, used by _onFileChanged()
   * so the file-watcher scan doesn't lose the context when it cancels the coordinator timer. */
  private _pendingGraphContext: GraphContext | undefined = undefined;

  /** Optional callback injected from extension.ts to build a fresh GraphContext
   * from the provider's cached dashboard data. Used by _onFileChanged() when
   * no coordinator has set a pending context (pure editor-side file changes). */
  private _getGraphContext?: () => GraphContext | undefined;

  /** The Layer-2 signal scanner instance, wired to VS Code workspace APIs. */
  private readonly _scanner: SignalScanner;

  /** Adapter registry for deduplicating files claimed by known adapter parsers (FEAT-015, FEAT-023). */
  private readonly _registry: AdapterRegistry;

  /** Methodology from the previous scan, used to detect adoption transitions (T21/R58). */
  private _previousMethodology: MethodologyInfo | null = null;

  /**
   * @param workspaceRoot   The root URI of the workspace to scan.
   * @param log             VS Code log output channel for diagnostic messages.
   * @param workspaceState  Optional memento for persisting dismissed
   *                        suggestion IDs across sessions.
   */
  constructor(
    private readonly _workspaceRoot: vscode.Uri,
    private readonly _log: vscode.LogOutputChannel,
    private readonly _workspaceState?: vscode.Memento,
  ) {
    super();

    this._scanner = new SignalScanner({
      rootUri: _workspaceRoot,
      findFiles: (include, exclude) =>
        vscode.workspace.findFiles(include, exclude),
      readFile: (uri) => vscode.workspace.fs.readFile(uri),
    });

    this._registry = new AdapterRegistry(createDefaultAdapters(), this._log);
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** Inject a callback to build GraphContext on demand (FEAT-031).
   * Called from _onFileChanged() when no pending context is available. */
  setGetGraphContext(fn: () => GraphContext | undefined): void {
    this._getGraphContext = fn;
  }

  /**
   * Perform a full three-layer scan of the workspace.
   *
   * **Steps:**
   * 1. Layer 2 – scan all 30 signal definitions via `SignalScanner`
   * 2. Layer 1 – detect CLI installs from known config-file heuristics
   * 3. Layer 3 – detect active methodology (Harness SDD, custom SDD, …)
   * 4. Classify maturity (`MaturityClassifier`)
   * 5. Analyse architecture patterns (`PatternAnalyzer`)
   * 6. Read previously-dismissed suggestion IDs from workspace state
   * 7. Generate suggestions (`AdvisoryEngine`) — uses graphContext when provided
   * 8. Cache the profile, emit `'scanComplete'`, return it
   *
   * On failure the method emits `'scanError'` *and* re-throws the error.
   */
  async scan(graphContext?: GraphContext): Promise<AgenticProfile> {
    try {
      this._log.info('[AgenticDetector] Starting scan…');

      // ── Layer 2: Scan all signal categories ──
      const categories = await this._scanner.scanAllCategories();

      // ── T20/R55: Deduplicate with existing adapters ──
      // Remove signal matches whose files are already claimed by known
      // adapter parsers. Adapter-detected nodes stay in Layer 1;
      // discovered nodes stay in Layer 2.
      const claimedFiles = await this._getAdapterClaimedFiles();
      if (claimedFiles.size > 0) {
        for (const cat of categories) {
          cat.matches = cat.matches.filter((m) => {
            const normalized = m.filePath.replace(/\\/g, '/');
            return !claimedFiles.has(normalized);
          });
          cat.count = cat.matches.length;
        }
        this._log.info(
          `[AgenticDetector] Filtered Layer-2 signals against ${claimedFiles.size} adapter-claimed file(s)`,
        );
      }

      // ── Layer 1: Detect CLI installations ──
      const cliInstalls = await this._detectCLIInstalls();

      // ── Layer 3: Detect methodology ──
      const methodology = await this._detectMethodology();

      // ── T21/R58: Emit methodology adoption events ──
      if (methodology.hasMethodology) {
        const wasSdd =
          this._previousMethodology?.methodologyName === 'Harness SDD' ||
          this._previousMethodology?.methodologyName === 'Custom SDD';
        if (!wasSdd) {
          this.emit('sddDetected');
        }
        if (
          this._previousMethodology?.methodologyName !== 'Harness SDD' &&
          methodology.methodologyName === 'Harness SDD'
        ) {
          this.emit('harnessDetected');
          this._log.info(
            `[AgenticDetector] Harness SDD adopted — re-classifying to L5`,
          );
        }
      }
      this._previousMethodology = methodology;

      // ── Build the base profile ──
      const layers: AgenticProfile['layers'] = {
        '1': { cliInstalls },
        '2': { categories },
        '3': { methodology },
      };

      // Build a provisional profile so we can call classify/analyse/generate.
      // classify() and analyse() only read profile.layers, so the dummy
      // maturity / patterns values are safe placeholders.
      const profile: AgenticProfile = {
        workspaceRoot: this._workspaceRoot.fsPath,
        scanTimestamp: 0,
        layers,
        maturity: { level: 'L0', label: '', description: '', color: '', nextLevel: null },
        patterns: [],
        suggestions: [],
        dismissedSuggestionIds: [],
        acknowledgedNodeIds: [],
        graphContext,
      };

      // ── Classify maturity level ──
      const maturity = classify(profile);
      profile.maturity = maturity;

      // ── Analyse architecture patterns ──
      const patterns = analyze(profile);
      profile.patterns = patterns;

      // ── Read dismissed suggestion IDs ──
      const dismissedIds = this.getDismissedSuggestionIds();

      // ── Generate suggestions ──
      const suggestions = generate(profile, new Set(dismissedIds));
      profile.suggestions = suggestions;
      profile.dismissedSuggestionIds = dismissedIds;

      // ── Finalise ──
      profile.scanTimestamp = Date.now();

      this._profile = profile;

      this._log.info(
        `[AgenticDetector] Scan complete – ` +
        `maturity=${maturity.level} ` +
        `(activeCategories=${categories.filter(c => c.count > 0).length}, ` +
        `patterns=${patterns.length}, ` +
        `suggestions=${suggestions.length})`,
      );

      this.emit('scanComplete', profile);
      return profile;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this._log.error(`[AgenticDetector] Scan error: ${err.message}`);
      this.emit('scanError', err);
      throw err;
    }
  }

  /**
   * Return the cached profile from the most recent successful scan,
   * or `null` if no scan has completed yet.
   */
  getProfile(): AgenticProfile | null {
    return this._profile;
  }

  /**
   * Schedule a debounced scan. Shares the existing `_debounceTimer` so
   * coordinator-triggered rescans coalesce with file-watcher-triggered ones.
   * The coordinator default (1000 ms) is intentionally longer than the
   * file-watcher debounce (500 ms) so rapid node edits don't thrash.
   */
  scheduleScan(graphContext?: GraphContext, debounceMs = 1000): void {
    this._pendingGraphContext = graphContext;
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      const ctx = this._pendingGraphContext;
      this._pendingGraphContext = undefined;
      this.scan(ctx).catch((err) => {
        this._log.error(`[AgenticDetector] Scheduled scan failed: ${err}`);
      });
    }, debounceMs);
  }

  // ── File watching ──────────────────────────────────────────────────────

  /**
   * Start a debounced file-system watcher that re-scans the workspace
   * when any file matching a watched glob is created, changed, or deleted.
   *
   * Glob patterns are obtained from `SignalScanner.getWatchGlobs()`, which
   * returns only non-content-pattern globs (to avoid watching overly broad
   * patterns).
   *
   * Safe to call multiple times – subsequent calls are no-ops while
   * watchers are already active.
   */
  startWatching(): void {
    if (this._watchers.length > 0) {
      return;
    }

    const globs = this._scanner.getWatchGlobs();
    for (const glob of globs) {
      const pattern = new vscode.RelativePattern(this._workspaceRoot, glob);
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidCreate(() => this._onFileChanged());
      watcher.onDidChange(() => this._onFileChanged());
      watcher.onDidDelete(() => this._onFileChanged());

      this._watchers.push(watcher);
      this._disposables.push(watcher);
    }

    // T21/R58: Watch for SDD methodology adoption — feature_list.json is not
    // covered by any signal catalog glob, so we add an explicit watcher.
    const featureListGlob = new vscode.RelativePattern(
      this._workspaceRoot,
      'feature_list.json',
    );
    const featureListWatcher =
      vscode.workspace.createFileSystemWatcher(featureListGlob);
    featureListWatcher.onDidCreate(() => this._onFileChanged());
    featureListWatcher.onDidChange(() => this._onFileChanged());
    featureListWatcher.onDidDelete(() => this._onFileChanged());
    this._watchers.push(featureListWatcher);
    this._disposables.push(featureListWatcher);

    // FEAT-031 T18: Watch spec files edited directly in the editor
    const specsGlob = new vscode.RelativePattern(
      this._workspaceRoot,
      '.kiro/specs/**',
    );
    const specsWatcher = vscode.workspace.createFileSystemWatcher(specsGlob);
    specsWatcher.onDidCreate(() => this._onFileChanged());
    specsWatcher.onDidChange(() => this._onFileChanged());
    specsWatcher.onDidDelete(() => this._onFileChanged());
    this._watchers.push(specsWatcher);
    this._disposables.push(specsWatcher);

    this._log.info(
      `[AgenticDetector] File watcher started (${globs.length + 2} patterns)`,
    );
  }

  /**
   * Stop all active file-system watchers and release their underlying
   * resources. Registered listeners are disposed.
   *
   * Safe to call when no watchers are active.
   */
  stopWatching(): void {
    for (const watcher of this._watchers) {
      watcher.dispose();
      const idx = this._disposables.indexOf(watcher);
      if (idx !== -1) {
        this._disposables.splice(idx, 1);
      }
    }
    this._watchers = [];
    this._log.info('[AgenticDetector] File watcher stopped');
  }

  // ── Suggestion dismissal ───────────────────────────────────────────────

  /**
   * Persistently dismiss a suggestion so it does not reappear on
   * subsequent scans. Triggers an immediate re-scan so the profile
   * reflects the updated suggestion set.
   *
   * No-op when `_workspaceState` is not available.
   */
  async dismissSuggestion(id: string): Promise<void> {
    if (!this._workspaceState) return;

    const dismissed = new Set(this.getDismissedSuggestionIds());
    dismissed.add(id);
    await this._workspaceState.update(AGENTIC_DISMISSED_KEY, Array.from(dismissed));
    this._log.info(`[AgenticDetector] Dismissed suggestion "${id}"`);

    await this.scan();
  }

  /**
   * Restore a previously dismissed suggestion so it may appear again.
   * Triggers an immediate re-scan.
   *
   * No-op when `_workspaceState` is not available.
   */
  async restoreSuggestion(id: string): Promise<void> {
    if (!this._workspaceState) return;

    const dismissed = new Set(this.getDismissedSuggestionIds());
    dismissed.delete(id);
    await this._workspaceState.update(AGENTIC_DISMISSED_KEY, Array.from(dismissed));
    this._log.info(`[AgenticDetector] Restored suggestion "${id}"`);

    await this.scan();
  }

  /**
   * Return the list of suggestion IDs that the user has dismissed.
   * When `_workspaceState` is not available the list is always empty.
   */
  getDismissedSuggestionIds(): string[] {
    if (!this._workspaceState) return [];
    return this._workspaceState.get<string[]>(AGENTIC_DISMISSED_KEY, []);
  }

  // ── Node acknowledgment (Phase 5 — T29) ────────────────────────────────

  /**
   * Mark a discovered node as acknowledged by the user, persisting the
   * decision in workspace state. The acknowledged status is used by the
   * whiteboard to show "✓" instead of "?" on discovered nodes.
   */
  async acknowledgeNode(id: string): Promise<void> {
    if (!this._workspaceState) return;

    const ackIds = new Set(this.getAcknowledgedNodeIds());
    ackIds.add(id);
    await this._workspaceState.update(AGENTIC_ACKNOWLEDGED_KEY, Array.from(ackIds));
    this._log.info(`[AgenticDetector] Acknowledged discovered node "${id}"`);
  }

  /**
   * Return whether a given node ID has been acknowledged.
   * When `_workspaceState` is not available the answer is always `false`.
   */
  isNodeAcknowledged(id: string): boolean {
    if (!this._workspaceState) return false;
    const ackIds = this._workspaceState.get<string[]>(AGENTIC_ACKNOWLEDGED_KEY, []);
    return ackIds.includes(id);
  }

  /**
   * Return the full list of acknowledged node IDs.
   */
  getAcknowledgedNodeIds(): string[] {
    if (!this._workspaceState) return [];
    return this._workspaceState.get<string[]>(AGENTIC_ACKNOWLEDGED_KEY, []);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Release all resources held by this detector:
   *   - Stop file watchers
   *   - Clear the debounce timer
   *   - Dispose all registered disposables
   *   - Remove all event listeners
   *   - Clear the cached profile
   *
   * After calling `dispose()` the instance must not be used for further
   * scans or watching without re-initialisation.
   */
  dispose(): void {
    this.stopWatching();

    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }

    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables = [];

    this.removeAllListeners();
    this._profile = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Debounced handler for file-system change events.
   * A 500 ms quiet-period coalesces multiple rapid file changes into a
   * single re-scan, preventing thrashing.
   */
  private _onFileChanged(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      // Re-use the pending graphContext set by scheduleScan() so that
      // file-watcher events don't lose the context when they cancel
      // the coordinator's debounce timer.
      const ctx = this._pendingGraphContext ?? this._getGraphContext?.();
      this._pendingGraphContext = undefined;
      this.scan(ctx).catch((err) => {
        this._log.error(`[AgenticDetector] Re-scan failed: ${err}`);
      });
    }, 500);
  }

  /**
   * Collect the set of absolute file paths that existing adapter parsers
   * (FEAT-015, FEAT-023) claim as their own. The AgenticDetector should
   * NOT double-tag these files in Layer-2 signals.
   *
   * Runs the full adapter parse, which calls `detect()` on each adapter
   * and collects all node `_filePath` metadata values. Relative paths
   * are resolved to absolute by prepending the workspace root.
   */
  private async _getAdapterClaimedFiles(): Promise<Set<string>> {
    try {
      const result = await this._registry.parse(this._workspaceRoot);
      const claimed = new Set<string>();
      const rootFs = this._workspaceRoot.fsPath.replace(/\\/g, '/');
      for (const node of result.graph.nodes) {
        const fp = node.metadata?._filePath;
        if (fp) {
          const normalized = fp.replace(/\\/g, '/');
          // Convert relative paths to absolute to match SignalMatch.filePath
          const absolute = normalized.startsWith('/')
            ? normalized
            : `${rootFs}/${normalized}`;
          claimed.add(absolute);
        }
      }
      return claimed;
    } catch {
      return new Set<string>();
    }
  }

  /**
   * Detect known agentic CLI installations by searching for their
   * characteristic configuration files in the workspace.
   *
   * Returns an empty array when no known CLI is detected.
   */
  private async _detectCLIInstalls(): Promise<CLIInstall[]> {
    const installs: CLIInstall[] = [];
    const exclude = `{${EXCLUDED_GLOB_PATTERNS.join(',')}}`;

    for (const cli of CLI_DEFINITIONS) {
      const foundFiles: string[] = [];

      for (const pattern of cli.patterns) {
        const uris = await vscode.workspace.findFiles(
          new vscode.RelativePattern(this._workspaceRoot, pattern),
          exclude,
          5,
        );
        for (const uri of uris) {
          foundFiles.push(uri.fsPath);
        }
      }

      if (foundFiles.length > 0) {
        installs.push({
          cliId: cli.id,
          cliName: cli.name,
          detectedBy: 'agentic-detector',
          configFiles: foundFiles,
          isActive: true,
          layer: 1,
        });
      }
    }

    return installs;
  }

  /**
   * Detect an active project methodology by checking for well-known
   * methodology configuration files.
   *
   * Currently supported:
   *   - **Harness SDD** (`.agents/agentic.json`)
   *   - **Custom SDD** (`feature_list.json`)
   *
   * Returns a "not active" `MethodologyInfo` when nothing is found.
   */
  private async _detectMethodology(): Promise<MethodologyInfo> {
    // Harness SDD
    const harnessConfig = await vscode.workspace.findFiles(
      new vscode.RelativePattern(this._workspaceRoot, '.agents/agentic.json'),
      undefined,
      1,
    );

    if (harnessConfig.length > 0) {
      return {
        hasMethodology: true,
        methodologyName: 'Harness SDD',
        methodologyVersion: null,
        configFile: harnessConfig[0].fsPath,
        isActive: true,
        layer: 3,
      };
    }

    // Custom / generic SDD (feature_list.json is the canonical entry point)
    const featureList = await vscode.workspace.findFiles(
      new vscode.RelativePattern(this._workspaceRoot, 'feature_list.json'),
      undefined,
      1,
    );

    if (featureList.length > 0) {
      return {
        hasMethodology: true,
        methodologyName: 'Custom SDD',
        methodologyVersion: null,
        configFile: featureList[0].fsPath,
        isActive: true,
        layer: 3,
      };
    }

    return {
      hasMethodology: false,
      methodologyName: null,
      methodologyVersion: null,
      configFile: null,
      isActive: false,
      layer: 3,
    };
  }
}
