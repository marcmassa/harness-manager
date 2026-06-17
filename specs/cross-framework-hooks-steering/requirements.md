# Requirements — Cross-framework Hooks & Steering Discovery

> Feature FEAT-026. Closes the gap surfaced after FEAT-024: a project that uses
> Kiro, Claude Code, Cursor, etc. — without Harness SDD's `agentic.json` — can
> still have hooks and steering files in its framework root (e.g., `.kiro/hooks/`)
> or even in the project root (e.g., `hooks/`). The whiteboard must discover
> these and show them as first-class nodes.
>
> **Configuration philosophy**: keep the global VS Code settings surface to a
> bare minimum (3 settings). Per-adapter customisation lives in a local
> `.harness-dashboard/config.json` file inside the workspace, editable from
> the extension via a command palette action.
>
> Each requirement is written in strict EARS and is verifiable by at least one
> specific test.

## EARS Patterns

| Pattern     | Syntax                              | When to use                              |
|-------------|-------------------------------------|------------------------------------------|
| Ubiquitous  | `SHALL ...`                         | Always true, permanent condition         |
| Event       | `WHEN <event> SHALL ...`            | Triggered by a specific event            |
| State       | `WHILE <state> SHALL ...`           | While a condition remains true           |
| Optional    | `WHERE <option> SHALL ...`          | Behavior varies based on configuration   |
| Unwanted    | `IF <condition> THEN SHALL ...`     | Response to failures or edge cases       |

## Requirements

### Configuration surface (the simplification)

### R1 — Only three global VS Code settings
- **Pattern:** Ubiquitous
- The feature SHALL expose exactly three global VS Code settings:
  - `harness-dashboard.adapters.<id>.path` (already exists from FEAT-023) — root path of an adapter
  - `harness-dashboard.adapters.<id>.discovery` (default `true`) — kill switch for the discovery layer on a specific adapter
  - `harness-dashboard.discovery.root` (default `true`) — global kill switch for project-root hook/steering discovery
- All other knobs (per-adapter hooksPath, steeringPath, discoverHooks, discoverSteering, rootHooks, rootSteering) SHALL be removed from VS Code settings and moved to the local config file described in R2.

### R2 — Local workspace config file
- **Pattern:** Ubiquitous
- The extension SHALL read per-adapter customisation from `<workspace-root>/.harness-dashboard/config.json` (created on demand). The schema is:

```typescript
interface HarnessDashboardConfig {
    /** Per-adapter overrides. */
    adapters?: Record<string, {
        /** Override the hooks directory (relative to workspace root). */
        hooksPath?: string;
        /** Override the steering directory (relative to workspace root). */
        steeringPath?: string;
    }>;
    /** Per-adapter extra discovery paths (relative to workspace root). */
    extraPaths?: Record<string, {
        hooks?: string[];     // additional hook globs to scan
        steering?: string[];  // additional steering globs to scan
    }>;
}
```

- WHEN the file does not exist, the extension SHALL behave as if all overrides are empty and create the file with an empty schema the first time the user invokes the config command (R3).

### R3 — Command palette to open the config file
- **Pattern:** Event
- WHEN the user invokes the command `Harness Dashboard: Open Local Configuration`, the system SHALL open `.harness-dashboard/config.json` in the VS Code editor, creating the file (with the empty schema) if it does not exist.

### R4 — Config validation
- **Pattern:** Unwanted
- IF `.harness-dashboard/config.json` is malformed JSON, THEN the system SHALL show an error notification AND SHALL fall back to the empty config (no override) for that workspace until the file is fixed.

### Discovery behaviour

### R5 — Default discovery location (per adapter)
- **Pattern:** Ubiquitous
- For every adapter that returns `isPathConfigurable() === true` AND for which the user has not set `harness-dashboard.adapters.<id>.discovery = false`, the system SHALL scan `<adapter-path>/hooks/**/*.{sh,js,ts}` and `<adapter-path>/steering/**/*.md`, where `<adapter-path>` is the value returned by `ConfigurationRegistry.getPathFor(adapterId)`.

### R6 — Per-adapter override via local config
- **Pattern:** Optional
- WHERE `.harness-dashboard/config.json#adapters.<id>.hooksPath` is set, the system SHALL use that path (relative to workspace root) instead of the default `<adapter-path>/hooks`.
- WHERE `.harness-dashboard/config.json#adapters.<id>.steeringPath` is set, the system SHALL use that path (relative to workspace root) instead of the default `<adapter-path>/steering`.

### R7 — Per-adapter extra paths via local config
- **Pattern:** Optional
- WHERE `.harness-dashboard/config.json#extraPaths.<id>.hooks` is set, the system SHALL additionally scan each of those globs (relative to workspace root) for hook files.
- WHERE `.harness-dashboard/config.json#extraPaths.<id>.steering` is set, the system SHALL additionally scan each of those globs (relative to workspace root) for steering files.

