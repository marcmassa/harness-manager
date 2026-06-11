# Tasks — Populate Governance Documents (FEAT-019)

> Discrete steps in order. The implementer marks `[x]` upon completing
> each one. Each task references the R<n> it covers and the test that
> will verify it.

## Pre-flight

- [x] **T0** — Confirm `DESIGN.md`, `progress/backlog.md`, and
  `progress/decisions.md` are the original template files (T0 is
  just a sanity check before rewriting; not a deliverable).

## Implementation

- [x] **T1** — Rewrite `DESIGN.md` (replace the 49-line template)
  with the 6 required sections (R1, R2, R3, R4, R5). Keep under
  250 lines; document the cap in the `Note to AI Agents` callout. _(R1, R2, R3, R4, R5)_
- [x] **T2** — Rewrite `progress/backlog.md` (replace the empty
  template) with prioritised P0/P1/P2/Tech-debt sections and
  concrete, checkable items. Cross-reference `feature_list.json` to
  ensure no `done` feature is in the backlog (R9). _(R6, R7, R8, R9)_
- [x] **T3** — Append `ADR-001: Adopt the Harness SDD framework for
  the Harness Dashboard repository` to `progress/decisions.md`,
  below the existing `## Format` section. Include all 6 standard
  fields and at least 2 discarded alternatives with one-sentence
  reasons each (R11, R12, R13). _(R10, R11, R12, R13, R14)_
- [x] **T4** — Append the "Governance Documents" section to
  `check.sh` (after the existing "SDD Infrastructure" section).
  The section SHALL scan `DESIGN.md`, `progress/backlog.md`, and
  `progress/decisions.md` for template placeholders and SHALL cross-
  check `progress/backlog.md` against the `done` feature IDs in
  `feature_list.json` (R16, R17). The section SHALL contribute to
  `EXIT_CODE` like every other check. _(R16, R17)_

## Tests / Verification

- [x] **T5** — Static greps for the R1–R15 placeholders and
  section-heading assertions documented in `design.md`'s Test Plan
  table. All 17 requirements must PASS a single Python script that
  reads the three docs and `feature_list.json`. _(R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15)_
- [x] **T6** — Run `./check.sh` and confirm the new "Governance
  Documents" section reports 4 PASS lines (3 files clean of
  placeholders + 1 backlog free of done-feature references) and the
  final result is `✅ All checks passed`. _(R16, R17)_
- [x] **T7** — Failure case: temporarily inject a placeholder
  (e.g., `{Briefly describe}`) into a copy of `DESIGN.md` (e.g.,
  `cp DESIGN.md /tmp/DESIGN.md.t7 && sed -i '' 's/Some/Some {Briefly
  describe}/' /tmp/DESIGN.md.t7`). Run a script that pipes
  `/tmp/DESIGN.md.t7` through the same grep the new check uses and
  confirm the grep reports the placeholder. Restore (T7 is a
  throwaway, no in-repo state to restore). _(R16)_
- [x] **T8** — Failure case: temporarily add a `done` FEAT ID to
  the backlog (e.g., `echo "- [ ] FEAT-001 (stale ref)" >>
  progress/backlog.md`), run `./check.sh`, confirm the new check
  reports `❌ backlog.md references done feature FEAT-001`, then
  revert. _(R9)_
- [x] **T9** — Run the full verification chain: `npm run build &&
  npm test && ./check.sh`. All green, exit 0. _(R16, R17)_

## Documentation

- [x] **T10** — Document the `R<n> ↔ test` traceability map in
  `progress/impl_governance-docs.md` (table with the 17 requirements
  and the T5/T6/T7/T8/T9 verifications that cover them).

## Closure

- [ ] **T11** — Run `./check.sh` one final time and confirm zero
  failures.
- [ ] **T12** — Update `feature_list.json`: set FEAT-019 `status` to
  `"done"`.
- [ ] **T13** — Log a summary in `progress/progress.md` following the
  format of prior entries (FEAT-001 through FEAT-018).
- [ ] **T14** — Clear `progress/current.md` to its template form
  (per `AGENTS.md` §5 session closing rule).
