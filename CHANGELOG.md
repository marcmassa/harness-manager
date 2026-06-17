# Changelog

All notable changes to Harness Dashboard are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **On test counts:** Every feature in this project that has `"sdd": true` in
> `feature_list.json` goes through Spec-Driven Development. Each spec adds a set
> of EARS requirements (R1..Rn), each requirement has one or more corresponding
> unit tests. The test count therefore grows by 5–30 per feature — it is not
> a fixed metric but a direct reflection of the requirement surface. Test counts
> in this changelog are informational checkpoints, not targets.

---

## [0.4.0] — 2026-06-17

> Adds 5 new features bringing the total to 28 done. FEAT-028 (Universal AI Provider) is the headline feature — AI spec generation works in Kiro and other IDEs without Copilot via configurable provider chain. FEAT-027 (KISS + DRY code quality hooks) enforces architectural principles on every save. FEAT-024/025/026 extend the whiteboard with steering, hooks, SDD management panel, and cross-framework discovery.

### Added

#### FEAT-028 — Universal AI Provider (provider chain)

- **Provider chain (Chain of Responsibility)**: `[vscodeLmProvider, createOpenAiCompatibleProvider]` — tries `vscode.lm` first, falls back to OpenAI-compatible API.
- **`AiProvider` interface** — `name`, `tryGenerate(prompt, options?)` — any provider is one `AiProvider` object.
- **`createOpenAiCompatibleProvider(defaults)`** — zero-dependency factory using Node.js built-in `https`. Configurable endpoint, model, API key.
- **`createProviderChain(providers, options)`** — tries providers in order; first success wins; last error if all fail.
- **`generateText(prompt, log?, options?)`** — backward-compatible entry point, unchanged signature.
- **3 settings** (`ai.apiKey`, `ai.endpoint`, `ai.model`) — fallback disabled by default (empty apiKey).
- **`harness-dashboard.checkLM` command** — diagnoses LM availability + runs a test generation; results shown in info/warning message with "View Output" action.
- **Settings gear button** — ⚙️ icon in the toolbar opens VS Code settings filtered to `@ext:marcmassacapo.harness-dashboard-vscode`.
- **Zero new npm dependencies** — `https` module used directly.
- **23 unit tests** covering all providers, chain logic, HTTP errors, and backward compatibility.
- **Traceability**: `progress/impl_universal-ai-provider.md` documents R<n>↔test mapping.

#### FEAT-027 — Code Quality On-Save Hooks (KISS + DRY)

- **KISS hook** (`hooks/kiss_check.py`) — checks for overengineering: long files >400 lines, long functions >80 lines, deep nesting >4 levels, unused parameters, excessive swallowed exceptions.
- **DRY hook** (`hooks/dry_check.py`) — checks for duplication: repeated string literals (>=12 chars, 3+ times), magic numbers, near-duplicate functions (Jaccard >= 0.85), duplicate interface/type definitions.
- **Two bash hooks** (`hooks/on-file-saved-kiss-check.sh`, `hooks/on-file-saved-dry-check.sh`) — triggered on TypeScript save in `src/`.
- **`hooks/code-quality-checks.json`** — JSON catalog listing all rules (runtime form of steering principles).
- **Registered in `agentic.json#hooks[]`** under events `on_file_saved_kiss` and `on_file_saved_dry`.
- **5 settings** (`verifyOnSave`, `blockOnSave`, `kissEnabled`, `dryEnabled`, `severity`).
- **`harness-dashboard.verifyCodeQuality` command** — manual verify of any chosen file.
- Reports issues to VS Code's Problems panel and an OutputChannel.

#### FEAT-025 — Enhanced SDD Panel

- **Dedicated SDD management panel** alongside the whiteboard — shows spec files (`requirements.md`, `design.md`, `tasks.md`) per feature.
- **Visual state badges** — feature chronology and status at a glance.
- **Inline spec editor** — edit spec files directly from the panel.
- **AI-assisted spec initiation** — integrate with the provider chain (vscode.lm → fallback) to generate EARS requirements, design decisions, or task lists with one click.

