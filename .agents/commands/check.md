# /check

Run `./check.sh` and report the result.

## Steps

1. Execute `./check.sh --quiet` from the project root. It prints warnings and one result line when it passes, and the full output when it fails.
2. Report the result line, or the failing sections.
3. If check.sh passes, run `hooks/run-hooks.sh on_check_pass`.
4. If failures, list the failing sections and their error messages.
5. Do not fix anything automatically; just report.

## Related

- `check.sh` is the harness verification gateway. It is the same script that runs in CI, and it includes `workflow-check` validation of work records and approvals.
- See `AGENTS.md §5` for the session-closing checklist (which always ends with `./check.sh`).
