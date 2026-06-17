# Requirements — Enhanced SDD Panel

> Feature FEAT-025 from `feature_list.json`. A focused, read-and-edit
> webview panel for the three spec files (`requirements.md`,
> `design.md`, `tasks.md`) of every feature in `feature_list.json`,
> with a one-click "Generate with AI" button. The existing
> whiteboard's `TimelineView` and `EntitySidePanel` already cover
> the timeline and entity-creation flows — this spec does NOT
> duplicate them.
>
> Each requirement is written in strict EARS and is verifiable by
> at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|-------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — Dedicated SDD Manager panel
- **Pattern:** Ubiquitous
- The extension SHALL provide a second webview view in the `harness-dashboard` Activity Bar container, with id `harness-dashboard.sddManager` and title "SDD Manager", reachable from the Activity Bar icon AND from the command palette command `Harness: Open SDD Manager`.

### R2 — Feature list with status badges
- **Pattern:** Ubiquitous
- The SDD Manager panel SHALL display, in a left sidebar, every entry from `feature_list.json` with its `id`, `title`, `status`, and `priority`. The status SHALL be rendered as a colour-coded badge using the same colours the whiteboard uses for `feature` nodes (pending=grey, spec_ready=amber, in_progress=blue, done=green, blocked=red).

### R3 — Three spec tabs
- **Pattern:** Event
- WHEN the user selects a feature in the sidebar SHALL display three tabs labelled **Requirements**, **Design**, and **Tasks**, one per spec file (`specs/<feature.name>/<requirements|design|tasks>.md`).

### R4 — Render tab content or placeholder
- **Pattern:** Event
- WHEN a tab becomes active SHALL render the contents of its spec file via the existing `MDViewer` component. WHERE the spec file does not exist SHALL show a "Not yet created" placeholder with a button labelled "Open in editor".

### R5 — Open spec in VS Code editor
- **Pattern:** Event
- WHEN the user clicks "Open in editor" on a tab SHALL open the corresponding spec file (`specs/<feature.name>/<file>.md`) in the VS Code text editor, reusing the existing `openMarkdownFile` handler logic.

### R6 — Inline edit mode
- **Pattern:** State
- WHILE edit mode is active for a tab SHALL show a monospace text area pre-filled with the current file content. WHILE edit mode is active SHALL show "Save" and "Cancel" buttons in place of the "Open in editor" button.

### R7 — Save spec file
- **Pattern:** Event
- WHEN the user clicks "Save" in edit mode SHALL write the text area contents to the corresponding spec file on disk atomically and SHALL re-render the tab in view mode with the new content.

### R8 — Exit edit mode without saving
- **Pattern:** Event
- WHEN the user clicks "Cancel" in edit mode SHALL exit edit mode and SHALL discard the in-memory text area contents. WHEN the user clicks another feature in the sidebar while edit mode is active SHALL exit edit mode silently and SHALL discard the in-memory text area contents (no confirmation dialog — the in-memory edits were never persisted, so the data is not lost).

### R9 — Save error handling
- **Pattern:** Unwanted
- IF the spec file write fails (e.g. file is read-only, or the user lacks write permission) THEN the system SHALL show an error message containing the failure reason AND SHALL keep edit mode open with the original content so the user does not lose work.

### R10 — AI button visibility
- **Pattern:** Optional
- WHERE `vscode.lm.selectChatModels()` returns at least one model SHALL show a button labelled "Generate with AI" on each spec tab. WHERE no model is available SHALL NOT show the button.

### R11 — AI generation call
- **Pattern:** Event
- WHEN the user clicks "Generate with AI" on a tab SHALL build a context-aware prompt per R12, call `vscode.lm.sendChatRequest`, and SHALL replace the text area (in edit mode) or the tab content (in view mode) with the model's response.

### R12 — AI prompt format and context budget
- **Pattern:** Ubiquitous
- The AI prompt SHALL include: (a) the feature's `title` and `description` from `feature_list.json`, (b) the corresponding spec template from `specs/templates/{requirements,design,tasks}.md` (verbatim), and (c) WHERE the target spec file already exists the first 4 096 characters of its current content. The total prompt size SHALL NOT exceed 8 192 characters. The prompt SHALL instruct the model to produce output that follows the template's structure (EARS for `requirements.md`, technical design for `design.md`, task checklist for `tasks.md`) and to return only the markdown body, with no preamble. IF `specs/templates/<file>.md` is missing THEN the system SHALL fall back to a hard-coded minimal template of the corresponding kind.

### R13 — AI errors and loading states
- **Pattern:** Unwanted
- IF the AI request fails (no model, timeout, invalid response) THEN the system SHALL show an error message AND SHALL NOT modify any spec file or text area. WHILE the AI request is in flight SHALL disable the "Generate with AI" button and show a loading indicator.

## Traceability with Acceptance Criteria

| Acceptance Criterion                                              | Covered by |
|-------------------------------------------------------------------|------------|
| SDD Manager view is reachable from Activity Bar and command palette | R1       |
| Sidebar lists every feature with id / title / status / priority   | R2         |
| Status badges use the same colours as the whiteboard's feature nodes | R2       |
| Selecting a feature shows three tabs (one per spec file)          | R3         |
| Active tab renders the file via MDViewer, or a "Not yet created" placeholder | R4 |
| "Open in editor" button opens the spec file in VS Code            | R5         |
| Edit mode shows a pre-filled text area with Save/Cancel           | R6         |
| Save writes the file atomically and re-renders the tab            | R7         |
| Cancel and sidebar-switch discard in-memory edits silently        | R8         |
| Save errors keep edit mode open and show the reason               | R9         |
| "Generate with AI" button is hidden when no LM is available       | R10        |
| AI click calls the model and replaces the tab content             | R11        |
| AI prompt uses the spec template and respects the 4 KB / 8 KB caps | R12       |
| AI failures show an error and leave the file untouched            | R13        |
