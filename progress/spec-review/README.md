# Spec checklist audit — 2026-11-17

## Outcome and scope

The repository review is complete as an **inventory and evidence triage** of all
20 specs with unchecked tasks. It is not certification of all feature acceptance
criteria, and it does not implement the discovered gaps. Each task has a linked
source, a disposition and evidence locations. Source/test existence alone is not
proof that every clause of a task is satisfied.

Baseline: main `990470d` plus the first PR #30 commit `bd06d0e`.
Original inventory: 359 unchecked markers. The first commit verified Agent Run
T40; this pass classifies all remaining **358**, checking **37** operational/status
tasks with direct evidence. **321 remain unchecked**; all are accounted for below.
No feature status, approved requirement/design or production source was changed.

## Classification key

| Class | Count in this pass | Meaning |
|---|---:|---|
| V | 37 | Verified current operational check or existing feature status; checkbox repaired |
| E | 252 | Related source/test/report located; full acceptance not certified |
| M | 17 | Manual or environment-dependent acceptance remains pending |
| H | 26 | Historical action/pre-change state, or dated evidence; not retroactively re-executed |
| N | 4 | Not applicable: ADR-002 chose to retain the repository name |
| G | 5 | Concrete implementation, test or documentation gap |
| D | 10 | Difference between task wording and current implementation/history |
| U | 7 | Specific verification evidence not located |

The 321 open markers are **not 321 missing implementations**. In particular,
252 E rows are navigation for acceptance verification, not a finding that the
code is absent; four rename-only tasks should never be implemented under the
existing decision. Historical exact test counts and prerequisite states are not
rewritten to match today's repository.

## Complete inventory

| Feature | Review | Input markers | Verified now | Still unchecked |
|---|---|---:|---:|---:|
| FEAT-009 | [relationship-editor-md-viewer-side-panel](relationship-editor-md-viewer-side-panel.md) | 21 | 2 | 19 |
| FEAT-010 | [semantic-skill-discovery](semantic-skill-discovery.md) | 17 | 2 | 15 |
| FEAT-011 | [agent-skill-idoneity](agent-skill-idoneity.md) | 20 | 2 | 18 |
| FEAT-012 | [enhanced-entity-intelligence](enhanced-entity-intelligence.md) | 32 | 2 | 30 |
| FEAT-013 | [skill-toggle-and-suggestion-control](skill-toggle-and-suggestion-control.md) | 24 | 2 | 22 |
| FEAT-014 | [open-file-in-editor](open-file-in-editor.md) | 7 | 2 | 5 |
| FEAT-018 | [ci-github-actions](ci-github-actions.md) | 6 | 3 | 3 |
| FEAT-019 | [governance-docs](governance-docs.md) | 4 | 2 | 2 |
| FEAT-020 | [vsix-gitignore-cleanup](vsix-gitignore-cleanup.md) | 18 | 2 | 16 |
| FEAT-021 | [e2e-integration-test](e2e-integration-test.md) | 21 | 3 | 18 |
| FEAT-022 | [repo-rename-decision](repo-rename-decision.md) | 16 | 2 | 14 |
| FEAT-023 | [adapter-config-paths-and-kiro-and-whiteboard-polish](adapter-config-paths-and-kiro-and-whiteboard-polish.md) | 32 | 2 | 30 |
| FEAT-024 | [steering-and-hooks-observability](steering-and-hooks-observability.md) | 27 | 3 | 24 |
| FEAT-025 | [enhanced-sdd-panel](enhanced-sdd-panel.md) | 18 | 2 | 16 |
| FEAT-026 | [cross-framework-hooks-steering](cross-framework-hooks-steering.md) | 16 | 1 | 15 |
| FEAT-027 | [code-quality-on-save-hooks](code-quality-on-save-hooks.md) | 21 | 1 | 20 |
| FEAT-028 | [universal-ai-provider](universal-ai-provider.md) | 14 | 3 | 11 |
| FEAT-029 | [universal-agentic-detection](universal-agentic-detection.md) | 42 | 1 | 41 |
| FEAT-031 | [advisory-live-sync](advisory-live-sync.md) | 1 | 0 | 1 |
| FEAT-033 | [agent-run-studio](agent-run-studio.md) | 1 | 0 | 1 |

## Findings that need action

1. **Agent Run UI and preview:** the Runs/history/prefill control is absent;
   interactive Claude preview differs from execution. History tests duplicate a
   helper rather than invoking the coordinator. See [dedicated review](../reconcile-agent-run-studio.md).
2. **Writer tests:** `src/harnessWriter.test.ts` imports `parserLogic`, changes
   input data and re-parses; it does not invoke the writer's persistence methods.
   Its passing deletion/label cases do not establish a click-confirm-write flow.
3. **Save blocking:** `src/verifier/codeQualitySetup.ts:49` uses an async save
   listener, awaits runAndReport, then calls `event.waitUntil(Promise.resolve([]))`.
   The installed VS Code declaration (`node_modules/@types/vscode/index.d.ts`,
   TextDocumentWillSaveEvent) requires waitUntil during event dispatch and defines
   the array as edits. An empty edit list is not cancellation. The claimed save
   blocking behavior is not established and needs a focused correction/acceptance test.
4. **E2E coverage:** `src/test/integration/criticalPath.test.ts:199` substitutes
   fixture ground truth for the node click; line 249 calls showTextDocument directly.
   The resolved macOS launch defect stays resolved, but this test does not prove
   DOM click/message routing.
5. **Overlap prevention:** the pure utility is tested, but the parser call has no
   canvas coordinates (`src/harnessParser.ts:58`). The existing implementation
   report explicitly calls it a no-op there. Do not infer collision-free canvas
   behavior from those unit tests.
6. **Missing traceability:** `progress/impl_feat-013.md`, explicitly requested
   by the skill-toggle spec, does not exist.
7. **Unperformed evidence:** CI obsolete-run cancellation, the detector's
   10,000-file benchmark and listed manual UI/model-dependent scenarios remain
   unverified. Mock tests are not timing or real-workspace acceptance evidence.

These findings are separate follow-up work. The original task's seven real-repo
adapter checks and the study's maintainer decisions remain unchanged.

## Verification

- `npm run build`: pass.
- `npm test`: 57 files / 819 tests pass.
- `npm run package`: 373,009 B; 400,000 B gate and required assets pass.
- `./check.sh --quiet`: 36 checks pass; two inherited missing adapter-test warnings.
- Feature statuses were read from feature_list.json; no transitions were performed.
- PR #30's first revision CI succeeded (run 44147797447); the expanded revision
  receives its own CI run before this review is handed back.
- Git diff review permits only checkbox changes in approved tasks.md files.
- All 358 input task IDs are represented exactly once across the 20 linked reviews.

## Branch and PR closure

PRs #26 (study), #27 (framework snapshot), #28 (audit/macOS) and #29 (packaging)
are merged. PR #30 contains this review and remains for maintainer approval.
The framework snapshot was not updated further. Dependency audit/remediation,
macOS verification and packaging fixes are complete; no release/tag/publication
was performed. Later framework updates still use update-plan/update-apply.
