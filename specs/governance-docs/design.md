# Design — Populate Governance Documents

> Technical decisions to implement feature FEAT-019. Replaces the
> three placeholder governance documents with concrete, accurate
> content and bakes the "no leftover template placeholders" check
> into `./check.sh` so the regression cannot recur silently.

## Summary

The Harness Dashboard repository is a **showcase of the Harness SDD
framework**. As such, its own governance documents are visible
artefacts that evaluators, contributors, and AI agents consult to
understand how the project is meant to work. Three of those documents
currently ship as empty templates:

- `DESIGN.md` (49 lines, generic "fill the braces" template)
- `progress/backlog.md` (18 lines, empty `TBD` placeholders)
- `progress/decisions.md` (20 lines, only a `## Format` section)

This feature **pays the documentation debt** that the project's own
analysis (2026-06-10) flagged. It also adds a regression guard so the
problem cannot come back: a new check in `./check.sh` fails the build
if any of the three files still contains a recognised placeholder.

The implementation is pure documentation plus a ~20-line bash block
appended to `check.sh`. No production code is modified. No
dependencies are added. The test surface is the new `check.sh`
section plus a few `grep`/`wc`-style assertions.

## Affected Files

| File | Action | Reason |
|---|---|---|
| `DESIGN.md` | **rewrite** | Replace 49-line placeholder with concrete architecture doc (R1–R5) |
| `progress/backlog.md` | **rewrite** | Replace empty template with concrete P0/P1/P2 backlog (R6–R9) |
| `progress/decisions.md` | **append first ADR** | Keep the format template, add ADR-001 (R10–R14) |
| `check.sh` | **append new section** | New "Governance Documents" check that fails on template placeholders (R16, R17) |
| `feature_list.json` | modify | Add FEAT-019 entry (already done in spec phase) |
| `progress/impl_governance-docs.md` | create | Implementation report (R↔T↔test traceability) |
| `progress/progress.md` | modify | Append FEAT-019 summary |

No production code (`src/`, `package.json`, `tsconfig.json`,
`esbuild.js`, `vitest.config.ts`, `media/`, `docs/`) is modified.

## Concrete Content Plan

### `DESIGN.md` (target ≈ 200 lines, fits in single file per R5)

| Section | Content source | Approx. lines |
|---|---|---|
| 1. System Overview | One paragraph describing the VS Code extension's purpose: visual whiteboard for AI agent architectures (subagents, skills, relationships), built on the Harness SDD framework. Distinguishes the product (`harness-dashboard-vscode`) from the framework (`.agents/`) it ships with. | ~15 |
| 2. Architectural Principles | Five named principles: CLI-agnostic, SDD-first, frugal AI (no embeddings without need), single source of truth (`agentic.json`), testable (EARS + Vitest). Each principle is one short paragraph, not a placeholder. | ~30 |
| 3. High-Level Architecture | A text diagram showing the three-tier split: Extension Host (Node + vscode API) ↔ Webview (React + React Flow) ↔ Filesystem (`.agents/`, `feature_list.json`, `progress/`, `specs/`, `*.vsix`). Explicitly says NO backend, NO cloud, NO external services. | ~40 |
| 4. Key Components | Table with: Extension Host, Webview, Parser, Writer, Adapters, Semantic Layer, TF-IDF Idoneity, OutputChannel, Persistence (workspaceState). Each row links to `src/<file>.ts`. | ~40 |
| 5. Data Flow & Integration | Sequence diagram (ASCII) showing: workspace open → file watcher → `HarnessParser` → message to webview → React Flow render → user click → message back → `HarnessWriter` → disk write → watcher fires again. Closes the loop. | ~30 |
| 6. Global Constraints | TS strict mode, Node 20.x via GitHub Actions, `engines.vscode ^1.85.0`, esbuild (not webpack), React 18 (not 19), `gray-matter` (not a custom parser), `dagre` for layout, `vscode.lm` if AI features, no `secrets.*` in CI, no `node-fetch` to external services. | ~25 |
| Note to AI Agents | Same callout as the template, but rewritten to reflect THIS project's specifics (point at `.agents/subagents/harness-vscode/` and the SDD workflow, not a generic reminder). | ~10 |

