# FEAT-031 — Advisory Live Sync

> **Feature ID:** FEAT-031
> **Feature Name:** advisory-live-sync
> **Type:** feat
> **Priority:** P1
> **Sprint:** Next
> **Agent:** typescript-implementer

---

## Context

The Advisory panel currently operates in isolation. Its evaluation is based exclusively on a filesystem scan and has no awareness of the live in-memory state of the tool — the whiteboard graph, the SDD feature list, or the changes the user just made. This creates three honesty problems:

1. **Stale evaluation**: The panel shows a scan from when the extension opened. If the user adds nodes, saves specs, or creates features during the session, the advisory still reflects the old state.
2. **Blind suggestions**: The advisory engine does not know how many subagents, skills, or features exist in the whiteboard model. It may suggest "define agents" when 15 are already mapped, or suggest "add SDD governance" when 30 features are already tracked.
3. **Information silo**: The maturity level — the single most useful output of the advisory — is only visible when the user navigates to the Advisory tab. The rest of the UI is dark to this signal.

This feature delivers two phases:

- **Phase 1** — Add a visible Re-scan button inside the Advisory panel so the user can force re-evaluation at any point.
- **Phase 2** — Break the isolation bubble: wire all three panels (Whiteboard, SDD, Advisory) through a shared state bus so that any meaningful change (file save, node CRUD, feature lifecycle) triggers re-evaluation and the result is visible from any panel.

---

## A — Re-scan UI (Phase 1)

### R1 — Re-scan message type
- **Pattern:** Event
- `'rescanAgentic'` SHALL be added to `WebviewMessageType` in `src/types.ts` so it is a known, validated message type.

### R2 — Re-scan button in Advisory panel
- **Pattern:** Ubiquitous
- `AdvisoryPanel` SHALL render a "Re-scan" button in its header bar, next to the scan timestamp.
- The button SHALL be present at all times when the panel is rendered (regardless of whether a profile exists).

### R3 — Scanning state indicator
- **Pattern:** Ubiquitous
- While a scan is in progress, the "Re-scan" button SHALL be disabled and display a progress ring or spinner in place of its label.
- A "Scanning…" text indicator SHALL appear in the header timestamp area while the scan runs.

### R4 — `isScanning` prop flow
- **Pattern:** Ubiquitous
- `index.tsx` SHALL track a boolean `isAdvisoryScanning` state.
- `isAdvisoryScanning` SHALL be set to `true` when `rescanAgentic` is posted and back to `false` when the next `advisoryProfile` message is received.
- `AdvisoryPanel` SHALL receive `isScanning` and `onRescan` as props so it renders the correct state.

### R5 — Re-scan handler in AdvisoryCoordinator
- **Pattern:** Event
- `AdvisoryCoordinator.handle()` SHALL process `rescanAgentic` messages by calling `this._agenticDetector?.scan()`.
- If no detector is available, the message SHALL be silently no-op'd (no error thrown).

---

## B — Shared Architecture State Bus (Phase 2)

### R6 — GraphContext passed to scan
- **Pattern:** Ubiquitous
- `AgenticDetector.scan()` SHALL accept an optional `GraphContext` parameter:
  ```typescript
  interface GraphContext {
    nodeCount: number;
    nodesByType: Record<string, number>; // { agent: 3, skill: 5, ... }
    edgeCount: number;
    featureCount: number;
    featuresByStatus: Record<string, number>; // { done: 28, in_progress: 2, pending: 0 }
  }
  ```
- When provided, the context SHALL be stored on the profile as `profile.graphContext` and passed to `generate()` for graph-aware suggestion evaluation.

### R7 — Extension host provides GraphContext
- **Pattern:** Ubiquitous
- `HarnessDashboardProvider` SHALL build a `GraphContext` from the current parsed graph data (nodes, edges) and the feature list whenever a scan is triggered — both on initial activation and on re-scan requests.
- The `GraphContext` SHALL be derived from the already-in-memory `DashboardData`; it SHALL NOT require an additional filesystem parse.

