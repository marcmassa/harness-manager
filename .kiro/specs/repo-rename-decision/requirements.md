# Requirements — Decide the repository rename and document as ADR-002

> Feature FEAT-022 from `feature_list.json`. Records the
> maintainer's decision about the GitHub repository name as
> ADR-002, and (if the decision is to rename) executes the
> rename. Closes the "documented inconsistency" gap that has
> been visible since the project started: the package, the
> display name, the VSIX, the README, and the CHANGELOG all
> say `harness-dashboard`; only the GitHub repo name says
> `harness-manager`. This is the last P0 item in the backlog
> written by FEAT-019.
>
> The feature is **bifurcated** by design: R1–R7 are the
> "ADR is written and accepted" requirements (always
> satisfied), and R8–R14 are the "rename is executed"
> requirements (satisfied only if the maintainer chooses to
> rename in the ADR). The implementer satisfies the first
> half unconditionally; the second half is conditional on
> the ADR's `Decision` field.
>
> Each requirement is written in strict EARS and is verifiable
> by at least one specific test (a test in this context is
> usually a `grep` or a `git remote -v` assertion).

## EARS Patterns

| Pattern | Syntax | When to use |
|---|---|---|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a continuous state holds |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — ADR-002 exists
- **Pattern:** Ubiquitous
- **Wording:** The file `progress/decisions.md` SHALL contain an entry titled `### ADR-002: Decide the GitHub repository name` with all six standard fields populated (Status, Context, Decision, Impact with Positive and Cost sub-bullets, Discarded Alternatives with at least two alternatives).

### R2 — ADR-002 lists both options
- **Pattern:** Ubiquitous
- **Wording:** The `Discarded Alternatives` list in ADR-002 SHALL include at least: (a) "keep the name `harness-manager` and document the mismatch" (the "accept the status quo" alternative) and (b) "rename to `harness-dashboard` and update all references" (the "fix the inconsistency" alternative). One of them is the chosen `Decision`; the other is discarded. If the maintainer chooses a third option, the third is added to `Decision` and both (a) and (b) are listed as discarded.

### R3 — ADR-002 explains the conflict
- **Pattern:** Ubiquitous
- **Wording:** The `Context` field of ADR-002 SHALL enumerate the current naming inconsistencies (the `package.json#name` is `harness-dashboard-vscode` but `package.json#repository.url` points to `harness-manager`; the CHANGELOG entry for 0.1.0 announces a rename that was not completed; the README badge URL is for `harness-manager`; the `git remote -v` output shows `harness-manager.git`), and SHALL name the audiences affected (GitHub visitors, npm/Marketplace users, contributors, CI consumers).

### R4 — ADR-002's Cost section is honest
- **Pattern:** Ubiquitous
- **Wording:** The `Cost` sub-bullet of ADR-002 SHALL explicitly state the cost of the chosen option, including (if the rename option is chosen) the cost of the rename itself (broken GitHub stars/forks redirect, broken `git clone` URLs, the need to update any external documentation that points to the old URL, the small but non-zero probability of the rename being unrecoverable if something goes wrong with the GitHub rename), and SHALL NOT be empty.

### R5 — ADR-002 is cross-referenced
- **Pattern:** Ubiquitous
- **Wording:** ADR-002 SHALL mention ADR-001 (the SDD framework adoption decision) in either `Context` or `Impact`, so that a future reader who finds ADR-001 can also find ADR-002 and vice versa.

### R6 — Once the ADR is written, the backlog P0 item is removed
- **Pattern:** Event
- **Wording:** WHEN the ADR is written and appended to `progress/decisions.md`, the corresponding P0 item in `progress/backlog.md` (`Decide: rename the repository…`) SHALL be removed in the same commit, so that the backlog reflects the shipped decision.

### R7 — `./check.sh` remains green
- **Pattern:** Unwanted
- **Wording:** IF the ADR-002 writing causes any of the cross-grep guards in `./check.sh` to fail (e.g., a stale `FEAT-XXX` reference, a leftover template placeholder, a malformed `feature_list.json`), the implementer SHALL fix the cross-grep failures in the same commit so the final `./check.sh` exit code is 0.

