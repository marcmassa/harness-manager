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

## [0.2.1] — 2026-06-14

> Backlog clearance: CSS refactor, CI/CD hardening, technical debt items.

### Added

- **Centralised style tokens** (backlog P1) — extracted `SPACE`, `NODE_STYLES`, `HANDLE_ACCENT`, `HANDLE_PILL_BASE`, edge glow RGB tokens, animation durations, keyframes string, `activeNodeShadow()` helper, and `edgeGlowCSS()` generator into `src/webview/styles.ts`. Both `CustomNode.tsx` and `index.tsx` now import from a single source of truth.
- **Publish VSIX workflow** (backlog P2) — `.github/workflows/publish.yml` triggered on `v*.*.*` tags; runs `vsce package` + `vsce publish` with `VSCE_PAT` secret.
- **Codecov coverage upload** (backlog P2) — CI workflow now generates coverage via `@vitest/coverage-v8` and uploads to Codecov after every push/PR.
- **GitHub Actions SHA pinning** (backlog P1) — `actions/checkout@v4` and `actions/setup-node@v4` replaced with pinned commit SHAs (`34e1148`, `49933ea`); comments document the versions and update procedure.

### Changed

- **Publisher identity** (backlog tech-debt) — `package.json#publisher` changed from `marcmassacapo` to `marcmassa` to match the GitHub repo owner.
- **CHANGELOG footnote** (backlog tech-debt) — added an explanatory note about test-count drift: each SDD feature adds 5–30 tests, so the count is a reflection of requirements, not a fixed target.

### Removed

- **Duplicated CSS constants** — `const SPACE`, `const EASE_SMOOTH`, `const nodeStyles`, `export const HANDLE_ACCENT`, `const handlePillBase`, `const hiddenHandleStyle` removed from `CustomNode.tsx` and `const SPACE` from `index.tsx`; all now imported from `styles.ts`.

### Technical

- Test suite: 141 unit tests (Vitest), 11 test files, 1 integration test.
- `@vitest/coverage-v8` added as devDependency; coverage reports generated to `coverage/` (lcov + text + html).

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