#### FEAT-024 — Steering & Hooks Observability

- **`steering` node type** — parses `agentic.json#steering[]`, reads steering markdown files, shows `steering → subagent` edges based on `applies_to`.
- **`hook` node type** — parses `agentic.json#hooks[]`, reads hook scripts, shows `hook → agent` edges.
- **Distinct visual styles** — steering files and hook scripts each get their own icon, colour, and shape.

#### FEAT-026 — Cross-framework hooks & steering discovery

- **Discovery layer** — scans both framework-specific roots (`.kiro/hooks/`, `.claude/hooks/`, etc.) and workspace root (`hooks/`, `steering/`) for hook/steering files.
- **Deduplication** — files found in both locations are shown once.
- **Per-adapter settings** — `hooksPath`, `steeringPath`, `discoverHooks`, `discoverSteering`.
- **Global settings** — `rootHooks`, `rootSteering` to control root-level discovery.
- **Backward-compatible** — FEAT-024's Harness-SDD handling unchanged.

### Changed

- **README.md** — version badge updated to 0.4.0; new features added to table; "What's new in 0.4.0" section; screenshot placeholders added.
- **`harness-dashboard.checkLM` command** — new command (category: "Harness Dashboard").
- **`harness-dashboard.verifyCodeQuality` command** — new command.
- **Settings gear button** added to the whiteboard toolbar.

### Technical

- Test suite: **228 unit tests** (Vitest, 16 files) — 87 new tests across 5 feature areas.
- All 28 features in `feature_list.json` are `done`.
- Lockfile regenerated with `npm install`; production dependency tree remains clean.
- `./check.sh`: all checks pass (only pre-existing ⚠️ `py_compile` warnings).

## [0.3.0] — 2026-06-14

> First published VSIX. FEAT-023 (configurable adapter paths + Kiro adapter + whiteboard polish) is the headline feature; backlog clearance and CI/CD hardening round out the release.

### Added

#### FEAT-023 — Configurable adapter paths + Kiro adapter + whiteboard UX polish

- **ConfigurationRegistry** (Part A) — singleton that lets users override adapter detection paths via VS Code settings. Five configurable adapters (Claude Code, Cursor, Gemini CLI, Copilot, Windsurf); two canonical adapters (Harness SDD, OpenCode) are not configurable. Six `contributes.configuration` entries in `package.json`. Cache is invalidated on `onDidChangeConfiguration`.
- **Kiro adapter** (Part B) — detects `.kiro/` files (agents, skills, relationships). First consumer of the ConfigurationRegistry. Registered as the 7th advertised adapter.
- **Whiteboard UX polish** (Part C) — `detectAndFixOverlaps()` guarantees no overlapping dagre-positioned nodes (4 px tolerance, 8 px stride, 5 iterations). Node appear animation (`@keyframes nodeAppear`, scale 0.85→1, 200 ms ease-out) with `prefers-reduced-motion: reduce` support. Edge style transitions animated at 150 ms. `fitView` eased to 400 ms `ease-in-out`.

#### Backlog clearance

- **Centralised style tokens** (P1) — extracted `SPACE`, `NODE_STYLES`, `HANDLE_ACCENT`, `HANDLE_PILL_BASE`, edge glow RGB tokens, animation keyframes, box-shadow helpers into `src/webview/styles.ts`. `CustomNode.tsx` and `index.tsx` now import from a single source of truth.
- **Publish VSIX workflow** (P2) — `.github/workflows/publish.yml` triggered on `v*.*.*` tags; runs `vsce package` + `vsce publish` with `VSCE_PAT` secret.
- **Codecov coverage upload** (P2) — CI workflow generates coverage via `@vitest/coverage-v8` and uploads to Codecov.
- **GitHub Actions SHA pinning** (P1) — `actions/checkout@v4` and `actions/setup-node@v4` pinned to commit SHAs.

### Changed

- **Published VSIX** — first public build at `harness-dashboard-vscode-0.3.0.vsix` (265 KB, 14 files).
- **Publisher identity** — `package.json#publisher` set to `marcmassacapo` (Marketplace identity).
- **CHANGELOG footnote** — explanatory note about test-count drift: each SDD feature adds 5–30 tests; the count reflects requirements, not a fixed target.
- **Zero npm audit warnings** — production dependency tree is clean.

