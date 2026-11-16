# /done

Run the reviewer on the feature currently in `in_progress` and mark it `done` if all checks pass.

## Steps

1. Run `./.agents/bootstrap.sh brief` and take the feature it lists as `active` (status `in_progress`). Do not read `feature_list.json` in full.
2. Run `./.agents/bootstrap.sh workflow-run-hook --feature-id "<feature_id>" --event on_review_start`. A failed required hook is recorded and blocks closure until `workflow-recover`.
3. Verify the `R<n> ↔ test` table in `progress/impl_<feature>.md` is complete.
4. Inspect `git status` and `git diff` — only files declared in `specs/<feature>/design.md` "Affected Files" should be touched.
5. Look for: debug `print()`s, TODO comments without context, hardcoded secrets, stray files.
6. If `.agents/agentic.json` declares `team_policy`, commit the candidate, then record closure evidence for that commit:
   - Each requirement: `./.agents/bootstrap.sh workflow-evidence --feature-id "<feature_id>" --requirement R<n> --kind automated --source "tests/test_<file>.py::<test>" --result passed --check-command "<command>"`, or `--kind manual --result reviewed --reviewer "<human>" --reviewer-role "<role>"`. Automated sources must be `test_*.py`/`*_test.py` test functions or methods, or `test*` functions in `test_*.sh`.
   - A wrong or renamed entry: `./.agents/bootstrap.sh workflow-evidence-remove --feature-id "<feature_id>" --requirement R<n> --source "<source>" --reason "<why>"`. Entries for older commits are superseded automatically.
   - Observed checks: `./.agents/bootstrap.sh workflow-run-checks --feature-id "<feature_id>"`.
   - Independent review, using only what the reviewer stated: `./.agents/bootstrap.sh workflow-review --feature-id "<feature_id>" --reviewer "<human>" --role "<role>" --decision approved --evidence-ref "<reference>"`.
7. Run `./check.sh`. It must pass with no errors.
8. Run `./.agents/bootstrap.sh workflow-run-hook --feature-id "<feature_id>" --event on_review_complete`.
9. On success, run `./.agents/bootstrap.sh workflow-transition --feature-id "<feature_id>" --target done`. It enforces the closing gate, updates `feature_list.json`, and runs the `on_feature_done` hooks. Then append a summary entry to `progress/progress.md` (format: `{date} | {type} | {title} | {files} | {next}`).
10. On failure: report the defects and leave the feature in `in_progress`.

## Guardrails

- Do not mark `done` if `./check.sh` or the transition fails, and do not edit `feature_list.json` by hand to get past the gate.
- Do not mark `done` if any R<n> is missing a test or reviewed manual evidence.
- Do not mark `done` if the diff touches files outside the declared scope.
- An agent or the implementer cannot supply the full-SDD closing review. Never invent reviewer names or results.
- When `review_mode` is `repository`, a local `done` is `pending-trusted-verification`. Only the required trusted CI check on the pull request authenticates it (see `docs/trusted-review.md`). Never describe it as provider-verified.
