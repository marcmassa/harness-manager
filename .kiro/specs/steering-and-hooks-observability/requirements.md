# Requirements — Steering & Hooks Observability

> Feature FEAT-024 from `feature_list.json`. Parse `agentic.json#steering[]` and `agentic.json#hooks[]` resources, read the actual steering markdown files and hook scripts, and render them as first-class visual nodes on the whiteboard with relationship edges.
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

### R1 — Parse steering entries from agentic.json
- **Pattern:** Event
- WHEN the HarnessSddAdapter parses `.agents/agentic.json` AND the file contains a `steering` array SHALL create a `steering` node for each entry with fields `name`, `file`, `description`, and `applies_to` preserved in metadata.

### R2 — Parse hook entries from agentic.json
- **Pattern:** Event
- WHEN the HarnessSddAdapter parses `.agents/agentic.json` AND the file contains a `hooks` array SHALL create a `hook` node for each entry with fields `event`, `script`, `description`, and `on_failure` preserved in metadata.

### R3 — Read steering file content
- **Pattern:** Ubiquitous
- For each `steering` node, the system SHALL attempt to read the Markdown file at the path specified by the node's `file` metadata AND SHALL store the file content in `metadata._body`.

### R4 — Handle missing steering files gracefully
- **Pattern:** Unwanted
- IF the file referenced by a `steering` node's `file` field does not exist THEN the system SHALL add a parser error AND SHALL set `metadata._fileMissing` to `true`.

### R5 — Read hook script content
- **Pattern:** Ubiquitous
- For each `hook` node, the system SHALL attempt to read the shell script at the path specified by the node's `script` metadata AND SHALL store the first 500 characters of content in `metadata._preview`.

### R6 — Steering-to-subagent relationship edges
- **Pattern:** Ubiquitous
- For each `steering` node whose `applies_to` array contains a subagent ID (or `"*"` for all), the system SHALL create a `governs` edge from the steering node to each matching subagent node.

### R7 — Hook-to-agent relationship edges
- **Pattern:** Ubiquitous
- For each `hook` node, the system SHALL create a `triggers` edge from the hook node to the primary agent node.

### R8 — Distinct visual styles for steering and hook nodes
- **Pattern:** Ubiquitous
- Steering nodes SHALL have a distinct visual appearance (different shape, colour, and icon) from `agent`, `subagent`, `skill`, and `feature` nodes. Hook nodes SHALL have a different visual appearance from steering nodes.

### R9 — Open steering/hook files in editor
- **Pattern:** Event
- WHEN the user clicks an "Open file" action on a steering or hook node SHALL open the corresponding file in the VS Code text editor.

### R10 — Watch steering and hook file changes
- **Pattern:** Ubiquitous
- The HarnessSddAdapter SHALL include the paths of all steering and hook files in its `watchGlobs()` return value so that changes trigger a re-parse.

### R11 — No orphan steering or hook nodes
- **Pattern:** Event
- WHEN parsing completes AND a steering or hook node was created SHALL create at least one relationship edge (`governs` or `triggers`) for it. IF no applicable subagent or agent exists THEN the system SHALL add a parser warning.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|--------------|
| Steering entries create nodes on whiteboard | R1, R8 |
| Hook entries create nodes on whiteboard | R2, R8 |
| Steering file content is readable from node | R3, R9 |
| Missing steering file shows error | R4 |
| Hook script preview is stored in metadata | R5 |
| Steering→subagent applies_to edges visible | R6 |
| Hook→agent edges visible | R7 |
| Distinct visual per node type | R8 |
| File changes trigger re-parse | R10 |
| Warning if steering/hook has no relationships | R11 |
