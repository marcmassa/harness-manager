# Agent Run & Architecture Studio — closure reconciliation

Review date: 2026-11-17. Baseline: main `990470d` (includes packaging PR #29).
Scope: the two unchecked tasks in `.kiro/specs/agent-run-studio/tasks.md`,
plus directly related history-test and command-preview evidence. This is not
full re-certification of all 29 requirements or the other 19 discrepant specs.

## Results

| Task / requirement | Finding | Disposition |
|---|---|---|
| T22 / R16 | Runs toolbar button, history drawer and task-prefill path are absent | Keep unchecked; actual implementation remains pending |
| T40 | Build/tests/check pass; feature was already done and historical closure exists | Mark this operational checklist item complete only |
| T39 / R14 | Adapter/registry tests exist, but history tests use duplicated helper logic and omit duration persistence | Existing checked marker overstates coverage; record missing verification without certifying R14 |
| T16 / R10 | Interactive Claude preview differs from adapter command | Existing checked marker does not establish current correctness; track repair separately |

The feature's existing `done` status is not changed. T40 being checked does
not mean R16 is fulfilled or that the entire feature now passes review.
The archived 2026-06-29 summary says all T1–T38 completed while T22 explicitly
says deferred. Preserve that historical record; this review documents the
contradiction rather than silently rewriting it.

## Evidence

- `.kiro/specs/agent-run-studio/requirements.md:134` (R16) requires a toolbar
  button, last 20 entries and click-to-reopen with task prefill.
- `.kiro/specs/agent-run-studio/tasks.md:101` (T22) explicitly records its
  deferral. `src/webview/WhiteboardCanvas.tsx:975` renders New, Templates and
  the gear menu; there is no Runs control. No RunHistoryPanel implementation
  was found in src. `src/webview/index.tsx:373` stores history and `:803`
  derives last-run badges, which does not satisfy the separate history UI.
- `src/webview/RunAgentPanel.tsx:14` has no task-prefill input prop; `:80`
  initializes task to an empty string. The existing panel is for launching,
  not browsing saved runs.
- `src/coordinators/RunCoordinator.ts:73` handles getRunHistory; `:149` creates
  entries; `:188` and `:194` implement append and duration updates. Backend
  history exists, so the missing R16 UI must not be described as missing all
  history support.
- `src/run/run.test.ts:196` defines its own appendHistory function, checks
  array order/limit and a standalone string slice. It neither imports nor
  invokes RunCoordinator. Searching test sources for RunCoordinator,
  getRunHistory and durationMs found no coordinator-history tests. T39
  explicitly calls for append, duration update and FIFO behavior in that
  coordinator; these tests do not establish the storage/lifecycle path.
- `src/webview/RunAgentPanel.tsx:50` adds `--message` in interactive mode;
  `src/run/adapters/claudeCodeAdapter.ts:16` omits task flags in that mode.
  `src/run/run.test.ts:33` asserts the bare command. R10 requires the preview
  to show the exact executed command. This mismatch is demonstrated from
  repository code; no claim about current external CLI syntax is needed.
- `progress/archive/progress-20261115.md:52` contains the original closure
  summary, including its partial-T39 qualification. `feature_list.json`
  already records agent-run-studio as done. No status transition was needed.

## Validation and limits

`npm run build`, `npm test` (57 files / 819 tests), `npm run package` and
`./check.sh --quiet` pass on the merged baseline in the isolated worktree.
The generated Claude adapter was refreshed locally before the final check.
The pre-existing missing adapter-parity/template-test warnings remain.
No manual Runs UI smoke test can certify an absent control. No agent CLI was
launched and no inference about the seven real-repository adapter checks is made.

## Follow-up

Keep T22 open and make the scope decision explicit: implement R16 under the
project's approval workflow, or obtain a maintainer-approved scope amendment.
Restore traceability with tests that invoke the real RunCoordinator history
and terminal-close paths; align command preview with the execution path.
These are recorded as descriptive maintenance items in progress/backlog.md.
This review changes no production source, approved requirement/design, or
feature status, and does not authorize implementation of the discovered gaps.

Unchecked-task inventory decreases from 359 to 358 across the same 20 specs;
only T40 was reconciled. The 2026-11-16 inventory remains a dated snapshot.
