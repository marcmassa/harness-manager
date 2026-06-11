# Tasks — Exclude *.vsix from git and clean the three committed binaries (FEAT-020)

> Discrete steps in order. The implementer marks `[x]` upon completing
> each one. Each task references the R<n> it covers.

## Pre-flight

- [ ] **T0** — Confirm the three binaries exist on disk and in the
  git index. (Sanity check; not a deliverable.)
  - `ls harness-dashboard-vscode-*.vsix` → 3 files
  - `git ls-files '*.vsix'` → 3 lines

## Implementation

- [ ] **T1** — Edit `.gitignore`: add the comment `# VS Code extension
  packages (rebuild with npm run package)` followed by `*.vsix` at
  the end of the existing "Build" section. Do not touch any other
  line. _(R1, R7, R8)_
- [ ] **T2** — Untrack the three committed binaries while keeping
  the working-tree copies:
  - `git rm --cached harness-dashboard-vscode-0.1.0.vsix`
  - `git rm --cached harness-dashboard-vscode-0.1.1.vsix`
  - `git rm --cached harness-dashboard-vscode-0.1.2.vsix`
  _(R2)_

## Verification

- [ ] **T3** — Verify the `.gitignore` change is minimal (R8):
  - `git diff .gitignore` shows ONLY the new comment + `*.vsix`
    line; no other line is added, removed, or modified.
- [ ] **T4** — Verify R1: `grep -E '^\*\.vsix' .gitignore` returns
  a match, and the line is uncommented.
- [ ] **T5** — Verify R7: `grep -B1 '^\*\.vsix' .gitignore` shows
  the preceding comment line.
- [ ] **T6** — Verify R2 (post-staging): `git diff --cached --name-only`
  shows the three `*.vsix` files as deleted.
- [ ] **T7** — Verify R3 (post-staging): `git status --short` does
  not list any `*.vsix` file. (Untracked binaries in the working
  tree are EXPECTED to be listed; the test only checks that no
  `*.vsix` appears in the *untracked* section, which is impossible
  by construction if `.gitignore` matches them. T8 confirms the
  match.) **Refined**: T7 checks that `git status --short --untracked=all`
  does not list any `*.vsix` either, because the new `.gitignore`
  rule hides them from the untracked list.
- [ ] **T8** — Verify R4: `git ls-files '*.vsix'` is empty
  (exit 0, empty stdout).
- [ ] **T9** — Verify R5: `git check-ignore -v
  harness-dashboard-vscode-0.1.2.vsix` reports a match against
  `*.vsix` in `.gitignore`.
- [ ] **T10** — Verify R5 (full cycle): run `npm run package` and
  confirm a fresh VSIX is created in the working tree. Then
  re-run `git status --short --untracked=all` and confirm the
  new VSIX is still hidden by `.gitignore`.
- [ ] **T11** — Verify R6: `./check.sh` exit 0, 33 passes, 2 warnings
  (same baseline as pre-feature).

## Documentation

- [ ] **T12** — Remove the P0 item this feature closes from
  `progress/backlog.md` (the "Exclude `*.vsix` from git and remove
  the three committed binaries" bullet). The item is shipped; the
  backlog shall not reference it.
- [ ] **T13** — Document the `R<n> ↔ test` traceability map in
  `progress/impl_vsix-gitignore-cleanup.md` (table with the 8
  requirements and the T3–T11 verifications that cover them).

## Closure

- [ ] **T14** — Run `./check.sh` one final time.
- [ ] **T15** — Update `feature_list.json`: set FEAT-020 `status`
  to `"done"`.
- [ ] **T16** — Log a summary in `progress/progress.md` following
  the format of prior entries (FEAT-001 through FEAT-019).
- [ ] **T17** — Commit the change (this is a real, shippable unit
  of work — it should land in git as a single commit with a
  conventional-commits message). The commit message SHALL
  mention both R1 and R2 in the body so a future `git log` search
  for "vsix" finds it.
