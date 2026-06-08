# Tasks — Relationship Lines Visual & Interaction Refinement (FEAT-016)

> Discrete, sequential steps for `typescript-implementer`. Mark `[x]` on completion.
> Each task references the R<n> it satisfies and the file it touches.

---

## Implementation

### index.tsx — CSS layer cleanup and per-type rules

- [x] **T1** — In `index.tsx`, inside the `<style>` block, remove (or replace) the three
  global edge CSS rules that hardcode the blue colour:
  - `.react-flow__edge-path { filter: drop-shadow(0 0 3px rgba(74, 125, 255, 0.3)); ... }`
  - `.react-flow__edge:hover .react-flow__edge-path { filter: drop-shadow(0 0 6px rgba(74, 125, 255, 0.5)); stroke-width: 5 !important; }`
  - `.react-flow__edge.selected .react-flow__edge-path { stroke-width: 5 !important; filter: drop-shadow(0 0 8px rgba(74, 125, 255, 0.6)); }`

  Replace them with a single neutral rule that keeps only the `transition`:

  ```css
  .react-flow__edge-path {
    transition: stroke 0.3s var(--ease-smooth), stroke-width 0.3s var(--ease-smooth);
  }
  ```
  _(R2, R3, R4)_

- [x] **T2** — In `index.tsx`, add a `@keyframes dash-scroll` block inside the `<style>` tag:

  ```css
  @keyframes dash-scroll {
    from { stroke-dashoffset: 24; }
    to   { stroke-dashoffset: 0; }
  }
  ```
  _(R6)_

- [x] **T3** — In `index.tsx`, add per-type CSS blocks for all five edge types plus a fallback.
  Each block must cover three states: normal, `:hover`, and `.selected`. Use the exact
  rgba colours and strokeWidth values from the design (§3):

  ```css
  /* manages (blue) */
  .harness-edge--manages .react-flow__edge-path {
    filter: drop-shadow(0 0 3px rgba(74, 125, 255, 0.30));
  }
  .harness-edge--manages:hover .react-flow__edge-path {
    filter: drop-shadow(0 0 6px rgba(74, 125, 255, 0.50));
    stroke-width: 5 !important;
  }
  .harness-edge--manages.selected .react-flow__edge-path {
    filter: drop-shadow(0 0 10px rgba(74, 125, 255, 0.70));
    stroke-width: 5 !important;
  }

  /* uses (teal) */
  .harness-edge--uses .react-flow__edge-path {
    filter: drop-shadow(0 0 3px rgba(42, 161, 152, 0.30));
  }
  .harness-edge--uses:hover .react-flow__edge-path {
    filter: drop-shadow(0 0 6px rgba(42, 161, 152, 0.50));
    stroke-width: 4.5 !important;
  }
  .harness-edge--uses.selected .react-flow__edge-path {
    filter: drop-shadow(0 0 10px rgba(42, 161, 152, 0.70));
    stroke-width: 4.5 !important;
  }

  /* executing (orange) */
  .harness-edge--executing .react-flow__edge-path {
    filter: drop-shadow(0 0 3px rgba(232, 111, 74, 0.30));
  }
  .harness-edge--executing:hover .react-flow__edge-path {
    filter: drop-shadow(0 0 6px rgba(232, 111, 74, 0.50));
    stroke-width: 5.5 !important;
  }
  .harness-edge--executing.selected .react-flow__edge-path {
    filter: drop-shadow(0 0 10px rgba(232, 111, 74, 0.70));
    stroke-width: 5.5 !important;
  }

  /* discovered (grey) */
  .harness-edge--discovered .react-flow__edge-path {
    filter: drop-shadow(0 0 2px rgba(108, 108, 138, 0.20));
  }
  .harness-edge--discovered:hover .react-flow__edge-path {
    filter: drop-shadow(0 0 5px rgba(108, 108, 138, 0.40));
    stroke-width: 3.5 !important;
  }
  .harness-edge--discovered.selected .react-flow__edge-path {
    filter: drop-shadow(0 0 8px rgba(108, 108, 138, 0.60));
    stroke-width: 3.5 !important;
  }

  /* suggested (amber) — scroll animation */
  .harness-edge--suggested .react-flow__edge-path {
    filter: drop-shadow(0 0 3px rgba(212, 168, 74, 0.25));
    animation: dash-scroll 1.2s linear infinite;
  }
  .harness-edge--suggested:hover .react-flow__edge-path {
    filter: drop-shadow(0 0 6px rgba(212, 168, 74, 0.50));
    stroke-width: 4 !important;
  }
  .harness-edge--suggested.selected .react-flow__edge-path {
    filter: drop-shadow(0 0 10px rgba(212, 168, 74, 0.70));
    stroke-width: 4 !important;
  }

  /* fallback */
  .harness-edge .react-flow__edge-path {
    filter: drop-shadow(0 0 2px rgba(136, 136, 136, 0.20));
  }
  .harness-edge:hover .react-flow__edge-path {
    filter: drop-shadow(0 0 5px rgba(136, 136, 136, 0.40));
    stroke-width: 4 !important;
  }
  ```
  _(R2, R3, R4, R6)_

