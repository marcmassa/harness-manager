# Tasks — End-to-end integration test of the critical user path (FEAT-021)

> Discrete steps in order. The implementer marks `[x]` upon
> completing each one. Each task references the R<n> it covers.

## Pre-flight

- [ ] **T0** — Confirm `@vscode/test-electron` is NOT yet in
  `package.json#devDependencies` (sanity check; the install is
  T1).

## Implementation

- [ ] **T1** — Add `@vscode/test-electron` to
  `package.json#devDependencies`. (Latest 2.x at time of writing;
  the implementer pins to a major version, e.g. `^2.3.0`.) Run
  `npm install` and confirm `node_modules/@vscode/test-electron/`
  exists. _(R1)_
- [ ] **T2** — Add the `test:integration` npm script to
  `package.json#scripts`:
  `"test:integration": "node ./out/test/integration/runIntegrationTests.js"`
  (or, in the ESM world the project uses, the equivalent `.mjs`
  or post-build path). The exact path is determined by the
  TypeScript build configuration. _(R1)_
- [ ] **T3** — Create the fixture workspace
  `src/test/fixtures/harness-sdd-minimal/` with the 4 files
  listed in `design.md`. Include a sentinel line
  `Demo Subagent for E2E test` at the top of the
  `SUBAGENT.md` so the R10 assertion is robust. _(R2)_
- [ ] **T4** — Create `src/test/integration/runIntegrationTests.ts`
  (the entry point that `@vscode/test-electron` downloads and
  executes). It uses Mocha to discover
  `src/test/integration/criticalPath.test.ts`, sets a 60-second
  per-test timeout, and configures the extension to be loaded
  from `dist/extension.cjs` (the production bundle). _(R1, R4)_
- [ ] **T5** — Create `src/test/integration/criticalPath.test.ts`
  implementing the 7-step critical path described in
  `design.md`. The test uses `vscode.window.tabGroups.all` and
  `vscode.workspace.openTextDocument` to assert R9/R10/R11.
  _(R3, R4, R5, R6, R7, R8, R9, R10, R11)_
- [ ] **T6** — Update `vitest.config.ts` to add
  `exclude: ['src/test/integration/**']` so Vitest does not try
  to run the integration test under the unit suite. (Vitest's
  `include: ['src/**/*.test.ts']` is broad and would otherwise
  pick up `criticalPath.test.ts`, which uses Mocha's `suite`
  global, not Vitest's `describe`.) _(R14)_
- [ ] **T7** — Update `.github/workflows/ci.yml` to add the
  `Run integration test` step after the existing
  `Harness SDD check` step, with `continue-on-error: true` and
  the `xvfb-run -a` prefix as documented in `design.md`. The
  step SHALL have `timeout-minutes: 10` and SHALL set
  `VSCODE_TEST_CACHE: /tmp/vscode-test-cache` to stabilize the
  download cache across CI runs. _(R12)_

## Verification

- [ ] **T8** — Build the integration test:
  `npm run build` (the existing esbuild script should pick up
  the new `src/test/integration/*.ts` files via the project's
  standard TS include). Confirm the output exists at the path
  referenced by `test:integration`. _(R1, R14)_
- [ ] **T9** — Run the integration test locally:
  `npm run test:integration`. The test SHALL pass within 60
  seconds (R13). If the local environment cannot run VS Code
  (e.g., headless Linux without Xvfb), the implementer SHALL
  install Xvfb or document the limitation. _(R13)_
- [ ] **T10** — Run the unit test suite: `npm test`. Confirm
  126/126 tests still pass, and the runtime is within 1 second
  of the pre-feature baseline (~0.5 s). _(R14)_
- [ ] **T11** — Run the full local chain:
  `npm run build && npm test && npm run test:integration && ./check.sh`.
  All green, exit 0. _(R14, R13)_
- [ ] **T12** — Failure case (sanity): introduce a small,
  known-bad change (e.g., add an early `return` in
  `extension.ts`'s `openInEditor` handler) in a throwaway
  branch, run the integration test, confirm it FAILS with a
  clear assertion message, then revert. This proves the test
  has teeth (catches real regressions). _(R9, R10)_
- [ ] **T13** — Verify R15: `git diff --name-only origin/main --
  src/extension.ts src/parserLogic.ts src/harnessParser.ts
  src/harnessWriter.ts src/semanticMatcher.ts
  src/idoneity.ts src/types.ts src/frameworks.ts src/webview/
  src/adapters/` returns empty (no production source
  modified). _(R15)_

## Documentation

- [ ] **T14** — Document the `R<n> ↔ test` traceability map in
  `progress/impl_e2e-integration-test.md` (table with the 15
  requirements and the T1–T13 verifications that cover them,
  plus a measured local-runtime row).
- [ ] **T15** — Remove the P1 item this feature closes from
  `progress/backlog.md` (the "FEAT-020 — End-to-end
  integration test" bullet — note: the spec's `FEAT-020`
  numbering refers to the backlog slot; the actual feature ID
  is FEAT-021 in `feature_list.json`; remove the bullet
  regardless of which ID it carries).

## Closure

- [ ] **T16** — Run `./check.sh` one final time and confirm zero
  failures.
- [ ] **T17** — Update `feature_list.json`: set FEAT-021
  `status` to `"done"`.
- [ ] **T18** — Log a summary in `progress/progress.md`
  following the format of prior entries (FEAT-001 through
  FEAT-020).
- [ ] **T19** — Open a GitHub issue (or note the maintainer
  should open one) titled "Remove `continue-on-error: true`
  from integration-test CI step (30-day grace period)" with a
  reminder to remove the flag after 30 days of stable green
  runs. Reference the issue URL in
  `progress/impl_e2e-integration-test.md` and in
  `.github/workflows/ci.yml` (replace the `<URL>` placeholder
  in T7). _(R12)_
- [ ] **T20** — Commit the change as a single conventional-commits
  commit (`feat(test): add end-to-end integration test of the
  critical user path`). The body SHALL list which R<n> it
  satisfies.
