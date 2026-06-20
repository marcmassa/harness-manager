# FEAT-029 — Universal Agentic Architecture Detection & Advisory

> **Feature ID:** FEAT-029
> **Feature Name:** universal-agentic-detection
> **Type:** feat
> **Priority:** P1
> **Sprint:** Next
> **Agent:** typescript-implementer

---

## 0. Domain Model — Three Layers

This feature operates on a three-layer domain model that SHALL be reflected throughout the implementation:

```
Layer 3 — METHODOLOGY
  Cómo se define el ciclo de vida, proceso y gobierno del trabajo con agentes
  Ej: SDD (Spec Driven Development): feature_list.json con ciclo de vida,
      specs (requirements → design → tasks), progress/ con trazabilidad

Layer 2 — AGENTIC IMPLEMENTATION
  Cómo está organizado el trabajo de los agentes en el proyecto:
  estructura de ficheros, definiciones, reglas, herramientas
  Ej: prompts/, rules/, tools/, skills/, mcp.json, agent scripts
  → HARNESS es una implementación concreta: .agents/agentic.json,
    subagents/, steering/, skills/, commands/, AGENTS.md

Layer 1 — AGENTIC CLI / INSTALL
  El runtime que ejecuta los agentes
  Ej: Claude Code, Kiro, Cursor, Gemini CLI, Copilot, OpenCode
```

**Key distinctions:**
- **Harness** is Layer 2 — an **implementation framework** that defines how agents are organized (`.agents/`, subagents, steering, skills, commands, `AGENTS.md`).
- **SDD (Spec Driven Development)** is Layer 3 — a **methodology/workflow** that defines the lifecycle: spec → approve → implement → verify → done (`feature_list.json`, `specs/`, `progress/`).
- The **Harness+SDD template** bundles both: Harness provides the agentic organization, SDD provides the development workflow. But they are conceptually separable — Harness can exist without SDD (as pure agentic structure), and SDD could be applied on top of a different implementation.
- Neither competes with Claude Code or Kiro. Harness+SDD is a layer **on top of** any agentic CLI.

The whiteboard SHALL make this three-layer distinction visible with separate badges:
- `[CLI]` for Layer 1 (install runtimes)
- `[HARNESS]` for Layer 2 when Harness implementation is detected
- `[IMPL]` for Layer 2 for other implementation signals
- `[SDD]` for Layer 3 when SDD methodology is detected

---

## 1. Requirements

### 1.1 — Agentic signal scanning (Layer 2)

| ID | Pattern | Requirement |
|----|---------|-------------|
| R1 | Ubiquitous | The system SHALL scan the workspace root for agentic implementation signals across 8 categories: prompt files, rules files, MCP configurations, agent methodology configs, tool definitions, skill/knowledge files, agent scripts, and memory/state files. |
| R2 | Ubiquitous | The system SHALL define each signal category with a set of file globs, directory patterns, and content heuristics (YAML frontmatter keywords, import statements, JSON keys) that trigger detection. |
| R3 | Event | WHEN a workspace is opened or reloaded SHALL run a full scan of all 8 signal categories. |
| R4 | Event | WHEN a file matching any signal glob is created, modified, or deleted SHALL re-scan the affected category within 5 seconds. |

### 1.2 — Signal categories (Layer 2 — Implementation)

