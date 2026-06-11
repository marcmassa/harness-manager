# Implementation Report — CI with GitHub Actions (FEAT-018)

> Traceability R↔T↔test for feature FEAT-018. Maps every EARS
> requirement to the task that implemented it and the verification
> (local or remote) that proves it.

## Summary

- **Created**: `.github/workflows/ci.yml` (54 lines, one job, six steps).
- **Created**: README CI badge.
- **Fixed (in scope)**: `check.sh` feature-list validation heredoc bug
  — Python exit code was being swallowed by `2>/dev/null || true`, and
  `$?` was being clobbered by an intervening command. Without this
  fix, R8 was technically unproven (an invalid `feature_list.json`
  status would print the error but exit 0). Now captured in
  `fl_rc=$?` and the `pass`/`fail` branches work as designed.
- **Deferred to first real PR**: T7 (push to feature branch and verify
  the workflow appears in PR Checks), T11 (concurrency cancellation on
  stacked commits), T12 (wall-clock duration measurement under 10
  minutes). All three are designed to work — verified structurally by
  T6 — but can only be observed in a real GitHub Actions run.

## Files Touched

| File | Action | Reason |
|---|---|---|
| `.github/workflows/ci.yml` | created | The single CI workflow (R1–R15) |
| `README.md` | modified | Added CI status badge (T13) |
| `check.sh` | modified | Fixed feature-list validator exit-code propagation (R8 hardening) |
| `feature_list.json` | modified | Added FEAT-018 entry (spec-author phase); will be marked `done` in T16 |
| `progress/impl_ci-github-actions.md` | created | This file |
| `progress/progress.md` | modified | Append FEAT-018 summary (T17) |
| `progress/current.md` | modified | Session state |

No production code (`src/`, `package.json`, `tsconfig.json`, `esbuild.js`,
`vitest.config.ts`, `media/`, `docs/`) was modified. No dependencies
added.

## R↔T↔test Map

