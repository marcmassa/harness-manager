# Design — React Flow 12 & React 19 Migration

> FEAT-037. shares release **0.8.1** with FEAT-036 (supply-chain-health).
> Version is NOT bumped. This design is constrained by DESIGN.md §2 and §6.

## 1. Verified facts (measured, not assumed)

| Fact | Value | How verified |
|---|---|---|
| Current graph lib | `reactflow@^11.11.4` (installed range in `package.json#dependencies`) | `package.json:349`, `npm view reactflow version` → 11.11.4 |
| Target package | **`@xyflow/react@12.11.6`** (current stable 12.11.x) | `npm view @xyflow/react version` |
| @xyflow/react peerDependencies | `react >=17`, `react-dom >=17`, `@types/react >=17`, `@types/react-dom >=17` | `npm view @xyflow/react peerDependencies` — **React 19 satisfies all four** |
| React today | `react@^18.2.0`, `react-dom@^18.2.0` (dependencies) | `package.json:347-348` |
| webview-ui-toolkit peer | `react >=16.9.0` — satisfied by React 19 (it is web-components based; the peer is nominal) | `npm view @vscode/webview-ui-toolkit peerDependencies` |
| Import surface | **7 files**: `WhiteboardCanvas.tsx`, `index.tsx`, `layoutUtils.ts`, `layoutUtils.test.ts`, `components/CustomNode.tsx`, `components/DiscoveredNode.tsx`, `components/EdgeContextMenu.tsx` | `grep -rln reactflow src/` |
| Named imports used | `ReactFlow` (default), `ReactFlowProvider`, `Background`, `Controls`, `useNodesState`, `useEdgesState`, `addEdge`, `useReactFlow`, `MarkerType`, `SelectionMode`, `Position`, `Handle`, and types `Node`, `Edge`, `Connection`, `NodeProps`, `NodeChange` | grep of the 7 files |
| `@types/react` / `@types/react-dom` | **NOT installed** — `tsc --noEmit` currently reports 2 364 error lines (JSX implicit-any etc.); no build script runs `tsc` (build = esbuild only) | `npm ls @types/react` → empty; `npx tsc --noEmit` |
| Test baseline | 773 tests / 56 files green; `check.sh` green | `npm test` this session |
| Official codemod | **None exists** — `@xyflow/upgrade`, `@xyflow/codemod`, `@xyflow/codemods`, `xyflow-upgrade` all 404 on npm (checked 2026-09-09) | `npm view …` |
| v12 breaking-change list | Migration guide fetched and applied (see §3) | reactflow.dev/learn/troubleshooting/migrate-to-v12 |

## 2. Per-file migration mapping (v11 → v12)

| File | v11 usage | v12 change | Risk |
|---|---|---|---|
| `src/webview/index.tsx` | `import { ReactFlowProvider } from 'reactflow'` (L4); `import 'reactflow/dist/style.css'` (L24); `createRoot` from `react-dom/client` (L2, **already 19-safe**) | `import { ReactFlowProvider } from '@xyflow/react'`; `import '@xyflow/react/dist/style.css'` | Low |
| `src/webview/WhiteboardCanvas.tsx` | **default** `import ReactFlow, {...} from 'reactflow'` (L2-14) | **named** `import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, useReactFlow, MarkerType, SelectionMode } from '@xyflow/react'` + type imports `Node`, `Edge`, `Connection`, `NodeChange` | Medium (single biggest file) |
| `src/webview/layoutUtils.ts` | `import { Node, Edge } from 'reactflow'` | Same names from `@xyflow/react` | Low |
| `src/webview/layoutUtils.test.ts` | `import type { Node, Edge } from 'reactflow'` | Same names | Low |
| `src/webview/components/CustomNode.tsx` | `import { Handle, Position, NodeProps } from 'reactflow'`; `({id,data,type,selected}: NodeProps)` | `Handle`, `Position` unchanged; **`NodeProps` becomes generic** → `NodeProps<HarnessFlowNode>` with typed `data` (see §5) | Medium |
| `src/webview/components/DiscoveredNode.tsx` | same pattern | same treatment | Medium |
| `src/webview/components/EdgeContextMenu.tsx` | `import type { Edge } from 'reactflow'` | `type { Edge } from '@xyflow/react'` (v12 `Edge` is generic with a compatible default) | Low |

