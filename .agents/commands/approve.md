# /approve

Approve a feature whose spec is in `spec_ready` and flip it to `in_progress`.

## Steps

1. Read `feature_list.json` and find the feature with `status: "spec_ready"`.
2. Verify that `specs/<feature-name>/{requirements.md, design.md, tasks.md}` all exist.
3. If all three files exist: set `status: "in_progress"` in `feature_list.json`.
4. If any of the three files is missing, refuse and explain.
5. Notify the implementer that the feature is ready.

## Guardrails

- Only the human may approve. Do not auto-approve on the agent's own initiative.
- One feature in `in_progress` at a time. If another feature is already `in_progress`, refuse and ask the user to close it first.

## Related

- See `docs/sdd.md §2.2` for the human approval gate.
