# Harness Dashboard

**Visual whiteboard for AI agent architectures** — map, trace and manage subagents, skills and relationships across any agentic framework.

[![CI](https://github.com/marcmassa/harness-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/marcmassa/harness-manager/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.6.0-blue)](https://github.com/marcmassa/harness-manager/releases)
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
| 🔗 **Edge types** | `manages` (smoothstep), `uses` (dashed teal), `suggested` (animated amber), `discovered` (straight grey) |
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

## What's new in 0.6.0

Security hardening and internal architecture refactor — no breaking changes, no new end-user features. All 372 unit tests pass.

### Security improvements

- **Content Security Policy nonce** — every webview render generates a cryptographic nonce (Web Crypto API). The `<meta http-equiv="Content-Security-Policy">` header now enforces `script-src 'nonce-...'` with no `unsafe-inline`, preventing script injection via DOM manipulation or postMessage exploitation.
- **WebView sandbox tightened** — `allow-same-origin` removed from both sidebar and full-window panel options, eliminating the risk of a compromised webview elevating itself to the extension host origin.
- **Unknown-message guard** — `_handleWebviewMessage` now validates every incoming message against a typed `WebviewMessageType` union (28 known types) before dispatching. Unknown types emit a warning to the output channel and are silently dropped.

### Architecture improvements

- **Domain coordinators** — `extension.ts` message handling split into three focused classes in `src/coordinators/`: `WhiteboardCoordinator` (13 cases), `SddCoordinator` (10 cases), `AdvisoryCoordinator` (2 cases). `extension.ts` retains only 4 shared handlers and is now 340 executable lines (down from ~700).
- **FeatureSpecPanel decomposed** — 1 994-line monolith split into five focused files: `FeatureList.tsx` (221), `SpecEditor.tsx` (314), `AiAssistBar.tsx` (96), `SpecWizard.tsx` (372), `FeatureSpecPanel.tsx` (192). All listed files are well under the 600-line cap.
- **Typed metadata** — `HarnessNode.metadata` changed from `Record<string, any>` to a `NodeMetadata` discriminated union with seven typed interfaces, each with a `[key: string]: unknown` escape hatch for frontmatter fields.
- **`dagre` moved to `devDependencies`** — the layout library is used only at build time; it is no longer bundled into the production VSIX.
- **New tests** — 15 additional Vitest tests: 6 for `layoutUtils` (empty graph, single node, row wrapping, feature nodes, multi-provider, edge filtering) and 8 for the `isKnownWebviewMessage` type guard.

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
