# /check

Run `./check.sh` and report the result.

## Steps

1. Execute `./check.sh` from the project root.
2. Report the summary section: `Result: ✅ All checks passed` or `Result: ❌ Some checks failed`.
3. If failures, list the failing sections and their error messages.
4. Do not fix anything automatically; just report.

## Related

- `check.sh` is the harness verification gateway. It is the same script that runs in CI.
- See `AGENTS.md §5` for the session-closing checklist (which always ends with `./check.sh`).
