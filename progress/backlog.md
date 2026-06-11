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

- [ ] **Land the CI workflow on `main` and verify the deferred T7/T11/T12 from the ci-github-actions spec in the first real PR** (workflow appears in PR Checks, concurrency cancels obsolete runs, wall-clock duration < 10 min). Without this verification, the CI workflow is structurally validated but operationally unproven.

## P1 — Important (next sprint)

- [ ] **Validate each of the 6 active universal adapters against a real-world repo of its framework**. Today the 6 advertised adapters exist and have unit tests, but the README's "universal support" claim is only honest after each adapter has been smoke-tested with a representative workspace. Suggested smoke fixture per adapter: a 5-line `CLAUDE.md` for `ClaudeCodeAdapter`, etc. The 7th adapter (`WindsurfAdapter`) is retained for legacy workspaces but is not advertised; per ADR-003 it is not part of the "6" we are validating. *This backlog item was originally authored with a placeholder ID; the real feature ID will be assigned when the feature is created in `feature_list.json`.*
- [ ] **Refactor: extract 4 webview CSS-in-JS patterns** (per-type node outline, per-type edge glow, animated suggestion dash, hover/selected state colour mapping) **into a single `src/webview/styles.ts` helper**. Improves consistency and makes the design tokens discoverable. (Tracked as a refactor task, not a feature — no `FEAT-XXX` ID needed.)
- [ ] **Pin GitHub Actions to commit SHAs** (currently `@v4` major-version pins). Defense-in-depth against a compromised tag. Affects `.github/workflows/ci.yml` only. (Tracked as a hardening task, not a feature.)

## P2 — Nice to have (whenever possible)

- [ ] **Coverage report upload to Codecov (or Coveralls)**. Out of scope of the ci-github-actions spec by design; revisit when there's a meaningful coverage delta to track. *This backlog item was originally authored with a placeholder ID; the real feature ID will be assigned when the feature is created in `feature_list.json`.*
- [ ] **FEAT-023 — Publish VSIX workflow**. A second GitHub Actions job triggered on tag push (`v*.*.*`) that runs `vsce package` and `vsce publish` using a `VSCE_PAT` secret stored in repo settings. Requires the PAT to be created and documented; not blocking the 0.1.x line.
- [ ] **Animated screenshots / GIF in `README.md`** showing the whiteboard, the timeline, the suggestion accept flow, and the MD viewer. The README's "Features" table is currently text-only; visuals would shorten the "what does this look like?" loop for evaluators.

## Technical / Debt

- [ ] **Investigate the `npm audit` warnings surfaced during the ci-github-actions dry-run (T5)**. The `npm ci` step succeeded but `npm audit` reported 2 vulnerabilities in transitive dependencies (`@types/dagre`, `canvas` for the build matrix). Neither is a runtime concern (both are dev-only), but they should be triaged and either pinned to safe versions or replaced.
- [ ] **Reconcile publisher identity**: `package.json#publisher` is `marcmassacapo` (12 chars) but the GitHub repo owner is `marcmassa` (9 chars). The Marketplace will reject the publish until this is unified. (5-minute fix once the rename decision in P0 is taken.)
- [ ] **Deprecate the `npx vitest run` direct invocation path** that the original `check.sh` (pre-harness-update) used; the new `check.sh` (after the harness infrastructure sync + ci-github-actions) uses `npm test -- --run` which is the canonical path. Some internal scripts (`scripts/*` if any are added later) may still use the old form — keep them consistent.
- [ ] **Document the `n` (number of unit tests) drift tolerance** in `CHANGELOG.md`. Each release bumps the count by 5–30; the CHANGELOG currently says "112 → 126" without explaining the cadence. A short "Tests: we add tests for every new R<n> in a `sdd: true` feature" footnote would help reviewers estimate the scope of a PR from the count alone.