### R8 — IF the rename is chosen: `package.json` repository URL updated
- **Pattern:** Optional (WHERE the ADR-002 Decision is "rename to `harness-dashboard`")
- **Wording:** `package.json#repository.url` SHALL be `https://github.com/marcmassa/harness-dashboard` and `package.json#bugs.url` SHALL be `https://github.com/marcmassa/harness-dashboard/issues`.

### R9 — IF the rename is chosen: `git remote` updated
- **Pattern:** Optional (same)
- **Wording:** `git remote -v` SHALL show the new URL `github.com/marcmassa/harness-dashboard.git` for both `fetch` and `push`.

### R10 — IF the rename is chosen: README URLs updated
- **Pattern:** Optional (same)
- **Wording:** All GitHub URLs in `README.md` (CI badge, "Open a workspace that uses [Harness SDD]" link, "Issues and PRs welcome at" link) SHALL point to `harness-dashboard`, not `harness-manager`.

### R11 — IF the rename is chosen: spec files cross-referencing the repo updated
- **Pattern:** Optional (same)
- **Wording:** All `https://github.com/marcmassa/harness-manager/...` URLs in `specs/**/*.md` (most notably `specs/ci-github-actions/tasks.md`, which contains the CI badge URL) SHALL be updated to `https://github.com/marcmassa/harness-dashboard/...`.

### R12 — IF the rename is chosen: GitHub-side rename instructions in the impl report
- **Pattern:** Optional (same)
- **Wording:** `progress/impl_repo-rename-decision.md` SHALL include a step-by-step checklist of the GitHub-side actions the maintainer must take manually (Settings → General → Rename), because these cannot be automated from within the repository. The checklist SHALL include: (1) open the repo's Settings, (2) rename to `harness-dashboard`, (3) set up the redirect from the old URL (GitHub does this automatically), (4) verify the badge URL in the README renders green, (5) verify the Marketplace listing (if any) still works.

### R13 — IF the rename is chosen: no production source modified
- **Pattern:** Optional (same, unwanted-style)
- **Wording:** The rename implementation SHALL NOT modify any file under `src/` (R15 of FEAT-021 is reused as the boundary). The change is exclusively to `package.json`, `README.md`, `specs/**/*.md`, and `progress/decisions.md`. If any source file is modified, it SHALL be a typo fix unrelated to the rename (e.g., `Marc Massa` → `Marc Massa` in LICENSE if the maintainer chooses to fix it).

### R14 — IF the rename is chosen: the change is one commit
- **Pattern:** Optional (same)
- **Wording:** The rename implementation SHALL be a single commit (or, if the ADR is written in a separate commit from the rename, exactly two commits: one for the ADR + backlog update, one for the rename). The history SHALL be clean and reviewable in a single PR.

### R15 — IF the rename is NOT chosen: a one-paragraph rationale is added to the README
- **Pattern:** Optional (WHERE the ADR-002 Decision is "accept the mismatch")
- **Wording:** A new section `## Note on the repository name` SHALL be appended to `README.md`, immediately after the `## License` section, explaining in 1-3 sentences that the repo is intentionally named `harness-manager` (not `harness-dashboard`) for historical reasons, and that the discrepancy is documented in ADR-002. This section prevents future evaluators from being confused by the mismatch.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| ADR-002 is present with all 6 standard fields | R1 |
| ADR-002 lists both the "accept" and "rename" alternatives | R2 |
| ADR-002's Context enumerates the current naming inconsistencies | R3 |
| ADR-002's Cost section is honest and complete | R4 |
| ADR-002 cross-references ADR-001 | R5 |
| The backlog P0 item is removed when the ADR is written | R6 |
| `./check.sh` exit 0 after the change | R7 |
| `package.json#repository.url` updated to `harness-dashboard` | R8 |
| `git remote -v` shows the new URL | R9 |
| All `README.md` GitHub URLs point to `harness-dashboard` | R10 |
| All `specs/**/*.md` GitHub URLs point to `harness-dashboard` | R11 |
| A GitHub-side rename checklist is in the impl report | R12 |
| No production source code modified | R13 |
| The change is 1-2 commits, cleanly reviewable | R14 |
| A README note explains the mismatch if the rename is NOT chosen | R15 |
