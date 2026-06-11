# Implementation Report — Populate Governance Documents (FEAT-019)

> Traceability R↔T↔test for feature FEAT-019. Maps every EARS
> requirement to the task that implemented it and the verification
> (static grep or runtime check) that proves it.

## Summary

- **Rewrote** `DESIGN.md` (49 → 232 lines): real 6-section architectural
  overview, 6-row component table, 5 architectural principles, 4-tier
  data flow diagram, explicit "no backend / no cloud / no API keys"
  statement.
- **Rewrote** `progress/backlog.md` (18 → 39 lines): 4 prioritised
  sections (P0/P1/P2/Tech-debt) with 13 concrete items, each
  referencing a `FEAT-XXX` ID that exists (or will exist) in
  `feature_list.json` and is `pending` or `blocked`. No `done` feature
  appears.
- **Appended ADR-001** to `progress/decisions.md` (20 → 88 lines):
  formal record of the project-level decision to adopt the Harness
  SDD framework, with 6 standard fields and 3 discarded alternatives
  (MADR, arc42, no formal ADR process). Reformulated the `## Format`
  template into prose that does not match the placeholder regex, so
  it does not trigger the regression guard.
- **Appended a "Governance Documents" check** to `check.sh` (369 →
  370 lines net, but the new section is ~45 lines): scans the 3
  governance docs for template placeholders and cross-checks the
  backlog against the `done` features in `feature_list.json`. The
  section participates in `EXIT_CODE` like every other check.

## Files Touched

| File | Action | Reason |
|---|---|---|
| `DESIGN.md` | rewrite | Replace 49-line placeholder with real architecture doc (R1–R5) |
| `progress/backlog.md` | rewrite | Replace empty template with concrete backlog (R6–R9) |
| `progress/decisions.md` | append ADR-001, rewrite `## Format` as prose (R10–R14) | First real ADR; format section must not trigger the new check |
| `check.sh` | append new section | New "Governance Documents" check (R16, R17) |
| `feature_list.json` | modified | Add FEAT-019 entry (spec-author phase); mark `done` in T12 |
| `progress/impl_governance-docs.md` | created | This file |
| `progress/progress.md` | modified | Append FEAT-019 summary (T13) |
| `progress/current.md` | reset to template form (T14) | Per `AGENTS.md` §5 session closing rule |

No production code (`src/`, `package.json`, `tsconfig.json`,
`esbuild.js`, `vitest.config.ts`, `media/`, `docs/`) was modified.
No dependencies added.

## R↔T↔test Map

| Req | Title | Implemented by | Verified by |
|---|---|---|---|
| R1 | `DESIGN.md` exists and is non-template | T1 | T5 (Python assertion R1: no template placeholders) + T6 (runtime check passes) |
| R2 | `DESIGN.md` sections present in order | T1 | T5 (Python assertion R2: positions `[604, 1628, 3286, 5774, 7899, 10002]`, monotonically increasing) |
| R3 | `DESIGN.md` content accuracy (no terraform/helm/etc.) | T1 | T5 (Python assertion R3: regex `(?i)terraform\|helm\|kubernetes\|k8s\|docker-compose\|pulumi\|cloudformation` returns no matches) |
| R4 | `DESIGN.md` component table accuracy | T1 | T5 (Python assertion R4: 6/6 components present) |
| R5 | `DESIGN.md` size ≤ 250 lines | T1 | T5 (Python assertion R5: 232 lines) |
| R6 | `backlog.md` exists and is non-template | T2 | T5 (Python assertion R6: no template placeholders) + T6 |
| R7 | `backlog.md` prioritised sections | T2 | T5 (Python assertion R7: positions `[688, 1705, 3119, 3888]`, monotonically increasing) |
| R8 | `backlog.md` items are concrete (single-line, no TBD/braces) | T2 | T5 (Python assertion R8: 0 multi-line items, 0 TBD/braces) |
| R9 | `backlog.md` does not reference `done` features | T2 | T5 (Python assertion R9: 0 overlap) + T8 (failure case: `FEAT-001` injected → check.sh reports ❌, restored to ✅) |
| R10 | `decisions.md` not just format template | T3 | T5 (Python assertion R10: 1 ADR-001) |
| R11 | ADR-001 has all 6 standard fields | T3 | T5 (Python assertion R11: 0 missing fields) |
| R12 | ADR-001 lists ≥ 2 discarded alternatives | T3 | T5 (Python assertion R12: 3 alternatives found) |
| R13 | ADR-001 `Cost` sub-bullet populated | T3 | T5 (Python assertion R13: 990 chars) |
| R14 | No duplicate ADR-001 | T3 | T5 (Python assertion R14: exactly 1 ADR-001 header) |
| R15 | Docs consistent with code | T1–T3 (cross-references) | T5 (Python assertion R15: informational; T6 + T8 enforce at runtime) |
| R16 | `check.sh` fails on leftover placeholders | T4 | T6 (runtime check: 0 placeholders, 3 PASS lines) + T7 (failure case: `{Briefly describe}` injected → grep finds it on line 235) |
| R17 | New check integrated into `check.sh` flow | T4 | T6 (check.sh exit 0 with 4 new passes); the new check sits between "CLI Adapter Tests" and "Result" sections, contributing to `EXIT_CODE` |

