# FEAT-043 implementation evidence

## T1 — Owner semantics and rule applicability

`src/optimizer/applicability.ts` holds one table:
- **Shared rules** run on any readable source: hygiene, budget, drift, content overlap, consistency.
- **Convention rules** depend on what the owning format documents, and run only where it documents them:

| Rule | Convention |
|---|---|
| `OPT-S01` | frontmatter |
| `OPT-S02` | name matches its folder |
| `OPT-S03` | required description |
| `OPT-S04` | trigger markers |
| `OPT-S05` | required sections |
| `OPT-S06` | hook contract and steering scope |
| `OPT-O02` | explicit skill and role links |

Conventions per format, from each format's own contract:
- **Harness SDD**: all of them.
- **Claude Code**: frontmatter and description for subagents and skills; folder naming and trigger markers for skills.
- **Kiro**: the skill conventions.

Cursor, Copilot, OpenCode, Windsurf, AGENTS.md, workspace profiles and companions declare none, so only shared rules run on their components.

Other changes:
- The engine skips a rule the component's owner does not support. `applicability()` reports why, which is input for the T2 coverage.
- Every finding carries the component's `source` (native URI and owner).
- The owner comes from the FEAT-041 source record, which the loader already carries.

| Requirement | Verification |
|---|---|
| R1 | applicability.test.ts: every registered rule is classified; the 0.8.2 Claude reviewer fixture no longer gets `OPT-S02` (rename to `agents`) or `OPT-S05`, but keeps Claude's own frontmatter rule; a custom profile without conventions gets only shared rules; a Harness SDD skill whose name differs from its folder still gets `OPT-S02` (native positive control); without a known owner no convention applies. |
| R4 | applicability.test.ts: the `OPT-S02` finding carries its source and owner. Panel display is T2. |

Verified: 891 unit tests.

## T2 — Scorer, corpus and panel coverage

How scoring works now:
- The engine records, per component, the dimensions that at least one applicable rule evaluated, and the rules it skipped with the reason from `applicability()`. This is `ComponentScore.coverage`.
- `scoreComponent` averages only the evaluated dimensions. A skipped dimension is `null`: neither a penalty nor a perfect 100. A finding proves its dimension was evaluated.
- With no evaluable dimension, `score` and `tier` are `null`: the component is unscored rather than 0 or 100.
- `rollup` averages scored components only, so adding an unscored component leaves the architecture score unchanged. With none scored it is `null`, not 0, and `scoredComponents` reports how many were aggregated.

Corpus statistics are keyed by cohort (`owner::type`, or the type when there is no owner). Each cohort sets its own median budgets and its frontmatter and heading majorities, so one format's sizes and habits never calibrate another's. A cohort below the sample minimum falls back to the absolute budget, as before, and the finding's detail says the corpus was too small. Relative findings name the cohort ("the median harness-sdd skill").

The panel:
- shows "Unscored" instead of a tier badge, "—" for an unscored architecture score, and an "n/6" column with the evaluated dimensions;
- in the expansion, lists the evaluated dimensions and every rule not evaluated, with its reason;
- shows the owning provider on each finding;
- draws an unevaluated radar axis at the centre and labels it "n/a";
- averages architecture radar axes over the components that evaluated them;
- gives no whiteboard chip to an unscored component.

`OptimizerPanel.tsx` (52 KB) was split to stay under the staged-file limit:
- **Moved verbatim:** `optimizerParts.tsx`, `optimizerControls.tsx`, `ComponentExpansion.tsx`, `OptimizerFilters.tsx` (filter bar and rule batches).
- **Extracted pure helper:** `optimizerCoverage.ts`.

| Requirement | Verification |
|---|---|
| R1 | coverage.test.ts: an end-to-end scan of a Cursor rule records the skipped convention rules and keeps the shared ones. |
| R2 | coverage.test.ts: partial evaluation averages only evaluated dimensions; a clean, fully evaluated component scores 100; the aggregate is unchanged when an unscored component is added; cohorts keep one format from calibrating another. OptimizerCoverage.test.ts: radar averages and the "n/6" column. |
| R3 | coverage.test.ts: an all-skipped component and architecture are unscored, with the skipped rules and reasons. OptimizerCoverage.test.ts renders "Unscored", "—" and the not-evaluated list. scorer.test.ts: an empty rollup is unscored. |
| R4 | Findings carry their source (T1); the panel shows the owning provider beside the rule ID and the native path. |

Verified: 902 unit tests, build.

## T3 — Fixes, AI refine, chat and delegation from current host findings

- **Quick fixes.** The fix is resolved from the host's current report by `(ruleId, nodeId)`; a `fix` sent by the webview is ignored.
- **The shared write path** (`optimizerWrite.ts`, moved verbatim from the coordinator and extended) now checks, before staging anything:
  - that the file on disk still equals the scanned source;
  - that any secondary file stays inside the component's own folder, so the same owner receives the whole edit.

  After the confirmation it rechecks ownership and permission through the gate, and that the file has not changed during the preview. AI refine uses the same path.
- **Chat handoff** now passes the gate as a reviewed edit of a current, owned node, so stale or read-only targets are refused before any prompt or file content is prepared.
- **Delegation** keeps authorizing every resolved component (FEAT-041 review fix). Every target's owner must now also accept edits, so a scope that includes a read-only owner (for example OpenCode) is refused before any terminal opens.

| Requirement | Verification |
|---|---|
| R5 | optimizerWrite.test.ts: a confirmed, authorized edit writes the component and its in-folder secondary file; a source changed during the preview is rejected with no write; ownership revoked after the modal is rejected with no write. |
| R6 | operations.test.ts: the chat handoff is decided as a reviewed edit. optimizerWrite.test.ts: a refused scope opens no terminal and shows no modal. |
| R7 | optimizerWrite.test.ts: a stale scan is rejected before the diff opens; a secondary file outside the component's folder or escaping the workspace is rejected; a mixed delegation with a read-only owner is refused. Stale and unknown targets are covered by the FEAT-041 decision tests. |

Verified: 911 unit tests.
