# Implementation / review report — FEAT-036 supply-chain-health

Durable record of the T16 artifact (the R<n>↔test traceability table was to
be recorded on disk before `progress/current.md` was reset at T18).
Verified by **reviewer-vscode** on 2026-09-09 (read from source, not from
the implementer's report). Gates observed at review time:
`npm test` 773/773 (56 files) · `./check.sh` exit 0 (36 ✅) ·
`npm audit` → **found 0 vulnerabilities** (dev-scope 12 → 0).

## R1–R14 ↔ test traceability

| R | Requirement (short) | Verifying test(s) | Status |
|---|---------------------|-------------------|--------|
| R1 | Static SupplyChainReport | `scanner.test.ts › produces the full deterministic report`; `packageJsonParser.test.ts › parses dependencies, devDependencies and overrides as flat maps`; `lockfileParser.test.ts › resolves versions for direct and transitive packages` | ✅ |
| R2 | Non-Node workspace → silence, no error | `scanner.test.ts › returns an empty report for a workspace without package.json` + `› malformed package.json is treated as absent (no throw)`; `supplyChainRules.test.ts › no SC rules at all on an empty (non-Node) report` | ✅ |
| R3 | Exactly one SC-01 when no bot | `supplyChainRules.test.ts › emits exactly one SC-01 when dependabot+renovate are missing` (count=1 asserted); `botConfigDetector.test.ts › a dependabot file WITHOUT the npm ecosystem still counts as missing`; `actionExecutor.test.ts › a re-scan after the file lands clears SC-01 (integration, R3)` | ✅ |
| R4 | Dependabot scaffold payload | `supplyChainRules.test.ts › carries a create-file action with the R4 payload (relPath + template)`; `scanner.test.ts › DEPENDABOT_TEMPLATE — R4 validity` (yaml.parse: npm+github-actions, weekly, grouped minor/patch, no PR-limit kill switch). Repo's own `.github/dependabot.yml` is byte-equivalent to the template (dogfood) | ✅ |
| R5 | Non-destructive create-file, BOTH clauses | `actionExecutor.test.ts › skips write and opens the file in the editor when it already exists (R5)` (asserts `writeFile` NOT called AND `showTextDocument` called once) + `› is NON-DESTRUCTIVE when .github/dependabot.yml already exists (R5)`. Executor changed by one line for clause 2 — ADR-004 | ✅ |
| R6 | Audit user-triggered only | `noAutoAudit.test.ts › runNpmAudit is referenced ONLY by auditRunner.ts and agenticDetector.ts`; `› no file except auditRunner spawns the npm audit argv`; `› agenticDetector.ts references runAudit…` (no `this.runAudit(` in scan path). Call sites: palette command + panel button only (code-verified) | ✅ |
| R7 | One bounded run, cached, re-scan | `auditRunner.test.ts › resolves ok with a parsed payload when exit=1 but stdout is JSON`; `› default timeout is the 15 s bound from R7`. Cache (`_auditPayload`, session-only), in-flight guard and `scheduleScan()` verified by code inspection of `AgenticDetector.runAudit()` / `AdvisoryCoordinator.runAuditAndRescan()` — vscode-host layer, untestable per design's unit-test constraint (informational gap) | ✅* |
| R8 | Audit failure degrades, never breaks | `auditRunner.test.ts › non-JSON stdout → parse`; `› exit without any stdout → parse`; `› timeout kills the child and reports reason "timeout"`; `› npm not on PATH → spawn`; `scanner.test.ts › unavailable audit → empty summary with the state recorded, payload ignored`; `supplyChainRules.test.ts › no SC-02 when the audit has not been captured` | ✅ |
| R9 | Stale override SC-02 (undici scenario) | `semverLite.test.ts › 7.28.0 < 7.29.0 (the undici stale-override case)`; `auditReducer.test.ts › names the package, the current pin and the patched version` (+ 4 not-stale negatives incl. range pins); `scanner.test.ts › reduces a captured audit payload into the report` (fixture `stale-override/`); `supplyChainRules.test.ts › titles name the package, the current pin and the patched version` | ✅ |
| R10 | Remediation command actions | `supplyChainRules.test.ts › carries BOTH remediation commands per R10` (SC-02: audit fix + outdated); `› SC-03 … fires with run-command npm audit fix` | ✅ |
| R11 | Prod vs dev classification | `auditReducer.test.ts › counts production and development findings separately`; `› uses the dev metadata inside v1 findings`; `› unknown packages default to production (conservative)`; `lockfileParser.test.ts › flags dev packages per package metadata (R11)`; findings list: `› exposes the classified findings list` | ✅ |
| R12 | Panel Supply Chain section | `AdvisoryPanel.test.ts › renders prod/dev counts and audit state when the report is non-empty`; `› shows the not-run badge and the Run npm audit button`; `› shows the unavailable state without error`; `› is hidden when the profile has no supplyChain` / `› is hidden for an empty (non-Node) report` | ✅ |
| R13 | No network from extension code | `noAutoAudit.test.ts › supply-chain sources import no http/https/fetch-based modules`; `› the only child_process module in supply-chain is auditRunner.ts`; reviewer grep (independent): no `fetch(`/axios/node-fetch/node:http in `src/supply-chain/` or any FEAT-036 diff file | ✅ |
| R14 | Deterministic output | `scanner.test.ts › two scans of unchanged input produce byte-identical reports` (JSON.stringify equality); `auditReducer.test.ts › two reductions … deep-equal and identically ordered`; `supplyChainRules.test.ts › two generate() calls … identical ordered SC ids`; `packageJsonParser.test.ts › preserves declared key order` | ✅ |

Grep-style tests carry `@requirement` headers in every new test file
(`rg '@requirement' src/supply-chain src/agentic-detector/supplyChainRules.test.ts` → all of R1–R14 covered).

## Binding constraints verified at review

- `git diff package.json`: ONLY `overrides.undici 7.28.0→7.29.0` + one
  `contributes.commands` entry. Dep sets untouched → zero new declared deps.
- `package-lock.json`: lock refresh churn only (npm update, ranges unchanged);
  `node_modules/undici` resolves 7.29.0; no `7.28.0` references remain.
- execFile/child_process: confined to `src/supply-chain/auditRunner.ts`
  within the feature (pre-existing uses in run/verifier/optimizer are out of scope).
- `src/supply-chain/*.ts`: no `vscode` import (pure modules).
- `activationEvents` unchanged (surgical, `onView:` only); new command
  registration pushed to `context.subscriptions`.
- CHANGELOG/README not touched: repo convention is version-bump + CHANGELOG
  on **release commits** ([0.8.0] release bundled FEAT-034+035; a separate
  `v0.7.0` release commit exists for the same pattern). Absence is correct
  for an unreleased feature.

## Reviewer notes (informational, no rework required)

1. `supplyChainRules.test.ts:171` title says "SC rules never fire…" but the
   body only asserts SC-01 absence (comment acknowledges SC-03 would fire;
   the state is unreachable from the real scanner).
2. `noAutoAudit.test.ts:56` title vs assertion mismatch (asserts zero
   `this.runAudit(` calls, not "exactly one reference").
3. Spawn errors other than ENOENT (e.g. EACCES) classify as `parse` instead
   of `spawn`; audit state is still `unavailable`, so R8 holds.
4. Undeclared-but-accepted design deltas: `supplyChainAuditResult` webview
   message, `src/webview/index.tsx` wiring (both necessary), and
   `AgenticProfile` carrying audit state inside the report rather than as a
   separate top-level field.