| ID | Pattern | Requirement |
|----|---------|-------------|
| R5 | Ubiquitous | The system SHALL detect prompt/instruction signals: `*.prompt.md`, `*.instruction.md`, `prompts/**`, `instructions/**`, `system-prompts/**`. |
| R6 | Ubiquitous | The system SHALL detect rules signals: `.cursorrules`, `.windsurfrules`, `.clinerules`, `rules/**/*.md`, `*.mdc`, files with `alwaysApply` or `globs` in YAML frontmatter. |
| R7 | Ubiquitous | The system SHALL detect MCP signals: `mcp.json`, `mcp-servers.json`, `.mcp/**`, files containing `"type": "mcp"` or `"transport": "stdio"` JSON keys. |
| R8 | Ubiquitous | The system SHALL detect agent framework signals (Layer 2): `langgraph.json`, `langchain*.json`, `crewai*.{yaml,yml}`, `autogen*.{yaml,yml}`, `AI_AGENT.md`, `AGENTS.md`, `AGENT.md`, files importing `openai`, `anthropic`, `langchain`, `crewai`, `autogen` packages. |
| R9 | Ubiquitous | The system SHALL detect tool definition signals: `tools/**`, `tool_definitions/**`, `*_tool.py`, `*_tool.ts`, `*_tool.js`, files with function-calling JSON schemas. |
| R10 | Ubiquitous | The system SHALL detect skill/knowledge signals: `SKILL.md`, `*_SKILL.md`, `skills/**`, `knowledge/**`. |
| R11 | Ubiquitous | The system SHALL detect agent script signals: `*.agent.py`, `*.agent.ts`, shell scripts invoking `opencode`, `claude`, `gemini`, `cursor` CLI tools. |
| R12 | Ubiquitous | The system SHALL detect memory/state signals: `memory.json`, `*.memory.md`, vector store configs, `state.json` files with agent state keys. |
| R13 | Ubiquitous | The system SHALL detect context/identity signals: `CONTEXT.md`, `SOUL.md`, `CHARACTER.md`, files with `role:` or `personality:` YAML frontmatter. |
| R14 | Ubiquitous | The system SHALL detect Harness implementation signals (Layer 2): `.agents/agentic.json` with `subagents[]`, `AGENTS.md`, `.agents/subagents/*/SUBAGENT.md`, `.agents/steering/`, `.agents/skills/`, `.agents/commands/`, `.agents/hooks/`. |

### 1.3 — CLI/Install detection integration (Layer 1)

| ID | Pattern | Requirement |
|----|---------|-------------|
| R15 | Ubiquitous | The system SHALL integrate with existing adapters (FEAT-015, FEAT-023) to report which agentic CLIs are installed in the workspace: Claude Code, Kiro, Cursor, Gemini CLI, Copilot, OpenCode, Windsurf. |
| R16 | Ubiquitous | The system SHALL label detected CLIs as "installed runtimes" (Layer 1) and NOT as "implementations" or "methodologies". |

### 1.4 — SDD Methodology detection (Layer 3)

| ID | Pattern | Requirement |
|----|---------|-------------|
| R17 | Ubiquitous | The system SHALL detect SDD (Spec Driven Development) methodology signals: `feature_list.json` with `sdd: true` entries and lifecycle statuses (`pending`, `spec_ready`, `in_progress`, `done`), `specs/**/{requirements,design,tasks}.md`, `progress/{current,history}.md`. |
| R18 | Ubiquitous | The system SHALL label SDD as a "methodology" (Layer 3) with badge `[SDD]` and SHALL show it as an overlay distinct from Layer 2 implementation signals. |

### 1.5 — Maturity classification

| ID | Pattern | Requirement |
|----|---------|-------------|
| R19 | Ubiquitous | The system SHALL classify each detected project into a maturity level from L0 to L5 based on all three layers. |
| R20 | Ubiquitous | The system SHALL define maturity levels as: **L0**=None (0 signals), **L1**=Ad-hoc (1-2 signal categories, unstructured), **L2**=Structured (3+ categories, organized files), **L3**=Implemented (organized implementation + at least one agentic CLI installed), **L4**=Managed (L3 + tools + skills + MCP all present), **L5**=Governed (L4 + SDD methodology active with specs + traceability). |
| R21 | Event | WHEN signals in any layer change SHALL re-classify maturity within 5 seconds. |

### 1.6 — Architecture pattern identification

| ID | Pattern | Requirement |
|----|---------|-------------|
| R22 | Ubiquitous | The system SHALL identify which canonical agentic architecture patterns are present in the project: Tool-Using Single Agent, Pipeline, Orchestrator-Worker, Multi-Agent Collaboration, Evaluator-Optimizer, Router, Reflection, Plan-and-Execute. |
| R23 | Ubiquitous | The system SHALL infer pattern presence from signal combinations (e.g., MCP + tool definitions + agent script → Tool-Using Single Agent). |
| R24 | Optional | WHERE the inference confidence is below 70% SHALL label the pattern as "tentative" rather than "detected". |

