# Design — Enhanced SDD Panel

> Feature FEAT-025. A second webview view in the `harness-dashboard`
> Activity Bar container that shows the three spec files of every
> feature in `feature_list.json`, lets the user open them in VS Code's
> editor, edit them inline, or generate their content with
> `vscode.lm`. Reuses the existing `MDViewer`, the existing
> `openMarkdownFile` handler logic, and a small shared
> `src/lmUtils.ts` module that `harnessParser` already needs.

## 1. Affected files

| File | Action | Reason |
|------|--------|--------|
| `src/webview/SDDManagerPanel.tsx` | **create** | Root React component (sidebar + tabs + edit mode + AI button). All sub-components live in this one file — KISS. |
| `src/lmUtils.ts` | **create** | Small `selectFirstChatModel()` and `sendChatRequest()` helpers, used by both this feature and `harnessParser` (refactored out of `_createLlmScorer`). |
| `src/extension.ts` | modify | Register a new `SDDManagerProvider` (`WebviewViewProvider`), a new `harness-dashboard.openSddManager` command, and the 5 new postMessage handlers. |
| `src/harnessParser.ts` | modify | Replace the private `_createLlmScorer` with a call to `lmUtils.sendChatRequest` — one less duplication. |
| `src/webview/styles.ts` | modify | Add the `SDD_MANAGER_*` style tokens (sidebar width, tab strip, status-badge colours — same hex values as the existing feature-node colours). |
| `package.json` | modify | Add the second `views` entry and the new `commands` entry. **No new settings** (KISS). |

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  VS Code                                                        │
│  ┌──────────────────────┐    ┌──────────────────────────┐       │
│  │  Whiteboard          │    │  SDD Manager (NEW)       │       │
│  │  (existing)          │    │                          │       │
│  │  TimelineView ✓      │    │  ┌──────────┬─────────┐  │       │
│  │  EntitySidePanel ✓   │    │  │ sidebar  │  tabs   │  │       │
│  │                      │    │  │ (feature │ (R/D/T) │  │       │
│  │                      │    │  │  list)   │         │  │       │
│  └──────────────────────┘    │  │          │  view / │  │       │
│                              │  │          │  edit   │  │       │
│                              │  │          │  mode   │  │       │
│                              │  │          │  + AI   │  │       │
│                              │  └──────────┴─────────┘  │       │
│  ┌──────────────────────────────────────────────┐              │
│  │  Extension Host                              │              │
│  │  - HarnessDashboardProvider (existing)       │              │
│  │  - SDDManagerProvider (new)                  │              │
│  │  - lmUtils (shared)                          │              │
│  └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

The SDD Manager is a **separate `WebviewViewProvider`** (not a tab in
the whiteboard). Reasons: (a) the whiteboard's `index.tsx` is 1 101
lines, adding a mode switch would be more code than a new view;
(b) the user can have both panels open side by side, which is the
common case when writing a spec while looking at the architecture.

## 3. postMessage protocol

| Message | Direction | Payload | Effect |
|---------|-----------|---------|--------|
| `getFeatureList` | webview → host | – | Reads `feature_list.json`, returns `{ features: [{id,name,title,description,status,priority,sprint,type,agent}] }`. |
| `getSpecFile` | webview → host | `{ featureName, file: 'requirements'\|'design'\|'tasks' }` | Reads `specs/<featureName>/<file>.md`, returns `{ exists, content }`. |
| `saveSpecFile` | webview → host | `{ featureName, file, content }` | Atomic `vscode.workspace.fs.writeFile`. On failure returns `{ ok:false, error }`. |
| `generateWithAI` | webview → host | `{ featureName, file }` | Builds prompt per R12, calls `lmUtils.sendChatRequest`, returns `{ ok, text, error? }`. |
| `openInEditor` | webview → host | `{ filePath }` | Calls the same `openFileInEditor(workspaceRoot, filePath)` helper that the whiteboard uses for `openMarkdownFile` — extracted to a top-level function in `extension.ts` so both providers share it. |

The SDD Manager's `getFeatureList` reads `feature_list.json`
directly via `vscode.workspace.fs.readFile` + `JSON.parse` — it
does **not** go through `HarnessParser`, because the parser
returns milestones, not the raw feature objects the sidebar needs.

## 4. AI prompt construction (R12)