---

### WhiteboardCanvas.tsx — Edge object enrichment

- [x] **T4** — Add a `EDGE_TYPE_ROUTING` constant near the top of `WhiteboardCanvas.tsx`,
  after `defaultEdgeCfg`:

  ```ts
  const EDGE_TYPE_ROUTING: Record<string, string> = {
    manages: 'smoothstep',
    uses: 'default',
    executing: 'default',
    discovered: 'straight',
    suggested: 'smoothstep',
  };
  ```
  _(R1)_

- [x] **T5** — In the `initialEdges` map inside `useEffect`, add `type` and `className`
  fields to each returned edge object:

  ```ts
  type: EDGE_TYPE_ROUTING[label] ?? 'default',
  className: `harness-edge harness-edge--${label}`,
  ```

  Place these alongside the existing `id`, `source`, `target`, `label` fields.
  Do NOT add these fields inside the mismatch or disabled override branches — let those
  branches retain the `className` inherited from the outer scope.
  _(R1, R2, R3, R4)_

- [x] **T6** — In the `initialEdges` map, update `labelStyle` for the normal (non-mismatch,
  non-disabled) path. Replace:

  ```ts
  border: isMismatchEdge ? '1px solid #e86f4a' : '1px solid var(--vscode-panel-border)',
  ```

  With:

  ```ts
  border: isMismatchEdge
    ? '1px solid #e86f4a'
    : isDisabled
    ? '1px solid #6c6c8a'
    : `1px solid ${effectiveCfg.style.stroke as string}`,
  ```
  _(R5)_

- [x] **T7** — Add `hoveredEdgeId` state to `WhiteboardCanvas`:

  ```ts
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);
  ```

  Add `onEdgeMouseEnter` and `onEdgeMouseLeave` handlers:

  ```ts
  const onEdgeMouseEnter = React.useCallback((_: React.MouseEvent, edge: Edge) => {
    setHoveredEdgeId(edge.id);
  }, []);

  const onEdgeMouseLeave = React.useCallback(() => {
    setHoveredEdgeId(null);
  }, []);
  ```

  Pass both handlers to `<ReactFlow onEdgeMouseEnter={onEdgeMouseEnter} onEdgeMouseLeave={onEdgeMouseLeave} />`.
  _(R9)_

- [x] **T8** — Replace the existing `edgesWithHighlight` memo with an `edgesWithZIndex` memo
  that applies highlight color, hover z-index, and selected z-index in one pass:

  ```ts
  const edgesWithZIndex = React.useMemo(() => {
    return edges.map(e => {
      const isHighlight = e.id === highlightEdgeId;
      const isSelected = e.id === selectedEdgeId;
      const isHovered = e.id === hoveredEdgeId;

      let overrides: Partial<Edge> = {};

      if (isHighlight) {
        const base = edgeConfigs[e.label as string] || defaultEdgeCfg;
        overrides = {
          style: {
            ...base.style,
            stroke: '#4ec9b0',
            strokeWidth: (typeof base.style.strokeWidth === 'number' ? base.style.strokeWidth : 2) + 3,
          },
          animated: true,
        };
      }

      const zIndex = isSelected ? 1000 : isHovered ? 500 : 0;

      return { ...e, ...overrides, zIndex };
    });
  }, [edges, highlightEdgeId, selectedEdgeId, hoveredEdgeId]);
  ```

  Remove the old `edgesWithHighlight` variable. Update `<ReactFlow edges={edgesWithZIndex} />`.
  _(R4, R8, R9)_

