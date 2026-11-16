# /spec

Create the spec for the first pending feature with `sdd: true`.

## Steps

1. Run `./.agents/bootstrap.sh brief` and take the first feature under `next pending`; confirm it has `"sdd": true`.
2. If none exists, report and stop.
3. Read `DESIGN.md`, `specs/templates/`, and `docs/sdd.md` (EARS section).
4. Optionally load the `ears-requirements` and `harness-sdd` skills from `.agents/skills/`.
5. Create `specs/<feature-name>/requirements.md` (strict EARS, R1, R2, ...).
6. Create `specs/<feature-name>/design.md` (architecture, alternatives, signatures, risks, **at least one discarded alternative**).
7. Create `specs/<feature-name>/tasks.md` (T1, T2, ... each referencing R<n>).
8. If `.agents/agentic.json` declares `team_policy`, create the work record first:
   `./.agents/bootstrap.sh workflow-init --feature-id "<feature_id>" --owner "<owner>" --branch "<branch>"`.
9. Run `./.agents/bootstrap.sh workflow-transition --feature-id "<feature_id>" --target spec_ready`.
   It validates the artifacts, updates `feature_list.json`, and runs the `on_spec_created` hooks.
   If it exits nonzero, report the failure to the user and do NOT proceed.
10. **Stop.** Notify the human to review the spec.

## Guardrails

- Never write code outside `specs/`, `progress/`, and `feature_list.json`.
- Use `SHALL` / `SHALL NOT` only. No soft verbs.
- Include the R<n> ↔ task mapping in `tasks.md`.
