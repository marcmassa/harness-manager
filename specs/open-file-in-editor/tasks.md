# Tasks — Open Markdown File in VS Code Editor

> Discrete steps in order. Implementer marks `[x]` upon completing each one. Each task references the R<n> it covers.

## Implementation

- [ ] **T1** — In `src/webview/index.tsx`, in the detail panel header's action button row, add a `<vscode-button appearance="secondary">` with text `"✏ Edit File"` that posts `openMarkdownFile` and sets `detailTab` to `'markdown'`. Wrap it in a conditional: only render when `selectedNode.type === 'skill' || selectedNode.type === 'subagent'`. _(R1, R2, R3, R4)_

- [ ] **T2** — In `src/webview/index.tsx`, remove the `<vscode-button appearance="icon">` (with `codicon-go-to-file`) from the Description tab's "Mission / Prompt" header row. _(R5)_

- [ ] **T3** — In `src/webview/index.tsx`, remove the `<vscode-button appearance="icon">` (with `codicon-go-to-file`) from the Markdown tab's sub-header row. Keep the file path label (`mdContent?.filePath`). _(R5)_

## Tests

- [ ] **T4** — Build and verify: `npm run build` must complete without errors. _(R1–R5)_

## Closure

- [ ] **T5** — Run `./check.sh` — all 96 tests green.
- [ ] **T6** — Update `feature_list.json`: set `status` to `"done"` for FEAT-014.
- [ ] **T7** — Log summary in `progress/current.md`.
