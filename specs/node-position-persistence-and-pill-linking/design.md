# Design — Node Position Persistence & Handle-Pill Linking (FEAT-017)

> Technical design for FEAT-017. Scope is limited to webview graph interaction. No parser schema changes and no source edits outside existing whiteboard interaction modules.

---

## Summary

The current whiteboard recomputes Dagre layout inside `WhiteboardCanvas` and then resets all node positions from that result on each graph refresh cycle. This causes manually moved nodes to snap back. FEAT-017 introduces a position-merge strategy: auto-layout remains the baseline, but user-moved coordinates are captured and overlaid before `setNodes`.

For linking, the visual handle pills already exist in `CustomNode`, but this feature formalizes pill-first interaction and verifies the drag path from source pill to target pill as the primary UX, without changing persistence semantics (`createEdge` message remains canonical).

## Affected Files

| File | Action | Reason |
|------|--------|--------|
| `src/webview/WhiteboardCanvas.tsx` | modify | Track manual positions from node-drag events and merge them with layouted nodes before render updates. |
| `src/webview/components/CustomNode.tsx` | modify | Keep pill/handle alignment explicit and ensure pill visuals remain the drag affordance for both source and target handles. |
| `src/webview/layoutUtils.ts` | optional modify | Keep helper pure; only touched if a small utility extraction improves merge clarity. |
| `src/webview/edgeMapping.test.ts` or new whiteboard test file | modify/create | Add tests for position persistence merge logic and pill-link connection behavior contracts. |

## Implementation Strategy

1. In `WhiteboardCanvas.tsx`, add `manualPositions` state/ref keyed by node id.
2. Intercept node move completion through `onNodesChange` changes (position updates) and store latest manual coordinates for moved nodes.
3. During graph refresh effect:
   - build `initialNodes` + `initialEdges`,
   - run `getLayoutedElements(...)`,
   - map layouted nodes through a merge function:
     - if `manualPositions[node.id]` is valid, use it,
     - else keep Dagre position.
4. Preserve existing `fitView` call behavior, but avoid forced visual jump for already moved nodes.
5. Keep connection creation in `onConnect` unchanged; ensure handle-pill placement and hit area remain centered and consistent in `CustomNode.tsx`.
6. Add regression checks ensuring `onAddSkill` and suggestion acceptance still produce edges.

## Error Handling / Edge Cases

| Condition | Response |
|-----------|----------|
| Node removed from graph but still present in `manualPositions` map | Ignore stale entry; optional cleanup pass removes unknown ids. |
| Persisted value includes `NaN`, `Infinity`, or missing `x/y` | Skip manual override and apply Dagre result for that node. |
| Graph data refresh introduces new nodes | New nodes use auto-layout until user drags them. |
| User starts drag from `+ LINK` pill but releases outside target | React Flow cancel path leaves state unchanged; no `createEdge` message emitted. |
| Overlapping pills in dense area | Keep existing z-index/hit area rules; no feature-scope change to collision routing. |

## Discarded Alternative

### Alternative A — Persist node coordinates to workspace files

Store node positions into `agentic.json` or sidecar metadata and rehydrate across sessions.

**Discarded** for FEAT-017 because:
- It introduces schema evolution and parser/writer changes for a UI-only interaction fix.
- It risks merge conflicts in repository files for purely local preferences.
- User request targets snap-back behavior in current interaction loop; session-level persistence solves the immediate defect with lower risk.

## Risks and Mitigations

- **Risk:** Overriding positions on every refresh may bypass intended relayout after structural changes.
  - **Mitigation:** Apply manual override only per node ids that user moved; untouched/new nodes still reflow with Dagre (R3).
- **Risk:** Capturing drag changes too frequently can add jitter.
  - **Mitigation:** Persist final position from node-change events after drag updates, not from every incidental render path.
- **Risk:** Pill UX tweaks could break connect hit-testing.
  - **Mitigation:** Keep `Handle` elements centered with absolute transform and verify drag-connect in automated/interactive tests (R5–R7).
