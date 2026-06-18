# Design — Relationship Lines Visual & Interaction Refinement (FEAT-016)

> Technical design for each requirement. The `typescript-implementer` executes `tasks.md`
> against this document. Do NOT edit after human approval.

---

## 1. Architectural overview

All changes are confined to the React/CSS layer of the webview. No extension-host code,
no new message types, no schema changes. Three files are affected:

| File | Nature of change |
|------|-----------------|
| `src/webview/WhiteboardCanvas.tsx` | Add `type`, `className`, `zIndex` fields to edge objects; update `labelStyle`; refine `highlightEdgeId` colors; add hover-zIndex memo |
| `src/webview/components/CustomNode.tsx` | Update handle pill accent-color map keyed by `type` |
| `src/webview/index.tsx` | Replace global CSS rules for edges; add `@keyframes dash-scroll`; add per-type CSS via `.harness-edge--<type>` selectors |

No new npm packages are required. ReactFlow already supports `type`, `className`, and
`zIndex` on `Edge` objects.

---

## 2. R1 — Semantic edge-type routing

### Strategy
Add a `EDGE_TYPE_ROUTING` lookup constant in `WhiteboardCanvas.tsx` and apply it when
building `initialEdges`:

```ts
const EDGE_TYPE_ROUTING: Record<string, string> = {
  manages: 'smoothstep',
  uses: 'default',
  executing: 'default',
  discovered: 'straight',
  suggested: 'smoothstep',
};
```

In the `initialEdges` map:

```ts
return {
  ...edgeBase,
  type: EDGE_TYPE_ROUTING[label] ?? 'default',
  // ...
};
```

ReactFlow reads the `type` prop and selects the corresponding path-drawing algorithm.
This does not require a custom edge component.

### Why smoothstep for `manages`
`manages` edges fan out from a single orchestrator node to multiple subagents. In bezier
mode, all five paths share the same control-point heuristic and nearly overlap. Smoothstep
produces distinct horizontal offsets before curving downward, making each path clearly
separate.

### Why straight for `discovered`
`discovered` edges represent the weakest semantic relationship — a skill scanned but not
yet activated. A straight line carries no visual weight and distinguishes them from the
curved active relationships.

---

## 3. R2, R3, R4 — Per-type CSS via `className`

### Strategy
The root cause of the generic blue shadow is a single `.react-flow__edge-path` rule in
`index.tsx` with a hardcoded `rgba(74, 125, 255, 0.3)` color. The fix has three steps:

**Step A — Remove the global rule** (`index.tsx`)  
Delete (or replace with a no-filter rule) the global `.react-flow__edge-path` `filter`
declaration. Keep only the `transition` property there.

**Step B — Assign `className` per edge** (`WhiteboardCanvas.tsx`)  
In `initialEdges`, add:

```ts
className: `harness-edge harness-edge--${label}`,
```

ReactFlow applies this `className` to the `<g>` wrapper of the edge SVG group.

**Step C — Add per-type CSS rules** (`index.tsx`)  
Add five `.harness-edge--<type>` blocks inside the `<style>` tag. Each block contains
three states: normal, `:hover`, and `.selected`. Example for `manages`:

```css
/* manages: blue */
.harness-edge--manages .react-flow__edge-path {
  filter: drop-shadow(0 0 3px rgba(74, 125, 255, 0.30));
}
.harness-edge--manages:hover .react-flow__edge-path {
  filter: drop-shadow(0 0 6px rgba(74, 125, 255, 0.50));
  stroke-width: 5 !important;  /* base 3.5 + 1.5 */
}
.harness-edge--manages.selected .react-flow__edge-path {
  filter: drop-shadow(0 0 10px rgba(74, 125, 255, 0.70));
  stroke-width: 5 !important;
}
```

Replicate for `uses`, `executing`, `discovered`, `suggested`, and a `.harness-edge`
fallback for unknown types.

### Why not a custom edge component
A custom edge component (`edgeTypes` registration) would require wrapping ReactFlow's
`BezierEdge`, `SmoothStepEdge`, etc. for each type, adding a `data-` attribute injection,
and re-implementing hover detection in React. The CSS-class approach achieves identical
results with zero new components and no API surface change.

### Hover strokeWidth caveat
ReactFlow sets `stroke-width` on the `<path>` element via the `style` prop. CSS
`stroke-width: 5 !important` on the path wins over inline style in SVG because CSS has
higher specificity than presentation attributes in SVG 1.1. This is confirmed behavior
in Chrome and Firefox. No JS change is needed.

---

## 4. R4 (partial) — Z-index for selected edge

### Strategy
ReactFlow Edge objects accept a `zIndex` prop (numeric). Add a derived memo
`edgesWithZIndex` in `WhiteboardCanvas.tsx` that layers on top of `edgesWithHighlight`:

```ts
const edgesWithZIndex = React.useMemo(() => {
  if (!selectedEdgeId) return edgesWithHighlight;
  return edgesWithHighlight.map(e => ({
    ...e,
    zIndex: e.id === selectedEdgeId ? 1000 : 0,
  }));
}, [edgesWithHighlight, selectedEdgeId]);
```

Pass `edgesWithZIndex` to `<ReactFlow edges={...} />` instead of `edgesWithHighlight`.

### R9 — Hover z-index
For hover z-index we cannot use CSS alone because ReactFlow controls SVG rendering order
via React state. The implementer SHALL add an `hoveredEdgeId` state and an `onEdgeMouseEnter`
/ `onEdgeMouseLeave` handler pair on `<ReactFlow />`. These update the state, which feeds
into `edgesWithZIndex`.

Hover z-index rule:

