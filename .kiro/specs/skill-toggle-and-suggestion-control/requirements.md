# Requirements — Skill Toggle & Suggestion Visibility Control

> Feature FEAT-013 from `feature_list.json`. Adds two user-facing controls:
> (1) the ability to **permanently dismiss** semantic relationship suggestions so they never reappear after a reload, and
> (2) the ability to **toggle on/off** existing skill connections (`uses` edges) for agents and subagents without deleting them.
>
> Additionally fixes six critical bugs detected by code analysis:
> - Suggestion Accept/Dismiss actions silently broken due to display-label mismatch (R6–R8)
> - Dismissed suggestions re-appear on every parse (R1)
> - Double TF-IDF matrix computation per parse cycle (R9)
> - `implicit any` type in `_sendData` (R10)
> - Node context menu has no click-outside dismissal handler (R11)
>
> Each requirement is written in strict EARS and is verifiable by at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

---

## Requirements

### R1 — Persistent Suggestion Dismissal
- **Pattern:** Event
- WHEN the user dismisses a suggested edge (via EdgeContextMenu "Dismiss" or the suggestion dialog "✕ Dismiss" button), the system SHALL persist the dismissed pair `{subagentId, skillId}` in the VS Code workspace state under the key `harness-manager.dismissedSuggestions` (stored as an array of `"subagentId::skillId"` strings), and SHALL NOT emit a `suggested` edge for that pair in any subsequent `parse()` call for the lifetime of the workspace state.

### R2 — Dismiss Persistence Survives Reload
- **Pattern:** Ubiquitous
- The system SHALL load dismissed suggestion pairs from workspace state on every `_sendData()` invocation and pass them to `HarnessParser.parse()` so that the parser excludes those pairs before emitting `suggested` edges.

### R3 — Global Suggestion Visibility Toggle
- **Pattern:** State
- WHILE the "Show Suggestions" checkbox in the dashboard header is unchecked, the system SHALL hide all `suggested` edges from the rendered graph without modifying the underlying data, and SHALL persist the toggle preference in React component state (session-only, reset to `true` on reload).

### R4 — Skill Connection Toggle (Disable)
- **Pattern:** Event
- WHEN the user right-clicks a `uses` edge in the whiteboard and selects "⏸ Disable Connection", the system SHALL mark the connection as disabled by persisting the key `"source::target"` in VS Code workspace state under `harness-manager.disabledConnections`, and SHALL NOT delete the underlying `uses` relationship from `agentic.json` or `SUBAGENT.md`.

### R5 — Disabled Edge Visual Style
- **Pattern:** State
- WHILE a `uses` edge is marked as disabled in workspace state, the system SHALL render it with: stroke `#6c6c8a`, `strokeDasharray: '4,4'`, opacity `0.45`, `strokeWidth 2`, and SHALL prepend `⏸ ` to its display label. The edge SHALL remain selectable and right-clickable.

### R6 — Skill Connection Toggle (Re-enable)
- **Pattern:** Event
- WHEN the user right-clicks a disabled `uses` edge and selects "▶ Enable Connection", the system SHALL remove the `"source::target"` entry from `harness-manager.disabledConnections` in workspace state and SHALL restore the edge to its normal `uses` visual style on the next `_sendData()` refresh.

---

## Bug Fixes (from static code analysis)

### R7 — Fix: `isSuggested` detection in EdgeContextMenu uses display label
- **Pattern:** Ubiquitous
- **Root cause:** `EdgeContextMenu.tsx` computes `currentLabel = edge.label`, but the rendered edge's `label` property holds the display string (e.g., `"suggested (0.56)"` or `"🔗 suggested (0.87)"`), not the raw `'suggested'` string. As a result, `isSuggested = currentLabel === 'suggested'` is always `false` for scored suggestions — Accept and Dismiss buttons never render.
- The system SHALL derive `isSuggested` from `(edge.data as any)?.originalLabel === 'suggested'` and `isUses` from `(edge.data as any)?.originalLabel === 'uses'`, so that EdgeContextMenu displays correct actions regardless of the display label.

### R8 — Fix: `handleDismissSuggestion` filter uses display label
- **Pattern:** Ubiquitous
- **Root cause:** `handleDismissSuggestion` in `WhiteboardCanvas.tsx` filters edges with `e.label === 'suggested'`, which never matches the stored display label.
- The filter SHALL use `(e.data as any)?.originalLabel === 'suggested'` to correctly identify and remove dismissed suggestion edges from React state.

### R9 — Fix: suggestion dialog Accept button uses display label
- **Pattern:** Ubiquitous
- **Root cause:** The suggestion dialog "Accept" onClick uses `edges.find(e => ... e.label === 'suggested')`, which fails for the same display-label mismatch reason.
- The find call SHALL use `e.data?.originalLabel === 'suggested'` to locate the correct edge.

### R10 — Fix: Double idoneity matrix computation per parse
- **Pattern:** Ubiquitous
- **Root cause:** `enrichWithIdoneity` (parserLogic.ts:92) and `enrichSuggestedEdgesWithIdoneity` (parserLogic.ts:183) both independently call `computeIdoneityMatrix(subagents, skills)` on identical input, performing the full TF-IDF corpus build twice per parse cycle.
- The system SHALL compute the idoneity matrix exactly **once** per parse, storing it in a local variable in `enrichWithIdoneity`, and SHALL pass the pre-computed `IdoneityMatrix` as an explicit parameter to `enrichSuggestedEdgesWithIdoneity(result, matrix)` to avoid re-computation.

### R11 — Fix: `implicit any` in `_sendData`
- **Pattern:** Ubiquitous
- **Root cause:** `extension.ts` `_sendData()` uses `acc: any` as the accumulator type in a `reduce` call.
- The system SHALL replace `acc: any` with `acc: Record<string, number>` to satisfy strict TypeScript.

### R12 — Fix: Node context menu has no click-outside handler
- **Pattern:** Event
- **Root cause:** The node context menu (`nodeContextMenu` state in `WhiteboardCanvas.tsx`) has no click-outside handler; the user must click a menu item to close it. The `EdgeContextMenu` component already implements a correct `mousedown` outside handler as a reference.
- WHEN the user clicks outside the node context menu, the system SHALL close it by setting `nodeContextMenu` to `null`.

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|------------|
| Dismissed suggestions survive parse / page reload | R1, R2 |
| Global toggle hides all suggested edges from graph | R3 |
| Disable a uses edge without deleting the link | R4, R5 |
| Re-enable a disabled uses edge | R6 |
| EdgeContextMenu shows Accept/Dismiss for scored suggestions | R7 |
| Dismiss from canvas correctly removes suggestion from state | R8 |
| Dialog Accept correctly locates and promotes the edge | R9 |
| Parser computes TF-IDF matrix exactly once per parse | R10 |
| `_sendData` has no implicit `any` | R11 |
| Node context menu closes on outside click | R12 |
