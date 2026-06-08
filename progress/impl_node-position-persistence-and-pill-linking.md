# FEAT-017 Implementation Traceability — node-position-persistence-and-pill-linking
## Scope Delivered
- Added in-session manual node position persistence in `src/webview/WhiteboardCanvas.tsx` using a `manualPositionsRef` map keyed by node id.
- Wrapped node change handling to capture final drag coordinates and keep default React Flow node updates intact.
- Added merge/validation utilities in `src/webview/nodePositionUtils.ts` and applied them before rendering layouted nodes.
- Improved pill-based linking ergonomics in `src/webview/components/CustomNode.tsx` by increasing handle hit area and keeping `Handle` center alignment over the visible pills.
- Preserved existing edge creation flows (`onConnect`, `onAddSkill`, and suggestion acceptance) while reducing suggestion visual noise in parser/UI defaults.

## R<n> Coverage
- **R1**: `handleNodesChange` and `handleNodeDragStop` store final valid coordinates in `manualPositionsRef` (`src/webview/WhiteboardCanvas.tsx`).
- **R2**: Layout refresh merges Dagre output with persisted manual positions via `mergeLayoutedNodesWithManualPositions` before `setNodes` (`src/webview/WhiteboardCanvas.tsx`).
- **R3**: Nodes without manual positions keep Dagre coordinates by default in merge function (`src/webview/nodePositionUtils.ts`).
- **R4**: Invalid/stale coordinate entries are sanitized by `isValidNodePosition` checks and filtered map output (`src/webview/nodePositionUtils.ts`).
- **R5**: Source/target pills remain explicit connect affordance with centered hidden handles and larger interaction area (`src/webview/components/CustomNode.tsx`).
- **R6**: Existing `onConnect` pipeline remains canonical (`createEdge` postMessage + `addEdge` local update) in `WhiteboardCanvas.tsx`.
- **R7**: Invalid drag-drop path relies on React Flow cancellation semantics; `onConnect` only executes on valid connections, so no edge/persistence mutation on invalid drop.
- **R8**: Existing non-pill creation paths remain active: `onAddSkill` emits `createEdge` and suggestion acceptance uses `acceptSuggestion` conversion in `WhiteboardCanvas.tsx`.

## Tests
- `src/webview/nodePositionUtils.test.ts`
  - validates finite coordinate detection.
  - validates manual-over-layout merge behavior.
  - validates invalid/stale position fallback and sanitization.
- `src/parserLogic.test.ts`
  - verifies suggestion cap per subagent.
  - verifies cross-framework suggestion suppression.
- Validation
  - `npm test` — passed.
  - `npm run build` — passed.
  - `./check.sh` — passed.

## Key Files Changed
- `src/webview/WhiteboardCanvas.tsx`
- `src/webview/components/CustomNode.tsx`
- `src/webview/nodePositionUtils.ts`
- `src/webview/nodePositionUtils.test.ts`
- `src/webview/index.tsx`
- `src/parserLogic.ts`
- `src/parserLogic.test.ts`
- `src/semanticMatcher.ts`
- `src/harnessParser.ts`
