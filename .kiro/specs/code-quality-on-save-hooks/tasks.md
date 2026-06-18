# Tasks — Code Quality On-Save Hooks (KISS + DRY)

> Feature FEAT-027. Implements R1–R18. Execute in order.

## Check catalog

- [ ] **T1** — Create `hooks/code-quality-checks.json` with the 9 checks (5 KISS + 4 DRY) and their IDs/severities. _(R3–R11, R18)_

## KISS hook

- [ ] **T2** — Create `hooks/kiss_check.py` implementing R3 (long file), R4 (long function), R5 (deep nesting), R6 (unused param), R7 (swallowed exception). Reads a file path from argv, emits the JSON report on stdout. _(R3, R4, R5, R6, R7)_
- [ ] **T3** — Create `hooks/on-file-saved-kiss-check.sh` (bash entry point) that exports `FILE` and calls `kiss_check.py`. `chmod +x`. _(R17)_
- [ ] **T4** — Add `kiss_check` to `agentic.json#hooks[]` with `event: "on_file_saved_kiss"`, `on_failure: "ignore"`. _(R17)_

## DRY hook

- [ ] **T5** — Create `hooks/dry_check.py` implementing R8 (repeated string), R9 (magic number), R10 (duplicate function, Jaccard ≥ 0.85), R11 (duplicate type/interface). _(R8, R9, R10, R11)_
- [ ] **T6** — Create `hooks/on-file-saved-dry-check.sh` (bash entry point) that exports `FILE` and calls `dry_check.py`. `chmod +x`. _(R17)_
- [ ] **T7** — Add `dry_check` to `agentic.json#hooks[]` with `event: "on_file_saved_dry"`, `on_failure: "ignore"`. _(R17)_

## TypeScript module

- [ ] **T8** — Create `src/verifier/codeQualityRunner.ts` with `runCodeQualityHooks(filePath, root, options)` that spawns both scripts in parallel, parses JSON, returns the merged `HookReport[]`. _(R12)_
- [ ] **T9** — Add a unit test `src/verifier/codeQualityRunner.test.ts` that mocks `child_process.spawn` to return fixture JSON for each hook, and verifies the merged result. _(R12, R15)_

## Extension integration

- [ ] **T10** — In `src/extension.ts`: register `onWillSaveTextDocument` listener that, for `src/**/*.{ts,tsx}` and `blockOnSave: true`, runs the hooks and cancels the save on error. _(R1, R13, R14)_
- [ ] **T11** — In `src/extension.ts`: register `onDidSaveTextDocument` listener that, for the same glob, runs the hooks, updates a `DiagnosticCollection`, and writes a report to the OutputChannel. _(R1, R12)_
- [ ] **T12** — Add the 5 `harness-dashboard.codeQuality.*` settings in `package.json#contributes.configuration`. _(R13, R15, R16)_

## Manual command

- [ ] **T13** — Register command `harness-dashboard.verifyCodeQuality` in `package.json#contributes.commands`. _(R2)_
- [ ] **T14** — Wire the command in `extension.ts`: open a file picker filtered to `src/**/*.ts(x)`, run both hooks on the chosen file, show the merged report in the OutputChannel. _(R2)_

## Verification

- [ ] **T15** — `npm test`, `npm run build`, `./check.sh` all green. _(all)_
- [ ] **T16** — Manual: save a valid TS file, no diagnostics appear. _(R1, R12)_
- [ ] **T17** — Manual: save a TS file with a function > 80 lines, warning appears in Problems panel under the KISS source. _(R4, R12)_
- [ ] **T18** — Manual: save a TS file with two near-identical functions, warning appears under DRY source. _(R10, R12)_
- [ ] **T19** — Manual: set `blockOnSave: true` and `severity: "error"`, save a TS file with a long function, the save is rolled back. _(R13, R15)_
- [ ] **T20** — Manual: run `bash hooks/run-hooks.sh on_file_saved_kiss --file src/parserLogic.ts`, the hook runs and prints the JSON report. _(R17)_
- [ ] **T21** — Manual: set `kissEnabled: false`, save a TS file with a long function, no KISS diagnostic appears. _(R16)_