### R8 — Project-root discovery
- **Pattern:** Optional
- WHERE the global setting `harness-dashboard.discovery.root` is `true` (default), the system SHALL additionally scan `<project-root>/hooks/**/*.{sh,js,ts}` and `<project-root>/steering/**/*.md` regardless of which adapters are detected. This covers the rare case where hook/steering files live at the project root.

### R9 — Per-adapter discovery kill switch
- **Pattern:** Optional
- WHERE the user has configured `harness-dashboard.adapters.<id>.discovery = false`, the system SHALL NOT run the discovery layer for that adapter, and SHALL NOT create hook/steering nodes from any of its paths.

### R10 — Global discovery root kill switch
- **Pattern:** Optional
- WHERE the user has configured `harness-dashboard.discovery.root = false`, the system SHALL NOT scan the project root for hooks or steering files.

### File-system behaviour

### R11 — Event inference from filename
- **Pattern:** Ubiquitous
- For each discovered hook file that has no frontmatter `event` field, the system SHALL derive the `event` from the filename by stripping the `.sh|.js|.ts` extension and normalising hyphens to underscores (e.g., `on-spec-created_validate.sh` → `on_spec_created_validate`).

### R12 — Steering description from first heading
- **Pattern:** Ubiquitous
- For each discovered steering markdown file that has no frontmatter `description` field, the system SHALL derive the `description` from the first `# H1` heading line of the file (text after `# `, trimmed).

### R13 — Framework-specific nodes take precedence
- **Pattern:** Unwanted
- IF a hook or steering file is discovered under both an adapter's path AND the project root, THEN the system SHALL keep the framework-specific discovery and SHALL skip the project-root discovery for that file to avoid duplicates.

### R14 — Hook-to-agent relationship
- **Pattern:** Ubiquitous
- For each hook node created from non-`harness-sdd` discovery, the system SHALL create a `triggers` edge from the hook node to the adapter's root agent node (the same node used by the adapter's own `manages` edges).

### R15 — Steering-to-subagent relationship
- **Pattern:** Ubiquitous
- For each steering node created from non-`harness-sdd` discovery, the system SHALL apply the same `applies_to` semantics as FEAT-024 (R6): if the file's filename matches a subagent ID, create a `governs` edge to that subagent; otherwise, create `governs` edges to all subagents of that adapter (wildcard behaviour).

### R16 — Edit button works for discovered files
- **Pattern:** Ubiquitous
- For each hook and steering node created via discovery, the system SHALL set `metadata._filePath` to the file's root-relative path so the existing "Open in VS Code editor" button works.

### R17 — Watcher integration
- **Pattern:** Ubiquitous
- Each adapter's `watchGlobs()` SHALL include the resolved hooks and steering paths (default + overrides + extras) so changes trigger a re-parse.

### Compatibility

### R18 — Backward compatibility with Harness SDD
- **Pattern:** Ubiquitous
- The `HarnessSddAdapter`'s `agentic.json`-driven hook and steering parsing (FEAT-024) SHALL remain unchanged. The new discovery layer is additive and SHALL NOT interfere with `agentic.json#hooks[]` and `agentic.json#steering[]` entries.

### R19 — Non-configurable adapters skip discovery
- **Pattern:** Unwanted
- IF an adapter returns `isPathConfigurable() === false` (e.g., `harness-sdd`, `opencode`), THEN the new discovery layer SHALL NOT scan for hooks or steering files on its behalf. The adapter's own logic handles its own resources.

## Traceability with Acceptance Criteria

| Acceptance Criterion                                                                | Covered by              |
|-------------------------------------------------------------------------------------|-------------------------|
| Only 3 global VS Code settings, not 7+                                             | R1                      |
| Local config file holds per-adapter overrides and extras                           | R2                      |
| User can open the config file from the command palette                             | R3                      |
| Malformed config falls back to defaults                                            | R4                      |
| Default discovery under `<adapter-path>/hooks/` and `/steering/` works            | R5                      |
| Per-adapter override via local config works                                        | R6                      |
| Extra globs via local config work                                                  | R7                      |
| Project-root discovery runs when `discovery.root: true`                            | R8                      |
| Per-adapter kill switch works                                                      | R9                      |
| Global kill switch for project-root works                                          | R10                     |
| Filename-based event inference works                                               | R11                     |
| H1-based description fallback works                                                | R12                     |
| No duplicate nodes from framework vs project-root paths                            | R13                     |
| Hook-to-agent edge created                                                         | R14                     |
| Steering-to-subagent edge(s) created                                               | R15                     |
| Edit button works on discovered nodes                                              | R16                     |
| File changes re-parse the graph                                                    | R17                     |
| Harness SDD `agentic.json` still works                                             | R18                     |
| `harness-sdd` and `opencode` are not affected                                      | R19                     |
