# Tasks — Enhanced SDD Panel

> Feature FEAT-025. Implements R1–R13. Execute in order.

## Foundation

- [ ] **T1** — Create `src/lmUtils.ts` with `selectFirstChatModel()` and `sendChatRequest(prompt)`, both thin wrappers over `vscode.lm`. Refactor `src/harnessParser.ts#_createLlmScorer` to use `sendChatRequest` instead of duplicating the API call. _(R10, R11, R12, R13)_

## Extension host

- [ ] **T2** — Extract a top-level `openFileInEditor(root, filePath)` helper in `src/extension.ts` (the `vscode.workspace.fs.stat` + `openTextDocument` + `showTextDocument` sequence). Refactor the existing `openMarkdownFile` case in `HarnessDashboardProvider` to call it. _(R5)_
- [ ] **T3** — In `package.json#contributes.views` add a second entry under the existing `harness-dashboard` container: `{ "type": "webview", "id": "harness-dashboard.sddManager", "name": "SDD Manager" }`. In `package.json#contributes.commands` add `{ "command": "harness-dashboard.openSddManager", "title": "Harness: Open SDD Manager" }`. _(R1)_
- [ ] **T4** — In `src/extension.ts` register `SDDManagerProvider` as a `WebviewViewProvider` for id `harness-dashboard.sddManager`, pass it the workspace root + `LogOutputChannel`, and register the `harness-dashboard.openSddManager` command (which calls `workbench.view.extension.harness-dashboard.sddManager`). _(R1)_
- [ ] **T5** — In `SDDManagerProvider.resolveWebviewView` add the postMessage cases: `getFeatureList` (read `feature_list.json` directly, return `features[]`); `getSpecFile` (read `specs/<name>/<file>.md`, return `{ exists, content }`); `saveSpecFile` (atomic write, return `{ ok, error? }`); `generateWithAI` (build prompt per R12, call `sendChatRequest`, return `{ ok, text, error? }`); `openInEditor` (call the helper from T2). _(R2, R4, R5, R7, R9, R11, R12, R13)_

## Webview

- [ ] **T6** — Create `src/webview/SDDManagerPanel.tsx` exporting `SDDManagerPanel` (root) plus local sub-components `Sidebar`, `FeatureCard`, `StatusBadge`, `SpecDetail`, `TabStrip`, `TabContent`, `ViewMode`, `EditMode`, `AIBar`, `GenerateButton`. All inline in the one file (KISS). Imports `MDViewer` from `./components/MDViewer.tsx`. Uses inline `vscode.postMessage` for the 5 messages from T5. _(R1, R2, R3, R4, R6, R7, R8, R10, R11, R13)_
- [ ] **T7** — Add `SDD_MANAGER_*` style tokens to `src/webview/styles.ts` (sidebar width 240 px, tab strip height 32 px, status-badge colours matching the existing feature-node palette: pending `#6c6c8a`, spec_ready `#d4a84a`, in_progress `#4a90d4`, done `#2aa198`, blocked `#c14a4a`). _(R2)_

## Tests

- [ ] **T8** — Unit test: `getFeatureList` reads `feature_list.json` and returns the parsed `features[]`. _(R2)_
- [ ] **T9** — Unit test: `getSpecFile` returns the file content if it exists and `{ exists: false }` if it does not. _(R4)_
- [ ] **T10** — Unit test: `saveSpecFile` writes the content atomically; on `vscode.workspace.fs.writeFile` rejection returns `{ ok: false, error }`. _(R7, R9)_
- [ ] **T11** — Unit test: `buildAIPrompt` includes title, description, template, and at most 4 096 chars of existing content; total ≤ 8 192 chars; missing template falls back to the hard-coded string. _(R12)_
- [ ] **T12** — Unit test: `generateWithAI` propagates `sendChatRequest` rejections into `{ ok: false, error }` and never touches the spec file. _(R11, R13)_

## Verification

- [ ] **T13** — `npm run build` and `npm test` are green. _(all)_
- [ ] **T14** — `./check.sh` is green (feature_list, spec files, adapter consistency). _(all)_
- [ ] **T15** — Manual: open the SDD Manager view, browse the sidebar, click a `done` feature, see the three spec tabs render via `MDViewer`. _(R1, R2, R3, R4)_
- [ ] **T16** — Manual: click "Open in editor" on the Requirements tab, edit and save in VS Code's text editor, click the same tab in the SDD Manager — content reflects the saved file (next click re-fetches). _(R4, R5)_
- [ ] **T17** — Manual: enter edit mode on a spec tab, change the content, click Save — the file is updated on disk and the tab re-renders in view mode. Click Cancel — the file is untouched. Mark a spec file read-only with `chmod -w`, click Save — error message appears, edit mode stays open. _(R6, R7, R8, R9)_
- [ ] **T18** — Manual (only if `vscode.lm.selectChatModels()` returns a model): click "Generate with AI" on the Requirements tab of a feature — the model returns EARS-formatted markdown, the text area is filled, and clicking Save persists it. Toggle VS Code's `github.copilot.chat` extension off and reload the panel — the button disappears. _(R10, R11, R12, R13)_
