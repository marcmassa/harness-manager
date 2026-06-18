# Requirements — Configurable adapter paths + Kiro adapter + whiteboard UX polish

> Feature FEAT-023 from `feature_list.json`. **Three-part
> feature**, of which Part A is the lasting architectural
> contribution and Parts B and C are the immediate payoffs.
>
> **Part A — Configurable adapter paths (general mechanism):**
> introduce a `ConfigurationRegistry` pattern that lets the
> user override the detection path of **any** adapter via VS
> Code settings (per-adapter, per-workspace, not Kiro-specific).
> The setting is a generic mechanism; each adapter opts in to
> exposing its detection path. The maintainer's earlier
> observation (in the spec-author session) is the design
> driver: the system must be extensible, not a one-off Kiro
> setting. **Kiro is the first consumer** of the registry.
>
> **Part B — Kiro adapter:** add a Kiro adapter (detection
> file: `.kiro/`) that uses the ConfigurationRegistry to
> expose its path as `harness-dashboard.adapters.kiro.path`
> (overridable, defaults to `.kiro`). Kiro is the AWS AI IDE
> (2025+), stores its config under `.kiro/`, and is a
> natural first-payoff adapter for the registry because its
> layout is not yet stabilized.
>
> **Part C — Whiteboard UX polish:** smoother, more
> professional node animations, and an explicit no-overlap
> guarantee for node positions. Two long-standing gaps closed:
> (1) **node overlap** — dagre auto-layout can produce
> identical `(x, y)` for two nodes, and the current code
> does not detect or fix this; (2) **animation quality** —
> node transitions are either instant or a single CSS dash,
> and the `fitView` camera movement snaps instead of
> easing. The polish is CSS-based, no new dependencies.
>
> The three parts are atomic in implementation (single
> commit, single test run) but produce largely independent
> code paths. Each requirement is in strict EARS and
> verifiable by at least one test.
>
> Because the feature is **tripartite**:
> - **R1–R8 cover the Configuration Registry** (always
>   shipped, the lasting contribution).
> - **R9–R15 cover the Kiro adapter** (always shipped, the
>   first payoff; depends on R1–R8).
> - **R16–R22 cover the whiteboard polish** (always
>   shipped; the no-overlap guarantee is a hard
>   requirement).

## EARS Patterns

| Pattern | Syntax | When |
|---|---|---|
| **Ubiquitous** | `SHALL ...` | Always true |
| **Event** | `WHEN <event> SHALL ...` | Triggered |
| **State** | `WHILE <state> SHALL ...` | Continuous |
| **Optional** | `WHERE <option> SHALL ...` | Configurable |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Failure handling |

## Part A — ConfigurationRegistry (R1–R8)

### R1 — Per-adapter configurable detection path setting
- **Pattern:** Ubiquitous
- **Wording:** The extension SHALL register a VS Code setting `harness-dashboard.adapters.<adapter-id>.path` for every adapter that opts in to configuration (via a `isPathConfigurable: boolean` flag on the `IAgentAdapter` interface). The setting SHALL be a `string` with the default value being the adapter's current default detection path (so the behavior is unchanged when the user does not override).

### R2 — Setting shape and scope
- **Pattern:** Ubiquitous
- **Wording:** The settings SHALL have `scope: 'resource'` (workspace-level, not global), `type: 'string'`, and SHALL be declared in the `contributes.configuration` block of `package.json`. Example for Kiro: `{ "key": "harness-dashboard.adapters.kiro.path", "type": "string", "default": ".kiro", "description": "Path to the Kiro agent configuration directory (relative to workspace root)." }`.

### R3 — Setting consumption at adapter runtime
- **Pattern:** Event
- **Wording:** WHEN an adapter's `detect()`, `parse()`, or `watchGlobs()` method is called, the system SHALL first read the corresponding setting via `vscode.workspace.getConfiguration('harness-dashboard').get(`adapters.${adapterId}.path`)`, and SHALL use that value in place of the hardcoded default. If the setting is an empty string or whitespace, the system SHALL fall back to the default (graceful degradation).

### R4 — Adapter opts in to configuration
- **Pattern:** Ubiquitous
- **Wording:** The `IAgentAdapter` interface SHALL add a new method `isPathConfigurable(): boolean`. Adapters that opt in return `true` and the registry reads R1's setting for them; adapters that opt out return `false` and the registry skips the setting (no setting is registered, no user-facing surface).

