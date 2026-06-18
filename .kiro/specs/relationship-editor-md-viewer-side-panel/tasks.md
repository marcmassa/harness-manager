# Tasks: relationship-editor-md-viewer-side-panel (FEAT-009)

> Discrete steps in order. The implementer marks `[x]` upon completing each one. Each task references the R<n> it covers.

## Implementation

- [ ] **T1** — Add `MarkdownFileContent` type and `EdgeLabel` type to `src/types.ts` _(R1-R10)_
- [ ] **T2** — Add `deleteEdge()` and `updateEdgeLabel()` methods to `src/harnessWriter.ts` — removes from agentic.json subagent[].skills[] and ## Skills section for 'uses' edges; handles 'manages' and 'executing' edge types _(R1, R2, R9)_
- [ ] **T3** — Add `getMarkdownContent()` method to `src/harnessParser.ts` — resolves file path by node type and reads raw content _(R3, R10)_
- [ ] **T4** — Update `src/extension.ts` message handler: add cases for `getMarkdownContent`, `deleteEdge`, `updateEdgeLabel` with appropriate responses _(R1-R3, R9)_
- [ ] **T5** — Create `src/webview/components/EdgeContextMenu.tsx` — floating context menu on edge click with "Delete Relationship" and "Change Label" actions; Delete key listener on selected edges _(R1, R2, R8, R9)_
- [ ] **T6** — Create `src/webview/components/MDViewer.tsx` — read-only Markdown content viewer with monospace styling, scrollable, shows placeholder when file not found _(R3, R10)_
- [ ] **T7** — Create `src/webview/components/EntitySidePanel.tsx` — slide-out side panel with entity type selector (subagent/skill), name field (kebab-case validation), description field (char counter), and Agent Skills optional fields (license, compatibility, author, version); permission preset for subagents _(R4, R5, R6, R7)_
- [ ] **T8** — Modify `src/webview/WhiteboardCanvas.tsx` — add edge click handler to show EdgeContextMenu, integrate Delete key listener, handle edge removal from local state _(R1, R2, R9)_
- [ ] **T9** — Modify `src/webview/index.tsx` — replace inline "Add Entity" section with side panel integration; wire up MDViewer in detail panel; handle new message types from extension; remove old inline form state variables _(R3, R4, R7)_

## Tests

- [ ] **T10** — Add unit test for `harnessWriter.deleteEdge()` — verify it removes from agentic.json and SUBAGENT.md for 'uses' edges _(R1)_
- [ ] **T11** — Add unit test for `harnessWriter.updateEdgeLabel()` — verify it updates label correctly _(R9)_
- [ ] **T12** — Add unit test for `harnessParser.getMarkdownContent()` — verify file resolution per node type and fallback for missing files _(R3, R10)_
- [ ] **T13** — Add unit test for EntitySidePanel validation — invalid kebab-case, empty description, overlong description _(R5, R6)_
- [ ] **T14** — Add unit test for EdgeContextMenu — verify it renders on edge click / right-click, fires delete callback _(R1, R8)_
- [ ] **T15** — Add integration test for full delete-edge flow: click → confirm → persisted → graph rebuilt without edge _(R1, R8)_
- [ ] **T16** — Add integration test for MD viewer: click node → MD content received → displayed in detail panel; missing file → placeholder shown _(R3, R10)_

## Post‑implementation Fixes

- [ ] **T21** — **(BUGFIX)** Edge deletion broken by idoneity display label: `handleDeleteEdge` sent `edge.label` (`"uses (0.87)"`) instead of the original label (`"uses"`), causing `deleteEdge` label check to fail. Add `originalLabel` to edge `data` during creation, and reference it in `handleDeleteEdge`. _(R1, R8)_
  - WhiteboardCanvas.tsx: store `data: { metadata: e.metadata, originalLabel: label }` in edge creation
  - WhiteboardCanvas.tsx: use `(edge.data as any)?.originalLabel || edge.label || 'uses'` in delete message

## Closure

- [ ] **T17** — Document traceability `R<n> ↔ test` in `progress/impl_feat-009.md`
- [ ] **T18** — Run `npm run build` and `./check.sh` — verify all tests pass
- [ ] **T19** — Update `feature_list.json`: set `status` to `"done"` for FEAT-009
- [ ] **T20** — Log summary in `progress/progress.md`

## Skill Assignment
- **Agent**: `typescript-implementer` (should load `ui-ux-design-standards` + `vscode-extension-best-practices` skills)

## Task Dependencies

```
T1 (types)
 ├─ T2 (writer)
 ├─ T3 (parser)
 ├─ T5 (EdgeContextMenu)
 ├─ T6 (MDViewer)
 └─ T7 (EntitySidePanel)
      │
T4 (extension handlers) ← depends on T2, T3
      │
T8 (WhiteboardCanvas edge interactions) ← depends on T5
T9 (index.tsx integration) ← depends on T4, T6, T7, T8
      │
T10-T16 (tests) ← depends on T9
T17-T20 (closure)
```
