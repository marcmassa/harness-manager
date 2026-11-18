import { evidenceFromGraph } from './evidence.js';
import * as vscode from 'vscode';

import { EventEmitter } from './detectorEvents.js';
import { detectCLIInstalls, detectMethodology, supplyChainDeps } from './workspaceDetection.js';
import { SignalScanner } from './signalScanner.js';
import { classify } from './maturityClassifier.js';
import { analyze } from './patternAnalyzer.js';
import { generate } from './advisoryEngine.js';
import { resolveSourceUri } from '../adapters/sourceGraph.js';
import { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../adapters/index.js';
// FEAT-036: supply-chain layer — deterministic static scan + user-triggered audit.
import { scanWorkspace } from '../supply-chain/scanner.js';
import { runNpmAudit, type AuditRunResult } from '../supply-chain/auditRunner.js';
import { emptyReport, type AuditState, type SupplyChainReport } from '../supply-chain/types.js';
import type {
  AgenticProfile,
  GraphContext,
  MethodologyInfo,
} from './types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENTIC_DISMISSED_KEY = 'agenticDetector.dismissedSuggestionIds';
const AGENTIC_ACKNOWLEDGED_KEY = 'agenticDetector.acknowledgedNodeIds';

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



  /** Methodology from the previous scan, used to detect adoption transitions (T21/R58). */
  private _previousMethodology: MethodologyInfo | null = null;

  /**
   * FEAT-036 R7: session-only cache of the parsed JSON of the single
   * user-triggered `npm audit --json` run. Never persisted (non-goal),
   * never populated by scan() (R6).
   */
  private _auditPayload: unknown | null = null;

  /** FEAT-036: audit lifecycle state surfaced on the report. */
  private _auditState: AuditState = 'not-run';

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
    private readonly _registry = new AdapterRegistry(createDefaultAdapters(), _log),
  ) {
    super();

    this._scanner = new SignalScanner({
      rootUri: _workspaceRoot,
      findFiles: (include, exclude) =>
        vscode.workspace.findFiles(include, exclude),
      readFile: (uri) => vscode.workspace.fs.readFile(uri),
    });
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
      const native = await this._registry.parse(this._workspaceRoot);
      const sources = native.graph.nodes.flatMap(node => node.source ? [node.source] : []);
      const evidence = evidenceFromGraph(native.graph.nodes);
      const claimedFiles = new Set(native.graph.nodes.flatMap(node => {
        const uri = resolveSourceUri(this._workspaceRoot, node.metadata._filePath);
        return uri ? [uri.fsPath.replace(/\\/g, '/')] : [];
      }));
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
      const cliInstalls = await detectCLIInstalls(this._workspaceRoot);

      // ── Layer 3: Detect methodology ──
      const methodology = await detectMethodology(this._workspaceRoot);

      // ── FEAT-036: Supply-chain static scan ──
      // Reads ONLY workspace files plus the cached audit payload — it never
      // launches npm itself (R6). Failures degrade to an empty report so a
      // broken supply-chain layer can never error the whole scan (R2/R8).
      let supplyChain: SupplyChainReport;
      try {
        supplyChain = await scanWorkspace(
          supplyChainDeps(this._workspaceRoot),
          this._auditPayload,
          this._auditState,
        );
      } catch (err) {
        this._log.warn(`[AgenticDetector] Supply-chain scan degraded: ${err}`);
        supplyChain = emptyReport();
      }

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
        sources,
        evidence,
        supplyChain,
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
   * FEAT-036 R6/R7: Run `npm audit --json` exactly once as a bounded local
   * child process, cache the parsed payload in memory for the session, and
   * record the audit state. This method is the ONLY path that launches
   * npm; it must be called exclusively from an explicit user action
   * (AdvisoryCoordinator via panel button or command palette) — never from
   * scan(), activation, or file watchers.
   *
   * On any failure (spawn / timeout / parse) the state becomes
   * `unavailable` and audit-derived rules stay silent (R8). The caller is
   * responsible for scheduling the follow-up re-scan (R7).
   */
  async runAudit(): Promise<AuditRunResult> {
    const result = await runNpmAudit(this._workspaceRoot.fsPath);
    if (result.ok) {
      this._auditPayload = result.payload;
      this._auditState = 'captured';
      this._log.info('[AgenticDetector] npm audit payload captured (session-only cache).');
    } else {
      this._auditPayload = null;
      this._auditState = 'unavailable';
      this._log.warn(`[AgenticDetector] npm audit unavailable (reason: ${result.reason}).`);
    }
    return result;
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

    const globs = new Set([...this._scanner.getWatchGlobs(), ...this._registry.watchGlobs(), 'feature_list.json', '.kiro/specs/**']);
    for (const glob of globs) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this._workspaceRoot, glob));
      watcher.onDidCreate(() => this._onFileChanged());
      watcher.onDidChange(() => this._onFileChanged());
      watcher.onDidDelete(() => this._onFileChanged());
      this._watchers.push(watcher);
    }
    this._log.info(`[AgenticDetector] File watcher started (${globs.size} patterns)`);
  }

  /**
   * Stop all active file-system watchers and release their underlying
   * resources. Registered listeners are disposed.
   *
   * Safe to call when no watchers are active.
   */
  /** Rebuild active watchers after the provider set changed (FEAT-041 R6). */
  refreshWatching(): void {
    if (this._watchers.length === 0) return;
    this.stopWatching();
    this.startWatching();
  }

  stopWatching(): void {
    for (const watcher of this._watchers) {
      watcher.dispose();
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

}
