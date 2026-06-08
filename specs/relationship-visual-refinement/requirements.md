# Requirements — Relationship Lines Visual & Interaction Refinement (FEAT-016)

> Feature FEAT-016 from `feature_list.json`. Improves how relationship edges look and interact
> across the ReactFlow whiteboard: per-type routing, per-type glow/shadow, label pills with
> edge color, hover/selection states per edge type, animated scroll for suggested edges,
> handle-pill visual integration, and Z-index layering for hovered/selected edges.
>
> Each requirement is written in strict EARS and is verifiable by at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|---------|--------|-------------|
| **Ubiquitous** | `SHALL …` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL …` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL …` | While a condition remains true |
| **Unwanted** | `IF <condition> THEN SHALL …` | Response to failures or edge cases |

---

## Requirements

### R1 — Semantic edge-type routing

- **Pattern:** Ubiquitous
- The system SHALL assign a ReactFlow `type` property to each edge according to its semantic
  meaning:
  - `manages` → `smoothstep` (hierarchical, top-down fan-out)
  - `uses` → `default` (bezier, lateral organic)
  - `executing` → `default` (bezier, dynamic)
  - `discovered` → `straight` (neutral, static)
  - `suggested` → `smoothstep` (lateral discovery curve)
- IF the edge label is not one of the five types above, the system SHALL default to `default`
  (bezier).

### R2 — Per-type drop-shadow (normal state)

- **Pattern:** Ubiquitous
- The system SHALL render each edge path with a CSS `drop-shadow` whose color matches the
  edge type's own stroke color at 30 % opacity, not the generic blue (`rgba(74, 125, 255, 0.3)`).
- The system SHALL NOT apply any global drop-shadow to `.react-flow__edge-path` that
  overrides the per-type shadow.
- Per-type shadow colours:
  - `manages` → `rgba(74, 125, 255, 0.30)`
  - `uses` → `rgba(42, 161, 152, 0.30)`
  - `executing` → `rgba(232, 111, 74, 0.30)`
  - `discovered` → `rgba(108, 108, 138, 0.20)`
  - `suggested` → `rgba(212, 168, 74, 0.25)`
  - default → `rgba(136, 136, 136, 0.20)`

### R3 — Per-type hover glow

- **Pattern:** Event
- WHEN the user hovers over an edge, the system SHALL:
  1. Increase the edge `strokeWidth` by 1.5 px beyond its base value.
  2. Replace the drop-shadow with a glow whose color is the edge type's own stroke color at
     50 % opacity and a blur radius of 6 px.
- The system SHALL NOT apply the generic blue hover glow (`rgba(74, 125, 255, 0.5)`) to any
  edge on hover.

### R4 — Per-type selected state with z-index elevation

- **Pattern:** Event
- WHEN an edge is selected (user click or keyboard navigation), the system SHALL:
  1. Apply an intensified glow whose color is the edge type's own stroke color at 70 % opacity
     and a blur radius of 10 px.
  2. Set the edge's `zIndex` to 1 000 so that it renders above all non-selected edges.
- WHEN the edge is deselected, the system SHALL restore the `zIndex` to its default value (0).

### R5 — Label pill border colored by edge type

- **Pattern:** Ubiquitous
- The system SHALL render each edge label with:
  - `border: 1px solid <edge-type-stroke-color>` in its `labelStyle` (not `var(--vscode-panel-border)`).
  - `background: var(--vscode-editor-background)` for the pill fill.
  - Text color equal to the edge type's stroke color.
- The system SHALL NOT render a white or semi-transparent generic background for the label pill.

### R6 — Suggested edge scroll animation

- **Pattern:** Ubiquitous
- The system SHALL animate `suggested` edges using a CSS `stroke-dashoffset` scrolling
  keyframe (`@keyframes dash-scroll`) applied via a CSS class, NOT via ReactFlow's `animated`
  prop (which causes opacity blinking).
- The animation SHALL complete one cycle in 1.2 s and repeat infinitely.
- The animation direction SHALL create the visual effect of dashes moving from source to
  target (positive dashoffset to zero).
- IF the `animated` prop of the `suggested` edge is currently `true`, the system SHALL set it
  to `false` and rely solely on the CSS keyframe.

### R7 — Handle pill accent color by node type

- **Pattern:** Ubiquitous
- The system SHALL render the source handle pill (`+ LINK`) of each node with an accent color
  derived from the most probable edge type for that node:
  - `agent` source → `manages` blue (`#4a7dff`)
  - `subagent` source → `manages` blue (`#4a7dff`)
  - `skill` source → `uses` teal (`#2aa198`)
  - `feature` source → default grey (`#888`)
- The system SHALL render the target handle pill (`↓ IN`) with the same accent colour as
  the source pill of the same node type.
- WHILE the node is not hovered, the handle pill SHALL remain in the neutral widget style
  (unchanged from current); the accent color SHALL only be visible while the node is hovered.

### R8 — New-edge entry animation

- **Pattern:** Event
- WHEN a new edge is created (via the handle pill drag-to-connect or the `+ LINK` / skill
  picker), the system SHALL animate the edge with a brief "entry flash" that:
  1. Starts with stroke colour `#4ec9b0` (entry green) and `strokeWidth` base + 3.
  2. Transitions to the natural stroke colour and base `strokeWidth` of the edge type over
     1 500 ms using a CSS-driven approach (class toggle) or `useState` timeout already in use.
- The system SHALL NOT retain the flash color after 1 500 ms.
- IF `highlightEdgeId` is already used for this purpose, the system SHALL refine its color
  from the current orange/yellow to the entry-green defined above while keeping the existing
  timeout mechanism.

### R9 — Z-index layering: hovered edge above peers

- **Pattern:** State
- WHILE the user's pointer is over an edge (hover state), the system SHALL render that edge
  at a `zIndex` higher than all edges that are not hovered, preventing overlap from obscuring
  the interactive path.
- The system SHALL implement this elevation via the ReactFlow Edge `zIndex` prop updated in
  the `edgesWithHighlight` memo (or an equivalent derived memo), not via global CSS `z-index`.
- WHEN the pointer leaves the edge, the system SHALL restore its `zIndex` to 0.

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Requirement(s) |
|----------------------|----------------|
| `manages` edges between agent and subagents do not overlap visually due to bezier stacking; smoothstep fan-out is visible | R1 |
| All five edge types render drop-shadows in their own stroke color, not blue | R2 |
| Hovering any edge glows in the edge's own color, not blue | R3 |
| Clicking an edge renders a stronger glow in its own color and appears above other edges | R4 |
| Each edge label pill has a border in the edge's own color | R5 |
| `suggested` edges scroll their dashes continuously without opacity blinking | R6 |
| Source/target handle pill on subagent node shows blue accent on hover | R7 |
| Newly created edge flashes green then fades to natural color | R8 |
| A hovered edge renders above overlapping non-hovered edges | R9 |
| Generic blue CSS rules are fully removed from `.react-flow__edge-path` and state selectors | R2, R3, R4 |