No other file touches the library. `package.json` scripts, `tsconfig.json`
(`jsx: react-jsx` — unchanged) and the whole extension host (`src/*.ts`
outside `webview/`) are untouched.

## 3. Breaking-change applicability matrix

Each official v12 breaking change, judged against **this** codebase:

| # | v12 change | Touches us? | Action |
|---|---|---|---|
| 1 | Package rename + named imports + new style path | **Yes** | §2 table; R2, R3 |
| 2 | Measured dims move to `node.measured.width/height` | **No** | Verified: `grep -rn "\.measured\|node\.width\|node\.height" src/webview/` → **0 hits**. `layoutUtils.ts` lays out with its own constants (`nodeWidth = 200`, `nodeHeight = 80`, L3-4) and never reads measured values. The "biggest v12 change" is inert here. |
| 3 | `node.width/height` now SET inline styles | **Conditional** | We never set `node.width`/`node.height`; nodes carry only `position` + `data`. Rule: **do not** start persisting dimensions into node objects; manual-position persistence (FEAT-017) stores `{x,y}` only (`nodePositionUtils`). Pinned by review + R1 layout tests. |
| 4 | No object-mutation updates | **Audit passed** | Every `setNodes`/`setEdges` callback in `WhiteboardCanvas.tsx` uses spread (`{...n, ...}`). The one mutation site is `layoutUtils.layoutRank()` writing `n.position`/`n.targetPosition` — on node objects **created fresh in the same effect** (L506-556) and never yet handed to React Flow. Legal under v12. Regression test added (T6) to pin the no-mutation invariant of the update path. |
| 5 | `onEdgeUpdate` → `onReconnect` | No | We never use edge-update props. |
| 6 | `parentNode` → `parentId` | No | No subflows; provider sectors are an SVG overlay sibling (L920-963), deliberately not custom nodes. |
| 7 | NodeProps `xPos/yPos` → `positionAbsoluteX/Y` | No | Custom nodes destructure only `id, data, type, selected`. |
| 8 | Handle state class renames (`connecting` → `connectingto/from`, `valid`) | No | Verified: our CSS overrides (inline `<style>` in `index.tsx` ~L1576-1730) target only `.react-flow__controls*`, `.react-flow__node*`, `.react-flow__edge-path`, `.harness-*` — none of the renamed handle-state classes. |
| 9 | `getNodesBounds` options | No | Not imported. |
| 10 | Generic `Node<NodeData, NodeType>` typing style | **Yes** | §5. |
| 11 | `nodeInternals` → `nodeLookup` | No | We never use `useStore` (comment at L917-919 says it crashed v11 for us). |
| 12 | Removed deprecated functions (`project`, `getRectOfNodes`, …) | No | None imported. |
| 13 | New "replace" change event in custom appliers | No | We use the stock `useNodesState`/`useEdgesState`; our `handleNodesChange` (L456-476) only inspects `remove` and `position` changes — both unchanged in v12 (`change.dragging`, `change.position` keep semantics). |
| + | `nodeDragThreshold` default **0 → 1** | **Yes** | §4 decision. |
| + | Edge z-index changes no longer remount; no `sourceHandle:null/targetHandle:null` on new edges | **Yes (favorably)** | §6. |
| + | v12 warns when styles not loaded | **Yes** | R3/R4. |
| + | v12 uses CSS variables + built-in dark mode (`colorMode` prop) | Minimal | We override via VS Code theme variables on existing stable class names; `colorMode` is NOT adopted (out of scope, would fight our theme integration). |
| + | `onMove` also fires for library-invoked viewport updates (fitView) | Minor | Our `onMove` just mirrors viewport into state for the SVG sector overlay — extra fires are harmless and actually **more correct** (overlay stays in sync after `fitView`). |
| + | Selection box capture while dragging out | Free improvement | No action. |
| + | `deleteKeyCode` / `nodesDraggable` / `elementsSelectable` / `selectionMode` / `connectionLineStyle` / `isValidConnection` / `defaultEdgeOptions` / `fitViewOptions` | Unchanged props | All our JSX props survive v12 with identical names. |