### Removed

- **Duplicated CSS constants** — `SPACE`, `EASE_SMOOTH`, `nodeStyles`, `HANDLE_ACCENT`, `handlePillBase`, `hiddenHandleStyle` removed from component files; all now imported from `styles.ts`.

### Documentation

- `docs/configuration.md` — long-form ConfigurationRegistry reference (6 configurable adapters, 2 canonical, edge cases).
- `progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md` — full R↔T↔test traceability for FEAT-023 (22 requirements, 31 tasks).
- `progress/backlog.md` — completed items moved to "Completed" section; 3 remaining items documented as blocked.

### Technical

- Test suite: 141 unit tests (Vitest, 11 files) + 1 integration test (VS Code 1.124.2, 2.1 s).
- Coverage via `@vitest/coverage-v8`; reports to `coverage/` (lcov + text + html).
- `./check.sh`: 33 checks, 0 failures, 2 expected warnings (skipped CLI parity tests).
- All 23 SDD features in `feature_list.json` are `done`.

## [0.1.0] — 2026-06-08

> Renamed from *Harness Manager* to *Harness Dashboard* (identifier prefix: `harness-dashboard`).


### Added

- **Whiteboard canvas** — interactive React Flow graph of agents, subagents, skills and features
- **Edge types** — `manages` (smoothstep, blue), `uses` (dashed teal), `suggested` (animated amber flow), `discovered` (straight grey)
- **Per-type edge glow** — hover and selection states match the edge's own color; no more generic blue shadow
- **Semantic skill discovery** — TF-IDF cosine similarity suggests missing subagent↔skill connections
- **Idoneity scoring** — best semantic owner per skill; mismatch highlighting for misrouted skills
- **Inline Markdown viewer** — read SUBAGENT.md / SKILL.md in the detail panel without leaving the whiteboard
- **Edit in editor** — "✏ Edit File" button opens the Markdown file in the VS Code text editor
- **Toggle connections** — disable/enable skill connections; state persisted per workspace
- **Dismiss suggestions** — permanently hide unwanted suggestions (persisted across reloads)
- **Detail side panel** — slides in from the right; active node shows pulsing ring + "▶ Viewing" badge
- **Progress timeline** — SDD feature lifecycle (pending → spec_ready → in_progress → done)
- **Entity creation panel** — add agents, subagents and skills from the activity bar side panel
- **Cross-reference detection** — scans Markdown bodies for explicit skill references
- **Orphan detection** — surfaces subagents/skills present on disk but not registered in `agentic.json`
- **Custom icon** — monochrome SVG for activity bar; full-colour SVG for gallery
- **Output channel** — extension logs appear in *Output > Harness Dashboard* with severity levels

### Technical

- Extension Host: TypeScript strict mode, esbuild bundle, `vscode.LogOutputChannel`
- Webview: React 18 + React Flow 11 + `@vscode/webview-ui-toolkit`
- Test suite: 112 unit tests (Vitest), zero integration test dependencies
- Adapter pattern for future multi-framework support (FEAT-015 in progress)

## [0.2.0] — 2026-06-11

> Adds CI, governance guard, E2E test, and 5 new features (FEAT-015 through FEAT-022). All 22 SDD features shipped in this release are `done`; the project has 126 unit tests + 1 integration test + a governance regression guard that catches stale `FEAT-XXX` references in the backlog at `./check.sh` time.

### Added

