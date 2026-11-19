# Tasks — Shared abstractions for duplicated code

- [ ] **T1** — Route `gitState` through `createGitRunner`. Test that it passes `-c core.fsmonitor=false` without a shell, and that it maps a non-repository to `'no-vcs'`. _(R5)_
- [ ] **T2** — Move the in-memory `vscode` mock to `src/test/vscodeMock.ts` and switch the seven test files to it. Record any fixture correction and the reason. _(R2)_
- [ ] **T3** — Add `finding()` and `OPTIMIZABLE_TYPES` and replace the copies. Test that no rule file defines its own `finding` and that every type list equals the constant. _(R3)_
- [ ] **T4** — Add the adapter helpers and use them in the six adapters. Test the flag combinations once, the body preview length, and the root node fallback. Existing adapter tests stay green. _(R1, R4)_
- [ ] **T5** — Add `AiIconButton` and the shared style constants, and replace the copies. Test that each constant has one definition, and run the `webviewChunks` suite. _(R6)_
- [ ] **T6** — Add `fsSnapshot.ts`, `summary.ts`, the key constants and `describeAll`, and replace the copies. _(R7)_
- [ ] **T7** — Make `check.sh` fail on failing unit tests and report the count. Test with a deliberately failing test in a scratch copy, which is not committed. _(R9)_
- [ ] **T8** — Run the full unit suite, the Extension Host suites and the package gate. Record lines removed and the VSIX size before and after. _(R8)_

## Traceability

| R | Tasks |
|---|---|
| R1 | T4 |
| R2 | T2 |
| R3 | T3 |
| R4 | T4 |
| R5 | T1 |
| R6 | T5 |
| R7 | T6 |
| R8 | T8 |
| R9 | T7 |