### `progress/backlog.md` (target ≈ 30 lines)

Sections in order (R7):

- **P0 — Critical (current sprint)**: 3 items, one per truly blocking
  tech-debt identified in the 2026-06-10 analysis:
  - `[ ] Exclude *.vsix from git and clean the three committed binaries` (trivially small, high hygiene impact)
  - `[ ] Add CI smoke test that exercises the workflow file end-to-end on first PR` (T7/T11/T12 deferred from FEAT-018)
  - `[ ] Decide: rename repo to `harness-dashboard` or accept the package/binary mismatch` (closes the open question raised in the project analysis)
- **P1 — Important (next sprint)**: 4 items that are real but
  unblocking:
  - `[ ] FEAT-020 — Integration / E2E test (open workspace → see graph → click node → edit file)` (closes the "no integration tests" gap)
  - `[ ] FEAT-021 — Test each of the 7 universal adapters with a real-world repo of its framework` (closes the "universal" claim honesty gap)
  - `[ ] Refactor: extract 4 webview CSS-in-JS patterns into a single `webviewStyles.ts` helper` (consistency)
  - `[ ] Pin GitHub Actions to commit SHAs (defense in depth)` (security hardening)
- **P2 — Nice to have (whenever possible)**: 3 items:
  - `[ ] FEAT-022 — Codecov / coverage report` (out of scope of FEAT-018 by design)
  - `[ ] FEAT-023 — Publish VSIX workflow (FEAT-019 of the publish track)` (release automation)
  - `[ ] Add animated screenshots to README.md` (marketing)
- **Technical / Debt**: 2 items:
  - `[ ] Investigate the `npm audit` warnings surfaced in T5 of FEAT-018` (security debt, low priority because dependencies are pinned)
  - `[ ] Reconcile: opencode.json#publisher is "marcmassacapo" but repo is owned by "marcmassa"` (5-minute consistency fix)

All items are checkable (R8) and none of them correspond to a `done`
feature (R9 — verified by grepping `feature_list.json` for each
`FEAT-XXX` referenced).

### `progress/decisions.md` (target ≈ 50 lines, retains the format template)

The existing `## Format` section at the top is **kept verbatim** — it
is documentation of how ADRs are structured, not a placeholder. Below
it, append the first real ADR:

```markdown
### ADR-001: Adopt the Harness SDD framework for the Harness Dashboard repository
- **Status:** Accepted
- **Context:** The Harness Dashboard project started as a fork of the
  Harness SDD template in June 2026. The first 17 features were
  shipped using the framework's Spec Driven Development (SDD) workflow
  (EARS requirements, design doc, tasks checklist, human approval
  gate, R↔T↔test traceability). The project now needs a documented
  record of why this workflow is the canonical way of working here, so
  that future contributors and AI agents understand that going outside
  it is an explicit decision, not a default.
- **Decision:** All non-trivial changes to the Harness Dashboard
  project SHALL go through the Harness SDD workflow: a `pending`
  feature in `feature_list.json` is shaped into a `specs/<name>/`
  folder with `requirements.md` (EARS), `design.md` (with discarded
  alternatives), and `tasks.md` (with R↔T↔test map) by the
  `spec-author-vscode` sub-agent; the spec waits at `spec_ready` for
  human approval; the `typescript-implementer` sub-agent executes the
  tasks; the `reviewer-vscode` sub-agent verifies traceability before
  flipping to `done`. `./check.sh` is the canonical local gate, and
  GitHub Actions runs the same gate on every PR.
- **Impact:**
  - Positive: every shipped feature has a documented rationale
    (EARS requirements), an explicit design with discarded
    alternatives (no "we tried X" is forgotten), and a test for
    every requirement (R↔T↔test traceability). Bugs caught at the
    spec phase are ~10× cheaper than bugs caught after merge. The
    state machine (`pending → spec_ready → in_progress → done`) is
    visible in the repo and enforced by `check.sh` (one feature in
    `in_progress` at a time, no `done` without green tests).
  - Cost: every feature requires three spec files before code is
    touched. A small feature costs ~30 minutes of spec author time
    and ~5 minutes of human review. The `spec-author-vscode` and
    `typescript-implementer` sub-agents must load the same context
    files (`AGENTS.md`, `feature_list.json`, `progress/current.md`)
    at the start of every session, which adds ~10 KB of context
    overhead. A 17-feature MVP took ~3 weeks end-to-end at the cost
    of this overhead; without the framework, the same MVP would
    have been 1–2 weeks faster but with ~5× the post-merge bug
    rate (an estimate, not measured).
- **Discarded Alternatives:**
  - **Standalone ADRs in `docs/adr/NNNN-*.md` using the MADR
    template**: MADR is the community standard, but it lives
    outside the SDD workflow and creates a parallel documentation
    system. The project already has `progress/decisions.md` for
    ADRs, and the SDD `design.md` already includes a "Discarded
    Alternatives" section per feature, so the MADR layer would be
    redundant.
  - **arc42 template for `DESIGN.md`**: arc42 is comprehensive (12
    sections, ISO-aligned) but is overkill for a single VS Code
    extension and would conflict with the `DESIGN.md` template
    shipped by the Harness SDD framework. The framework's 6-section
    `DESIGN.md` is sufficient for this project's scale.
  - **No formal ADR process**: rejected because the project is a
    framework showcase, so the lack of a visible ADR process would
    undermine the framework's credibility.
```

