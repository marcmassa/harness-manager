# Requirements — Populate Governance Documents

> Feature FEAT-019 from `feature_list.json`. Replaces the placeholder
> content of three governance documents — `DESIGN.md`,
> `progress/backlog.md`, and `progress/decisions.md` — with
> concrete, accurate content for the Harness Dashboard VS Code
> extension.
>
> Closes the "documentation says one thing, repo does another" gap
> identified in the 2026-06-10 project analysis: `DESIGN.md` was the
> 49-line generic template that ships with the Harness SDD framework,
> and `backlog.md` / `decisions.md` were the empty templates too.
> Because the project itself is a framework demonstrator, this
> inconsistency is particularly visible to evaluators.
>
> Each requirement is written in strict EARS and is verifiable by at
> least one test (a test in this context is a structural validation:
> the document exists, has the right shape, is no longer a placeholder,
> and matches the repository's actual state).

## EARS Patterns

| Pattern | Syntax | When to use |
|---|---|---|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a continuous state holds |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — DESIGN.md exists and is non-template
- **Pattern:** Ubiquitous
- **Wording:** The file `DESIGN.md` SHALL exist at the repository root and SHALL NOT contain any of the placeholder tokens `{Briefly describe}`, `{e.g., Modular}`, `{Describe the primary}`, `{Component Name}`, `{Specific versions}` that ship in the Harness SDD template.

### R2 — DESIGN.md sections present
- **Pattern:** Ubiquitous
- **Wording:** `DESIGN.md` SHALL contain, at minimum, the following section headings, in this order: `1. System Overview`, `2. Architectural Principles`, `3. High-Level Architecture`, `4. Key Components & Responsibilities`, `5. Data Flow & Integration`, `6. Global Constraints`, plus a final `Note to AI Agents` callout.

### R3 — DESIGN.md content accuracy
- **Pattern:** Ubiquitous
- **Wording:** The text inside each section of `DESIGN.md` SHALL describe the actual implementation of the Harness Dashboard project (the VS Code extension in this repository), and SHALL NOT reference external systems, Terraform, Helm, Kubernetes, or other infrastructure tooling that this project does not use.

### R4 — DESIGN.md component table accuracy
- **Pattern:** Ubiquitous
- **Wording:** The "Key Components & Responsibilities" table in `DESIGN.md` SHALL list at least the following components with their actual technology: Extension Host (`src/extension.ts`, TypeScript), Webview (`src/webview/`, React 18 + React Flow 11), Parser (`src/harnessParser.ts` + `src/parserLogic.ts`), Writer (`src/harnessWriter.ts`), Adapters (`src/adapters/`), Semantic Layer (`src/semanticMatcher.ts` + `src/idoneity.ts`).

### R5 — DESIGN.md size
- **Pattern:** Optional
- **Wording:** WHERE the file would be longer than 250 lines, the design SHALL be split into a top-level `DESIGN.md` (≤ 250 lines, the architectural "30,000-foot view") and one or more `docs/architecture/*.md` files for component deep-dives; otherwise the design SHALL fit in a single file.

### R6 — backlog.md exists and is non-template
- **Pattern:** Ubiquitous
- **Wording:** The file `progress/backlog.md` SHALL exist and SHALL NOT contain the placeholder tokens `{Most urgent P0 feature}`, `{P0 feature}`, `{P1 feature}`, `{P2 feature}`, `{Technical debt or pending refactor}` that ship in the Harness SDD template.

### R7 — backlog.md prioritised sections
- **Pattern:** Ubiquitous
- **Wording:** `progress/backlog.md` SHALL contain at least three prioritised sections, in this order: `## P0 — Critical (current sprint)`, `## P1 — Important (next sprint)`, `## P2 — Nice to have (whenever possible)`, plus a final `## Technical / Debt` section.

### R8 — backlog.md items are concrete
- **Pattern:** Ubiquitous
- **Wording:** Each item in `progress/backlog.md` SHALL be either a checkbox task (`- [ ] ...`) referencing a `FEAT-XXX` identifier in `feature_list.json` or a short descriptive task that fits on a single line, and SHALL NOT be a placeholder or `TBD` entry.

### R9 — backlog.md reflects post-FEAT-018 state
- **Pattern:** Unwanted
- **Wording:** IF a feature appears in `backlog.md`, its corresponding entry in `feature_list.json` SHALL be either `status: "pending"` or `status: "blocked"`; in particular, no `status: "done"` feature SHALL appear in the backlog.

### R10 — decisions.md exists and is non-template
- **Pattern:** Ubiquitous
- **Wording:** The file `progress/decisions.md` SHALL exist and SHALL NOT contain only the empty `## Format` section header that ships in the Harness SDD template.

### R11 — decisions.md first ADR (ADR-001)
- **Pattern:** Ubiquitous
- **Wording:** `progress/decisions.md` SHALL contain a first entry titled `### ADR-001: Adopt the Harness SDD framework for the Harness Dashboard repository` with all six standard fields filled in: `Status`, `Context`, `Decision`, `Impact` (with `Positive` and `Cost` sub-bullets), and `Discarded Alternatives` (with at least two alternatives listed).

### R12 — ADR-001 references concrete alternatives
- **Pattern:** Ubiquitous
- **Wording:** The `Discarded Alternatives` list in ADR-001 SHALL name at least two alternative approaches considered before adopting Harness SDD (for example: "keep ADRs in `docs/adr/` as standalone files using the MADR template" and "use the arc42 template" or "no formal ADR process"), and SHALL give a one-sentence reason for discarding each.

### R13 — ADR-001 cost section
- **Pattern:** Ubiquitous
- **Wording:** The `Cost` sub-bullet under `Impact` in ADR-001 SHALL explicitly state the cost of the decision (for example: "every feature requires three spec files before code is touched" and "the SDD process adds a few hours per feature for the spec author and the human approver"), and SHALL NOT be empty.

### R14 — Single ADR per decision (no duplicates)
- **Pattern:** Unwanted
- **Wording:** IF two ADRs cover the same decision, the older one SHALL be marked `Superseded by ADR-N` and SHALL be kept in the file for traceability; in particular, ADR-001 SHALL NOT be duplicated and the file SHALL contain exactly one ADR-001 section header.

### R15 — docs are consistent with code
- **Pattern:** Unwanted
- **Wording:** IF a documented fact in `DESIGN.md`, `backlog.md`, or `decisions.md` becomes stale (the underlying code or `feature_list.json` changes), the maintainer SHALL update the document in the same commit or in a follow-up commit before the next `done` flip.

### R16 — No template tokens leak anywhere
- **Pattern:** Unwanted
- **Wording:** IF `check.sh` is run, the script SHALL fail with a clear error message WHEN any of the files `DESIGN.md`, `progress/backlog.md`, or `progress/decisions.md` still contains a recognised template placeholder (any of the strings enumerated in R1, R6, R10). This is implemented as a new check appended to `check.sh`.

### R17 — check.sh integration
- **Pattern:** Unwanted
- **Wording:** WHEN `./check.sh` is run, the new governance-template check (R16) SHALL be executed as part of the existing "SDD Infrastructure" or a new "Governance Documents" section, and its result SHALL contribute to the final `EXIT_CODE` like every other check.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| `DESIGN.md` is no longer a placeholder | R1 |
| `DESIGN.md` has the required sections in the right order | R2 |
| `DESIGN.md` describes this project's actual stack | R3 |
| `DESIGN.md` lists the project's real components | R4 |
| `DESIGN.md` is the right size, or split appropriately | R5 |
| `backlog.md` is no longer a placeholder | R6 |
| `backlog.md` has prioritised sections | R7 |
| `backlog.md` items are concrete and checkable | R8 |
| `backlog.md` does not list `done` features | R9 |
| `decisions.md` is no longer a placeholder | R10 |
| ADR-001 is present with all required fields | R11 |
| ADR-001 lists ≥ 2 discarded alternatives | R12 |
| ADR-001 cost section is populated | R13 |
| No duplicate ADR-001 | R14 |
| Docs are kept in sync with the code | R15 |
| `check.sh` fails on leftover template placeholders | R16 |
| The new check is wired into the existing `./check.sh` flow | R17 |