## 4. `nodeDragThreshold` — the decision (R6)

**Decision: adopt the v12 default — pass `nodeDragThreshold={1}` explicitly.**

Rationale:

- v11's default (0) starts a drag on any mousedown over a node, so a click
  with even 1 px of pointer jitter ends as a "drag" and — because our
  `handleNodesChange` records every non-dragging position change into
  `manualPositionsRef` (L465-474) — nudges the node and **persists** that
  nudge as a manual position. With hundreds of clicks over a session this
  silently corrupts the auto-layout. Threshold 1 makes
  press–move<1px–release a pure click: selection (`onNodeClick`) still fires,
  no position change is emitted.
- The pill-based linking UX (FEAT-017 handle pills) is unaffected: pill
  `onPointerDown` handlers call `event.stopPropagation()` (verified in
  `CustomNode.tsx` L666-667 and 4 other sites), so React Flow's drag
  machinery never sees those gestures at any threshold value.
- Setting the prop **explicitly** (instead of relying on the default)
  documents the intent and pins it against upstream default changes — the
  same way `deleteKeyCode={null}` is already explicit.
- Discarded: explicitly setting `0` to "preserve v11 feel" — it would
  re-introduce the jitter-nudge persistence bug the v12 default fixes, and
  1 px is imperceptible to intentional drags (verified acceptable against
  FEAT-017's persistence flow, which only consumes final positions).

## 5. Typing migration

v12's `NodeProps` is generic: `NodeProps<NodeType extends Node>` with
`data: NodeType['data']` constrained to `Record<string, unknown>`. Today's
`NodeProps` (v11, `data: any`) keeps `CustomNode`/`DiscoveredNode` compiling
loosely.

Plan (per the v12 TypeScript guide):

```ts
// src/webview/nodeTypes.ts (new, small)
import type { Node } from '@xyflow/react';
export interface FlowNodeData extends Record<string, unknown> {
    label: string;
    metadata: NodeMetadata;            // FEAT-030 discriminated union from src/types.ts
    // …the rest of the data bag WhiteboardCanvas builds at L528-553
    [key: string]: unknown;
}
export type HarnessFlowNode = Node<FlowNodeData>;
export type HarnessNodeProps = NodeProps<HarnessFlowNode>;
```

- `CustomNode` / `DiscoveredNode`: `(props: HarnessNodeProps)` — `data.label`,
  `data.metadata._framework` (used by `providerOf` in `layoutUtils.ts`) flow
  through the union without `as any` at the read sites we control.
- `useNodesState<HarnessFlowNode>([])`, `useEdgesState<Edge>([])`,
  `NodeChange<HarnessFlowNode>` in `handleNodesChange`.
- The `targetPosition = 'top' as any` casts in `layoutUtils.ts` become
  `Position.Top` / `Position.Bottom` (the `as any` existed only because
  v11's narrowing was awkward).
- **Scope guard:** the repo does not type-check the webview today (2 364
  `tsc` errors, no `tsc` gate in build or check.sh). We **add
  `@types/react@^19` + `@types/react-dom@^19` as devDependencies** (required
  by @xyflow/react's peer types) but do **not** turn on a full `tsc` gate in
  this feature — that is a separate backlog-sized effort. Acceptance proxy:
  the 7 migrated files must introduce **zero new** `tsc` errors relative to
  their pre-migration count in their own file set.

## 6. Edge behavior reconciliation (FEAT-016)

- **z-index layering**: `edgesWithZIndex` (L836-861) recomputes edge objects
  with `zIndex: 1000/500/0` on select/hover. In v11 each change **remounted**
  the edge component (visible as transition resets); v12 updates z-order
  without remount — strictly better, same code. Test: hover/select e2e-check
  (manual checklist item M5) + transition continuity assertion.
- **`sourceHandle:null` removal**: verified nothing in `src/` reads
  `edge.sourceHandle` or `edge.targetHandle` (grep → 0 hits); our layering and
  `originalLabel` bookkeeping live in `edge.data` / `edge.label`. No impact.
- **Markers**: `MarkerType.ArrowClosed` with explicit `width/height/color` —
  unchanged API in v12.

## 7. Dependency & build changes

`package.json`:

```diff
- "react": "^18.2.0",
- "react-dom": "^18.2.0",
- "reactflow": "^11.11.4",
+ "react": "^19.0.0",
+ "react-dom": "^19.0.0",
+ "@xyflow/react": "^12.11.6",
```
devDependencies: `+ "@types/react": "^19"`, `+ "@types/react-dom": "^19"`.
Version stays `0.8.1`. No `overrides` changes.

`esbuild.js`: **no change.** The webview context bundles from
`src/webview/index.tsx` with `loader: { ".css": "css" }` and no React-related
`external` entries — it resolves `@xyflow/react` and its CSS the same way it
resolved `reactflow`, emitting the same `dist/webview.js` + `dist/webview.css`
pair. The dist-file allowlist (esbuild.js L30) is unchanged.

`.github/workflows/ci.yml`: unchanged (`npm ci && build && test && check.sh`).

## 8. Rollback plan

**Branch-based, single migration PR, no runtime flag.**

- Operate on a `feat/react-flow-12` branch from `main`; the migration is one
  reviewable commit for deps+imports and one for behavior reconciliation.
- Why no feature flag: the swap is a **build-time** dependency change — two
  React Flow majors cannot coexist in one esbuild bundle, and React 18/19
  cannot both mount the same root. A runtime toggle would mean shipping both
  libraries (VSIX budget violation, R12). Rollback = `git revert` the merge
  commit (or don't merge); workspace state needs no migration — persisted
  manual positions are `{x,y}` pairs in `workspaceState`, layout-compatible
  with both majors.
- Blast radius check: only `src/webview/**` + `package.json` change; the
  extension host is untouched, so even a bad rollback cannot corrupt
  on-disk harness files.

## 9. Size & perf budget

- Budget: VSIX < 300 KB (DESIGN.md §2.4). Baseline 0.8.1 VSIX size **must be
  measured before the swap and after** (`npm run package`); record both in
  `.kiro/specs/react-flow-12-migration/size-report.md` (T2, T12). v11→v12
  minified+gzipped deltas are historically small and React 19 is ~slightly
  lighter than 18; expected net change: within ±15 KB.
- Runtime: first whiteboard paint for the repo's own ~40-node graph must stay
  visually indistinguishable from v11 (manual checklist M1); `fitView`
  animation remains 400 ms eased; activation time unchanged (< 500 ms —
  webview code is lazily loaded and the extension host is untouched).

## 10. Test strategy

1. **Unit (Vitest, existing 773 must stay green)** — `layoutUtils.test.ts`
   retargets its type import; **new** assertions: (a) `getLayoutedElementsByProvider`
   output is byte-identical for a fixture graph regardless of v12 (it already
   is — pure math); (b) no-mutation invariant of the update path (§3 #4);
   (c) WhiteboardCanvas source-contract test (regex over source like existing
   FEAT-036 `noAutoAudit.test.ts` style): `nodeDragThreshold={1}` present, no
   `from 'reactflow'` anywhere, style import path correct (R2, R3, R6).
2. **Build/package gates** — `npm run build` (esbuild), `npm run package`
   (vsce) with size report (R12), `./check.sh` (governance).
3. **e2e (FEAT-021)** — `npm run test:integration` (`@vscode/test-electron`,
   `criticalPath.test.ts` mounts the webview and drives `getData`); extends
   the real React-Flow render path through v12 + React 19 (R1, R11).
4. **Manual checklist in VS Code (F5 host)** — recorded evidence in
   `progress/progress.md` at review time:
   - M1 open whiteboard: sectors/nodes/edges render styled, correct layout,
     dark + light theme (R1, R3, R4, R11)
   - M2 drag node → reload window → position persisted (R5)
   - M3 click node with jitter → selected, **no** position drift (R6)
   - M4 edge hover/select → colors, dash, marker per type; no flicker/remount (R7)
   - M5 edge context menu: change label, delete-confirm; suggestion accept + dismiss flows (R8, R9)
   - M6 handle-pill click-link and drag-link (R6 rationale)
   - M7 DevTools console empty of errors/warnings (R4, R11)

## 11. Governance reconciliation (R13)

- **DESIGN.md**: line 198 `React 18 (not 19 — React Flow 11 compatibility)` →
  `React 19 + @xyflow/react 12 (migrated from reactflow 11 / React 18 — FEAT-037)`;
  §3 ASCII box `React 18 + Flow 11` → `React 19 + Flow 12`; §4 Webview UI row
  `React 18, React Flow 11` → `React 19, React Flow 12`. **Hard constraint:**
  DESIGN.md is at 249/250 lines — all edits must be in-place replacements,
  net-zero lines.
- **CHANGELOG.md**: extend the existing `[0.8.1]` section (currently FEAT-036
  only) with a "### Changed — React Flow 12 + React 19 (FEAT-037)" subsection;
  update the section's summary line to name both features. **No `[0.9.0]`.**
- **README.md**: "What's new in 0.8.1" gains a migration bullet; feature table
  row note stays "*new in 0.8.1*".

## 12. Discarded Alternatives

1. **Stay on reactflow 11 + React 18.** v11 receives legacy fixes only; the
   repo's own supply-chain posture (FEAT-036 shipped this same release) would
   be inconsistent with pinning an EOL-ish major. Rejected: debt with a
   compounding coupon; the import surface is at its historical minimum (7
   files) so migration cost is lowest **now**.
2. **Official codemod.** Checked on 2026-09-09: **no official upgrade
   codemod exists** for v11→v12 — `@xyflow/upgrade`, `@xyflow/codemod`,
   `xyflow-upgrade` are all 404 on the npm registry; the xyflow team's
   documented path is the manual migration guide. With only 7 touchpoints, a
   hand-migration is cheaper than writing/validating a codemod anyway.
   Rejected as a tool that does not exist.
3. **@xyflow/react 12 with React 18 only (defer React 19).** Technically
   supported (peers allow `>=17`). Rejected: it double-pays the verification
   gates (unit + e2e + manual checklist + VSIX measurement, twice) for zero
   user value now; the React-19 audit (§13) shows the codebase is already
   19-clean (`createRoot` in use, zero `defaultProps` on function components,
   zero `ReactDOM.render`), and @xyflow/react 12.11.x officially supports
   React 19 — doing both in one 0.8.1 release is the cheaper bundle of risk.
4. **React Flow 12 `colorMode`/CSS-variable re-theming of the whiteboard.**
   Out of scope: our theme story is VS Code variables; adopting v12's dark
   mode would duplicate that system. Rejected to keep the diff surgical.

## 13. React 19 compatibility audit (results)

| Check | Result |
|---|---|
| `ReactDOM.render` anywhere in `src/` | **0 hits** — `index.tsx` already uses `createRoot` from `react-dom/client` |
| `defaultProps` on function components | **0 hits** in `src/` (grep `defaultProps`) |
| Legacy context / lifecycles (`componentWillMount`, `childContextTypes`) | not used (no class components in webview) |
| `forwardRef` misuse patterns | 0 hits in `src/webview/` |
| `AdvisoryPanel.tsx`, `OptimizerPanel.tsx`, `AgentBuilderWizard.tsx`, `RunAgentPanel.tsx` | pure function components + hooks only; no React-19-hostile APIs |
| `@vscode/webview-ui-toolkit` | peer `react >=16.9.0` — compatible; web components, does not import React at runtime |
| `jsx: react-jsx` (tsconfig) + esbuild transform | unchanged by React 19 |

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Subtle CSS regression from v12 stylesheet rewrite (vars-based internals) | Manual checklist M1/M4/M5 with light+dark themes; overrides audited against §3 #8 |
| React 19 batching changes reordering our multi-`setNodes` effects | e2e + manual M2-M6; effects already idempotent (spread-based) |
| Silent behavior change in `onNodesChange` position semantics | T6 unit test pinning `manualPositionsRef` recording rule |
| Size regression blows 300 KB | T12 measure gate; rollback trivial (§8) |
| tsc error-count drift in migrated files | §5 acceptance proxy (zero new errors in the 7 files) |
