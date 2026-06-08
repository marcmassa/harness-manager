# Requirements — Node Position Persistence & Handle-Pill Linking (FEAT-017)

> Feature FEAT-017 from `feature_list.json`. This feature stabilizes whiteboard interaction in two ways:
> (1) preserve user-manual node positions so moved nodes do not snap back to Dagre defaults, and
> (2) improve relationship creation by making visible handle pills the primary drag-to-connect affordance.
>
> Each requirement is written in strict EARS and is verifiable by at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|---------|--------|-------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

---

## Requirements

### R1 — Manual node positions persist during session
- **Pattern:** Event
- WHEN the user drags and drops a node in the whiteboard, the system SHALL persist the node's new coordinates in client state keyed by node id.

### R2 — Re-layout must not overwrite user-placed nodes
- **Pattern:** State
- WHILE a node has a persisted manual position, the system SHALL reuse that position after graph re-parses, filter toggles, selection changes, and panel interactions instead of the auto-layout coordinate.

### R3 — New/unmoved nodes still receive auto-layout
- **Pattern:** State
- WHILE a node does not have a persisted manual position, the system SHALL continue applying Dagre auto-layout so new nodes and untouched nodes are positioned automatically.

### R4 — Invalid persisted coordinates recover safely
- **Pattern:** Unwanted
- IF a persisted position is missing, non-finite, or references a node id that no longer exists, THEN the system SHALL ignore that persisted value and fall back to auto-layout for that node without crashing.

### R5 — Handle pills are the explicit link affordance
- **Pattern:** Ubiquitous
- The system SHALL render source and target handle pills as the visible drag-to-connect affordance with React Flow handles aligned to the pill-center hit area.

### R6 — Drag-from-pill to node creates relationship
- **Pattern:** Event
- WHEN the user presses the source handle pill and drags to a valid target handle pill, the system SHALL create exactly one edge using the existing connect pipeline (`onConnect` + extension persistence message).

### R7 — Invalid pill drags are safely cancelled
- **Pattern:** Unwanted
- IF the user releases a drag from a source pill outside any valid target handle, THEN the system SHALL cancel the connection attempt with no graph mutation.

### R8 — Keyboard and context-menu linking remain functional
- **Pattern:** State
- WHILE FEAT-017 behavior is active, the existing edge creation paths (node skill picker and context-menu based conversion of suggestions) SHALL continue to work without regression.

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|------------|
| Dragging a node to a new place and then toggling Specs/Suggestions keeps the node where user placed it | R1, R2 |
| Newly discovered nodes still appear in Dagre positions when never manually moved | R3 |
| Corrupted or stale saved position data does not crash render and falls back to layout | R4 |
| User can start a connection by pressing the visible `+ LINK` pill and dropping on `↓ IN` pill | R5, R6 |
| Releasing drag on empty canvas creates no edge and no persistence write | R7 |
| Existing add-skill button flow and suggestion accept flow still create edges | R8 |
