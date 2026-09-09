# Tasks — Supply-Chain Health (FEAT-036)

> Discrete steps in order. The implementer marks `[x]` upon completing each
> one. Each task references the R<n> it covers. Pure modules (T2–T7) are
> implemented test-first with fixtures; wiring (T8–T13) comes after the
> core is deterministic and green.

## Phase 0 — Repo hygiene / dogfood

- [x] **T1** — Dogfood this repo: create `.github/dependabot.yml` with the R4 content (npm + github-actions, weekly, grouped minor/patch, dev+prod); bump the stale `package.json#overrides.undici` from `7.28.0` to `7.29.0`; `npm install` to refresh the lockfile; verify `npm audit --json` reports **0 dev-scope vulnerabilities** and `./check.sh` stays green. Capture before/after alert counts in `progress/current.md`. _(R3, R4, R9 — live proof)_

## Core — pure modules (no vscode, no child_process)

- [x] **T2** — Create `src/supply-chain/types.ts` (`SupplyChainReport`, `AuditState`, `AuditSummary`, `ScopedFinding`) per design signatures. _(R1, R11)_
- [x] **T3** — Implement `packageJsonParser.ts` (deps / devDeps / overrides maps; malformed JSON → treated as absent) + table tests. _(R1, R2)_
- [x] **T4** — Implement `lockfileParser.ts` (resolved versions, dev flags per package) + tests with a minimal lock fixture. _(R1, R11)_
- [x] **T5** — Implement `botConfigDetector.ts` (dependabot yml/yaml with npm ecosystem via `yaml` pkg; renovate.json/json5/.renovaterc presence) + tests. _(R3)_
- [x] **T6** — Implement `semverLite.ts` (`compare` on numeric-dot versions; range strings skipped) + edge tests (`7.28.0` vs `7.29.0`, equal, longer segments). _(R9, R14)_
- [x] **T7** — Implement `auditReducer.ts` (scope classification prod/dev from audit+lock metadata; stale-override list via semverLite; exit-1-with-JSON = success payload) + fixture-payload tests incl. the undici 7.28.0→7.29.0 scenario. _(R9, R11)_

## Scanner & advisory wiring

- [x] **T8** — Implement `scanner.ts` (`scanWorkspace(deps, auditPayload, auditState)`) with in-memory `SupplyChainFsDeps`; empty-report path for no package.json; determinism test (double scan → deep-equal) using fixture dirs under `src/test/fixtures/supply-chain/`. _(R1, R2, R14)_
- [x] **T9** — Extend `src/agentic-detector/types.ts` with optional `supplyChain` on `AgenticProfile`; wire `SupplyChainScanner` into `AgenticDetector.scan()` (reads cached audit payload only — never triggers it); extend `testUtils.makeProfile`. _(R1, R2, R6)_
- [x] **T10** — Implement `dependabotTemplate.ts` (exact R4 YAML; validated with `yaml.parse`) and `supplyChainRules.ts` (`SC_RULES`: sc-add-update-bot, sc-stale-override:<name>, sc-audit-findings; action payloads per R4/R10). _(R3, R4, R9, R10)_
- [x] **T11** — Merge `SC_RULES` into `advisoryEngine.generate()` rule iteration; tests via `generate(profile)`: exactly one SC-01 when missing, per-package SC-02 ids, dismissal-compatible ids, no SC rules on empty report. _(R3, R9, R10)_

## Audit execution edge (the ONLY child_process path)

- [x] **T12** — Implement `auditRunner.ts` (`execFile('npm', ['audit','--json'])`, 15 s timeout, `{ok}`/`{ok:false,reason}` result); tests spawn a stub `npm` via `process.execPath` covering ok / timeout / garbage / spawn-error. _(R7, R8)_
- [x] **T13** — Wire the user path: `harness-dashboard.runSupplyChainAudit` command in `extension.ts`, `'runSupplyChainAudit'` in `WebviewMessageType`, handling in `AdvisoryCoordinator` (in-flight guard, session cache, `scheduleScan()` after completion); grep-test that no other call site exists. _(R6, R7, R13)_

## Panel

- [x] **T14** — Add the *Supply Chain* section to `AdvisoryPanel.tsx` (prod/dev counts, audit state badge, Run npm audit button posting `runSupplyChainAudit`); hidden when report empty; component tests in `AdvisoryPanel.test.tsx`. _(R12)_
- [x] **T15** — ActionExecutor coverage test: `create-file` of the dependabot template is non-destructive when the file exists (R5) and re-scan clears SC-01 after the file lands. _(R5)_

## Verification & closure

- [x] **T16** — Confirm zero new npm dependencies (`package.json` diff touches only the T1 override bump) and record the R<n>↔test traceability table in `progress/current.md`. _(R13, all)_
- [x] **T17** — Run `./check.sh` — all green (build, 681+ tests, governance, adapter sync). _(all)_
- [x] **T18** — Update `feature_list.json`: FEAT-036 → `"done"`; move session summary into `progress/progress.md`; reset `progress/current.md`. _(all)_
