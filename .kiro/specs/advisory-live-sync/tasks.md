# Tasks — Advisory Live Sync

> Discrete steps in implementation order. Mark `[x]` on completion.
> Each task references the R<n> it covers.
> Groups A–D match the requirement groups in `requirements.md`.
> Phase 1 = Group A (T1–T6). Phase 2 = Groups B–D (T7–T22).

---

## Group A — Re-scan UI (Phase 1)

- [x] **T1** — Add `'rescanAgentic'` to `WebviewMessageType` union in `src/types.ts`; add it to `KNOWN_MESSAGE_TYPES` Set so the message guard accepts it; update `isKnownWebviewMessage` _(R1)_

- [x] **T2** — Add `case 'rescanAgentic'` to `AdvisoryCoordinator.handle()`: call `this._agenticDetector?.scan()` and return `true`; if no detector, return `true` silently _(R5)_

- [x] **T3** — Add `onRescan: () => void` and `isScanning: boolean` props to `AdvisoryPanelProps` in `src/webview/AdvisoryPanel.tsx`; add a Re-scan icon button (↻ or `$(refresh)` codicon) in the header bar next to the scan timestamp; disable it when `isScanning` is true _(R2)_

- [x] **T4** — Add scanning state to `AdvisoryPanel.tsx` header: show `<vscode-progress-ring>` and "Scanning…" text while `isScanning` is true; restore timestamp when `isScanning` is false _(R3)_

- [x] **T5** — Add `isAdvisoryScanning` state and `handleRescan` callback to `index.tsx`; wire `isAdvisoryScanning` to `true` on `rescanAgentic` post and back to `false` on next `advisoryProfile` receipt; pass `onRescan={handleRescan}` and `isScanning={isAdvisoryScanning}` to `<AdvisoryPanel>` _(R4)_

- [ ] **T6** — Manual smoke test: open Advisory tab, click Re-scan, verify button disables + spinner shows, verify profile updates after scan; also verify the empty state (no profile yet) shows the button correctly _(R2, R3, R4)_

---

## Group B — Shared Architecture State Bus (Phase 2)

- [x] **T7** — Add `GraphContext` interface and `ArchitectureSummary` interface to `src/agentic-detector/types.ts`; add `graphContext?: GraphContext` optional field to `AgenticProfile` _(R6, R9)_

- [x] **T8** — Update `AgenticDetector.scan()` signature to accept `graphContext?: GraphContext`; store it as `profile.graphContext` before passing the profile to `generate()`; keep existing behaviour when `graphContext` is absent _(R6)_

- [x] **T9** — Add `AgenticDetector.scheduleScan(graphContext?: GraphContext, debounceMs?: number): void` using the existing `_debounceTimer` field (same timer — whichever fires first wins, rapid bursts coalesce); document that file-watcher debounce (500 ms) and coordinator debounce (1000 ms default) share this timer _(R11, R12)_

- [x] **T10** — Add `getCachedData(): DashboardData | null` getter to `HarnessDashboardProvider`; add a private `buildGraphContext(): GraphContext` function in `extension.ts` that reads from the cached data to produce node/edge/feature counts _(R7)_

- [x] **T11** — Add `postToWebview(msg: unknown): void` helper to `HarnessDashboardProvider` that posts to whichever view is active (sidebar or full-window panel); replace the existing `sendAdvisoryProfile` usage with it + add `architectureSummary` broadcast in the `scanComplete` listener and at scan start _(R9)_

- [x] **T12** — Add two graph-aware suggestion rules to `src/agentic-detector/advisoryEngine.ts`: `S-GC01` (agents without skills) and `S-GC02` (sprint complete) as specified in `design.md`; ensure both guard on `!p.graphContext` _(R8)_

- [x] **T13** — Add `architectureSummary` case to the `handleMessage` switch in `src/webview/index.tsx`; add `architectureSummary` and `isAdvisoryScanning` state updated by this message _(R9, R10)_

- [x] **T14** — Create a `MaturityBadge` component in `src/webview/index.tsx` (~40 lines); render it in the tab strip header using `architectureSummary` state; show a pulsing indicator when `isScanning` is true; hide the badge when `architectureSummary` is null _(R10)_

---

## Group C — Post-write Re-evaluation (Phase 2)

- [x] **T15** — Update `WhiteboardCoordinator` constructor to accept an optional `scheduleScan?: () => void` callback; call `this._scheduleScan?.()` after all mutating operations: createNode, deleteNode, updateMetadata, createEdge, deleteEdge, confirmAndDeleteEdge, acceptSuggestion, toggleSkillConnection _(R11)_

- [x] **T16** — Update `SddCoordinator` constructor similarly; call `this._scheduleScan?.()` after createFeature, deleteFeature, saveSpecFile _(R12)_

- [x] **T17** — Update coordinator instantiation in `extension.ts` to wire the `scheduleScan` callback: `() => agenticDetector.scheduleScan(buildGraphContext(), 1000)` _(R11, R12)_

- [x] **T18** — Add `.kiro/specs/**` `FileSystemWatcher` to `AgenticDetector.startWatching()`; use the existing `_onFileChanged()` debounce handler (500 ms) _(R13)_

---

## Group D — Stale Data & Suggestion Fixes (Phase 2)

- [x] **T19** — Add stale scan detection to `AdvisoryPanel.tsx`: local `isStale` state, set via `useEffect` comparing `profile.scanTimestamp` to `Date.now()` (threshold: 120 000 ms); show an amber notice bar with "Results may be stale — re-scan now" and a dismiss ×; reset `isStale` when a new profile arrives or re-scan is triggered _(R14)_

- [x] **T20** — Consolidate suggestion dismissal in `AdvisoryCoordinator.handle()`: replace the direct `workspaceState` write with `await this._agenticDetector?.dismissSuggestion(sugId)`; remove the duplicate state write; `AgenticDetector.dismissSuggestion()` already calls `scan()` internally _(R15)_

---

## Closure

- [x] **T21** — Write or extend Vitest tests: (a) `agenticDetector.test.ts` — `scheduleScan()` coalesces two rapid calls into one; (b) `advisoryEngine.test.ts` — S-GC01 fires when `nodesByType.agent >= 2` and skill count is 0; S-GC02 fires when all features are done; both return false when `graphContext` is absent

- [x] **T22** — `npm test` all pass; `npm run build` zero errors; `./check.sh` green (adapter drift pre-existing, not FEAT-031); update `feature_list.json` status to `"done"`; log summary in `progress/progress.md`
