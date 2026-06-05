# /status

Show the current state of the Harness SDD project.

## Steps

1. Read `feature_list.json` and count features by status.
2. If there is a feature in `in_progress`, show its ID, name, and title.
3. List features in `spec_ready` (waiting for human approval).
4. List features in `pending` (next up).
5. Show the latest 5 entries of `progress/progress.md`.
6. If a CLI adapter is missing (no `opencode.json` / `GEMINI.md` / `CLAUDE.md` in the repo root), warn the user to run `./.agents/bootstrap.sh <cli>`.

## Output format

Use a clean table or list. Highlight the active feature (if any) and any blockers.

## Related

- See `AGENTS.md §1` for the mandatory pre-task checklist.
