# /spec

Create the spec for the first pending feature with `sdd: true`.

## Steps

1. Read `feature_list.json` and find the first feature with `status: "pending"` and `"sdd": true`.
2. If none exists, report and stop.
3. Read `DESIGN.md`, `specs/templates/`, and `docs/sdd.md` (EARS section).
4. Optionally load the `ears-requirements` and `harness-sdd` skills from `.agents/skills/`.
5. Create `specs/<feature-name>/requirements.md` (strict EARS, R1, R2, ...).
6. Create `specs/<feature-name>/design.md` (architecture, alternatives, signatures, risks, **at least one discarded alternative**).
7. Create `specs/<feature-name>/tasks.md` (T1, T2, ... each referencing R<n>).
8. Update `feature_list.json`: set the feature's `status` to `"spec_ready"`.
9. **Stop.** Notify the human to review the spec.

## Guardrails

- Never write code outside `specs/`, `progress/`, and `feature_list.json`.
- Use `SHALL` / `SHALL NOT` only. No soft verbs.
- Include the R<n> ↔ task mapping in `tasks.md`.
