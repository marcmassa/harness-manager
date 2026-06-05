---
name: harness-sdd
description: "Complete Spec Driven Development workflow for the Harness SDD framework. Use when the user asks about SDD, feature_list.json, spec_ready, in_progress, EARS requirements, traceability, or wants to create/approve/review a spec. Triggers on keywords: SDD, harness, feature_list, spec, requirements, design, tasks, EARS, traceability, implementer, reviewer."
---

# Harness SDD — Complete Workflow

This skill is the canonical reference for the **Spec Driven Development** process
implemented by the Harness SDD framework. Load it whenever you are operating
inside a project that uses Harness SDD, regardless of which CLI you are running.

## When to use

Load this skill when:

- The user asks to implement a feature and the project has `feature_list.json` with `sdd: true` features.
- The user mentions `spec_author`, `spec_ready`, `in_progress`, `done`, or `blocked`.
- The user wants to write requirements in EARS notation.
- The user asks about traceability (`R<n>` ↔ test).
- The user wants to run `/status`, `/spec`, `/approve`, `/implement`, `/done`, or `/check`.

## The state machine

```
pending → [spec-author] → spec_ready → ⏸ HUMAN → in_progress → [implementer → reviewer] → done
                                                          │
                                                          └──→ blocked (reason in progress/current.md)
```

There must be **at most one** feature in `in_progress` at any time.

## Step-by-step

### 1. Spec phase (spec-author)

1. Read `feature_list.json` and find the first `pending` feature with `sdd: true`.
2. Read `DESIGN.md` to align with global principles.
3. Read `specs/templates/{requirements,design,tasks}.md`.
4. Read `docs/sdd.md` (especially the EARS section) if you need formatting help.
5. Create `specs/<feature-name>/requirements.md` with strict EARS (R1, R2, ...).
6. Create `specs/<feature-name>/design.md` with summary, affected files, signatures, algorithm, error handling, **at least one discarded alternative**, and risks.
7. Create `specs/<feature-name>/tasks.md` with T1, T2, ... each referencing the R<n> it covers.
8. Update `feature_list.json` to `status: "spec_ready"`.
9. **Stop.** Wait for human approval.

### 2. Human gate

The human reads the three files and either approves or requests changes.

- Approve → set `status: "in_progress"`.
- Request changes → fix and re-submit.

### 3. Implementation phase (implementer)

1. Read `tasks.md` and execute T1, T2, ... in order, marking `[x]`.
2. For each task: read the referenced R<n> and follow the approach in `design.md`.
3. Write at least one test per R<n>. Document the `R<n> ↔ test` map in `progress/impl_<feature>.md`.
4. Run `./check.sh` periodically. It must pass.
5. Do not edit the approved spec.

### 4. Review phase (reviewer)

1. Verify the `R<n> ↔ test` table is complete.
2. Run `./check.sh`. Must pass clean.
3. Inspect `git diff` for scope (only files declared in `design.md` should be touched).
4. On success: set `status: "done"`, append to `progress/progress.md`.

## EARS quick reference

| Pattern | Syntax | When |
|---|---|---|
| Ubiquitous | `SHALL <action>` | Always true |
| Event | `WHEN <event> SHALL <action>` | Triggered by an event |
| State | `WHILE <state> SHALL <action>` | Continuous condition |
| Optional | `WHERE <option> SHALL <action>` | Varies by configuration |
| Unwanted | `IF <condition> THEN SHALL <action>` | Failure handling |

Hard rules:
- One `SHALL` per requirement.
- No soft verbs (`should`, `could`, `may`).
- Each requirement is verifiable by at least one test.
- IDs are stable: `R1`, `R2`, ... (never renumber after approval).

## Anti-patterns to avoid

- Spec without a discarded alternative.
- Requirement with no test.
- Task that covers no R<n>.
- Implementing before human approval.
- Two features in `in_progress` at the same time.
- Marking `done` with `./check.sh` red.

## Related skills

- `ears-requirements` — how to write EARS requirements properly.
- `terraform-structure` — Terraform module structure (when the feature is IaC).
- `skill-governance` — workflow for contributing back to the skills registry.