### 1.7 — Advisory engine

| ID | Pattern | Requirement |
|----|---------|-------------|
| R25 | Ubiquitous | The system SHALL generate actionable improvement suggestions based on the detected signals, maturity level, and architecture patterns. |
| R26 | Ubiquitous | The system SHALL prioritize suggestions by impact (low/medium/high) and effort (low/medium/high). |
| R27 | Event | WHEN the user dismisses a suggestion SHALL persist the dismissal per workspace and SHALL not show it again. |
| R28 | Optional | WHERE the maturity level is L0 SHALL display: "No agentic patterns detected. Learn more about agentic AI architectures." |
| R29 | Optional | WHERE Layer 2 has prompts but no structure SHALL suggest organizing into a `prompts/` directory. |
| R30 | Optional | WHERE Layer 2 has rules but no steering files SHALL suggest migrating to platform-agnostic steering files compatible with any Layer 1 CLI. |
| R31 | Optional | WHERE Layer 2 has MCP servers but no agent definitions SHALL suggest defining agents that consume those MCP tools. |
| R32 | Optional | WHERE Layer 1 has a CLI installed but Layer 2 is unstructured SHALL suggest structuring the implementation to match the CLI's conventions. |
| R33 | Optional | WHERE Layer 2 has skills but no agent associations SHALL suggest defining `uses` relationships. |
| R34 | Optional | WHERE Layer 2 has Harness signals (`.agents/`) but SDD methodology is absent (no `feature_list.json` lifecycle) SHALL suggest adopting SDD for lifecycle governance. |
| R35 | Optional | WHERE Layer 1+Layer 2 are present but neither Harness nor SDD detected SHALL suggest adopting the Harness+SDD template for structured agentic development. |
| R36 | Optional | WHERE multiple agent scripts share prompt patterns SHALL suggest extracting shared prompts into reusable skill files. |

### 1.8 — Whiteboard: layer visualization

| ID | Pattern | Requirement |
|----|---------|-------------|
| R37 | Ubiquitous | The whiteboard SHALL visually distinguish the three layers: Layer 1 (CLI installs) as a zone with `[CLI]` badges, Layer 2 (implementation nodes) as the main graph with `[IMPL]` or `[HARNESS]` badges, Layer 3 (methodology) as an overlay indicator with `[SDD]` badge. |
| R38 | Ubiquitous | Each node on the whiteboard SHALL display a small badge indicating which layer it belongs to: `[CLI]` (blue), `[IMPL]` or `[HARNESS]` (green), or `[SDD]` (emerald). |
| R39 | Ubiquitous | The system SHALL render detected implementation elements (prompts, rules, tools, skills, MCP, agent scripts, memory files, Harness files) as "discovered" nodes on the whiteboard, positioned in Layer 2. |
| R40 | State | WHILE the user has not yet acknowledged a discovered node SHALL display a pulsing indicator on the node. |
| R41 | Event | WHEN the user clicks a discovered node SHALL show the signal evidence that triggered detection (file path, matched pattern, confidence). |
| R42 | Ubiquitous | The system SHALL render inferred relationships between discovered nodes (e.g., a `.prompt.md` file is "used by" an agent script that references it) as suggested edges. |
| R43 | Ubiquitous | Discovered nodes SHALL have a distinct visual style (dashed border, muted colors, "?" icon for unacknowledged) to distinguish them from parsed nodes. |
| R44 | Ubiquitous | The whiteboard SHALL display a "Layer Legend" toggle that explains the layer badges (`[CLI]`, `[IMPL]`, `[HARNESS]`, `[SDD]`), discovered node styles, and inferred edge style. |

### 1.9 — Agentic Profile panel (new tab)

