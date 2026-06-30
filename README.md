# Harness Dashboard

**Visual whiteboard for AI agent architectures** — map, trace and manage subagents, skills and relationships across any agentic framework.

[![CI](https://github.com/marcmassa/harness-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/marcmassa/harness-manager/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.7.0-blue)](https://github.com/marcmassa/harness-manager/releases)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blueviolet)](https://code.visualstudio.com/updates/v1_85)

![Harness Dashboard icon](media/icon.png)

---

## Screenshots

| Whiteboard | SDD Panel |
|---|---|
| ![Whiteboard showing agent graph with subagents, skills, and steering/hook nodes](media/screenshots/whiteboard.png) | ![SDD management panel showing feature list, specs, and AI-assisted generation](media/screenshots/sdd-panel.png) |
| **Architecture Analysis & Advisory** | **Full-window Dashboard** |
| ![Advisory tab with maturity badge, SVG signal bars, suggestions and CLI detection](media/screenshots/achitecture-advisory.png) | ![Harness Dashboard opened as a full editor panel, detached from the activity bar](media/screenshots/full-window.png) |

---

## What it does

Harness Dashboard reads your workspace and renders an interactive graph of your AI agent setup:

- **Nodes** — Agents, Subagents, Skills (architectural hierarchy) and Features (compact grid, below the agent graph)
- **Edges** — `manages`, `uses`, `suggested`, `discovered` relationships with semantic coloring
- **Semantic suggestions** — TF-IDF cosine similarity recommends missing skill connections
- **Detail panel** — click any node to read its description and Markdown file inline
- **Timeline** — SDD progress milestones in a git-style view

Works out of the box with **Harness SDD**, and ships with **universal adapters** for Claude Code, Gemini CLI, Cursor, GitHub Copilot, OpenCode and Kiro (see the [Supported project structures](#supported-project-structures) table below).

---

## Features

| Feature | Description |
|---------|-------------|
| 🗺 **Whiteboard canvas** | Drag-and-drop, zoom, pan — powered by React Flow |
| 🔗 **Edge types** | `manages`, `uses`, `governs`, `triggers`, `suggested`, `discovered` — each with semantic coloring and arrow style |
| 🧱 **Agent Builder Wizard** | Unified modal for creating any node type (agent, subagent, skill, steering, hook, feature-spec) with guided and advanced modes |
| 💡 **Semantic skill discovery** | Suggests subagent↔skill connections from description text |
| 📋 **Inline Markdown viewer** | Read SUBAGENT.md / SKILL.md without leaving the panel |
| ✏️ **Edit in editor** | Open any Markdown file directly in the VS Code editor |
| 🔍 **Idoneity scoring** | Shows best semantic owner per skill, highlights mismatches |
| ⏸ **Toggle connections** | Disable/enable skill connections persistently |
| 🚫 **Dismiss suggestions** | Permanently hide unwanted suggestions (persisted across reloads) |
| 📅 **Progress timeline** | Visualize SDD feature lifecycle (pending → done) |
| 🧭 **Steering & Hooks nodes** | Visualise steering files and hook scripts on the whiteboard, with relationship edges to subagents and agents |
| 📐 **SDD Management Panel** | Browse and edit spec files (requirements, design, tasks) per feature, with AI-assisted spec generation |
| 🔄 **Cross-framework discovery** | Find hooks and steering files from any agentic framework (Harness, Kiro, Claude Code, etc.) |
| 🤖 **Universal AI Provider** | Provider chain (`vscode.lm` → OpenAI-compatible API fallback) works in any IDE without Copilot |
| 🔍 **Agentic Architecture Detection** | Scans any workspace for agentic signals (prompts, rules, MCP, frameworks, tools, skills, memory, context), classifies maturity L0–L5, identifies architectural patterns, and generates actionable improvement suggestions |
| 🧩 **Discovered Node Visualization** | Detected CLI installs, agent implementations, Harness SDD, and methodology elements appear on the whiteboard with layer badges (`[CLI]`, `[IMPL]`, `[HARNESS]`, `[SDD]`) and dashed/solid borders |
| 📊 **SVG Signal Bar Chart** | See signal strength across 9 categories at a glance in the Advisory tab |
| 🚀 **One-click Scaffold** | "Apply Harness+SDD" button bootstraps `.agents/agentic.json` and `feature_list.json` from detected signals |
| 🔲 **Full-window Dashboard** | Open the dashboard as a standalone editor panel, detached from the activity bar, for more screen space |

---

## What's new in 0.7.0

Unified entity creation wizard, full connection overhaul, and visual polish. No breaking changes.

### Agent Builder Wizard — unified entity creation

- **All node types in one place** — the old "Add Entity" button (steering, hook, skill, subagent) is gone; the Agent Builder Wizard now handles all 6 types: `agent`, `subagent`, `skill`, `steering`, `hook`, and `feature-spec`.
- **Guided + Advanced modes** — a mode toggle lets you step through fields one by one (guided) or fill everything on a single scrollable page (advanced). State is preserved when switching between modes.
- **Header pre-selection** — "✨ Generate Spec" and "+ New Node" header buttons open the wizard pre-selecting the relevant type, from any active tab.
- **Root-level modal** — the wizard is no longer hidden when the Spec Manager or Advisory tab is active.

### Whiteboard connection overhaul

- **Full relationship coverage** — you can now draw any valid architectural link: `agent ↔ subagent` (manages), `agent/subagent ↔ skill` (uses), `agent/subagent ↔ steering` (governs), `agent/subagent ↔ hook` (triggers).
- **Visible connection handles** — hovering any connectable node reveals OUT/IN pills without needing to open its detail panel first. Steering and hook nodes also show connection handles.
- **Drag-to-connect feedback** — a dashed blue line tracks the cursor while dragging a connection; invalid drop targets are blocked by `isValidConnection`.
- **Persistent non-"uses" edges** — manages/governs/triggers edges survive extension restarts via workspaceState.

### UX polish

- **Unified button style** — vivid `vscode-button` color + compact rounded shape with shadow, consistent across header and whiteboard toolbar.
- **Floating expand button** — the "Expand" button is now fixed bottom-right, always visible regardless of active tab, and hidden when already in full-window mode.
- **Full-window detection** — `__harness_is_full_window` injected via nonce-tagged inline script; no extra VS Code API calls needed.

For full details see the [CHANGELOG](./CHANGELOG.md).

---

## Supported project structures

| Framework | Detection file | Status |
|-----------|---------------|--------|
| **Harness SDD** | `.agents/agentic.json` | first-class |
| **Claude Code** | `CLAUDE.md` / `.claude/agents/` | adapter (FEAT-015) |
| **Gemini CLI** | `GEMINI.md` | adapter (FEAT-015) |
| **Cursor** | `.cursor/rules/` | adapter (FEAT-015) |
| **GitHub Copilot** | `.github/copilot-instructions.md` | adapter (FEAT-015) |
| **OpenCode** | `opencode.json` | adapter (FEAT-015) |
| **Kiro** | `.kiro/agents/` | adapter (FEAT-023) |

> **Note on Windsurf:** the `WindsurfAdapter` source file still ships in the extension (the adapter was implemented in FEAT-015 before Windsurf was discontinued), but the table above does not advertise it because new users cannot realistically adopt a discontinued product. The adapter is retained for users with existing Windsurf workspaces. See `progress/decisions.md#adr-003-windsurf-discontinuation` for the rationale.

---

## Getting started

1. **Install** — download the latest VSIX from the [Releases page](https://github.com/marcmassa/harness-manager/releases) and install it via `Extensions: Install from VSIX...`, or install directly from the VS Code Marketplace (*coming soon*).
2. Open a workspace that uses [Harness SDD](https://github.com/marcmassa/harness-sdd-template.git) or any supported agentic framework  
3. Click the **Harness Dashboard** icon in the Activity Bar
4. The whiteboard renders your agent graph automatically

> **No config needed.** The extension detects your project structure on activation.

---

## Requirements

- VS Code 1.85 or newer
- A workspace with at least one supported agent config file (see table above)

---

## Extension settings

State (dismissed suggestions, disabled connections) is persisted automatically per workspace via VS Code's `workspaceState`.

### Adapter path overrides

Per-adapter detection path overrides under `harness-dashboard.adapters.<id>.path`. The defaults match each framework's canonical detection directory; override them when your project places its agent files in a non-standard location. Configurable: `claude-code`, `cursor`, `gemini-cli`, `copilot`, `windsurf`, `kiro`. **Not** configurable: `harness-sdd` (canonical, `.agents/agentic.json`) and `opencode` (canonical, `opencode.json`/`opencode.jsonc`) — changing the path would break the framework's own tooling.

```json
{
  "harness-dashboard.adapters.kiro.path": ".kiro"
}
```

If a configured path is invalid (does not exist or is not a directory), the extension logs a one-line warning to the **Harness Dashboard** output channel and falls back to the framework's default. See [`docs/configuration.md`](docs/configuration.md) for the long-form ConfigurationRegistry reference.

### AI provider settings

Configure the OpenAI-compatible fallback provider to help define new specs with the specs panel:

| Setting | Default | Description |
|---------|---------|-------------|
| `harness-dashboard.ai.apiKey` | `""` | API key for fallback provider. Empty = fallback disabled. |
| `harness-dashboard.ai.endpoint` | `https://api.openai.com/v1/chat/completions` | Base URL for the API. Change for Ollama, Azure, LM Studio, etc. |
| `harness-dashboard.ai.model` | `gpt-4o-mini` | Model identifier sent in the request body. |


---

## Contributing

Issues and PRs welcome at [github.com/marcmassa/harness-manager](https://github.com/marcmassa/harness-manager).

---

## License

MIT © Marc Massa

---

## Note on the repository name

The **GitHub repository** is intentionally named `harness-manager`,
while the product, the VS Code extension, the npm package, the
VSIX file, and the VS Code Marketplace listing are all named
`harness-dashboard` (or `harness-dashboard-vscode` for the
package). The discrepancy is historical: the v0.1.0 release
of 2026-06-08 renamed the product from "Harness Manager" to
"Harness Dashboard" but the GitHub repository name was not
updated at that time.

This mismatch is **intentional and documented**. The decision
to keep the repository name as `harness-manager` (rather than
rename it to `harness-dashboard`) is recorded in
[`ADR-002`](./progress/decisions.md#adr-002-accept-the-github-repository-name-harness-manager-and-document-the-mismatch).
A future maintainer may choose to perform the rename at a
project milestone (e.g., v0.4.0 or v1.0.0); until then, the
two names refer to the same project.
