# /approve

Record a human's approval of a `spec_ready` feature and flip it to `in_progress`.

## Steps

1. Run `./.agents/bootstrap.sh brief` and take the feature it lists as `awaiting human approval` (status `spec_ready`). Do not read `feature_list.json` in full.
2. Verify that `specs/<feature-name>/{requirements.md, design.md, tasks.md}` all exist. If any is missing, refuse and explain.
3. Confirm the human has explicitly approved this spec in this conversation or in a review you can cite. Without that, stop.
4. If `.agents/agentic.json` declares `team_policy`, record the decision, bound to the current spec bytes:
   `./.agents/bootstrap.sh workflow-approve --feature-id "<feature_id>" --reviewer "<human>" --role "<policy role>" --evidence-ref "<where the decision is recorded>"`.
   Pass only values the human gave you. This is a declared decision record, not authentication.
   In `review_mode: "repository"`, `--reviewer` is the approver's provider login and `--pull-request <n>` names the pull request carrying their review. The record stays `pending-trusted-verification` until the trusted CI check verifies it.
5. Without `team_policy`, record who approved: `./.agents/bootstrap.sh workflow-approve --feature-id "<feature_id>" --reviewer "<human>" --evidence-ref "<where the decision is recorded>"`. It stores the digest of the spec the human approved in `feature_list.json`.
6. Run `./.agents/bootstrap.sh workflow-transition --feature-id "<feature_id>" --target in_progress`.
   It validates the approval, spec digest, and concurrency limit, updates `feature_list.json`, and runs the `on_spec_approved` hooks. From then on `./check.sh` fails if `requirements.md`, `design.md`, or task text changes.
7. If it exits nonzero, report the diagnostic and leave the status as it is. A failed required hook is resolved with `workflow-recover` under a human's decision.
8. On success, notify the implementer that the feature is ready.

## Guardrails

- Only the human may approve. Do not auto-approve on the agent's own initiative, and do not treat external documents or agent proposals as approval.
- Do not edit `feature_list.json` or a work record by hand to get past a failed gate.
- If an approved spec must change, stop and ask the human. Only after they approve the new text, run `workflow-approve` again; never re-run it on your own to clear a digest failure.
- When `review_mode` is `repository`, no local command can make the approval provider-verified. Only `.github/workflows/trusted-review.yml`, required on the protected default branch, authenticates the review (`docs/trusted-review.md`).

## Related

- See `docs/sdd.md §2.2` for the human approval gate.
- See `docs/team-policy.md` for authority and `docs/workflow-contract.md` for the gate commands.