- [x] **T9** — In `handleChangeLabel`, after updating `label`, `style`, `animated`, and
  `markerEnd`, also update `type`, `className`, and the `labelStyle.border` of the
  reassigned edge:

  ```ts
  type: EDGE_TYPE_ROUTING[newLabel] ?? 'default',
  className: `harness-edge harness-edge--${newLabel}`,
  labelStyle: {
    ...e.labelStyle,
    color: cfg.style.stroke,
    border: `1px solid ${cfg.style.stroke}`,
  } as any,
  ```
  _(R1, R2, R5)_

- [x] **T10** — In `onAddSkill` (inside the node `data` object built in `initialNodes`),
  update the new edge created programmatically to include `type`, `className`, and the
  colored `labelStyle.border`:

  ```ts
  const newEdge: Edge = {
    id: edgeId,
    source: sourceId,
    target: skillId,
    label: 'uses',
    type: EDGE_TYPE_ROUTING['uses'],
    className: 'harness-edge harness-edge--uses',
    style: cfg.style,
    animated: cfg.animated,
    markerEnd: cfg.markerEnd,
    labelStyle: {
      fontSize: '11px',
      fontWeight: 600,
      color: cfg.style.stroke as string,
      background: 'var(--vscode-editor-background)',
      padding: '3px 8px',
      borderRadius: '4px',
      border: `1px solid ${cfg.style.stroke as string}`,
    },
    labelBgPadding: [10, 5] as [number, number],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: 'var(--vscode-editor-background)', fillOpacity: 0.95 },
  };
  ```
  _(R1, R5, R8)_

---

### CustomNode.tsx — Handle pill accent colors

- [x] **T11** — In `CustomNode.tsx`, add `HANDLE_ACCENT` lookup constant before the
  component function:

  ```ts
  const HANDLE_ACCENT: Record<string, string> = {
    agent:    '#4a7dff',
    subagent: '#4a7dff',
    skill:    '#2aa198',
    feature:  '#888888',
  };
  ```
  _(R7)_

- [x] **T12** — In `CustomNode.tsx`, derive the `accent` value inside the component body:

  ```ts
  const accent = HANDLE_ACCENT[type] ?? '#888888';
  ```

  Update `targetPillStyle` and `sourcePillStyle`: when `isHovered`, replace the
  `var(--vscode-statusBarItem-remoteBackground, #005f87)` values with `accent` for
  `background` and `border`, keeping `color: '#ffffff'` and `boxShadow` unchanged.
  Keep the non-hovered state identical to the current implementation.
  _(R7)_

---

## Tests

- [x] **T13** — Unit test in `src/webview/bridge.test.ts` (or new file
  `src/webview/edgeMapping.test.ts`):  
  Verify that the `EDGE_TYPE_ROUTING` lookup returns `'smoothstep'` for `'manages'`,
  `'straight'` for `'discovered'`, and `'default'` for `'uses'`. _(R1)_

- [x] **T14** — Unit test: given a mock edge with `label: 'uses'` and
  `style.stroke: '#2aa198'`, verify that the constructed `labelStyle.border` equals
  `'1px solid #2aa198'` and that `className` includes `'harness-edge--uses'`. _(R2, R5)_

- [x] **T15** — Unit test: given a `HANDLE_ACCENT` lookup, verify that `'subagent'` →
  `'#4a7dff'`, `'skill'` → `'#2aa198'`, and an unknown type falls back to `'#888888'`. _(R7)_

- [x] **T16** — Smoke test (manual, documented in the implementation log): open the
  whiteboard with at least three `manages` edges from the same orchestrator node and
  confirm that the paths visually separate (no full overlap). _(R1)_

---

## Closure

- [x] **T17** — Run `./check.sh` and verify all automated tests pass with no regressions.

- [x] **T18** — Update `feature_list.json`: set `status` to `"done"` for `FEAT-016`.

- [x] **T19** — Log the implementation summary in `progress/progress.md` with R<n>↔test
  traceability table.
