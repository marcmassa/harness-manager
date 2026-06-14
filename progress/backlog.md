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

- [ ] **Land the CI workflow on `main` and verify the deferred T7/T11/T12 from the ci-github-actions spec in the first real PR** (workflow appears in PR Checks, concurrency cancels obsolete runs, wall-clock duration < 10 min). Without this verification, the CI workflow is structurally validated but operationally unproven. *(Blocked: requires a real PR to be opened against `main`.)*

## P1 — Important (next sprint)

- [ ] **Validate each of the 7 advertised adapters against a real-world repo of its framework**. Today the 7 advertised adapters (Harness SDD, Claude Code, Cursor, GitHub Copilot, OpenCode, Kiro, Gemini CLI) exist and have unit tests, but the README's "universal support" claim is only honest after each adapter has been smoke-tested with a representative workspace. Suggested smoke fixture per adapter: a 5-line `CLAUDE.md` for `ClaudeCodeAdapter`, etc. The 8th adapter (`WindsurfAdapter`) is retained for legacy workspaces but is not advertised; per ADR-003 it is not part of the "7" we are validating. (Updated for the configurable-paths release: Kiro was added as the 7th advertised adapter. The canonical `harness-sdd` and `opencode` adapters are first-class; the 5 universal adapters shipped earlier are now 6 with Kiro; `windsurf` is the deprecation-still-supported 8th.) *(Blocked: requires access to repos using each framework.)*

## P2 — Nice to have (whenever possible)

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
