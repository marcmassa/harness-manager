# Spec Driven Development (SDD) — Complete Documentation

> This document describes in detail the SDD process implemented in the project.
> It is the complete reference for spec_authors, implementers, and reviewers.

---

## 1. Philosophy

SDD (Spec Driven Development) is a process where **requirements, design, and tasks are written and approved before writing a single line of code**. This contrasts with approaches like:

- **Code-first:** the agent writes code directly and then it is reviewed.
- **Chat-driven:** requirements exist only in the conversation, not on disk.

SDD prioritizes **traceability** and **early human approval** over code writing speed. The result is higher quality code, fewer iterations, and a permanent record of why everything was done.

## 2. The SDD Cycle in Detail

### 2.1 pending → spec_ready

**Input:** A feature in `feature_list.json` with `status: "pending"` and `"sdd": true`.

**Who:** The `spec_author` agent (typically a quality-agent).

**What it produces:**
- `specs/<feature-name>/requirements.md` — requirements in EARS.
- `specs/<feature-name>/design.md` — technical decisions.
- `specs/<feature-name>/tasks.md` — executable checklist.

**Rules:**
- The spec_author does NOT write code. Only specs.
- The spec_author reads the root `DESIGN.md` to ensure the feature aligns with the global architecture.
- The spec_author reads `specs/templates/` and `docs/sdd.md` before starting.
- The folder name in `specs/` must match the `name` in `feature_list.json`.
- Each file follows the templates in `specs/templates/`.
- Upon completion, update `feature_list.json`: `status: "spec_ready"`.

### 2.2 spec_ready → ⏸ Human

**Input:** Feature with `status: "spec_ready"` and files in `specs/<feature-name>/`.

**Who:** A human (tech lead, SRE, architect).

**What to review:**
- `requirements.md`: Do the requirements cover all cases? Are they verifiable? Do they use EARS correctly?
- `design.md`: Is the architecture correct? Do the discarded alternatives make sense? Are risks covered?
- `tasks.md`: Are tasks in logical order? Does each R<n> have a test?

**Result:**
- **Approve** → change `status: "in_progress"` and launch implementation.
- **Request changes** → the spec_author fixes and re-submits.

### 2.3 in_progress → done

**Input:** Feature with `status: "in_progress"`.

**Who:** The `implementer` and the `tester-agent`.

**Workflow:**
1. The implementer executes `tasks.md` from top to bottom, marking `[x]`.
2. For each implementation task: write code, configuration, or infrastructure.
3. For each test task: write tests that verify the referenced R<n>.
4. Document traceability `R<n> ↔ test` in `progress/impl_<feature>.md`.
5. Run `./check.sh` — it must pass clean.
6. The **reviewer** (human or quality-agent) verifies:
   - All tasks are marked `[x]`.
   - Each R<n> has at least one test.
   - `check.sh` passes.
   - No undocumented side effects.
7. If approved → `status: "done"`, record in `progress/progress.md`.

## 3. EARS — Easy Approach to Requirements Syntax

### 3.1 The 5 Patterns

| Pattern | When | Syntax | Example |
|--------|--------|----------|-----------------|
| **Ubiquitous** | The condition is always true | `SHALL <action>` | `The system SHALL use AES-256 encryption` |
| **Event** | Triggered by an event | `WHEN <event> SHALL <action>` | `WHEN the user clicks submit SHALL save data` |
| **State** | Depends on a continuous state | `WHILE <state> SHALL <action>` | `WHILE in maintenance mode SHALL return 503` |
| **Optional** | Varies by configuration | `WHERE <option> SHALL <action>` | `WHERE region is EU SHALL comply with GDPR` |
| **Unwanted** | Response to failures | `IF <condition> THEN SHALL <action>` | `IF connection fails THEN SHALL retry 3 times` |

### 3.2 EARS Hard Rules

1. **Each requirement has a unique, stable ID:** `R1`, `R2`, ...
2. **Each requirement is verifiable by at least one test.**
3. **One requirement = one SHALL.** Do not mix multiple SHALLs in the same sentence.
4. **Only SHALL / SHALL NOT.** Do not use "could", "can", "supports", "should".
5. **Order matters:** R1 before R2 if there is a logical dependency.

## 4. Traceability

### 4.1 R<n> → Test Map

The implementer documents traceability in `progress/impl_<feature>.md`:

```markdown
## Traceability R<n> ↔ Test

| Requirement | Test | Type | File |
|-----------|------|------|---------|
| R1 | test_encryption_is_aes256 | unit | tests/test_security.py |
| R2 | test_save_on_submit | integration | tests/test_api.py |
| R3 | test_maintenance_mode_returns_503 | unit | tests/test_app.py |
| R4 | test_gdpr_compliance_in_eu | unit | tests/test_compliance.py |
| R5 | test_retry_on_failure | integration | tests/test_network.py |
```

### 4.2 Reviewer Verification

The reviewer checks:

1. **Completeness:** Each R<n> has at least one test in the table.
2. **Coverage:** Each listed test actually exists and passes.
3. **Suitability:** The test verifies exactly what the requirement says.
4. **check.sh:** The script passes clean.

## 5. Anti-patterns

### ❌ Ignoring Global Design
If a `specs/<feature>/design.md` proposes a solution that contradicts the principles in the root `DESIGN.md` without a justified ADR, it is an anti-pattern.

### ❌ Spec without discarded alternatives
`design.md` must include **at least one discarded alternative**. If it doesn't, the spec_author hasn't thought through enough options.

### ❌ Non-verifiable requirements
`R1: The system SHALL be fast` is not verifiable. What does "fast" mean? < 1s? < 100ms? Under what load?

### ❌ Tasks without R<n> references
Every task should reference at least one R<n>. If a task covers no requirement, why does it exist?

### ❌ Mixing features in the same spec
One spec covers ONE feature. If two features are related but can be implemented separately, create separate specs and manage dependencies in `progress/backlog.md`.

### ❌ Implementing without approval
If the spec is in `spec_ready` but the human hasn't approved, NO code is written. The spec_author waits.

## 6. FAQ

### Can I have specs for features that are not sdd:true?
Technically yes, but the process doesn't validate or require them. For complex features, it's recommended to write them anyway.

### What if a feature changes during implementation?
If the change is small, update `tasks.md` and document in `progress/impl_<feature>.md`. If the change is large (new R6+ requirements or architecture change), stop, update the spec, and get human approval again.

### What if the reviewer is an AI agent?
The AI reviewer verifies traceability and task completeness. Final (human) approval is still required for the spec. The AI reviewer is complementary, not a substitute.

### When do I use sdd: false?
For trivial tasks: typos, name changes, dependency updates, purely mechanical refactors. If in doubt, use `sdd: true`.
