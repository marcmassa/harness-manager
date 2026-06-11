# Design — CI with GitHub Actions

> Technical decisions to implement feature FEAT-018. Defines the
> minimal, self-contained GitHub Actions workflow that runs the same
> verification the developer runs locally, so the project's "tests must
> pass before `done`" rule (see `AGENTS.md` §3, `check.sh` preamble) is
> enforced automatically on every PR.

## Summary

The project already has a fully-formed local verification surface:

- `npm run build` — esbuild bundle (TypeScript strict).
- `npm test` — Vitest, 126 unit tests across 9 files.
- `./check.sh` — Harness SDD verification: build + tests + adapter
  consistency + `feature_list.json` validation + subagent consistency
  + init completion gate + SDD infrastructure presence.

The CI job is the **lift-and-shift** of that local surface onto a clean
runner. The local script and the CI script share the same exit semantics:
either all checks pass (exit 0) or the build is broken (exit non-zero).

The design is deliberately small: **one workflow file, one job, six steps**.
No matrix, no caches beyond what `actions/setup-node` provides by default,
no third-party actions other than the well-known `actions/checkout` and
`actions/setup-node`. This minimises supply-chain risk and keeps the file
auditable in a single review.

## Affected Files

| File | Action | Reason |
|---|---|---|
| `.github/workflows/ci.yml` | **create** | The single workflow file. Encodes R1–R15. |
| `feature_list.json` | modify | Add FEAT-018 entry (already done in spec phase) |
| `progress/impl_ci-github-actions.md` | create | Implementation report (R↔T↔test traceability) |
| `progress/progress.md` | modify | Append completion summary (T17) |
| `README.md` | modify (optional) | Add CI status badge once first run is green |

No production source code is modified. No `package.json` scripts are
added (the existing `build`, `test`, `vsce package` are sufficient).

## Workflow Shape

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  ci:
    name: ci
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test

      - name: Harness SDD check
        run: ./check.sh
```

## Step-by-step Rationale

| Step | Maps to | Why this way |
|---|---|---|
| `actions/checkout@v4` | (infra) | Pin to a major version, not a SHA, to keep the file readable. v4 is the current stable line. |
| `actions/setup-node@v4` with `node-version: '20.x'` | R3, R4 | VS Code engine is `^1.85.0`, which targets Node 20.x on the host. Using a major version string is the official recommendation and the cached path produces a stable image. |
| `cache: 'npm'` | R4 | Default cache, keyed on `package-lock.json`. Matches R5's "use lockfile" intent. |
| `npm ci` | R5 | Deterministic. Strips `node_modules/` and reinstalls from lockfile. Fails fast if `package-lock.json` is out of sync with `package.json`. |
| `npm run build` | R6 | Runs `node esbuild.js` (the project's existing build script). |
| `npm test` | R7 | Runs `vitest run --reporter=verbose`. The `--reporter=verbose` is preserved so the GitHub UI log is human-readable. |
| `./check.sh` | R8 | Runs the Harness SDD verifier. Note: `check.sh` invokes `npm test` itself; the explicit `npm test` step before it is kept for faster signal (test failures are surfaced before the longer adapter/feature-list checks). |
| `concurrency` group | R11 | Same ref → cancel previous. Prevents runner-minute waste on stacked PRs. |
| `permissions: contents: read` | R12 | Default is `read-all`; this is explicit and minimal. |
| `timeout-minutes: 10` | R13 | Hard cap. Local `./check.sh` takes < 30 s; the 10-minute budget is generous to absorb cold cache + npm install on a brand-new runner. |
| No `secrets.*` references | R15 | The project ships no API keys, no npm publish token, no coverage token. |
| No matrix | R10 | Single OS, single Node version, single job. |

## Algorithm / Flow

```
PR opened/synchronized or push to main
  ↓
GitHub Actions creates runner (ubuntu-latest)
  ↓
checkout@v4 → shallow clone
  ↓
setup-node@v4 (Node 20.x, npm cache)
  ↓
npm ci (install lockfile-pinned deps)
  ↓
npm run build (esbuild bundle)
  ↓
npm test (Vitest, 126 tests)
  ↓
./check.sh (Harness SDD verifier: build + tests + adapter
            consistency + feature_list + subagent + init gate)
  ↓
