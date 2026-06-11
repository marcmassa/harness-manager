# Design — Exclude *.vsix from git and clean the three committed binaries

> Technical decisions to implement feature FEAT-020. Single-file
> change to `.gitignore`, three `git rm --cached` invocations, and a
> verification pass. No code, no dependencies, no test infrastructure.

## Summary

The project ships three `harness-dashboard-vscode-*.vsix` binaries
(versions 0.1.0, 0.1.1, 0.1.2) that were created locally and
accidentally committed. They are ~775 KB total, they pollute
`git status` on every clone, and they make the repo harder to
diff and review (a `git log` for `*.vsix` will return noise). They
are also fully reproducible: `npm run package` rebuilds them
deterministically from `package.json` + `dist/`, so they are not
the kind of artefact that should be in version control.

The fix is the standard one: add the artefact pattern to
`.gitignore`, remove the committed artefacts from the index with
`git rm --cached`, and verify the rest of the toolchain still
behaves. This is a 5-minute change; the only design decision is
**whether to keep the working-tree copies of the three binaries or
delete them entirely**.

## Affected Files

| File | Action | Reason |
|---|---|---|
| `.gitignore` | modify | Add `*.vsix` pattern (R1, R7, R8) |
| `harness-dashboard-vscode-0.1.0.vsix` | `git rm --cached` | Untrack (R2) |
| `harness-dashboard-vscode-0.1.1.vsix` | `git rm --cached` | Untrack (R2) |
| `harness-dashboard-vscode-0.1.2.vsix` | `git rm --cached` | Untrack (R2) |
| `progress/impl_vsix-gitignore-cleanup.md` | create | Implementation report (R↔T↔test) |
| `progress/progress.md` | modify | Append summary |
| `progress/backlog.md` | modify | Remove the P0 item this feature closes |
| `feature_list.json` | modify | Add FEAT-020 entry (already done) and mark `done` |

No production code is modified. No dependencies are added. The
VSIX files themselves MAY be deleted from the working tree (the
spec is permissive on this; see Discarded Alternative below).

## Decision: keep the working-tree copies or delete them?

Two options:

1. **`git rm --cached` only** — keep the binaries in the working
   tree so the maintainer can `code --install-extension
   harness-dashboard-vscode-0.1.2.vsix` without rebuilding.
2. **`git rm` (without `--cached`)** — delete the binaries from
   both the index and the working tree, forcing a rebuild on
   demand via `npm run package`.

**Decision: option 1** (`git rm --cached`). Reason: the maintainer
may want to ship the 0.1.x line from the current binaries without
rebuilding. Rebuilding is cheap (`npm run package` is ~5 seconds)
but not free, and the working-tree copies are zero-cost to keep.
The CI workflow does not run `npm run package`, so the binaries
are not in the way of automation.

## Algorithm / Flow

```
1. Read current .gitignore. Identify the section under which the
   *.vsix line should go (the "Build" section is the natural home
   because VSIX is a build artefact).
2. Edit .gitignore: add `# VS Code extension packages (rebuild with
   npm run package)` followed by `*.vsix` at the end of the
   "Build" section. Do not touch any other line.
3. git rm --cached harness-dashboard-vscode-0.1.0.vsix
   git rm --cached harness-dashboard-vscode-0.1.1.vsix
   git rm --cached harness-dashboard-vscode-0.1.2.vsix
4. Verify:
   - git check-ignore -v harness-dashboard-vscode-0.1.2.vsix → matched by *.vsix
   - git ls-files '*.vsix' → empty
   - git status --short → does not list any .vsix
5. Run ./check.sh → exit 0, 33 passes, 2 warnings (unchanged from
   pre-feature baseline).
6. Run npm run package → fresh .vsix created in working tree →
   git status lists it as untracked? NO, it must be listed as
   untracked ONLY if .gitignore does not match it. The test
   confirms .gitignore matches and the file is ignored.
```

## Error Handling

