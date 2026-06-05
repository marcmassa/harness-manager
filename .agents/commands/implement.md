# /implement

Execute `tasks.md` for the feature in `in_progress`.

## Steps

1. Read `feature_list.json` and find the feature with `status: "in_progress"`.
2. Read `specs/<feature-name>/{requirements.md, design.md, tasks.md}`.
3. Load any project-relevant skills (e.g. `terraform-structure` for Terraform).
4. Walk `T1`, `T2`, ... in order. For each:
   - Read the referenced R<n> in `requirements.md`.
   - Follow the approach in `design.md`.
   - Write the code/configuration.
   - Mark the task `[x]`.
   - Optionally commit (small, focused commits).
5. After each implementation task, write at least one test that verifies the referenced R<n>.
6. Document the `R<n> ↔ test` map in `progress/impl_<feature>.md`.
7. When all `T<n>` are done, run `./check.sh`. It must pass.
8. Hand off to the reviewer (do not mark `done` yourself).

## Guardrails

- Do not edit the approved spec (`requirements.md`, `design.md`, `tasks.md` are read-only).
- One feature in `in_progress` at a time.
- Every R<n> must end up with at least one test.