| ID | Pattern | Requirement |
|----|---------|-------------|
| R45 | Ubiquitous | The system SHALL add an "Agentic Profile" tab alongside the existing Whiteboard and SDD Panel tabs. |
| R46 | Ubiquitous | The Agentic Profile tab SHALL display: maturity badge (color-coded L0–L5), three-layer status summary, signal bar chart per category, identified patterns with confidence, and top 3 improvement suggestions with dismiss buttons. |
| R47 | Ubiquitous | The Agentic Profile tab SHALL display which agentic CLIs are installed (Layer 1), whether Harness implementation is active (Layer 2), whether SDD methodology is active (Layer 3), and suggest actions if gaps exist between layers. |
| R48 | Event | WHEN the profile changes SHALL update the tab within 5 seconds. |
| R49 | Ubiquitous | The Agentic Profile tab SHALL include an action button "Apply Harness+SDD" that, when clicked, scaffolds a minimal `.agents/agentic.json` + `feature_list.json` structure. |

### 1.10 — Output & diagnostics

| ID | Pattern | Requirement |
|----|---------|-------------|
| R50 | Ubiquitous | The system SHALL log scan results to the Harness Dashboard output channel with per-category signal counts and layer breakdown. |
| R51 | Event | WHEN the user runs the "Harness Dashboard: Scan Agentic Profile" command SHALL perform an immediate full scan and display the results in the output channel. |
| R52 | Ubiquitous | The system SHALL expose the AgenticProfile data through the webview message protocol so custom views can consume it. |

### 1.11 — Performance & boundaries

| ID | Pattern | Requirement |
|----|---------|-------------|
| R53 | Ubiquitous | The system SHALL scan only the workspace root (not nested node_modules/, .git/, dist/, build/, .venv/, __pycache__/). |
| R54 | Ubiquitous | The initial full scan SHALL complete within 5 seconds on a workspace with up to 10,000 files. |
| R55 | Event | WHEN a signal category pattern matches over 200 files SHALL stop scanning that category and report "200+ files" as the count. |
| R56 | Ubiquitous | The system SHALL NOT require any network access, API keys, or external services. |

### 1.12 — Existing adapter integration

| ID | Pattern | Requirement |
|----|---------|-------------|
| R57 | State | WHILE a known adapter has already detected a file SHALL NOT double-tag it as a discovered node (deduplication by absolute path). Adapter-detected nodes stay in Layer 1; discovered nodes go to Layer 2. |
| R58 | Event | WHEN the user adopts Harness (creates `.agents/agentic.json`) SHALL add `[HARNESS]` badge to Layer 2 and update maturity. WHEN SDD is also detected (`feature_list.json` with lifecycle) SHALL additionally show `[SDD]` badge in Layer 3 and re-classify to L5. |

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|------------|
| Three-layer domain model (CLI/Harness/SDD) | R1, R14, R15, R17, R37, R38 |
| Full workspace scan on open | R1, R2, R3 |
| File watcher triggers re-scan | R4, R21 |
| 9 signal categories (Layer 2, including Harness) | R5–R14 |
| Harness implementation detection (Layer 2) | R14, R58 |
| CLI install detection (Layer 1) | R15, R16 |
| SDD methodology detection (Layer 3) | R17, R18 |
| Maturity classification L0–L5 | R19, R20 |
| Architecture pattern identification | R22, R23, R24 |
| Actionable suggestions generated | R25, R26 |
| Suggestions persistable | R27 |
| Context-aware suggestions per layer/gap | R28–R36 |
| Layer-badges ([CLI]/[IMPL]/[HARNESS]/[SDD]) on whiteboard | R37, R38, R44 |
| Discovered nodes on whiteboard | R39, R43 |
| Pulsing indicator for unacknowledged | R40 |
| Evidence display on click | R41 |
| Inferred relationship edges | R42 |
| Agentic Profile tab with chart | R45, R46, R47 |
| Real-time tab updates | R48 |
| "Apply Harness+SDD" scaffold action | R49 |
| Output channel logging | R50 |
| Manual scan command | R51 |
| Webview message protocol | R52 |
| Performance: excludes build dirs | R53, R54 |
| Large-directory limit (200+ files) | R55 |
| Zero network/API dependencies | R56 |
| Deduplication with adapters | R57 |
| Maturity upgrade on Harness+SDD adoption | R58 |