### R8 — Graph-aware suggestions
- **Pattern:** Ubiquitous
- The advisory engine SHALL include at least two rules that use `GraphContext` when available:
  - `S-GC01` — If `nodesByType.skill === 0` and `nodesByType.agent >= 2`: suggest "Document your agents as reusable skill files".
  - `S-GC02` — If `featuresByStatus.done >= 10` and `featuresByStatus.in_progress === 0`: suggest "All features done — start a new sprint or archive the backlog".
- Rules SHALL degrade gracefully when `GraphContext` is absent (condition evaluates to `false`).

### R9 — Architecture summary message
- **Pattern:** Event
- After each scan, the extension SHALL post a lightweight `architectureSummary` message to the webview in addition to `advisoryProfile`:
  ```typescript
  {
    type: 'architectureSummary',
    maturityLevel: MaturityLevel,
    maturityLabel: string,
    maturityColor: string,
    activeSuggestions: number,
    scanTimestamp: number,
    isScanning: boolean,
  }
  ```
- This message SHALL also be sent with `isScanning: true` at the start of every scan, before the result is available.

### R10 — Maturity badge in tab strip header
- **Pattern:** Ubiquitous
- `index.tsx` SHALL maintain an `architectureSummary` state updated by the `architectureSummary` message.
- A maturity badge (level pill + colour) SHALL be rendered in the tab strip header, visible from all tabs (Whiteboard, Specs Manager, Advisory).
- The badge SHALL show a pulsing indicator while `isScanning` is true.

---

## C — Post-write Re-evaluation (Phase 2)

### R11 — Re-scan after whiteboard writes
- **Pattern:** Event
- After any `WhiteboardCoordinator` operation that mutates graph data (createNode, deleteNode, updateMetadata, createEdge, deleteEdge, confirmAndDeleteEdge, acceptSuggestion, toggleSkillConnection), the coordinator SHALL notify the extension to schedule a scan.
- The scan SHALL be debounced at 1000 ms to coalesce rapid edits (e.g., creating multiple nodes in quick succession).

### R12 — Re-scan after SDD writes
- **Pattern:** Event
- After `SddCoordinator` operations that change the feature lifecycle (createFeature, deleteFeature, saveSpecFile), the coordinator SHALL trigger the same debounced scan.

### R13 — SDD spec file watcher
- **Pattern:** Ubiquitous
- `AgenticDetector.startWatching()` SHALL add a `FileSystemWatcher` for `.kiro/specs/**` so that spec file changes made directly in the editor (outside the SDD panel) also trigger a re-scan.

---

## D — Stale Data & Suggestion Fixes (Phase 2)

### R14 — Stale scan notice
- **Pattern:** Event
- IF the advisory profile is older than 120 seconds AND the user navigates to the Advisory tab, THEN a non-blocking notice ("Results may be stale — click to re-scan") SHALL appear below the header until the next scan completes or the user dismisses it.

### R15 — Dismissal state consolidation
- **Pattern:** Ubiquitous
- The duplicate suggestion-dismissal logic between `AdvisoryCoordinator` (writing to `workspaceState` directly) and `AgenticDetector.dismissSuggestion()` SHALL be consolidated: `AdvisoryCoordinator` SHALL call `this._agenticDetector?.dismissSuggestion(id)` and remove its own `workspaceState` write.
- This ensures dismissed IDs are managed in a single place and the profile is re-generated immediately after dismissal.

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| "Re-scan" button visible in Advisory panel | R2 |
| Button disabled and shows spinner during scan | R3 |
| `isScanning` state synchronized between extension and webview | R4, R9 |
| `rescanAgentic` is a validated message type | R1, R5 |
| Advisory engine receives node/feature counts from whiteboard | R6, R7 |
| At least 2 graph-aware suggestion rules fire correctly | R8 |
| Maturity badge visible in tab strip from all tabs | R9, R10 |
| Any whiteboard or SDD write triggers re-evaluation within 1 s | R11, R12 |
| Editing a spec file in the editor triggers re-scan | R13 |
| Stale scan notice appears after 120 s of inactivity | R14 |
| Suggestion dismissal goes through a single code path | R15 |
