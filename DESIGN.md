# System Design & Architecture

> This document defines the high-level architecture, global principles, and
> technical direction of **Harness Dashboard**, the VS Code extension
> shipping under the `harness-dashboard-vscode` package name. It is the
> primary "30,000-foot view" that contributors and AI agents read first
> to understand how the project is put together.
>
> **Size policy**: this file SHALL stay at ≤ 250 lines. If a section
> grows beyond that, split the deep-dive into `docs/architecture/<topic>.md`
> and link from here. The cap is a readability rule, not a
> build-time check.

---

## 1. System Overview

Harness Dashboard is a **visual whiteboard for AI agent architectures**. It
reads the user's workspace, discovers the agents, subagents, skills and
features defined for the project (Harness SDD, Claude Code, Gemini CLI,
Cursor, GitHub Copilot, OpenCode), and renders them as an
interactive React Flow graph inside a VS Code Webview. Users can navigate
the graph, inspect each node's source Markdown, accept or reject
semantic suggestions for missing skill connections, and (in earlier
features) edit the underlying files through a `HarnessWriter`. The
extension is a **purely client-side** tool: no backend, no cloud, no
external service, no user-supplied API key.

The project itself is a **showcase of the Harness SDD framework**: the
same `agentic.json` + `specs/<name>/{requirements,design,tasks}.md` +
`feature_list.json` + `progress/` + `./check.sh` workflow that the
extension helps visualise is what the maintainers use to ship the
extension. This is intentional "dogfooding".

---

## 2. Architectural Principles

1. **CLI-agnostic by construction** — every project capability
   (subagents, skills, commands) is declared once in
   `.agents/agentic.json` and rendered to each supported CLI's native
   format (`opencode.json`, `CLAUDE.md`, `GEMINI.md`, `.claude/`,
   `.gemini/`) by a deterministic Python renderer. Adding a new CLI
   means adding a new adapter template, not editing the source of truth.

2. **SDD-first, no code without a spec** — every non-trivial change
   is shaped into a `specs/<feature>/{requirements,design,tasks}.md`
   triplet, waits at `spec_ready` for human approval, then is
   implemented, reviewed, and closed. `./check.sh` enforces the
   invariants (one feature in `in_progress`, no `done` without green
   tests, no missing spec files for SDD features).

3. **Frugal AI, no surprises** — semantic matching uses TF-IDF
   + cosine similarity computed locally, not an embedding model.
   When an LLM enhancement is available, it uses VS Code's built-in
   `vscode.lm` API (no API keys, no HTTP). This keeps the VSIX
   under 300 KB and respects user privacy.

4. **Single source of truth** — the runtime graph model is built
   from `agentic.json` (canonical) and the on-disk Markdown
   (`SUBAGENT.md`, `SKILL.md`). The graph is **derived state**; it is
   never the source of truth.

5. **Testable, by construction** — every requirement R<n> maps to at
   least one test; every task T<n> references the R<n> it covers.
   Unit tests (Vitest) cover the semantic layer and adapters;
   `./check.sh` covers the harness invariants; the new CI workflow
   (FEAT-018) re-runs the same gate on every PR.

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VS Code Editor                              │
│                                                                     │
│  ┌──────────────────────┐         ┌──────────────────────────┐      │
│  │   Extension Host     │ ◀─────▶ │       Webview            │      │
│  │   (Node.js)          │  msgs   │   (React 18 + Flow 11)   │      │
│  │                      │         │                          │      │
│  │  • activate()        │         │  • WhiteboardCanvas      │      │
│  │  • HarnessParser     │         │  • TimelineView          │      │
│  │  • HarnessWriter     │         │  • DetailPanel / MDView  │      │
│  │  • AdapterRegistry   │         │  • EntitySidePanel       │      │
│  │  • vscode.lm (opt.)  │         │  • ContextMenu components│      │
│  └──────────┬───────────┘         └──────────┬───────────────┘      │
│             │                                │                      │
└─────────────┼────────────────────────────────┼──────────────────────┘
              │ FileSystemWatcher              │ postMessage
              ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Workspace Filesystem                            │
