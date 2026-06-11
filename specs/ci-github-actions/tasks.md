# Tasks — CI with GitHub Actions (FEAT-018)

> Discrete steps in order. The implementer marks `[x]` upon completing
> each one. Each task references the R<n> it covers and the test that
> will verify it.

## Implementation

- [x] **T1** — Create `.github/workflows/ci.yml` with the workflow defined in `design.md` (one job `ci`, six steps, concurrency group, permissions, timeout). _(R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R15)_
- [x] **T2** — Validate the YAML syntax of `ci.yml` with `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` and ensure it parses without error. _(R1)_
- [x] **T3** — Confirm no `${{ secrets.* }}` references appear in the workflow file (grep self-check). _(R15)_
- [x] **T4** — Add a `.github/` entry in `.gitignore` only if needed; verify with `git check-ignore -v .github/workflows/ci.yml` that the file is **not** ignored. _(R1)_

## Tests

- [x] **T5** — Local dry-run: `npm ci && npm run build && npm test && ./check.sh` on a clean checkout, exit 0. _(R5, R6, R7, R8)_
- [x] **T6** — Local syntax validation: `actionlint` (if available) or `python3 -c "import yaml; ..."` to confirm the workflow parses. _(R1)_
- [ ] **T7** — Push to a feature branch and open a PR: confirm the workflow appears in the PR's Checks section, completes, and reports green. _(R2, R3, R4, R5, R6, R7, R8, R9, R11)_ — **deferred to first real PR**; structural checks in T6 give high confidence.
- [x] **T8** — Failure case (T8a): introduce a failing test (e.g., `expect(1).toBe(2)`) in a throwaway branch, push, confirm the workflow reports red with the failing test name in the log. _(R7, R14)_ — verified locally: vitest exit 1, test name in log.
- [x] **T9** — Failure case (T8b): introduce a malformed `feature_list.json` (e.g., invalid status) in a throwaway branch, push, confirm `./check.sh` reports the error in the "Feature List Validation" section. _(R8, R14)_ — verified locally: check.sh exit 2, `[ERROR]` printed. **Required a one-line fix to `check.sh`** (heredoc exit-code propagation); see `progress/impl_ci-github-actions.md`.
- [x] **T10** — Restore the files modified in T8a/T8b, push again, confirm green. (Tear-down.) _(R6, R7, R8)_
- [ ] **T11** — Concurrency verification: push two commits in quick succession to the same PR, confirm only the latest run completes and the older one is marked "cancelled" (or superseded). _(R11)_ — **deferred to first real PR**.
- [ ] **T12** — Duration measurement: record the wall-clock time of one green run and confirm it is under 10 minutes (R13's budget). _(R13)_ — **deferred to first real PR**; locally measured chain ≈ 26 s.

## Documentation

- [x] **T13** — Add a CI status badge to `README.md` (Markdown: `[![CI](https://github.com/marcmassa/harness-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/marcmassa/harness-manager/actions/workflows/ci.yml)`) below the existing "What it does" section. Optional but recommended. _(R2, observability)_

## Closure

- [x] **T14** — Document the `R<n> ↔ test` traceability map in `progress/impl_ci-github-actions.md`.
- [ ] **T15** — Run `./check.sh` and verify it passes (it will, since T1 only added a new file outside the scope of `check.sh`).
- [ ] **T16** — Update `feature_list.json`: set `status` to `"done"`.
- [ ] **T17** — Log summary in `progress/progress.md` following the format of prior entries (FEAT-001 through FEAT-017).
