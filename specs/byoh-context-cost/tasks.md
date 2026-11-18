# Tasks — BYOH context cost, optimization and inference usage

- [ ] **T1** — Add `loadMode` to the FEAT-041 source record, the built-in load mode table, and the optional profile v1 and companion v1 fields. Test every table row, an undeclared resource yielding `unknown`, a branded file name without declaration yielding `unknown`, and a v1 profile and companion without the field remaining valid. _(R1, R2, R3)_
- [ ] **T2** — Implement `computeSessionCost` with calibration. Test baseline, catalog and on-demand sums per owner, unknown resources listed as unpriced and excluded from totals, a provider with no declared modes reported unevaluated, and calibration applied only when configured. _(R4, R5, R6, R10)_
- [ ] **T3** — Implement OPT-K01–K03 under FEAT-043 applicability and render the cost section with money estimates. Test cross-owner duplication between CLAUDE.md, AGENTS.md and copilot-instructions, the baseline share, an on-trigger candidate, attribution of all affected owners, unauthorized actions hidden, and the factor and price date shown with every money figure and no network call. _(R7, R8, R9, R10)_
- [ ] **T4** — Implement the inference ledger and wire AI-assisted callers. Test reported OpenAI-compatible usage, `countTokens` present and absent, the 500-entry cap, and absence of prompt or response content in stored entries. _(R11, R12)_
- [ ] **T5** — Implement the git HEAD comparison. Test changed, new and deleted sources, a non-git folder, and an untracked file without analysis failure. _(R13, R14)_
- [ ] **T6** — Exercise SDD-only, foreign-only, custom-profile and mixed folders in the Extension Host. Compare workspace contents and script sentinels before and after cost analysis and the baseline diff. _(R1, R4, R5, R8, R10, R13, R15)_

Record the R-to-test results before independent review. Run build, unit tests, integration, packaging and project checks on the implementation candidate.

## Traceability

| R | Tasks |
|---|---|
| R1 | T1, T6 |
| R2 | T1 |
| R3 | T1 |
| R4 | T2, T6 |
| R5 | T2, T6 |
| R6 | T2 |
| R7 | T3 |
| R8 | T3, T6 |
| R9 | T3 |
| R10 | T2, T3, T6 |
| R11 | T4 |
| R12 | T4 |
| R13 | T5, T6 |
| R14 | T5 |
| R15 | T6 |