- **Universal agent architecture reader (FEAT-015)** — parse and visualise agent architectures from Claude Code, Gemini CLI, Cursor, GitHub Copilot, and OpenCode alongside Harness SDD, all on a single whiteboard. The `WindsurfAdapter` source still ships for users with existing Windsurf workspaces, but Windsurf is no longer advertised as a supported framework (the product was discontinued after FEAT-015 shipped; see ADR-003).
- **Relationship visual refinement (FEAT-016)** — per-type edge routing, glow, label pill borders, animated `suggested` edges, hover/selected z-index layering.
- **Node position persistence + handle-pill linking (FEAT-017)** — manually moved nodes stay where you put them after a graph refresh; drag from one node's pill to another to create an edge directly.
- **End-to-end integration test (FEAT-021)** — `@vscode/test-electron` test that runs the extension in a real VS Code instance and exercises the critical user path (activate → click node → open in editor) in 2.1 s. Runs locally with `npm run test:integration` and in CI on every push/PR.
- **GitHub Actions CI (FEAT-018)** — workflow at `.github/workflows/ci.yml` runs `npm ci && npm run build && npm test && ./check.sh` on every push and PR to `main`, with a concurrency group that cancels obsolete runs.
- **Governance guard (FEAT-019)** — `./check.sh` now fails the build if `DESIGN.md`, `progress/backlog.md`, or `progress/decisions.md` still contains a template placeholder, or if the backlog references a `done` feature. First ADR (`ADR-001: Adopt the Harness SDD framework`) + second ADR (`ADR-002: Accept the GitHub repository name harness-manager and document the mismatch`).
- **`.vsix` gitignore cleanup (FEAT-020)** — `*.vsix` and `.vscode-test/` are now in `.gitignore`; the three committed binaries are untracked and no longer pollute `git status`.
- **Repository rename decision (FEAT-022)** — the GitHub repo is intentionally named `harness-manager` while the product is `harness-dashboard`. ADR-002 documents the decision and the `## Note on the repository name` section in `README.md` explains the mismatch.

### Technical

- Test suite: 126 unit tests (Vitest) + 1 integration test (Mocha + `@vscode/test-electron`). Full chain (`npm run build && npm test && npm run test:integration && ./check.sh`) completes in < 30 s.
- New devDependencies: `mocha@^11.7.6`, `@types/mocha@^10.0.10`, `@vscode/test-electron@^3.0.0`.
- `esbuild.js` now produces three new build targets (`runIntegrationTests.cjs`, `bootstrap.cjs`, `criticalPath.test.cjs`) into `out/test/integration/` (not `dist/`, so they do NOT ship in the production VSIX).
- `vitest.config.ts` excludes `src/test/integration/**` from the Vitest run, keeping unit and integration suites disjoint.
- Harness framework sync: `render.py` (+61 LOC for `_merge_unique_ordered` and `_sanitize_template_body` helpers), `AGENTS.md` (+7 LOC for the "Skill Loading Mechanism" block per agentskills.io), `BOOTSTRAP.md` (note about programmatic opencode render), `check.sh` (new `npm test -- --run` invocation + CLI Adapter Tests section), deletion of obsolete `opencode.json.tmpl` (now generated programmatically).
- A pre-existing bug in `check.sh` (the feature-list validator heredoc swallowed Python's exit code) was fixed as part of FEAT-018; without the fix, R8 of the ci-github-actions spec was technically unproven.

### Governance

- This is the first release where every shipped feature has a complete R↔T↔test traceability map in `progress/impl_<feature>.md` (5 new impl reports added: ci-github-actions, governance-docs, vsix-gitignore-cleanup, e2e-integration-test, repo-rename-decision).
- The governance guard (FEAT-019) has already caught stale `FEAT-XXX` references in the backlog during FEAT-020, FEAT-021, and FEAT-022 implementation — it works as designed.
- Two ADRs are now in `progress/decisions.md`. The format template at the top of the file has been rewritten as prose to avoid false-positive matches against the new governance regex.

### Backlog (post-0.2.0)

- P0: land the CI workflow on `main` and verify the deferred T7/T11/T12 in the first real PR (operational, not a code change).
- P1: validate the 7 universal adapters with real-world repos; refactor webview styles into a `webviewStyles.ts` helper; pin GitHub Actions to commit SHAs.
- P2: Codecov, publish workflow, animated screenshots.
- Tech-debt: `npm audit` warnings; publisher identity (`marcmassacapo` vs `marcmassa`, out of scope per ADR-002); deprecate `npx vitest run` direct invocation; CHANGELOG test-count footnote.