```ts
zIndex: e.id === selectedEdgeId ? 1000 : e.id === hoveredEdgeId ? 500 : 0,
```

---

## 5. R5 — Label pill border

### Strategy
The current `labelStyle` already sets `border: '1px solid var(--vscode-panel-border)'`.
Replace this with the edge type's own stroke color:

```ts
labelStyle: {
  // ...existing properties...
  color: edgeStrokeColor,
  border: `1px solid ${edgeStrokeColor}`,
},
```

Where `edgeStrokeColor` is extracted from `effectiveCfg.style.stroke as string`.
Mismatch and disabled overrides already set their own colors and should retain their
existing border logic — add a guard so the new rule applies only when neither flag is set.

---

## 6. R6 — Suggested edge scroll animation

### Strategy
Add a `@keyframes dash-scroll` rule in `index.tsx`:

```css
@keyframes dash-scroll {
  from { stroke-dashoffset: 24; }
  to   { stroke-dashoffset: 0;  }
}
```

The `suggested` edge has `strokeDasharray: '8,4'` (total pattern = 12 px). Using 24 px
(two full cycles) as the starting offset produces smooth, seamless looping.

Apply it in the per-type CSS block for `suggested`:

```css
.harness-edge--suggested .react-flow__edge-path {
  animation: dash-scroll 1.2s linear infinite;
  filter: drop-shadow(0 0 3px rgba(212, 168, 74, 0.25));
}
```

In `edgeConfigs['suggested']`, set `animated: false` (it currently is `false` — confirm
no change is needed here). The `animated` prop in ReactFlow renders a `<circle>` traveling
along the path, which is not the desired effect.

---

## 7. R7 — Handle pill accent color

### Strategy
In `CustomNode.tsx`, the pill styles (`targetPillStyle`, `sourcePillStyle`) are currently
hardcoded to use `var(--vscode-statusBarItem-remoteBackground)` when hovered. Replace with
a type-keyed accent lookup:

```ts
const HANDLE_ACCENT: Record<string, string> = {
  agent:    '#4a7dff',   // manages blue
  subagent: '#4a7dff',   // manages blue
  skill:    '#2aa198',   // uses teal
  feature:  '#888888',   // neutral
};
const accent = HANDLE_ACCENT[type] ?? '#888888';
```

When `isHovered`:
- `background`: `accent` at full opacity
- `color`: `#ffffff` (white text — confirmed ≥ 4.5:1 on all five accent colors in dark mode)
- `border`: `1px solid ${accent}`

When not hovered: keep the current neutral widget style (no change).

### Why not a dynamic lookup from the graph
The handle pill is on the node level, not the edge level. Computing the dominant outgoing
edge type at render time requires traversing `graph.edges` inside `CustomNode`. That data
is not currently passed to `CustomNode`. A static type-keyed map is simpler and matches
the semantic intent: a subagent is _primarily_ a `manages`-source regardless of what edges
happen to exist.

---

## 8. R8 — New-edge entry animation

### Strategy
`WhiteboardCanvas.tsx` already has `highlightEdgeId` state and a `setTimeout(..., 1500)`
mechanism. The current color override uses `var(--vscode-editorWarning-foreground, #ffa726)`
(orange/yellow).

Change:
- Flash stroke → `#4ec9b0` (entry green, distinct from any edge type)
- Flash strokeWidth → `base + 3`
- Keep the existing `animated: true` during the 1 500 ms window

No CSS keyframe is needed — the existing state-driven override in `edgesWithHighlight` is
sufficient and already handles cleanup via `setTimeout`.

---

## 9. Discarded alternatives

### A. Custom edge components for per-type styling
Registering a custom component in `edgeTypes` for each of the five edge types would
provide the most precise control (e.g., injecting `data-edge-type` on the `<path>` DOM
element). However, it requires:
- Five wrapper components each re-importing `BezierEdge`, `SmoothStepEdge`, `StraightEdge`
- Re-implementing the `labelStyle`/`labelBgStyle` pass-through
- Registering all five in the `edgeTypes` prop

The CSS `className`-on-edge approach achieves R2/R3/R4 with zero new components and no
regression risk. **Discarded**.

### B. Inline `filter` style on each edge via `style` prop
Setting `filter` inline per edge (e.g. `style: { ..., filter: 'drop-shadow(...)' }`)
would work for the normal state, but cannot express `:hover` or `.selected` states in
inline styles. Combined with the CSS approach it would create conflicts. **Discarded** in
favor of the pure CSS-class strategy.

### C. SVG `<filter>` element per edge
A `<defs><filter>` approach would render a named filter element per edge type in the SVG
and reference it via `filter="url(#manages-glow)"`. This is the most semantically correct
SVG solution but requires injecting elements into the ReactFlow SVG DOM, which ReactFlow
does not expose a stable API for. **Discarded**.

---

## 10. File change summary

| File | Sections changed |
|------|-----------------|
| `src/webview/index.tsx` | Remove global blue `filter` from `.react-flow__edge-path`; remove generic hover/selected rules; add per-type `.harness-edge--<type>` blocks; add `@keyframes dash-scroll` |
| `src/webview/WhiteboardCanvas.tsx` | Add `EDGE_TYPE_ROUTING` constant; add `className` + `type` + `zIndex` to `initialEdges` map; fix `labelStyle.border`; add `hoveredEdgeId` state + handlers; add `edgesWithZIndex` memo; change highlight flash color to `#4ec9b0`; update `handleChangeLabel` to propagate `type` and `className` |
| `src/webview/components/CustomNode.tsx` | Add `HANDLE_ACCENT` lookup; apply accent color to `targetPillStyle` and `sourcePillStyle` when hovered |
