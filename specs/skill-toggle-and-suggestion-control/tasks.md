# Tasks — Skill Toggle & Suggestion Visibility Control

> Discrete steps in order. The implementer marks `[x]` upon completing each one. Each task references the R<n> it covers.

---

## Implementation

### Backend — Extension Host

- [ ] **T1** — Add `context: vscode.ExtensionContext` as third constructor parameter to `HarnessDashboardProvider`; store it as `this._context`. Update the `activate` function call site accordingly. _(R1, R4)_

- [ ] **T2** — Add `ParseOptions` interface to `harnessParser.ts` (`dismissedSuggestions?: Set<string>`, `disabledConnections?: Set<string>`). Update `HarnessParser.parse()` signature to accept optional `ParseOptions`. In `_sendData()`, read both sets from `this._context.workspaceState` and pass them to `parse()`. _(R2, R4)_

- [ ] **T3** — In `addSemanticSuggestions` (parserLogic.ts), add optional `dismissedSuggestions?: Set<string>` parameter; before emitting a suggested edge, check `dismissedSuggestions?.has(`${subagentId}::${skillId}`)` and skip if true. Apply the same guard in `addCrossRefEdges`. _(R1, R2)_

- [ ] **T4** — In `HarnessParser.parse()`, after all suggested edges are added, iterate uses edges and set `edge.metadata.disabled = true` for any edge whose `"source::target"` key is in `disabledConnections`. _(R4, R5)_

- [ ] **T5** — Fix double idoneity computation: change `enrichWithIdoneity` return type from `void` to `IdoneityMatrix` (return the computed matrix). Change `enrichSuggestedEdgesWithIdoneity` signature to accept `matrix: IdoneityMatrix` as second param; remove the internal `computeIdoneityMatrix` call and use the passed matrix instead. Thread the matrix through `harnessParser.ts`. _(R10)_

- [ ] **T6** — Fix `_sendData` implicit `any`: change `acc: any` to `acc: Record<string, number>` in the `reduce` call in `extension.ts`. _(R11)_

- [ ] **T7** — Add two new `case` blocks in the `webviewView.webview.onDidReceiveMessage` handler:
  - `'dismissSuggestion'`: validate `data.subagentId` and `data.skillId` are non-empty strings, persist to `workspaceState['harness-manager.dismissedSuggestions']`, call `_sendData()`.
  - `'toggleSkillConnection'`: validate `data.source` and `data.target`, persist to `workspaceState['harness-manager.disabledConnections']` (add or remove based on `data.disabled`), call `_sendData()`. _(R1, R4, R6)_

### Frontend — EdgeContextMenu

- [ ] **T8** — In `EdgeContextMenu.tsx`, replace `currentLabel = (edge.label as EdgeLabel)` with `originalLabel = (edge.data as any)?.originalLabel as string | undefined`. Derive `isSuggested = originalLabel === 'suggested'` and `isUses = originalLabel === 'uses'`. Derive `isDisabled = isUses && edge.data?.metadata?.disabled === true`. Add optional prop `onToggleConnection?: (edge: Edge, disable: boolean) => void`. _(R7)_

- [ ] **T9** — In `EdgeContextMenu.tsx`, add Disable/Enable button: render `'⏸ Disable Connection'` when `isUses && !isDisabled && !isSuggested`, and `'▶ Enable Connection'` when `isUses && isDisabled`. Button calls `onToggleConnection?.(edge, !isDisabled); onClose()`. _(R4, R6)_

### Frontend — WhiteboardCanvas

- [ ] **T10** — Fix `handleDismissSuggestion` (R8): change the `setEdges` filter from `e.label === 'suggested'` to `(e.data as any)?.originalLabel === 'suggested'`. Add a `vscode.postMessage({ type: 'dismissSuggestion', subagentId: source, skillId: target })` call after the state update. _(R1, R8)_

- [ ] **T11** — Fix `handleAcceptSuggestion` in the suggestion dialog (R9): change `edges.find(... e.label === 'suggested')` to `edges.find(... (e.data as any)?.originalLabel === 'suggested')`. _(R9)_

- [ ] **T12** — Add `handleToggleConnection` callback: posts `{ type: 'toggleSkillConnection', source, target, disabled }` to extension. Pass it to `EdgeContextMenu` as `onToggleConnection`. _(R4, R6)_

- [ ] **T13** — Add disabled edge rendering in `initialEdges` map: when `label === 'uses' && e.metadata?.disabled === true`, apply disabled style (`stroke: '#6c6c8a'`, `strokeDasharray: '4,4'`, `opacity: 0.45`, `strokeWidth: 2`) and prepend `⏸ ` to `displayLabel`. Store `disabled: true` in `edge.data.metadata`. _(R5)_

- [ ] **T14** — Fix node context menu click-outside (R12): add a full-screen transparent overlay `div` (`position: fixed; inset: 0; zIndex: 9998`) rendered just before the menu `div` when `nodeContextMenu !== null`; its `onClick` calls `setNodeContextMenu(null)`. Raise menu `div` to `zIndex: 9999`. _(R12)_

### Frontend — index.tsx

- [ ] **T15** — Add `showSuggestions` boolean state (default `true`). In the header, add a `<vscode-checkbox>` labeled "Suggestions" that controls this state. In `filteredGraph` memo, add condition: `if (!showSuggestions && e.label === 'suggested') return false`. _(R3)_

---

## Tests

- [ ] **T16** — Unit test (`parserLogic.test.ts`): verify that `addSemanticSuggestions` does NOT emit a suggested edge for a pair included in the `dismissedSuggestions` set, but DOES emit for non-dismissed pairs. _(R1, R2)_

- [ ] **T17** — Unit test (`parserLogic.test.ts`): verify that `enrichWithIdoneity` returns a non-null `IdoneityMatrix` with the expected `records` count. Verify that `enrichSuggestedEdgesWithIdoneity(result, matrix)` enriches suggested edges without recomputing (pass a spy/mock matrix and confirm `computeIdoneityMatrix` is only called once). _(R10)_

- [ ] **T18** — Unit test (`parserLogic.test.ts`): verify that uses edges whose `"source::target"` key is in `disabledConnections` have `metadata.disabled === true` after `parse()`, and edges NOT in the set have `metadata.disabled` falsy. _(R4, R5)_

- [ ] **T19** — Unit test (`bridge.test.ts` or new `extension.test.ts`): verify `isSuggested` logic — given an edge whose `data.originalLabel === 'suggested'` and `label === 'suggested (0.56)'`, `isSuggested` SHALL be `true`. _(R7)_

- [ ] **T20** — Unit test (`parserLogic.test.ts`): verify `addCrossRefEdges` does NOT emit a suggested edge for a cross-ref pair in `dismissedSuggestions`. _(R1)_

---

## Closure

- [ ] **T21** — Document traceability `R<n> ↔ test` in `progress/impl_feat-013.md`
- [ ] **T22** — Run `./check.sh` and verify all tests pass (≥ 88 tests green)
- [ ] **T23** — Update `feature_list.json`: set `status` to `"done"` for FEAT-013
- [ ] **T24** — Log summary in `progress/progress.md`
