# /status

Show the current state of the Harness SDD project.

## Steps

1. Run `./.agents/bootstrap.sh brief` and present its output: feature counts, the active feature and its next task, features awaiting approval, next pending, session state, and any context-budget warning.
2. Run `./.agents/bootstrap.sh workflow-check` and report its result. A failure means stale approval, a pending failed hook, an interrupted mutation, or missing work records. `[SKIP]` means the project has not opted in to `team_policy`.
3. If recent history is asked for, show the last five entries of `progress/progress.md` by reading only its newest part.

Do not read `feature_list.json` or the progress logs in full.

## Related

- See `AGENTS.md §1` for the session-start checklist.
