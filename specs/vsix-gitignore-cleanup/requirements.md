# Requirements — Exclude *.vsix from git and clean the three committed binaries

> Feature FEAT-020 from `feature_list.json`. Closes the first P0
> item in the backlog that was written by FEAT-019: three
> `harness-dashboard-vscode-*.vsix` binaries (~775 KB total) are
> currently committed to the repository, polluting `git status`
> and bloating the repo. `*.vsix` is not in `.gitignore`, so future
> `vsce package` runs will keep adding new committed binaries.
>
> Each requirement is written in strict EARS and is verifiable by
> at least one test (a test in this context is a `git`-level
> assertion: file presence in `.gitignore`, file presence in
> `git ls-files`, absence from `git status`).

## EARS Patterns

| Pattern | Syntax | When to use |
|---|---|---|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a continuous state holds |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — `*.vsix` pattern in `.gitignore`
- **Pattern:** Ubiquitous
- **Wording:** The file `.gitignore` at the repository root SHALL contain the line `*.vsix` (or an equivalent glob pattern that matches every file whose name ends in `.vsix` at the root or any depth), and SHALL NOT comment it out.

### R2 — Three committed binaries removed from the index
- **Pattern:** Event
- **Wording:** WHEN this feature is implemented, the files `harness-dashboard-vscode-0.1.0.vsix`, `harness-dashboard-vscode-0.1.1.vsix`, and `harness-dashboard-vscode-0.1.2.vsix` SHALL be removed from the git index with `git rm --cached` (the working-tree copies MAY be kept or deleted at the implementer's discretion; the spec does not mandate either way because the binaries are reproducible from `npm run package`).

### R3 — `git status` is clean of `.vsix` files
- **Pattern:** Ubiquitous
- **Wording:** After R1 and R2 are applied, `git status --short` SHALL NOT list any file whose name ends in `.vsix` as untracked, modified, or staged.

### R4 — `git ls-files` does not include any `.vsix`
- **Pattern:** Ubiquitous
- **Wording:** `git ls-files '*.vsix'` SHALL return no output (exit 0, empty stdout) after R1 and R2 are applied.

### R5 — `npm run package` still works
- **Pattern:** Unwanted
- **Wording:** IF a developer runs `npm run package` (which invokes `vsce package --no-dependencies`), the build SHALL still produce a `.vsix` file in the working tree, and that file SHALL NOT be tracked by git.

### R6 — `check.sh` exit code unchanged
- **Pattern:** Unwanted
- **Wording:** `./check.sh` SHALL continue to exit 0 with 33 passes and 2 warnings after R1–R5 are applied (the new `*.vsix` files SHALL be ignored by every section of `check.sh` that touches the filesystem, including the new "Governance Documents" section introduced by FEAT-019).

### R7 — `.gitignore` comment documenting the rule
- **Pattern:** Ubiquitous
- **Wording:** The line `*.vsix` in `.gitignore` SHALL be preceded by a short comment (1 line) that explains the rule, e.g. `# VS Code extension packages (rebuild with npm run package)`, so that a future maintainer who greps `.gitignore` understands why the line exists.

### R8 — No regression in other ignored files
- **Pattern:** Unwanted
- **Wording:** IF R1 changes the matched-file set of `.gitignore`, the change SHALL be limited to adding the `*.vsix` pattern (and its comment), and SHALL NOT remove or comment out any other existing line of `.gitignore`.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| `*.vsix` is in `.gitignore` | R1, R7 |
| The three existing binaries are removed from the git index | R2 |
| `git status` does not show any `.vsix` | R3 |
| `git ls-files '*.vsix'` returns empty | R4 |
| `npm run package` still produces a working `.vsix` | R5 |
| `./check.sh` still passes | R6 |
| `.gitignore` is not otherwise disturbed | R8 |