| Condition | Response |
|---|---|
| `.gitignore` already has `*.vsix` (idempotency) | The implementer SHALL detect this with `grep -q '^\*\.vsix' .gitignore` before editing; if present, skip the edit and only run `git rm --cached` (defensive — R1 already satisfied) |
| The three binaries are not in the index (idempotency) | The implementer SHALL detect this with `git ls-files '*.vsix'`; if empty, skip the `git rm` step |
| A future maintainer creates a `.vsix` and runs `git add .` | The new file SHALL be ignored (R5) — this is the regression guard, not a separate requirement |
| The CI workflow tries to checkout a `.vsix` | N/A — CI does not checkout VSIX files; it only builds and tests |

## Discarded Alternative

**Delete the binaries from the working tree as well** (option 2
above, `git rm` without `--cached`).

Discarded because:

1. The maintainer may want to install the 0.1.2 binary locally
   without rebuilding. Rebuilding is ~5 seconds with `npm run
   package`, but it is not free, and a `code --install-extension
   harness-dashboard-vscode-0.1.2.vsix` from the existing file
   is faster.
2. The working-tree copies cost zero disk space in a typical
   developer's `.git` (because they are untracked, not in the
   index). They are only present on the maintainer's machine.
3. The spec is intentionally permissive: it says the working-tree
   copies MAY be kept or deleted. The design chooses "kept" by
   default; if the maintainer later prefers the cleaner state
   (`git rm` without `--cached`), the change is one command and
   one paragraph in the changelog.

## Risks and Edge Cases

- **Case-insensitive filesystems** — on macOS HFS+ and Windows
  NTFS, `.vsix` and `.VSIX` are the same file. The `*.vsix`
  pattern matches both on these filesystems (git's pattern
  matching is case-sensitive by default, but git's path
  handling is filesystem-aware). To be safe, the implementer
  MAY also add `*.VSIX` if the maintainer reports an issue;
  this is not required for the spec.
- **`.vsix` inside subdirectories** — the project's source tree
  has no `.vsix` files inside subdirectories today. The `*.vsix`
  pattern matches at any depth (git's default glob behaviour),
  so a future contributor who runs `vsce package` inside a
  subdirectory would also be safe.
- **A future CI job that needs a VSIX artefact** — if
  FEAT-023 (publish workflow) lands, it will need a VSIX
  artefact. The natural pattern for that is a CI job step that
  uploads the VSIX as a GitHub Actions artifact (not as a git
  commit), which is consistent with the `*.vsix` ignore rule.
  The spec does not block this; it simply ensures that VSIX
  files do not pollute the git history.
- **The CI workflow (FEAT-018) runs `git status` nowhere** — so
  it does not care about untracked VSIX files. The change is
  invisible to CI.
- **The new governance check (FEAT-019 R16) scans governance
  docs, not the filesystem broadly** — so the new `*.vsix`
  ignore rule does not affect the governance check at all.

## Test Plan

| Req | How verified |
|---|---|
| R1 | `grep -E '^\*\.vsix' .gitignore` returns a match (and the line is uncommented) |
| R2 | `git diff --cached --name-only` shows the three `*.vsix` files as deleted (in the staged change) |
| R3 | `git status --short` does not list any `*.vsix` (after the commit) |
| R4 | `git ls-files '*.vsix'` is empty |
| R5 | `npm run package` produces a `harness-dashboard-vscode-X.Y.Z.vsix`; `git check-ignore -v <file>` reports the match |
| R6 | `./check.sh` exit 0, same baseline as before (33 passes, 2 warnings) |
| R7 | `grep -B1 '^\*\.vsix' .gitignore` shows the preceding comment line |
| R8 | `git diff .gitignore` shows ONLY the new comment + `*.vsix` line, no other changes |

The verification commands are T-shaped: most are one-line greps
that take < 1 second. R5 (npm run package) is the only one that
touches the build, and it is a no-op for the existing dist/ tree
(esbuild just re-bundles, vsce just re-zips).
