# Requirements — Open Markdown File in VS Code Editor

> Feature FEAT-014 from `feature_list.json`. Fixes the "Open in Editor" button that was partially implemented in FEAT-009 (R3) but is effectively invisible in the current UI. Three root causes were identified by code analysis:
> 1. The button uses `appearance="icon"` with a codicon (`codicon-go-to-file`) — if the webview sandbox does not load the codicon font, the button renders as an invisible zero-width element.
> 2. The button is placed inside each tab's content area, not in the detail panel header — it is invisible when the user hasn't switched to the correct tab.
> 3. The button is rendered for ALL node types (agent, feature, skill, subagent) but only works for skill and subagent nodes.
>
> The fix provides a clearly visible, always-accessible "Edit File" button in the detail panel header.
>
> Each requirement is written in strict EARS and is verifiable by at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

---

## Requirements

### R1 — Edit File Button in Panel Header
- **Pattern:** State
- WHILE a `skill` or `subagent` node is selected and the detail panel is visible, the system SHALL display an "Edit File" button in the detail panel header row. The button SHALL be rendered with visible text (`Edit File`) regardless of codicon loading, and SHALL additionally render an icon if codicones are available.

### R2 — Button Hidden for Non-Editable Node Types
- **Pattern:** Ubiquitous
- The system SHALL NOT render the "Edit File" button when the selected node is of type `agent` or `feature`, since those node types do not have an editable Markdown file.

### R3 — Click Opens File in VS Code Editor
- **Pattern:** Event
- WHEN the user clicks the "Edit File" button, the system SHALL post `{ type: 'openMarkdownFile', nodeId, nodeType }` to the extension host, which SHALL resolve the file path (`.agents/skills/<id>/SKILL.md` for skills, `.agents/subagents/<id>/SUBAGENT.md` for subagents) and open it as an editable document in the VS Code text editor.

### R4 — Automatic Switch to Markdown Tab
- **Pattern:** Event
- WHEN the user clicks "Edit File", the system SHALL also switch the detail panel's active tab to "Markdown File" so the user can see the file content in the panel while editing it in the VS Code editor.

### R5 — Remove Redundant Hidden Icon Buttons
- **Pattern:** Ubiquitous
- The system SHALL remove the `appearance="icon"` open-file buttons that were placed inside the Description tab and Markdown tab content, replacing them with the header button from R1. The Markdown tab header SHALL instead show only the file path label (no duplicate button).

### R6 — File Not Found Fallback
- **Pattern:** Unwanted
- IF the resolved Markdown file does not exist on disk, THEN the extension host SHALL display a VS Code warning notification: `"File not found: <relPath>"` and SHALL NOT open a blank or broken editor tab. (This behavior is already implemented; R6 requires it to remain unchanged.)

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|------------|
| Selecting a skill node shows "Edit File" button in panel header | R1, R2 |
| Selecting a subagent node shows "Edit File" button in panel header | R1, R2 |
| Selecting an agent or feature node does NOT show the button | R2 |
| Clicking "Edit File" opens the file in VS Code editor for editing | R3 |
| Clicking "Edit File" switches detail tab to "Markdown File" | R4 |
| No redundant icon-only open-file buttons remain in tab content | R5 |
| Missing file shows warning, no broken editor tab | R6 |