## Verification Commands Run

| Step | Command | Expected | Actual | Pass? |
|---|---|---|---|---|
| T0 | `wc -l DESIGN.md progress/backlog.md progress/decisions.md` | 49 / 18 / 20 (template sizes) | 49 / 18 / 20 | ✅ |
| T0 | `grep -E '\{(Briefly describe\|...)' DESIGN.md` | 7 matches | 7 matches | ✅ (pre-rewrite) |
| T5 | Python assertion script (15 checks) | all PASS | all 15 ✅ | ✅ |
| T6 | `./check.sh` after T1–T4 | exit 0, 4 new PASS lines, 0 fails | exit 0, 4 new PASS lines, 33 total passes | ✅ |
| T7 | Inject `{Briefly describe}` into copy of `DESIGN.md`, run grep | grep finds it on its line | line 235 | ✅ |
| T8 | Append `FEAT-001` to `backlog.md`, run `check.sh` | check.sh reports ❌ | "backlog.md references done feature(s): FEAT-001" | ✅ |
| T8 | Restore `backlog.md`, re-run `check.sh` | exit 0 | exit 0 | ✅ |
| T9 | `npm run build && npm test && ./check.sh` | all green | build OK, 126/126 tests, check.sh exit 0 | ✅ |

## Design Decisions Worth Recording

### 1. The `## Format` template in `decisions.md` was rewritten as prose

The original format template in the Harness SDD framework uses
placeholder tokens like `{N}`, `{Decision Title}`, `{Alternative A}`
to teach the format. The new check (R16) would interpret these as
"forgotten placeholders" and fail the build.

**Resolution**: replaced the template with prose that documents the
format abstractly, then left ADR-001 as a worked example. The
"format documentation" still lives in the same file, but no longer
in a form that matches the placeholder regex.

**Why this is the right call**: the format template is *meant* to be
copied and filled in. If we kept it literal, every new ADR would
risk inheriting a placeholder that the guard would flag. The
abstract form is more robust.

**Trade-off**: a future contributor who wants to write an ADR
needs to read the prose section + look at ADR-001 to understand the
shape, instead of copying a literal template. The prose is short
(~25 lines) and ADR-001 is a complete worked example, so the cost
is small.

### 2. Backlog references `FEAT-XXX` IDs that don't exist yet

The backlog references `FEAT-020`, `FEAT-021`, `FEAT-022`, `FEAT-023`
— features that are not yet in `feature_list.json`. This is
intentional: the backlog is a forward-looking plan, and `FEAT-019`
itself is in the same boat (it was `pending` when the backlog was
written).

**Verification at runtime**: the `check.sh` R9 cross-check only
flags references to `status: "done"` features. References to
`pending`, `spec_ready`, `in_progress`, or non-existent IDs are
permitted. This is the right behaviour: the backlog is allowed
to point at the future, but not at the past.

**Trade-off**: a maintainer who deletes a `FEAT-XXX` entry from
`feature_list.json` will not get a "this backlog item is now
orphaned" warning. A future enhancement could add a "warn on
unknown FEAT-XXX reference" check, but it would need to allow
`FEAT-XXX` IDs that are *expected* to exist (i.e., be
forward-looking). That enhancement is tracked as future tech-debt,
not part of FEAT-019.

### 3. The check is read-only, not auto-fixing

The `check.sh` governance check **reports** leftover placeholders;
it does not **fix** them. Auto-fixing documentation is dangerous
because the auto-fix cannot know what the human meant. Failing
loudly is the correct behaviour for a regression guard.

**Trade-off**: a maintainer who re-introduces a placeholder (e.g.,
by copying a section from an old doc) gets a red CI run and must
fix it manually. The fix is usually trivial (remove the
placeholder, replace with real content), so the cost is small
compared to the risk of an auto-fix that silently corrupts the
doc.

## Sign-off

- [x] T0 — sanity check passed
- [x] T1 — DESIGN.md rewritten (49 → 232 lines, 0 placeholders)
- [x] T2 — backlog.md rewritten (18 → 39 lines, 4 sections, 0 stale refs)
- [x] T3 — ADR-001 appended (decisions.md 20 → 88 lines, 6 fields, 3 alternatives)
- [x] T4 — check.sh new section appended (4 PASS lines at runtime)
- [x] T5 — 15 static assertions pass
- [x] T6 — `./check.sh` exit 0, 4 new governance passes
- [x] T7 — failure case: placeholder detected by grep
- [x] T8 — failure case: stale FEAT ref in backlog detected by check.sh
- [x] T9 — full chain: build + test + check.sh all green
- [x] T10 — this report
- [ ] T11 — final `./check.sh` (next)
- [ ] T12 — mark `done` in `feature_list.json`
- [ ] T13 — log in `progress/progress.md`
- [ ] T14 — reset `progress/current.md` to template form