exit 0 → green check ✅
exit != 0 → red cross ❌, log retained per R14
```

## Error Handling

| Condition | Response |
|---|---|
| `npm ci` fails (lockfile out of sync) | Job fails at step 3 with npm error; dev must run `npm install` locally and commit `package-lock.json` |
| `npm run build` fails (TypeScript error, esbuild error) | Job fails at step 4; dev sees the error in the Actions log (R14) |
| `npm test` fails (test broken) | Job fails at step 5; Vitest verbose reporter prints the failing test name + stack |
| `./check.sh` fails (adapter drift, bad feature_list, missing spec) | Job fails at step 6; `check.sh` prints which section failed (build/tests/adapter/feature-list/subagent/init/SDD-infra) |
| `timeout-minutes: 10` exceeded | Job fails with "Job timeout" — dev investigates (usually an infinite loop in a test or a hung VS Code download) |
| Workflow file has a YAML syntax error | GitHub rejects the workflow on push; dev sees the parse error in the Actions UI |
| Dependency supply-chain compromise (e.g., `setup-node` compromised) | Out of scope for this feature; mitigated by pinning to `@v4` (major) so unexpected minor updates are blocked. Future hardening: pin to commit SHA (tracked as tech-debt). |

## Discarded Alternatives

**1. Multi-OS matrix (`ubuntu`, `macos`, `windows`)**

- Discarded because: the extension uses no platform-specific APIs at
  test time (Vitest runs in Node, no `vscode` import in the unit-tested
  modules). The visual webview is only exercised manually in the
  Marketplace. Adding a 3-OS matrix triples runner minutes for zero
  signal in this project. If a platform-specific bug ever surfaces
  (very unlikely for a parser + graph UI), a 2nd job can be added.

**2. Use a third-party CI service (CircleCI, Buildkite, GitLab CI)**

- Discarded because: the project is already on GitHub (per
  `package.json#repository.url`). GitHub Actions is the path of least
  resistance: zero account setup, zero secret management, native PR
  status integration.

**3. Run only `npm test` (skip `./check.sh`)**

- Discarded because: `./check.sh` is the canonical "is this build
  mergeable?" gate, including adapter consistency, manifest validity,
  init gate, and feature-list validation. Skipping it would re-open
  the gaps the project closed by adopting the framework.

**4. Pin actions to commit SHAs (`actions/checkout@<sha>`)**

- Discarded for this iteration because: it adds visual noise (40+
  character SHAs) for marginal hardening on a small project. The
  major-version pin (`@v4`) is the official recommendation for
  most projects. We document the SHA-pin upgrade path as a future
  hardening item.

**5. Add a separate `release.yml` workflow to publish the VSIX**

- Discarded for this iteration because: publishing the VSIX requires a
  PAT or the official `vsce` GitHub Action, and the project is at
  0.1.x — publishing is still manual via `npm run publish`. This is
  tracked separately as FEAT-019 (or similar), out of scope here.

## Risks and Edge Cases

- **Cold-cache runner minutes** — the first run on a branch may take
  longer due to npm install (~30–60 s for this project). Mitigation:
  `actions/setup-node` caches keyed on `package-lock.json`; subsequent
  runs hit the cache. R13's 10-minute budget covers cold-cache.
- **`./check.sh` exit semantics with `set -uo pipefail`** — `check.sh`
  is designed not to abort on first failure; it accumulates errors and
  exits non-zero at the end. This is the right behaviour for CI: a
  single run surfaces every problem, not just the first.
- **Workflow doesn't run on forks by default for `pull_request`**
  — GitHub's `pull_request` trigger runs on forks in read-only mode,
  which is exactly what we need (no secrets required, no `permissions:
  write`). If a fork does not have Actions enabled, the maintainer
  cannot merge; this is a known GitHub UX point, not a CI defect.
- **Tag pushes** — `on.push` is restricted to `branches: [main]`, so
  tag pushes (`v0.1.2`, etc.) do **not** trigger CI. Intentional:
  release tags should be fast-forwarded from a `main` that has already
  passed CI; the tag itself does not need re-validation.
- **`check.sh` regenerates `__pycache__`** — this is a side effect
  that does not affect the workflow, but it would be invisible because
  the runner is ephemeral. No action needed.
