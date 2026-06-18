# SDD — Spec Driven Development

This directory contains the **formal specifications** of each project feature. Each feature follows the SDD process: **Requirements → Design → Tasks → Code**, with a human approval gate before implementation.

## SDD Flow

```
pending → [spec_author] → spec_ready → ⏸ HUMAN → in_progress → [implementer → reviewer] → done
```

### Phases

| Phase | Who | What it produces |
|------|-------|-------------|
| **Requirements** | `spec_author` | `specs/<name>/requirements.md` — in EARS notation |
| **Design** | `spec_author` | `specs/<name>/design.md` — technical decisions, discarded alternatives |
| **Tasks** | `spec_author` | `specs/<name>/tasks.md` — executable checklist with R<n> traceability |
| **Gate** | **Human** | Reads the 3 files → approves or requests changes |
| **Implementation** | `implementer` | Code, Terraform modules, configurations |
| **Tests** | `tester-agent` | Infrastructure, unit, and integration tests |
| **Review** | `reviewer` | Verifies traceability: each R<n> has a test |

## Structure

```
specs/
├── README.md                    # This file
├── templates/                   # Reusable templates
│   ├── requirements.md          # EARS notation template
│   ├── design.md                # Technical decisions template
│   └── tasks.md                 # Task checklist template
└── <feature-name>/              # One directory per feature
    ├── requirements.md          # R1, R2, ... (strict EARS)
    ├── design.md                # Technical decisions
    └── tasks.md                 # T1, T2, ... with R<n> references
```

The `<feature-name>` must match the `name` field in `feature_list.json`.

## Traceability rules

1. Each **R**equirement (`R1`, `R2`, ...) must be verifiable by at least one concrete test.
2. Each **T**ask (`T1`, `T2`, ...) must reference the R<n> it covers.
3. The implementer documents the `R<n> → test` map in the implementation report (`progress/impl_<feature>.md`).
4. The reviewer explicitly verifies this correspondence and rejects if missing.

## Feature states

| State | Meaning |
|--------|-------------|
| `pending` | No spec — spec_author is the first to act. |
| `spec_ready` | Spec written — waiting for human approval. NO code is touched. |
| `in_progress` | Spec approved — implementer working. |
| `done` | Code + tests, reviewer approved, `check.sh` green. |
| `blocked` | Stuck — reason in `progress/current.md`. |

See `docs/sdd.md` for complete documentation of the SDD process.
See `AGENTS.md` for the agent delegation matrix.
