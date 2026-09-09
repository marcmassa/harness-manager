# Tasks — React Flow 12 & React 19 Migration

> FEAT-037 · release **0.8.1** (shared with FEAT-036 — version NOT bumped).
> Ordered; the implementer marks `[x]` per task. Every task cites its R<n>.
> Work on branch `feat/react-flow-12` (rollback plan: design §8). Do not mix
> changes from any other feature (AGENTS.md §3).

## Baseline

- [x] **T1** — Measure and record the pre-migration baseline: `npm test`
      (expect 773/56), `npm run package`, write the VSIX byte size into
      `.kiro/specs/react-flow-12-migration/size-report.md`. _(R1, R12)_

## Dependency swap

- [x] **T2** — `package.json`: remove `reactflow`, add `@xyflow/react@^12.11.6`,
      bump `react`/`react-dom` to `^19.0.0`; add devDependencies
      `@types/react@^19`, `@types/react-dom@^19`. Keep `version: "0.8.1"`.
      Run `npm install` and commit the lockfile diff. _(R2, R10, R13)_

## Import rewrite (design §2)

- [x] **T3** — Rewrite all 7 reactflow touchpoints to `@xyflow/react`:
      default→named `ReactFlow` import in `WhiteboardCanvas.tsx`; CSS path in
      `index.tsx`; type-only imports in `layoutUtils.ts`, `layoutUtils.test.ts`,
      `EdgeContextMenu.tsx`; `ReactFlowProvider` in `index.tsx`. Grep-verify
      zero remaining `reactflow` strings under `src/`. _(R2, R3)_

## Typing migration (design §5)

- [x] **T4** — Introduce `FlowNodeData` / `HarnessFlowNode` / `HarnessNodeProps`
      (small `src/webview/nodeTypes.ts`), re-type `CustomNode.tsx` and
      `DiscoveredNode.tsx` with generic `NodeProps<>`, `useNodesState<>` /
      `useEdgesState<>` / `NodeChange<>` generics in `WhiteboardCanvas.tsx`,
      and replace `as any` position casts in `layoutUtils.ts` with
      `Position.Top/Bottom`. Acceptance: zero NEW `tsc --noEmit` errors in the
      8 touched files (design §5 scope guard). _(R1, R2, R10)_

## Behavioral reconciliation (design §3, §4, §6)

- [x] **T5** — Add explicit `nodeDragThreshold={1}` to the `<ReactFlow>` JSX
      (decision + rationale in design §4). Verify pill stopPropagation still
      prevents drag takeover. _(R5, R6)_
- [x] **T6** — Reconciliation audit with tests: (a) no mutation-based
      `setNodes`/`setEdges` updates (design §3 #4 — add a pinning test);
      (b) confirm no code reads `edge.sourceHandle`/`targetHandle` or
      `node.width/height/measured` (grep evidence in PR); (c) z-index layering
      and per-type edge styling assertions for the 8 edge kinds. _(R1, R7)_

## Verification

- [x] **T7** — `npm run build` (esbuild) green with unchanged dist allowlist
      (`webview.js` + `webview.css` emitted). _(R2, R3)_
- [x] **T8** — `npm test`: ≥773 tests / 56 files pass, including the new
      source-contract and reconciliation tests. _(R1–R7, R10)_
- [x] **T9** — e2e: `npm run test:integration` (@vscode/test-electron,
      FEAT-021 critical path) passes on React 19 + Flow 12 with a clean
      console. _(R1, R11)_
- [x] **T10** — Manual checklist M1–M7 (design §10.4) inside the F5 VS Code
      host, light + dark themes; record results in `progress/current.md`.
      _(R1, R3–R9, R11)_
- [x] **T11** — Confirm no React Flow "styles not loaded" warning and no React
      19 deprecation warnings in the webview console (checklist M7 evidence).
      _(R4, R11)_

## Sizing & release governance

- [x] **T12** — Post-migration `npm run package`; append the after-size to
      `size-report.md`; assert < 300 KB (R12 gate — if exceeded, stop and
      report, do not proceed to closure). _(R12)_
- [x] **T13** — DESIGN.md §3/§4/§6 amendments to "React 19 + React Flow 12"
      — in-place replacements only, file stays ≤ 250 lines. _(R13)_
- [x] **T14** — Extend the existing `CHANGELOG.md` `[0.8.1]` section with the
      migration (### Changed subsection + updated summary line naming FEAT-036
      AND FEAT-037; **no new [0.9.0]**); consolidate README "What's new in
      0.8.1" to cover both features. Version remains 0.8.1. _(R13)_

## Closure

- [x] **T15** — Run `./check.sh` (must exit 0); set FEAT-037 to `"done"` in
      `feature_list.json`; move the session summary (including the
      R<n>↔test traceability table and size report numbers) into
      `progress/progress.md` and clear `progress/current.md`.
      _(R1–R13)_

## Closure record

T1–T15 complete on 2026-09-09. T9–T11 closed on the documented evidence:
automated proxies + e2e on cached 1.124.2 + **M1–M7 verified by the human in the
F5 host**; T12/R12 closed by explicit **human acceptance of the +27.2 KB
migration delta** with the pre-existing screenshot bloat deferred to a separate
asset-diet feature. FEAT-037 → `done` in `feature_list.json`.