| Req | Title | Implemented by | Verified by |
|---|---|---|---|
| R1 | Workflow presence (`ci.yml`, job `ci`) | T1 | T6 (Python yaml.safe_load + structural check confirms `jobs.ci` exists) |
| R2 | Trigger events (`push`/`pull_request` to `main`) | T1 | T6 (asserts `on.push.branches == [main]` and `on.pull_request.branches == [main]`) |
| R3 | Runner `ubuntu-latest` | T1 | T6 (asserts `jobs.ci.runs-on == "ubuntu-latest"`) |
| R4 | Node 20.x + npm cache | T1 | T6 (asserts `setup-node.with.node-version == "20.x"` and `cache == "npm"`) |
| R5 | `npm ci` (not `npm install`) | T1 | T5 (local `npm ci` succeeds with deterministic lockfile) + T6 (asserts install step uses `npm ci`) |
| R6 | `npm run build` step fails job on non-zero exit | T1 | T5 (build succeeds) + T6 (asserts `Build` step uses `npm run build`) |
| R7 | `npm test` step fails job on test failure | T1 | T8a (introduced `expect(1).toBe(2)` → `vitest` exit 1; failing test name visible in log per R14) + T6 |
| R8 | `./check.sh` step fails job on non-zero exit | T1 | T9 (set `status: "borked"` → `check.sh` exit 2, prints `[ERROR] FEAT-018: invalid status 'borked'`) + T6 |
| R9 | Step ordering (checkout → setup-node → npm ci → build → test → check) | T1 | T6 (asserts exact step-name order) |
| R10 | Single required job, no matrix | T1 | T6 (asserts `len(jobs) == 1`) |
| R11 | Concurrency group cancels in-progress runs on same ref | T1 | T6 (asserts `concurrency.cancel-in-progress == true`). T11 will observe it in a real run. |
| R12 | `permissions: contents: read`, no elevated scopes | T1 | T6 (asserts `permissions.contents == "read"` and no other keys) |
| R13 | Typical run ≤ 10 min | T1 | T6 (asserts `timeout-minutes <= 10`). T5 measured local `npm ci` (12s) + build (5s) + tests (0.5s) + `check.sh` (8s) ≈ 26s, well under budget. T12 will measure on first real run. |
| R14 | Failure logs visible in GitHub Actions UI | T1 | T8a (the failing test name and assertion message are printed by Vitest's verbose reporter, which is the default in `package.json#scripts.test`). GitHub Actions retains this in the run page by default. |
| R15 | No `${{ secrets.* }}` references | T1 | T3 (`grep -E 'secrets\.' .github/workflows/ci.yml` returns no matches) + T6 (regex re-check on raw file) |

## Verification Commands Run (and their outcomes)

| Step | Command | Expected | Actual | Pass? |
|---|---|---|---|---|
| T2 / T6 | `python3 -c "import yaml; yaml.safe_load(...)"` + structural checks | parse OK + 14 structural assertions pass | All pass | ✅ |
| T3 | `grep -nE 'secrets\.' .github/workflows/ci.yml` | no match | no match | ✅ |
| T4 | `git check-ignore -v .github/workflows/ci.yml` | not ignored | not ignored (exit 1) | ✅ |
| T5 | `npm ci && npm run build && npm test && ./check.sh` | exit 0 chain | exit 0 (all steps pass) | ✅ |
| T8a | inject `expect(1).toBe(2)` in `discovery.test.ts`, run `vitest` | exit 1 + test name in log | exit 1, "T8a placeholder (intentionally failing)" listed | ✅ |
| T8b | set `status: "borked"` in `feature_list.json`, run `./check.sh` | exit non-zero + `[ERROR]` in log | exit 2 + `[ERROR] FEAT-018: invalid status 'borked'` | ✅ |
| T10 | restore backups, re-run `./check.sh` | exit 0 | exit 0 | ✅ |
| T7 / T11 / T12 | run on real GitHub Actions runner | green, in-progress cancelled, < 10 min | **deferred to first real PR** | ⏳ |

## Bug Found and Fixed During Implementation

`check.sh` (lines 185–232) had a **silent failure** in the feature-list
validator:

```bash
# BEFORE (buggy)
python3 /dev/stdin <<'PYEOF' 2>/dev/null || true
...
sys.exit(1) if errors else 0
PYEOF

if [ $? -eq 0 ]; then ...
```

Two compounding issues:

1. `2>/dev/null || true` swallowed Python's exit code 1 AND its
   stderr, so the validator could fail silently and the script would
   still report success.
2. Even after removing `2>/dev/null || true`, the `$?` in the
   subsequent `if` was being captured from the heredoc, but the
   surrounding pipeline (with the embedded `pass()` function calls and
   the [ ... ] test) had a fragile interaction that made the assertion
   unreliable.

**Fix applied**:

```bash
# AFTER
python3 /dev/stdin <<'PYEOF'
...
PYEOF
fl_rc=$?

if [ "$fl_rc" -eq 0 ]; then
    pass "Feature list validation completed"
else
    fail "Errors in feature_list.json"
fi
```

Why this is in-scope for FEAT-018: **R8 requires `./check.sh` to fail
the CI job on a malformed `feature_list.json`**. Without the fix, R8
was technically unproven (the validator would print the error and
exit 0, so the GitHub Actions step would still show green). The fix
makes R8 testable. T9 demonstrates the fix works.

## Known Limitations / Future Work

- **T7 / T11 / T12 deferred** — need a real GitHub Actions run to
  observe the workflow trigger, concurrency cancellation, and
  wall-clock duration. The structural checks in T6 give high
  confidence, but the first PR that lands this workflow on `main`
  will be the moment of truth. The maintainer should manually
  verify the badge turns green in the README.
- **SHA-pinning** — actions are pinned to major versions (`@v4`),
  not commit SHAs. SHA-pinning is a recommended hardening for
  supply-chain security but adds visual noise. Tracked as future
  tech-debt, not blocking.
- **VSIX artifact** — T13 added a status badge but not an artifact
  upload. If the team wants a built `.vsix` attached to each green
  run, that's a follow-up feature (suggested FEAT-019).
- **Codecov / coverage** — explicitly out of scope per the design
  alternatives section.

## Sign-off

- [x] T1 — workflow created
- [x] T2 — YAML parses
- [x] T3 — no secrets
- [x] T4 — not gitignored
- [x] T5 — local dry-run green
- [x] T6 — 14 structural assertions pass
- [x] T7 — deferred (first real PR)
- [x] T8a — failing test causes vitest exit 1
- [x] T8b — invalid status causes check.sh exit 2 (after fix)
- [x] T10 — files restored
- [x] T11 — deferred (first real PR)
- [x] T12 — deferred (first real PR)
- [x] T13 — README badge added
- [x] T14 — this report
- [ ] T15 — `./check.sh` green (next)
- [ ] T16 — mark done
- [ ] T17 — log in progress.md
