# Dependency maintenance — 2026-11-16

Baseline: `origin/main` at `5522ad3`, after PRs #23, #25 and #16.
Environment: macOS darwin-arm64, Node 26.13.1, npm 11.20.0.

| Audit | Baseline | Final maintenance branch |
|---|---:|---:|
| Total | 9 (3 high, 5 moderate, 1 low) | 0 |
| Production (`--omit=dev`) | 0 | 0 |

`npm audit fix` without `--force` updated compatible lockfile dependencies
(including Azure identity/MSAL, brace-expansion, qs and serialize-javascript)
and left four moderate findings: glob, minimatch and their Mocha/vsce parents.

Scoped overrides now select `mocha > glob@14.0.6`,
`mocha > minimatch@11.0.8` and `@vscode/vsce > minimatch@11.0.8`.
These cross the parents' declared major ranges; the actual consumers use
`glob.sync`/`hasMagic` and named `minimatch`, and were exercised by the final
Mocha integration run and vsce packaging. This is dependency maintenance,
as permitted by docs/sdd.md §6; no application behavior or source was changed.
The overrides require continued review when Mocha or vsce is upgraded.
Remove each override once its parent's declared dependency range resolves to
patched versions, then rerun both audits, integration and packaging.

Advisories: [glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
(fixed from 14.0.2) and
[minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249)
(fixed from 11.0.1). Downgrading Mocha via audit --force was rejected;
leaving the vulnerable tree was also rejected. Overrides are confined to the
known development-tool parents, not all consumers globally.

Unchanged: direct runtime dependencies, extension version 0.8.2,
`@types/vscode@1.85.0`, `engines.vscode`, React migration assertions and
existing unrelated security overrides. No release or publication.

## Verification

- Fresh `npm ci` used to replace stale installed test-electron 2.5.2.
- Final `npm audit --json` and `npm audit --omit=dev --json`: zero findings.
- `npm run build`: pass.
- `npm test`: 57 files / 819 tests pass.
- `npm run package`: pass; 373,009 B / 400,000 B (93%). Executed in a clean
  worktree with the final package.json/package-lock.json and installed dependency
  tree, excluding the original checkout's pre-existing untracked local files.
- `./check.sh`: pass.
- `npm run test:integration`: pass before and after final overrides, one full-flow
  integration test each time. test-electron 3.1.0 downloaded stable VS Code
  1.146.0 for darwin-arm64; no VSCODE_TEST_PATH override. Exit 0, no ENOENT.
  VS Code emitted SDK receipt warnings, but extension load and the test passed.

Local validation used Node 26; repository CI uses Node 22 and remains the
independent compatibility gate. No claim is made about Windows e2e coverage.