The prompt is built by `buildAIPrompt(feature, file, template)` in
`SDDManagerPanel.tsx`'s host-side handler:

```
You are writing a {requirements|design|tasks} file for a Harness SDD feature.

## Feature
- Title: {feature.title}
- Description: {feature.description}

## Template (follow this structure)
{template content from specs/templates/<file>.md, or hard-coded fallback}

## Existing content (if any, capped at 4 096 chars)
{first 4 096 chars of specs/<name>/<file>.md, or "(none)"}

## Output
Return only the markdown body, no preamble. Follow the template's structure exactly.
```

The 4 096-character cap on existing content and the 8 192-character
total cap are enforced before the call. The hard-coded fallback for
a missing template is ~10 lines of minimal EARS / design / tasks
text kept inside `buildAIPrompt` itself.

## 5. Component tree (one file)

```
SDDManagerPanel (src/webview/SDDManagerPanel.tsx)
├── Sidebar
│   └── FeatureCard (inline sub-component)
│       └── StatusBadge (inline sub-component, 5 lines)
└── SpecDetail
    ├── Header (feature id + title + Open-in-editor button)
    ├── TabStrip (Requirements | Design | Tasks)
    ├── TabContent
    │   ├── ViewMode  →  <MDViewer content={…} />
    │   └── EditMode  →  <textarea /> + Save / Cancel
    └── AIBar
        └── GenerateButton (visible iff vscode.lm reports a model)
```

`MDViewer` is imported from the existing
`src/webview/components/MDViewer.tsx` — no re-implementation of
markdown rendering, frontmatter detection, or the 200-line
truncation logic.

## 6. State persistence

None. The selected feature and active tab are **not** persisted
across webview reloads. The original spec's state-persistence R
was dropped in review as low-value complexity for a quick
viewer — clicking a feature in the sidebar takes < 200 ms, and
the user typically re-selects the feature they were working on
anyway.

## 7. Testing strategy

| Area | Approach |
|------|----------|
| Unit: `getFeatureList` | Mock `vscode.workspace.fs.readFile` to return a fixture `feature_list.json`; assert the returned `features[]` matches. |
| Unit: `getSpecFile` | Mock `vscode.workspace.fs.readFile` to return a spec file; assert content. Then mock a `ENOENT` and assert `{ exists: false }`. |
| Unit: `saveSpecFile` | Mock `vscode.workspace.fs.writeFile`; assert it is called with the right path + content. Then make the mock throw and assert the error propagates with the right shape. |
| Unit: `buildAIPrompt` | Pure function; pass a fixture feature + template + existing content; assert the prompt contains each section and respects the 4 096 / 8 192 caps. |
| Unit: `generateWithAI` | Mock `lmUtils.sendChatRequest` to return text; assert the result is passed back to the webview. Then make it reject; assert the error message. |
| Manual | Open the panel, browse features, open a spec in VS Code's editor, edit and save from the panel, click "Generate with AI" (if a model is available). |

## 8. Discarded alternatives

1. **Add the SDD Manager as a tab in the existing whiteboard
   webview** — discarded. `index.tsx` is 1 101 lines and a
   whiteboard is a graph; a spec detail view is a document. They
   share no state. Two `WebviewViewProvider`s is the right
   boundary.
2. **Custom `vscode.CustomEditor` per spec file** — discarded. A
   `CustomEditor` is tied to one file extension and cannot host a
   list + tabs in one view. The current spec is a 3-file index
   per feature, not a single file.
3. **Re-implement the timeline / status history in the SDD
   Manager** — discarded. `src/webview/TimelineView.tsx` already
   renders the SDD state machine and progress milestones on the
   whiteboard. The original R6 (timeline pane) was dropped in
   review.
4. **A "New Feature" form in the panel** — discarded. The user can
   edit `feature_list.json` directly in VS Code's editor (faster
   for power users, validated by `check.sh`, no duplication of
   the JSON schema). The original R7 (new feature form) was
   dropped in review.
5. **`workspaceState` persistence of the selected feature** —
   discarded. The cost of two `workspaceState.update` calls plus
   restore logic is not justified by remembering "which feature
   was open" across webview reloads.
6. **Per-feature `opencode.json`/`.gemini` adapter settings for
   the SDD Manager** — discarded. The SDD Manager reads
   `feature_list.json` and `specs/<name>/*.md` directly; it does
   not touch any agent-architecture files.