## `check.sh` Addition (R16 + R17)

Append a new section after the existing "SDD Infrastructure" check.
Approximately 20 lines:

```bash
# ── Governance Documents check (FEAT-019) ─────────────────
section "Governance Documents"

# R16: template placeholders MUST NOT appear in governance docs
PLACEHOLDER_PATTERN='\{[A-Z][a-zA-Z0-9 _-]{2,40}\}'
GOVERNANCE_FILES=(DESIGN.md progress/backlog.md progress/decisions.md)
gp_fail=0
for f in "${GOVERNANCE_FILES[@]}"; do
    if [ ! -f "$f" ]; then
        warn "Missing $f (governance doc absent)"
        gp_fail=1
        continue
    fi
    # Find placeholder tokens like {Briefly describe}, {Component Name}
    matches=$(grep -nE "$PLACEHOLDER_PATTERN" "$f" 2>/dev/null || true)
    if [ -n "$matches" ]; then
        fail "$f still contains template placeholders:"
        echo "$matches" | sed 's/^/       /'
        gp_fail=1
    else
        pass "$f is free of template placeholders"
    fi
done

# R9: backlog SHALL NOT reference done features
if [ -f progress/backlog.md ] && [ -f feature_list.json ]; then
    done_ids=$(python3 -c "
import json
d = json.load(open('feature_list.json'))
print(' '.join(f['id'] for f in d['features'] if f['status'] == 'done'))" 2>/dev/null)
    for did in $done_ids; do
        if grep -q "$did" progress/backlog.md 2>/dev/null; then
            fail "backlog.md references done feature $did"
            gp_fail=1
        fi
    done
    if [ "$gp_fail" -eq 0 ]; then
        pass "backlog.md does not reference any done feature"
    fi
fi

if [ "$gp_fail" -ne 0 ]; then
    EXIT_CODE=1
fi
```

The check is intentionally **read-only** (it does not auto-fix
placeholders). Auto-fixing documentation is dangerous because the
auto-fix can't know what the human meant. Failing loudly is the
correct behaviour for a regression guard.

## Algorithm / Flow

```
1. implementer (typescript-implementer) opens the feature at in_progress.
2. Read DESIGN.md — confirm it is the 49-line template (T1 prerequisite).
3. Rewrite DESIGN.md with the section content above (T1).
4. Rewrite progress/backlog.md (T2).
5. Append ADR-001 to progress/decisions.md (T3).
6. Append the new "Governance Documents" section to check.sh (T4).
7. Run ./check.sh: T4's new check verifies (a) placeholders are gone,
   (b) backlog has no done-feature references. Both must PASS.
8. Run the full verification chain (T5): npm run build, npm test, ./check.sh.
9. If green, the implementer-vscode and reviewer-vscode agents can
   validate the docs against requirements R1–R17 and the R↔T↔test
   traceability.
10. Update feature_list.json to done (T6) and progress/progress.md (T7).
```

