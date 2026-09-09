# Backlog

> Prioritised list of pending features for the Harness Dashboard project.
>
> Each item is either a checkbox task linked to a `FEAT-XXX` entry in
> `feature_list.json` (status `pending` or `blocked`) or a short
> descriptive task (no ID). Items are listed in priority order within
> each section; the section header encodes the priority.
>
> **Maintenance rule** (per `DESIGN.md` and the first ADR): when an item
> is shipped, remove it from the backlog in the same commit that flips
> its `feature_list.json` entry to `done`. The `./check.sh` governance
> check (the governance-docs spec, requirements R16/R17) fails if the
> backlog references any `status: "done"` feature.

## P0 — Critical (current sprint)

_(cleared — see Completed sections below)_

## P1 — Important (next sprint)

- [ ] **Fix the e2e harness against current VS Code stable** — `@vscode/test-electron@2.5.2` spawns `Contents/MacOS/Electron` but darwin zips from 1.136.x ship the binary as `Code` (ENOENT before extension load; `npm run test:integration` fails identically on `main` and on the migration branch). The React Flow 12 migration's e2e pass (2026-09-09) was obtained via `VSCODE_TEST_PATH` against cached 1.124.2. Fix = upgrade test-electron (or pin/patch the binary-name resolution) so the integration gate runs against stable again. Surfaced during the 0.8.1 migration work, deliberately kept out of that feature (one feature at a time).

- [ ] **Validate each of the 7 advertised adapters against a real-world repo of its framework**. Today the 7 advertised adapters (Harness SDD, Claude Code, Cursor, GitHub Copilot, OpenCode, Kiro, Gemini CLI) exist and have unit tests, but the README's "universal support" claim is only honest after each adapter has been smoke-tested with a representative workspace. Suggested smoke fixture per adapter: a 5-line `CLAUDE.md` for `ClaudeCodeAdapter`, etc. The 8th adapter (`WindsurfAdapter`) is retained for legacy workspaces but is not advertised; per ADR-003 it is not part of the "7" we are validating. (Updated for the configurable-paths release: Kiro was added as the 7th advertised adapter. The canonical `harness-sdd` and `opencode` adapters are first-class; the 5 universal adapters shipped earlier are now 6 with Kiro; `windsurf` is the deprecation-still-supported 8th.) *(Blocked: requires access to repos using each framework.)*

## P2 — Nice to have (whenever possible)

- [ ] **Capture `media/screenshots/chat-handoff.png`** — a finding's prompt arriving prefilled in the host editor's chat, to fill the empty second cell of the 0.8.0 screenshot row. The optimizer panel shot landed in 0.8.0; only this one is outstanding. *(Blocked: it is the host editor's own chat UI, and `screencapture` from the build environment returns "could not create image from display" for lack of macOS Screen Recording permission.)*

- [ ] **Re-shoot `media/screenshots/optimizer-panel.png` with a component row expanded** (optional polish). The current shot shows the radar, the legend and the table, but every row is collapsed, so the per-finding actions — quick fix, AI refine, Ask &lt;host&gt;, Delegate — are not visible anywhere in the README.

- [ ] **Animated screenshots / GIF in `README.md`** showing the whiteboard, the timeline, the suggestion accept flow, and the MD viewer. The README's "Features" table is currently text-only; visuals would shorten the "what does this look like?" loop for evaluators. *(Blocked: requires manually running the extension in VS Code to capture.)*

## Completed (cleared in 2026-06-14 session)

- ✅ **CSS-in-JS refactor** — `src/webview/styles.ts` created; `CustomNode.tsx` and `index.tsx` import shared tokens (P1).
- ✅ **GitHub Actions SHA pinning** — `actions/checkout@v4` and `actions/setup-node@v4` pinned to commit SHAs (P1).
- ✅ **Coverage report upload to Codecov** — `@vitest/coverage-v8` installed; CI workflow generates and uploads coverage (P2).
- ✅ **Publish VSIX workflow** — `.github/workflows/publish.yml` created (trigger: `v*.*.*` tags) (P2).
- ✅ **Publisher identity** — `package.json#publisher` changed to `marcmassa` (tech-debt).
- ✅ **CHANGELOG test-count footnote** — explanatory note added about SDD-driven test count drift (tech-debt).
- ✅ **npm audit** — re-checked: 0 vulnerabilities in production deps (tech-debt).
- ✅ **Deprecate npx vitest run** — no references found in `check.sh`, `scripts/`, or elsewhere (tech-debt).

## Completed (cleared in 2026-09-09 session)

- ✅ **CI workflow operationally verified on a real PR** (was the only P0): PR #3 (`v0.8.1 — Supply-Chain Health`) exercised the full gate — workflow appeared in PR Checks, `ci` job **pass in 1m 10s** (< 10 min budget ✅), CodeQL Analyze jobs pass, and the post-merge push run on `main` passed in 1m 14s. One deferred sub-criterion remains **unproven but non-blocking**: concurrency cancellation of obsolete runs needs two pushes within the job duration (~1 min) and has not fired on any PR yet — re-check opportunistically on the next rapid-push PR (T12 of the ci-github-actions spec).
- ✅ **Dependabot security updates configured on `main`** — `.github/dependabot.yml` landed with the v0.8.1 supply-chain dogfood task (T1); the first `Dependabot Updates` runs (`npm_and_yarn`, `github_actions`) triggered automatically minutes after the merge.
