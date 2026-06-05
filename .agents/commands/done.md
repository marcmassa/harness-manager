# /done

Run the reviewer on the feature currently in `in_progress` and mark it `done` if all checks pass.

## Steps

1. Read `feature_list.json` and find the feature with `status: "in_progress"`.
2. Verify the `R<n> ↔ test` table in `progress/impl_<feature>.md` is complete.
3. Run `./check.sh`. It must pass with no errors.
4. Inspect `git status` and `git diff` — only files declared in `specs/<feature>/design.md` "Affected Files" should be touched.
5. Look for: debug `print()`s, TODO comments without context, hardcoded secrets, stray files.
6. On success:
   - Update `feature_list.json`: `status: "done"`.
   - Append a summary entry to `progress/progress.md` (format: `{date} | {type} | {title} | {files} | {next}`).
7. On failure: report the defects and leave the feature in `in_progress`.

## Guardrails

- Do not mark `done` if `./check.sh` fails.
- Do not mark `done` if any R<n> is missing a test.
- Do not mark `done` if the diff touches files outside the declared scope.
