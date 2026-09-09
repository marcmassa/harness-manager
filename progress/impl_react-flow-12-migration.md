# Implementation / review report — FEAT-037 react-flow-12-migration

Durable T16-style record: the R<n>↔evidence table for the React Flow 12 &
React 19 migration (release 0.8.1, shared with FEAT-036). Verified by
**reviewer-vscode** from source on 2026-09-09; human closed M1–M7 and the
R12 gate the same day.

Gates at closure: `npm test` **819/57** · `npm run build` green ·
e2e critical path PASSED (cached VS Code 1.124.2, React 19 + @xyflow/react
12.11.6 real render) · `./check.sh` exit 0 · full VSIX
1,871,439 B → 1,899,264 B (+27.2 KB; human-accepted, see size-report.md).

## R1–R13 ↔ evidence

| R | Requirement (short) | Evidence | Status |
|---|---------------------|----------|--------|
| R1 | Behavior parity (nodes/layout/edges) | 819 tests green incl. untouched layoutUtils geometry tests; e2e PASS; M1/M2/M4 live-verified by human | ✅ |
| R2 | @xyflow/react + React 19; zero reactflow refs | `reactFlow12Migration.test.ts`: zero-package-reference audit, named-import + package.json contract tests; reviewer grep: 0 hits; absent from lockfile | ✅ |
| R3 | v12 stylesheet bundled & applied | `index.tsx:26` import + dist css content test (`.react-flow__node` ×35, 85 `--xy-*` vars) | ✅ |
| R4 | No "styles not loaded" warning | stylesheet-in-bundle + webview HTML link; live console clean — human-verified (M7) | ✅ |
| R5 | FEAT-017 drag + persistence preserved | recording-rule pins; `handleNodesChange` type-only diff; e2e; human-verified (M2) | ✅ |
| R6 | Explicit `nodeDragThreshold={1}` | source pin at `WhiteboardCanvas.tsx:899` inside `<ReactFlow>`; pill stopPropagation sites verified unchanged; human-verified (M3) | ✅ |
| R7 | FEAT-016 edge styling + z-index layering | 8-edge-kind routing/stroke/dash/marker/animated tests + zIndex 1000/500/0 spread-only pin; human-verified (M4) | ✅ |
| R8 | Edge/node context menus unchanged | 6 real source-contract pins (commit c910d8b): onEdgeClick→menu state, `<ReactFlow onEdgeClick>` wiring, conditional `<EdgeContextMenu` render, menu→handler props; human-verified (M5) | ✅ |
| R9 | Suggestion accept/dismiss flows identical | same pins: `handleAcceptSuggestion` posts `{type:'acceptSuggestion', subagentId, skillId}` + menu close; `handleDismissSuggestion` posts `{type:'dismissSuggestion', …}`; human-verified (M5) | ✅ |
| R10 | React 19 runtime via createRoot; toolkit OK | package.json contract + createRoot pin; toolkit peer `react>=16.9` satisfied | ✅ |
| R11 | No console errors / React-19 removed APIs | `ReactDOM.render`=0 + `defaultProps`=0 audit tests; e2e host alive; live console — human-verified (M7) | ✅ |
| R12 | Size gate | size-report.md: +27.2 KB zipped delta; literal budget pre-breached at baseline by ~1.71 MB screenshots (fails on untouched main too); **human accepted, follow-up vsix-asset-diet opened** | ✅ (accepted) |
| R13 | Governance docs | DESIGN.md 249/250 lines (§3/§4/§6 → React 19 + Flow 12); CHANGELOG [0.8.1] names FEAT-036+037, ### Changed subsection, no [0.9.0]; README consolidated; version stays 0.8.1 | ✅ |

## Review deviations (all declared, all accepted)

1. `environment.d.ts` / `css.d.ts` added — React 19 typed JSX requires the
   `declare module 'react' { namespace JSX }` augmentation for the toolkit's
   web components and the CSS side-effect import.
2. `FitViewOptions.ease: 'ease-in-out'` removed — v12 types `ease` as a
   function; the string never resolved to a valid d3 ease and fell back to
   the default at runtime. Removal preserves observable behavior.
3. `edgeConfigs` exported — test-only visibility (precedent: EDGE_TYPE_ROUTING).
4. e2e executed against cached VS Code 1.124.2 — current stable (1.136.x)
   renames the darwin binary to `Code` while `@vscode/test-electron@2.5.2`
   spawns `Electron`; pre-existing infra issue, fails identically on main.
   Backlog item opened.