## Discarded Alternative

**Auto-generate the three docs from `feature_list.json` and the git log**

A `scripts/sync-governance-docs.ts` could read `feature_list.json` and
emit a `DESIGN.md` and `backlog.md` from it on every build. The
`decisions.md` would still be hand-edited (ADRs are not derivable
from the code).

Discarded because:

1. **It hides the design**: an auto-generated `DESIGN.md` would
   describe the *current* code, but the purpose of a design doc is
   to record *why* the code is the way it is, including the
   rejected alternatives. The latter cannot be reverse-engineered
   from the code.
2. **It creates a moving target**: every commit that touches the
   code would re-generate the doc, and the diff would be noisy
   (whitespace, renumbering, reordering of bullets). Reviewers
   would soon learn to ignore the diff.
3. **It bypasses the human approval gate**: the whole point of the
   governance docs is that a human reads and signs off on the
   architectural overview. A machine-generated file achieves the
   "form" of governance without the "function".

The implementation therefore **writes the docs by hand** and uses
`check.sh` as a one-way regression guard (not a generator).

## Risks and Edge Cases

- **Length drift** — a maintainer might add a section to
  `DESIGN.md` over time and push it past 250 lines. R5 (size cap)
  is enforced by a soft rule ("split if > 250 lines"), not by
  `check.sh`. The implementer documents the rule in `DESIGN.md`
  itself (in the `Note to AI Agents` callout) so future contributors
  know to split.
- **Backlog staleness** — `backlog.md` will become stale as soon
  as the first P0 item is shipped. The same discipline as
  `feature_list.json` (update on the same commit as the change)
  applies; R15 makes this explicit.
- **Multiple ADRs colliding** — R14 prevents duplicates, but a
  future maintainer could write ADR-005 that supersedes ADR-001.
  The "Superseded by ADR-N" convention is the standard fix and is
  spelled out in the format template at the top of the file.
- **`check.sh` regex false positives** — the placeholder regex
  `\{[A-Z][a-zA-Z0-9 _-]{2,40}\}` is permissive enough to match
  legitimate uses of `{Word}` in prose. Mitigation: keep prose
  in fenced code blocks when it contains braces; the regex matches
  braces anywhere. We accept this risk because governance docs
  rarely need braces in prose; if a false positive appears in
  practice, the maintainer can reword.
- **CI re-runs the new check** — yes, the new "Governance
  Documents" section in `check.sh` runs in CI as part of the
  harness-check step (FEAT-018 R8). A future PR that re-introduces
  a placeholder in any of the three files will fail the CI step
  with a clear `❌ DESIGN.md still contains template placeholders:`
  message. This is exactly the regression-guard behaviour the
  feature promises.

## Test Plan (concrete verifications)

The verification of this feature is mostly structural (grep + line
counts + a fresh `./check.sh` run). The R↔T↔test map in
`progress/impl_governance-docs.md` will spell out:

| Req | How verified |
|---|---|
| R1 | `grep -E '\{(Briefly describe|e\.g\.|Describe|Component|Specific)\}' DESIGN.md` returns no matches |
| R2 | `grep -E '^## [0-9]+\.' DESIGN.md` returns exactly 6 lines in the documented order |
| R3 | `grep -iE 'terraform|helm|kubernetes' DESIGN.md` returns no matches |
| R4 | grep for the 6 component names in DESIGN.md |
| R5 | `wc -l DESIGN.md` ≤ 250 (or split into `docs/architecture/`) |
| R6, R10 | analogous greps on `backlog.md` / `decisions.md` |
| R7 | grep for `## P0`, `## P1`, `## P2`, `## Technical / Debt` in backlog |
| R8 | every `- [ ]` line in backlog fits on ≤ 120 chars and has no `TBD` / `{...}` |
| R9 | cross-grep backlog against `done` IDs in feature_list.json |
| R11, R12, R13, R14 | greps for the 6 standard ADR fields in ADR-001 |
| R16, R17 | the new `./check.sh` section PASSES on the new docs and FAILS on a copy that has a placeholder re-introduced |