### R5 — Initial set of configurable adapters
- **Pattern:** Ubiquitous
- **Wording:** For this feature, the configurable adapters SHALL be: `kiro` (the new Part B adapter), `claude-code`, `cursor`, `gemini-cli`, `copilot`, and `windsurf`. The `harness-sdd` adapter SHALL NOT be configurable (its `.agents/agentic.json` path is canonical and changing it would break the framework's own tooling).

### R6 — Invalid path handling
- **Pattern:** Unwanted
- **Wording:** IF the user sets `harness-dashboard.adapters.<id>.path` to a path that does not exist (or to a path that is not a directory), the adapter's `detect()` SHALL return `false` (no error), the OutputChannel SHALL emit a one-line warning ("Configured path '<X>' for adapter '<id>' does not exist or is not a directory; using default detection"), and the system SHALL NOT throw.

### R7 — Setting validation in `package.json`
- **Pattern:** Ubiquitous
- **Wording:** The `package.json#contributes.configuration.properties` block SHALL declare one `harness-dashboard.adapters.<id>.path` entry per configurable adapter (per R5), with the same `type: 'string'`, `default`, and `description` as the design's schema. VS Code's built-in settings UI SHALL auto-complete the settings based on these declarations.

### R8 — Configuration unit tests
- **Pattern:** Ubiquitous
- **Wording:** The test suite SHALL include at least 5 unit tests for the ConfigurationRegistry: (a) an adapter that opts in (`isPathConfigurable() === true`) reads the setting; (b) an adapter that opts out does NOT read the setting; (c) an empty-string setting falls back to the default; (d) a non-existent configured path triggers the warning + graceful fallback; (e) a configured path that is not a directory triggers the same warning + fallback. All 5 pass on a clean main.

## Part B — Kiro adapter (R9–R15)

### R9 — Kiro adapter detection
- **Pattern:** Event
- **Wording:** WHEN the project root contains a `.kiro/` directory, the system SHALL register a Kiro agent adapter and surface it on the whiteboard alongside the other 6 active adapters. Detection uses the configured path (per R1–R3, default `.kiro/`).

### R10 — Kiro subagent discovery
- **Pattern:** Ubiquitous
- **Wording:** The Kiro adapter SHALL discover each `<configured-path>/agents/<name>.md` (or equivalent documented Kiro agent definition file) as a `subagent` node in the graph, with the file's H1 title as the node label and the file's first paragraph as the node description.

### R11 — Kiro skill discovery
- **Pattern:** Ubiquitous
- **Wording:** The Kiro adapter SHALL discover each `<configured-path>/skills/<name>/SKILL.md` (or equivalent documented Kiro skill definition file) as a `skill` node in the graph, using the same `gray-matter` frontmatter + body parsing that the other adapters use (so the skill shows up in the idoneity matrix, the semantic matcher, and the dismissable-suggestion system).

### R12 — Kiro subagent-skill relationships
- **Pattern:** Event
- **Wording:** WHEN a Kiro subagent's markdown body references a Kiro skill by name (e.g., a "Skills" section listing `my-skill`), the system SHALL create a `uses` edge between the subagent and the skill, with the same confidence heuristics as the Harness SDD adapter (exact name match, then case-insensitive match, then markdown body match).

### R13 — Kiro adapter registration
- **Pattern:** Ubiquitous
- **Wording:** The Kiro adapter SHALL be registered in `src/adapters/index.ts` and exercised by `src/adapters/adapterRegistry.test.ts`, with a `detect()` method that returns `true` only when the configured path exists, and a `parse()` method that returns the standard `ParserResult` shape. The Kiro adapter SHALL return `isPathConfigurable() === true` (so the registry reads the setting per R1–R3).

### R14 — Kiro framework badge and label
- **Pattern:** Ubiquitous
- **Wording:** Kiro nodes SHALL display the framework badge "Kiro" with the same 4px node accent and label color conventions as the other adapters, and SHALL be sortable in the README's "Supported project structures" table. Per ADR-003, deprecated adapters are not advertised; Kiro is active and IS advertised.

### R15 — Kiro unit tests
- **Pattern:** Ubiquitous
- **Wording:** The Kiro adapter SHALL have at least 6 unit tests: detection-positive (with default path), detection-positive (with custom configured path), detection-negative (no `.kiro/`), subagent discovery, skill discovery, relationship inference. The custom-path test verifies the R1–R3 wiring (the registry reads the setting and the adapter picks it up).

## Part C — Whiteboard UX polish (R16–R22)

### R16 — No-overlap guarantee (the hard one)
- **Pattern:** Ubiquitous
- **Wording:** The whiteboard layout function SHALL guarantee that no two nodes share the same `(x, y)` position to within a 4-pixel tolerance (4 px = the visual half-width of the smallest node type), after both the dagre auto-layout pass AND the manual-position merge pass.

### R17 — Overlap detection at parse time
- **Pattern:** State
- **Wording:** WHILE parsing a `ParserResult`, the system SHALL compute a set of `(x, y)` positions from the dagre layout, and IF any two nodes share a position to within 4 px, the system SHALL emit a `ParserError` with `file: "<adapter-id>"` and `message: "Node <id-A> and <id-B> overlap at (<x>, <y>)"`. The error is non-fatal; it surfaces to the OutputChannel as a warning.

### R18 — Overlap fix at parse time
- **Pattern:** State
- **Wording:** WHILE an overlap is detected (per R17), the system SHALL apply a deterministic offset to the colliding node(s) — `(x + N × 8, y + N × 8)` where N is the collision index — to break the tie. The offset is applied to the dagre layout result BEFORE the manual-position merge, so manual positions are still respected (overrides on top of the auto-offset).

### R19 — Whiteboard node appear/disappear animation
- **Pattern:** Event
- **Wording:** WHEN a node enters the graph (new layout) or leaves (deletion), the system SHALL animate the transition: appear = `opacity 0 → 1` over 200 ms with `transform: scale(0.85) → scale(1)`; disappear = the reverse. The animation SHALL be implemented with React Flow's `nodesDraggable` and the CSS `transition` property on the `CustomNode` component's outer div, not with `requestAnimationFrame` (which is already used elsewhere and has caused past flakiness).

### R20 — Whiteboard `fitView` easing
- **Pattern:** Event
- **Wording:** WHEN the system calls `fitView({ padding: 0.2 })` (e.g., on graph refresh, on a `Cmd+0` keyboard shortcut, or on initial mount), the system SHALL use React Flow's `duration: 400, ease: 'ease-in-out'` parameters (instead of the default 250 ms linear).

### R21 — Edge style transitions
- **Pattern:** Event
- **Wording:** WHEN an edge's style changes (e.g., from `manages` to `uses` after a re-parse, or from `uses` to `disabled` after the user toggles a connection), the system SHALL animate the transition: `stroke`, `strokeWidth`, `opacity`, and `stroke-dasharray` SHALL transition over 150 ms via CSS `transition`.

### R22 — No-overlap test
- **Pattern:** Ubiquitous
- **Wording:** The test suite SHALL include at least 3 tests that exercise the no-overlap guarantee: (a) a 5-node graph with all manual positions set to `(0, 0)` → after merge, no two nodes share a position; (b) a 10-node graph with dagre auto-layout only (no manual positions) → no two nodes share a position; (c) a mixed graph (some manual, some auto) → no two nodes share a position. All 3 tests pass on a clean `main` branch.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| Per-adapter configurable path setting | R1, R2 |
| Setting consumed at adapter runtime | R3, R4 |
| Adapters opt in via `isPathConfigurable()` | R4, R5 |
| Initial set of configurable adapters | R5 |
| Invalid path handling | R6 |
| Setting declared in `package.json` | R7 |
| ConfigurationRegistry unit tests | R8 |
| `.kiro/` workspace detected (default + custom path) | R9, R13, R15 |
| Kiro subagents appear as graph nodes | R10, R15 |
| Kiro skills appear as graph nodes | R11, R15 |
| Kiro subagent-skill relationships inferred | R12, R15 |
| Kiro adapter registered in adapter registry | R13 |
| Kiro badge in the UI | R14 |
| Kiro in the README's "Supported project structures" | R14 |
| Kiro unit tests pass | R15 |
| No two nodes share a position (4 px tolerance) | R16, R22 |
| Overlap detected and reported as ParserError | R17 |
| Overlap fixed with deterministic offset | R18 |
| Node appear/disappear animation | R19 |
| fitView uses 400 ms ease-in-out | R20 |
| Edge style changes animate | R21 |
