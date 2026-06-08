# Tasks — Node Position Persistence & Handle-Pill Linking (FEAT-017)

> Ordered implementation steps for `typescript-implementer`. Mark `[x]` when complete. Every task maps to one or more requirements.

---

## Implementation

- [x] **T1** — In `src/webview/WhiteboardCanvas.tsx`, introduce a `manualPositions` map (state or ref) keyed by node id and capture manual node coordinates from `onNodesChange` drag-position updates. _(R1)_

- [x] **T2** — Refactor node change handling so manual-position capture and default React Flow node updates both execute (wrapper around `onNodesChange`). _(R1, R2)_

- [x] **T3** — In the graph refresh effect, merge Dagre layout output with `manualPositions` before `setNodes`, preserving manually moved nodes and leaving unmoved nodes untouched. _(R2, R3)_

- [x] **T4** — Add defensive validation for manual coordinates (`Number.isFinite`, x/y existence) and stale-node cleanup logic so invalid entries never break render. _(R4)_

- [x] **T5** — In `src/webview/components/CustomNode.tsx`, keep source/target `Handle` center alignment coupled to visible pills and ensure cursor/hit-area semantics remain explicit for drag starts and drops. _(R5, R6, R7)_

- [x] **T6** — Verify `onConnect` integration in `WhiteboardCanvas.tsx` still emits exactly one `createEdge` message and one local edge add for successful pill drag connections. _(R6)_

- [x] **T7** — Confirm no-op behavior for invalid drops (outside target handle): no edge added and no persistence message sent. _(R7)_

- [x] **T8** — Validate that non-pill linking paths (`onAddSkill` and suggestion acceptance flow) remain unchanged and still create `uses` edges correctly. _(R8)_

## Tests

- [x] **T9** — Add unit tests for node position merge logic (manual position overrides Dagre; unmoved nodes keep Dagre; invalid values fallback). _(R2, R3, R4)_

- [x] **T10** — Add whiteboard interaction test (or equivalent unit contract) asserting successful pill drag invokes existing `onConnect` pipeline once. _(R5, R6)_

- [x] **T11** — Add test/assertion for aborted drag path ensuring no edge mutation and no `createEdge` persistence call. _(R7)_

- [x] **T12** — Add regression tests for `onAddSkill` and suggestion accept path to ensure FEAT-017 does not break prior linking flows. _(R8)_

## Closure

- [x] **T13** — Document traceability `R<n> ↔ test` in `progress/impl_node-position-persistence-and-pill-linking.md`.

- [x] **T14** — Run `./check.sh` and verify all checks pass.

- [x] **T15** — Update `feature_list.json` status for `FEAT-017` from `spec_ready` to `done` only after implementation + review.

- [x] **T16** — Append implementation summary to `progress/progress.md`.
