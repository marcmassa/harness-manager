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


- [ ] **Close acceptance-evidence gaps** — writer persistence and webview click flows need tests that exercise the actual paths; canvas overlap prevention needs verification after layout. Restore missing skill-toggle traceability and collect the outstanding manual, CI cancellation and detector benchmark evidence. [Full task-by-task inventory](spec-review/README.md).

- [ ] **Complete the deferred Runs history UI and verify its storage lifecycle** — the toolbar/history drawer/task-prefill path is absent; existing history tests duplicate helper logic instead of exercising the coordinator's persistence and duration updates. Decide implementation versus an explicitly approved scope amendment. Evidence: [Agent Run closure review](reconcile-agent-run-studio.md).

- [ ] **Align the interactive Claude command preview with execution** — the Run panel shows `--message` while the adapter omits it; the preview therefore does not represent the command that runs. Evidence: [Agent Run closure review](reconcile-agent-run-studio.md).



- [ ] **Click through the 7 advertised adapters in the webview** — the scripted real-workspace runs passed for all seven on 2026-11-19 ([results](../docs/byoh/field-results-2026-11-19.md)). The remaining step of the smoke procedure is manual: locate each expected entity on the canvas and open its source from the detail panel.

- [ ] **Resolve source paths against the parsed root (multi-root prerequisite)** — `toRelativePath` relies on `vscode.workspace.asRelativePath`, which is relative to the containing workspace folder. Parsing a root nested inside a workspace folder prefixes paths with the subfolder name and breaks source URIs (seen with Harness SDD, Kiro and Cursor in the 2026-11-19 field run). Single-folder workspaces are unaffected.

## P2 — Nice to have (whenever possible)

- [ ] **VSIX payload watch** — budget utilization is ≥80% since the ADR-005 amendment (the packaging gate prints the utilization line on every run). When the next UI-dependency bump pushes the artifact over the gate, open a webview code-splitting / bundle-diet feature rather than amending the budget twice.

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

- ✅ **CI workflow operationally verified on a real PR** (was the only P0): PR #3 (`v0.8.1 — Supply-Chain Health`) exercised the full gate — workflow appeared in PR Checks, `ci` job **pass in 1m 10s** (< 10 min budget ✅), CodeQL Analyze jobs pass, and the post-merge push run on `main` passed in 1m 14s. One deferred sub-criterion remains **unproven but non-blocking**: concurrency cancellation of obsolete runs needs two pushes within the job duration (~1 min) and has not fired on any PR yet — re-check opportunistically on the next rapid-push PR (T11 of the ci-github-actions spec).
- ✅ **Dependabot security updates configured on `main`** — `.github/dependabot.yml` landed with the v0.8.1 supply-chain dogfood task (T1); the first `Dependabot Updates` runs (`npm_and_yarn`, `github_actions`) triggered automatically minutes after the merge.

## Completed (verified 2026-11-16; maintenance branch)

- ✅ **Development-tree npm audit remediation** — main at `5522ad3`: 9 findings (3 high, 5 moderate, 1 low), production 0. Compatible lockfile updates plus scoped Mocha/vsce overrides reduce both audits to 0. Evidence and override retirement criteria: `docs/security/2026-11-16-maintenance.md`.
- ✅ **macOS e2e harness** — `@vscode/test-electron@3.1.0` runs current stable VS Code 1.146.0 on darwin-arm64 without `VSCODE_TEST_PATH`; integration test passes before and after the final dependency overrides. The previous Electron/Code ENOENT no longer reproduces.

- Retake the older README screenshots (whiteboard, SDD panel, Advisory, full window) for the 0.9 editor Dashboard; `dashboard-0-9-0.png` already shows the native views.

- Upstream the 0.9.0 `check.sh` fix (a failing unit-test run fails the check instead of warning) to the Harness SDD framework template, so a framework update does not revert it.
