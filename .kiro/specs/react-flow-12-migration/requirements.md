# Requirements — React Flow 12 & React 19 Migration

> Feature FEAT-037 from `feature_list.json`. Migrate the whiteboard's graph
> library from `reactflow@11.11.4` to `@xyflow/react@^12.11` and the webview
> runtime from React 18 to React 19 — with **zero user-visible regression** on
> the whiteboard. This spec **shares release 0.8.1** with FEAT-036
> (supply-chain-health): 0.8.1 is not yet tagged or published, so both features
> ship together and the existing `CHANGELOG.md` `[0.8.1]` section is
> **extended**, not duplicated. The package version stays `0.8.1` (no bump).
>
> Each requirement is written in strict EARS and is verifiable by at least one
> specific test (unit, e2e, package inspection, or the in-VS-Code manual
> checklist defined in `design.md` §9).

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — Whiteboard behavior parity after migration
- **Pattern:** Ubiquitous
- After the migration, when the whiteboard renders a workspace containing
  agents, subagents, skills, steering, hooks, and discovered entities, the
  system SHALL render the same node set, the same automatic layout geometry,
  and the same edge set as rendered by React Flow 11 for the same input.

### R2 — Dependency and import surface fully on @xyflow/react
- **Pattern:** Ubiquitous
- The extension SHALL declare `@xyflow/react` (≥ 12.11.6), `react` (^19) and
  `react-dom` (^19) as its graph/runtime dependencies, and the source tree
  SHALL NOT contain any import of the `reactflow` package or of
  `reactflow/dist/style.css`.

### R3 — React Flow 12 stylesheet loaded
- **Pattern:** Ubiquitous
- The webview bundle SHALL include the `@xyflow/react/dist/style.css`
  stylesheet so that nodes, edges, handles, controls and the attribution pane
  render with React Flow's v12 base styling under the existing VS Code
  theme-variable overrides.

### R4 — No "styles not loaded" warning
- **Pattern:** Unwanted
- If the whiteboard renders in any VS Code theme, then the webview console
  SHALL NOT emit React Flow 12's "styles not loaded" warning.

### R5 — Manual node-drag persistence preserved (FEAT-017)
- **Pattern:** Event
- When the user drags a node to a new position and releases it, the system
  SHALL record that position as a manual override and SHALL restore it on the
  next parse/refresh, exactly as specified by FEAT-017.

### R6 — Click-vs-drag disambiguation at the v12 threshold
- **Pattern:** Ubiquitous
- The whiteboard SHALL set an explicit node drag threshold of **1 pixel**
  (React Flow 12's new default, adopted deliberately — see design §4), so a
  press–release sequence that moves the pointer less than 1 px is treated as
  a click and does not start a node drag.

### R7 — Per-type edge styling and z-index layering preserved (FEAT-016)
- **Pattern:** Ubiquitous
- After the migration, each edge kind (`manages`, `uses`, `executing`,
  `discovered`, `suggested`, `governs`, `triggers`, `inferred`) SHALL keep its
  routing type, stroke, dash pattern, animated state, arrow marker, label and
  hover/selected z-index elevation as defined by FEAT-016, and edges SHALL NOT
  remount when only their z-index changes (v12 behavior adopted).

### R8 — Edge and node context menus preserved
- **Pattern:** Event
- When the user clicks an edge, the system SHALL open the edge context menu at
  the click position; and when the user right-clicks a node, the system SHALL
  open the node context menu — both with the same actions as before the
  migration (change label, delete, accept/dismiss suggestion, toggle, show
  skill suggestions).

### R9 — Suggestion accept/dismiss flow preserved
- **Pattern:** Event
- When the user accepts a `suggested` edge from the context menu, the system
  SHALL restyle it as a `uses` edge and post the `acceptSuggestion` message to
  the extension host; and when the user dismisses it, the system SHALL remove
  the edge and post `dismissSuggestion` — identical to pre-migration behavior.

### R10 — React 19 runtime
- **Pattern:** Ubiquitous
- The webview SHALL run on React 19 (`react` and `react-dom` major 19, with
  matching `@types/*`), mounting via `react-dom/client` `createRoot`, and
  `@vscode/webview-ui-toolkit` SHALL remain compatible (its declared peer
  range `react >=16.9.0` is satisfied by 19).

### R11 — No console errors or deprecation warnings
- **Pattern:** Unwanted
- If the extension activates and the whiteboard renders, then the webview
  console SHALL NOT contain any error, any React 19 removed-API warning
  (function-component `defaultProps`, legacy lifecycle, `ReactDOM.render`), or
  any React Flow 12 runtime warning.

### R12 — VSIX size budget with recorded before/after
- **Pattern:** Unwanted
- If the migration is proposed as complete, then the before/after
  `vsce package` VSIX sizes SHALL be recorded in this spec folder, and the
  after-size SHALL remain below the 300 KB budget of DESIGN.md §2.4; if the
  budget is exceeded, the migration SHALL NOT be declared done.

### R13 — Governance documents reflect the shared 0.8.1 release
- **Pattern:** Ubiquitous
- The system SHALL keep its documents truthful: DESIGN.md §4/§6 SHALL state
  React 19 + React Flow 12 (file stays ≤ 250 lines), the existing
  `CHANGELOG.md` `[0.8.1]` section SHALL be **extended** with this migration
  (no new `[0.9.0]` section), the README "What's new in 0.8.1" SHALL cover
  **both** FEAT-036 and FEAT-037, and `package.json#version` SHALL remain
  `0.8.1`.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|------------|
| Whiteboard renders identically (nodes, layout, edges, theme) | R1, R2, R3, R7 |
| Styles load; no library warnings | R3, R4, R11 |
| Manual drag + position persistence (FEAT-017) unchanged, clicks don't nudge nodes | R5, R6 |
| Edge styling / layering (FEAT-016) unchanged | R7, R8, R9 |
| React 19 runtime, no deprecated APIs | R10, R11 |
| Bundle budget respected and measured | R12 |
| Docs honest about the shared 0.8.1 release | R13 |
| Existing gates stay green (773 tests, esbuild, e2e, ./check.sh) | R1, R5–R11 |
