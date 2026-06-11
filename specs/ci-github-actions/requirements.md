# Requirements — CI with GitHub Actions

> Feature FEAT-018 from `feature_list.json`. Adds a continuous integration
> pipeline that runs on every push and pull_request to `main`, executing
> the same checks a developer runs locally (`npm ci`, `npm run build`,
> `npm test`, `./check.sh`), so that broken builds, broken tests, broken
> harness adapters, or malformed manifests cannot reach `main`.
>
> Closes the "no CI" gap identified in the project analysis (2026-06-10).
>
> Each requirement is written in strict EARS and is verifiable by at least
> one specific test (the workflow run itself is the test, plus the
> downstream observability of the GitHub UI / commit status).

## EARS Patterns

| Pattern | Syntax | When to use |
|---|---|---|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies by configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — Workflow presence
- **Pattern:** Ubiquitous
- **Wording:** The repository SHALL contain exactly one GitHub Actions workflow file at `.github/workflows/ci.yml` that defines a CI job named `ci`.

### R2 — Trigger events
- **Pattern:** Event
- **Wording:** WHEN a push is made to the `main` branch, OR WHEN a pull_request is opened, reopened, synchronized, or marked ready-for-review targeting the `main` branch, the workflow SHALL be triggered.

### R3 — Runner environment
- **Pattern:** Ubiquitous
- **Wording:** The workflow SHALL execute on `ubuntu-latest` GitHub-hosted runners.

### R4 — Node.js toolchain setup
- **Pattern:** Ubiquitous
- **Wording:** The workflow SHALL set up Node.js version `20.x` (matching the project's `engines.vscode` baseline) and SHALL configure npm caching keyed on `package-lock.json`.

### R5 — Reproducible dependency install
- **Pattern:** Ubiquitous
- **Wording:** The workflow SHALL install dependencies with `npm ci` (deterministic, lockfile-based) and SHALL NOT invoke `npm install` in CI.

### R6 — Build step
- **Pattern:** Ubiquitous
- **Wording:** The workflow SHALL execute `npm run build` and SHALL fail the job if the exit code is non-zero.

### R7 — Unit tests step
- **Pattern:** Ubiquitous
- **Wording:** The workflow SHALL execute `npm test` (Vitest) and SHALL fail the job if any test file reports a non-zero exit code or any test case is reported as failed.

### R8 — Harness SDD check step
- **Pattern:** Ubiquitous
- **Wording:** The workflow SHALL execute `./check.sh` (Harness SDD verification) and SHALL fail the job if the script's final exit code is non-zero.

### R9 — Step ordering
- **Pattern:** State
- **Wording:** WHILE the workflow is running, the steps SHALL execute in the order: checkout → setup-node → npm ci → npm run build → npm test → ./check.sh; subsequent steps SHALL NOT run if any earlier required step fails.

### R10 — Single required job
- **Pattern:** Ubiquitous
- **Wording:** The workflow SHALL define exactly one job (`ci`) with no matrix strategy and no additional helper jobs, keeping the configuration minimal and reviewable.

### R11 — Concurrency control
- **Pattern:** State
- **Wording:** WHILE multiple workflow runs are queued for the same ref, the workflow SHALL cancel in-progress runs of older commits on the same pull_request or branch using the `concurrency` group, so that obsolete runs do not consume runner minutes.

### R12 — Permissions minimization
- **Pattern:** Ubiquitous
- **Wording:** The workflow SHALL declare `permissions: contents: read` at the top level and SHALL NOT request `write`, `packages: write`, or any other elevated scope, since the job only needs to read repository contents.

### R13 — Check duration budget
- **Pattern:** Optional
- **Wording:** WHERE a developer pushes a commit to a pull_request, the total workflow execution time SHALL complete within 10 minutes for the typical case (single commit, cache hit on dependencies).

### R14 — Observable failure context
- **Pattern:** Unwanted
- **Wording:** IF any step fails, the workflow SHALL preserve the full log of the failing step in the GitHub Actions UI (using the default GitHub logging behaviour) so that the failure is diagnosable from the run page alone, without requiring local reproduction.

### R15 — No external secrets
- **Pattern:** Unwanted
- **Wording:** The workflow SHALL NOT reference any secret stored in GitHub Actions secrets (`${{ secrets.* }}`) and SHALL NOT require any user-provided API key, since the project uses no third-party services and the build is self-contained.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| A `.github/workflows/ci.yml` file exists and is committed | R1 |
| Workflow triggers on `push` to `main` | R2 |
| Workflow triggers on `pull_request` to `main` | R2 |
| Workflow runs on `ubuntu-latest` | R3 |
| Workflow uses Node 20.x with npm cache | R4 |
| `npm ci` is used (not `npm install`) | R5 |
| `npm run build` runs and fails the job on non-zero exit | R6 |
| `npm test` runs and fails the job on test failure | R7 |
| `./check.sh` runs and fails the job on non-zero exit | R8 |
| Steps execute in the documented order; later steps skip on earlier failure | R9 |
| Exactly one job (`ci`), no matrix | R10 |
| Concurrency group cancels obsolete runs on the same ref | R11 |
| `permissions: contents: read` declared, no elevated scopes | R12 |
| Typical run completes in ≤ 10 minutes | R13 |
| Failure logs are visible in the GitHub Actions UI | R14 |
| No GitHub secrets are referenced | R15 |