│                                                                     │
│  .agents/                                                          │
│    agentic.json       ← canonical manifest (single source of truth)│
│    subagents/<name>/SUBAGENT.md                                     │
│    skills/<name>/SKILL.md                                           │
│    commands/<name>.md                                               │
│    adapters/<cli>/<file>.tmpl                                       │
│  feature_list.json   ← SDD feature state machine                    │
│  progress/           ← session log + ADRs + backlog                │
│    current.md, progress.md, backlog.md, decisions.md, handoff.md    │
│  specs/<name>/       ← SDD artefacts (requirements, design, tasks) │
│  src/                ← TypeScript source (extension + webview)      │
└─────────────────────────────────────────────────────────────────────┘
```

There is **no** backend service, **no** cloud, **no** external HTTP call,
and **no** user-supplied API key. Everything runs in the user's VS Code
process on their own machine.

---

## 4. Key Components & Responsibilities

| Component | Responsibility | Location | Tech |
|---|---|---|---|
| **Extension Host** | Lifecycle, command registration, webview ↔ host messaging, output channel | `src/extension.ts` | TypeScript, `vscode` API |
| **Parser** | Read `agentic.json`, `feature_list.json`, `progress/progress.md`, `SUBAGENT.md`, `SKILL.md` into a `ParserResult` graph | `src/harnessParser.ts`, `src/parserLogic.ts` | `gray-matter` for frontmatter, custom JSON parser |
| **Writer** | Persist user edits (create subagent/skill, link/unlink, accept suggestion) back to disk | `src/harnessWriter.ts` | atomic `vscode.workspace.fs` writes |
| **Adapters** | Detect + parse agent architectures from non-Harness sources (Claude Code, Gemini CLI, Cursor, Copilot, OpenCode, and the deprecated Windsurf) into the common graph model | `src/adapters/*.ts` | pattern: `IAgentAdapter` + 7 implementations (one of which — `WindsurfAdapter` — is retained for legacy workspaces; see ADR-003) |
| **Semantic Layer** | TF-IDF vectorizer, cosine similarity, name-boost, n-gram tokenization | `src/semanticMatcher.ts` | pure functions, no I/O |
| **Idoneity Layer** | Bidirectional semantic idoneity matrix, best-owner-by-skill, mismatch detection | `src/idoneity.ts` | reuses `semanticMatcher.ts` |
| **Webview UI** | React Flow whiteboard, node types (agent/subagent/skill/feature), per-type edge styling, timeline view, detail panel, side panel, context menus | `src/webview/*` | React 18, React Flow 11, `@vscode/webview-ui-toolkit` |
| **Persistence** | Per-workspace state (dismissed suggestions, disabled connections, manual node positions) | `context.workspaceState` | VS Code API |
| **Output Channel** | Diagnostic logs visible in *Output > Harness Dashboard*, severity-filtered | `vscode.LogOutputChannel` | built-in |
| **CI Workflow** | Re-runs `npm ci && build && test && check.sh` on every push and PR to `main` | `.github/workflows/ci.yml` | GitHub Actions, ubuntu-latest, Node 20.x |
| **Harness SDD** | The framework that ships inside this repo: `agentic.json`, `bootstrap.sh`, `check.sh`, `specs/`, `feature_list.json` | `.agents/`, `check.sh`, `AGENTS.md` | CLI-agnostic manifest, Python renderer |

---

## 5. Data Flow & Integration

A typical session:

```
1. VS Code opens a workspace
   └─▶ onView:harness-dashboard.dashboard fires
       └─▶ Extension.activate()
           └─▶ HarnessDashboardProvider registered as WebviewViewProvider

2. Webview sends 'ready' / 'getData' message
   └─▶ Extension Host invokes HarnessParser on workspace root
       └─▶ AdapterRegistry.runAll() iterates all 7 adapters
           ├─▶ HarnessSddAdapter.parse()        → ParserResult
           ├─▶ ClaudeCodeAdapter.parse()        → ParserResult (if CLAUDE.md)
           ├─▶ GeminiCliAdapter.parse()         → ParserResult (if GEMINI.md)
           ├─▶ CursorAdapter.parse()            → ParserResult (if .cursor/)
           ├─▶ CopilotAdapter.parse()           → ParserResult (if .github/copilot-instructions.md)
           ├─▶ OpenCodeAdapter.parse()          → ParserResult (if opencode.json)
           └─▶ WindsurfAdapter.parse()          → ParserResult (if .windsurf/) [DEPRECATED, see ADR-003]
       └─▶ mergeResults() deduplicates nodes/edges/milestones
       └─▶ enrichWithIdoneity() computes semantic ownership
       └─▶ addSemanticSuggestions() generates 'suggested' edges (TF-IDF)
       └─▶ reconcileSkillDiscovery() flags orphan skills
   └─▶ ParserResult is postMessaged to the webview
       └─▶ WhiteboardCanvas renders nodes + edges via React Flow
       └─▶ TimelineView renders progress milestones

3. User clicks a node
   └─▶ Webview sends 'selectNode' message (internal state)
       └─▶ DetailPanel reads metadata._filePath, opens MDViewer inline

4. User accepts a suggested edge (right-click → "Accept Suggestion → uses")
   └─▶ Webview sends 'acceptSuggestion' { subagentId, skillId }
       └─▶ Extension Host invokes HarnessWriter.acceptSuggestion()
           └─▶ Updates .agents/agentic.json AND .agents/subagents/<id>/SUBAGENT.md atomically
       └─▶ FileSystemWatcher fires
           └─▶ Loop back to step 2 (auto-refresh of the whiteboard)
```

No external integration. The only "integration" is the local
filesystem and (optionally) the user's already-installed language
models via `vscode.lm`.

---

## 6. Global Constraints

- **Language / Stack**:
  - TypeScript 5.x with `strict: true` (`tsconfig.json`).
  - React 18 (not 19 — React Flow 11 compatibility).
  - Node 20.x in CI (matches `engines.vscode ^1.85.0`).
  - esbuild for bundling (not Webpack, not Rollup).
  - Vitest for unit tests (not Jest, not Mocha).
  - `gray-matter` for YAML frontmatter; `dagre` for auto-layout;
    no custom parser, no custom layout engine.

- **VS Code engine**: `^1.85.0` (declared in `package.json#engines`).

- **Distribution**: VSIX via `@vscode/vsce`. CI is GitHub Actions; no
  npm publish token yet (manual release). VSIX artifacts are excluded
  from git by `*.vsix` in `.gitignore` (planned — currently three
  binaries are committed; see backlog).

- **Persistence**: VS Code `workspaceState` (per-workspace, not
  `globalState`) for UI state; the filesystem for everything else.
  No DB, no cache file, no `node_modules/.cache/...` smuggling.

- **Security / privacy**:
  - `SecretStorage` if any token is ever needed (none today).
  - No `node-fetch` to external hosts.
  - No `secrets.*` in CI workflows.
  - All AI features go through `vscode.lm` (user's own model, no API
    key needed).

- **Performance**:
  - Activation time < 500 ms (surgical `onView` activation event,
    lazy import of webview bundle).
  - All disposables registered in `context.subscriptions`.
  - Vitest unit-test suite: 126 tests in < 500 ms.

- **Harness SDD invariants** (enforced by `./check.sh`):
  - At most one feature `in_progress` at a time.
  - Every `sdd: true` feature at `spec_ready` / `in_progress` / `done`
    has all three spec files in `specs/<name>/`.
  - Generated CLI adapters are in sync with `agentic.json` (caught
    by `./.agents/bootstrap.sh --check`).
  - The new "Governance Documents" check (FEAT-019 R16) fails on
    leftover template placeholders in `DESIGN.md`,
    `progress/backlog.md`, or `progress/decisions.md`.

---

> **Note to AI Agents:** Before proposing a feature-specific design in
> `specs/<feature>/design.md`, you MUST align with the principles and
> constraints defined in this document. In particular: do not introduce
> a new dependency without a "Discarded Alternatives" entry that names
> at least one alternative already available in the existing
> dependency set, and do not propose a `src/` change without first
> reading the file you intend to modify.
