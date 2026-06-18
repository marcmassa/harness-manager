# Requirements — Universal Agent Architecture Reader

> Feature FEAT-015 from `feature_list.json`. Extends the plugin to detect and parse agent
> architectures from any major agentic tool (Claude Code, Gemini CLI, Cursor, GitHub Copilot,
> OpenCode, Windsurf, Continue) without requiring Harness SDD. Each format is normalized into the
> common `HarnessGraph` model and rendered on the existing whiteboard.
>
> Each requirement is written in strict EARS and is verifiable by at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|---------|--------|-------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

---

## Requirements

### R1 — Adapter Interface
- **Pattern:** Ubiquitous
- The system SHALL define a TypeScript interface `IAgentAdapter` with three methods: `id(): string`, `detect(root: vscode.Uri): Promise<boolean>`, and `parse(root: vscode.Uri): Promise<ParserResult>`.

### R2 — Adapter Registry
- **Pattern:** Event
- WHEN the extension parses a workspace, the system SHALL iterate all registered `IAgentAdapter` implementations in declared priority order, invoke `detect()` on each, and merge the `parse()` results of all adapters that return `true` from `detect()` into a single `ParserResult`.

### R3 — Harness SDD Adapter (existing)
- **Pattern:** Event
- WHEN `.agents/agentic.json` is present in the workspace root, the system SHALL parse it using the existing Harness SDD logic (subagents, skills, commands, relationships) as the `HarnessSddAdapter`.

### R4 — Claude Code Adapter
- **Pattern:** Event
- WHEN `CLAUDE.md` or `.claude/agents/` is present in the workspace root, the system SHALL parse `CLAUDE.md` as the root `agent` node and each `.claude/agents/*.md` file (YAML frontmatter: `name`, `description`, `tools`) as a `subagent` node, with `manages` edges from the root agent to each subagent.

### R5 — Gemini CLI Adapter
- **Pattern:** Event
- WHEN `GEMINI.md` is present in the workspace root, the system SHALL parse `GEMINI.md` as the root `agent` node and each `.gemini/commands/*.toml` file as a `skill` node, with `uses` edges from the root agent to each skill.

### R6 — Cursor Adapter
- **Pattern:** Event
- WHEN `.cursor/rules/` or `.cursorrules` is present in the workspace root, the system SHALL parse `.cursor/rules/*.mdc` files using their YAML frontmatter: files with `alwaysApply: true` or no `globs` field SHALL be created as `agent` nodes; files with `globs` patterns SHALL be created as `subagent` nodes.

### R7 — GitHub Copilot Adapter
- **Pattern:** Event
- WHEN `.github/copilot-instructions.md` or `.github/instructions/*.instructions.md` or `.vscode/prompts/*.prompt.md` is present, the system SHALL parse `.github/copilot-instructions.md` as the root `agent` node, each `*.instructions.md` file as a `subagent` node (using its `applyTo` frontmatter as description), and each `*.prompt.md` as a `skill` node.

### R8 — OpenCode Adapter
- **Pattern:** Event
- WHEN `opencode.json` or `opencode.jsonc` is present in the workspace root, the system SHALL parse the file as a `ParserResult` with the project name as root `agent` node and each entry in `subagents[]` (if present) as a `subagent` node.

### R9 — Windsurf Adapter
- **Pattern:** Event
- WHEN `.windsurf/rules/*.md` or `.windsurfrc` is present, the system SHALL parse each `.windsurf/rules/*.md` file as a `subagent` node and create a synthetic root `agent` node named after the workspace.

### R10 — Framework Badge in UI
- **Pattern:** Event
- WHEN at least one adapter's `detect()` returns `true`, the system SHALL display a compact badge in the webview dashboard header listing the names of all detected frameworks (e.g. "Harness · Claude Code").

### R11 — Multi-Framework Merge
- **Pattern:** State
- WHILE multiple adapters are active simultaneously, the system SHALL assign each node a `_framework` metadata field with the originating adapter id and SHALL render nodes from different frameworks with a visually distinct border color or icon.

### R12 — Graceful Degradation
- **Pattern:** Unwanted
- IF an adapter's `parse()` throws an error or a config file is malformed, the system SHALL catch the error, log it to the `OutputChannel` at `warn` level, skip that adapter's result, and continue merging results from remaining adapters without crashing the extension.

### R13 — Empty State
- **Pattern:** State
- WHILE no adapter's `detect()` returns `true`, the system SHALL display a dedicated empty state in the webview with a list of supported frameworks and their required file signatures.

### R14 — File Watcher Extension
- **Pattern:** Event
- WHEN any file matching a registered adapter's detection pattern changes, is created, or is deleted on disk, the system SHALL trigger a full re-parse and push the updated `ParserResult` to the webview.

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---------------------|------------|
| `IAgentAdapter` interface is implemented by all adapters | R1 |
| All active adapters' results are merged into one graph | R2 |
| Existing Harness SDD project parses correctly via adapter | R3 |
| Claude Code `.claude/agents/*.md` appear as subagent nodes | R4 |
| Gemini CLI `GEMINI.md` + commands appear as agent+skills | R5 |
| Cursor `.cursor/rules/*.mdc` appear as agent/subagent nodes | R6 |
| Copilot instructions and prompts appear as agent/skill nodes | R7 |
| OpenCode `opencode.json` agents appear as subagent nodes | R8 |
| Windsurf rules appear as subagent nodes | R9 |
| Dashboard header shows detected framework names | R10 |
| Multi-framework nodes have `_framework` metadata | R11 |
| Malformed config → warn log, no crash, other adapters continue | R12 |
| No config files → empty state shown in webview | R13 |
| Saving a config file triggers webview refresh | R14 |
