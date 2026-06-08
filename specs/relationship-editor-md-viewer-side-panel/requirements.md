# Requirements: relationship-editor-md-viewer-side-panel (FEAT-009)

> Feature FEAT-009 from `feature_list.json`. Adds edge deletion/modification, file-content viewer on node click, and a side panel for entity creation with full Agent Skills specification fields.
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

## Requirements

### R1 — Edge deletion on click
- **Pattern:** Event
- **Wording:** WHEN a user clicks on an edge in the whiteboard, THEN the system SHALL display a contextual action (tooltip or button) that allows deleting that relationship, AND upon confirmation the system SHALL remove the edge from both the local graph and the persisted files (agentic.json and SUBAGENT.md).

### R2 — Edge deletion via keyboard
- **Pattern:** Event
- **Wording:** WHEN a user selects an edge and presses the `Delete` or `Backspace` key, THEN the system SHALL remove the selected edge from the graph and persist the deletion.

### R3 — MD file content in detail panel
- **Pattern:** Event
- **Wording:** WHEN a user clicks on a node in the whiteboard, THEN the detail panel at the bottom SHALL display the full content of the corresponding Markdown file (SUBAGENT.md for agent/subagent nodes, SKILL.md for skill nodes) rendered as read-only text with syntax highlighting.

### R4 — Side panel for entity creation
- **Pattern:** Event
- **Wording:** WHEN a user clicks "Add Entity" in the toolbar, THEN the system SHALL open a side panel (adjacent to the activity bar, not an inline section) containing the entity creation form, replacing the current inline "Add Entity" section.

### R5 — Skill creation with Agent Skills spec fields
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL provide the following fields when creating a Skill entity: `name` (required, kebab-case validation), `description` (required, max 1024 chars), `license` (optional), `compatibility` (optional), `metadata.author` (optional), and `metadata.version` (optional), following the agentskills.io specification.

### R6 — Subagent creation with required fields
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL provide the following fields when creating a Subagent entity: `name` (required, kebab-case), `description` (required), and permission preset selector (read-only / read-write / custom).

### R7 — Side panel toggle and close
- **Pattern:** Event
- **Wording:** WHEN a user clicks the close button on the side panel, OR clicks "Add Entity" again while the panel is open, THEN the system SHALL close the side panel and return the whiteboard to full width.

### R8 — Deletion confirmation dialog
- **Pattern:** Unwanted
- **Wording:** IF a user attempts to delete an edge or node, THEN the system SHALL show a confirmation dialog before executing the deletion, preventing accidental removal.

### R9 — Edge modification (label update)
- **Pattern:** Event
- **Wording:** WHEN a user right-clicks on an edge, THEN the system SHALL display a context menu with an option to change the relationship label ("manages", "uses", "executing"), AND upon selection the system SHALL update the edge label in both the local graph and the persisted data.

### R10 — MD file not found fallback
- **Pattern:** Unwanted
- **Wording:** IF the corresponding Markdown file for a node does not exist on disk, THEN the detail panel SHALL display a clear message: "No Markdown file found for `{nodeId}`" instead of an empty or broken view.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|--------------|
| Clicking an edge shows a delete option and removes it on confirmation | R1, R8 |
| Pressing Delete on a selected edge removes it | R2 |
| Node click shows raw MD file content in the detail panel | R3 |
| Missing MD file shows placeholder message | R10 |
| "Add Entity" opens a side panel instead of inline section | R4 |
| Side panel has close button and toggles properly | R7 |
| Skill form includes name, description, license, compatibility, metadata fields | R5 |
| Subagent form includes name, description, and permission preset | R6 |
| Right-click on edge offers label change and persists it | R9 |
