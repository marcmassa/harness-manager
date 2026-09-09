# Design — Supply-Chain Health (FEAT-036)

> Technical decisions for FEAT-036. Aligned with `DESIGN.md` principles:
> deterministic analysis (§2.3), frugal AI / no HTTP / ≤300 KB VSIX (§2.4,
> §6), testability (§2.6), zero new npm dependencies. Every module below
> that carries logic is a pure function or DI-injected class, unit-testable
> with string inputs like `src/agentic-detector/contentMatcher.ts`.

## Summary

A new deterministic supply-chain layer reads three things already on disk —
`package.json`, `package-lock.json`, and the presence/content of a
dependency-update bot config — and folds the result into the existing
advisory loop as a new `SC` rule family. Security-audit-derived rules
(stale `overrides` pins, fix suggestions) consume the cached JSON of a
single **user-triggered** local `npm audit --json` run — the same trust
model as running `./check.sh` in a terminal. Suggestions reuse
FEAT-032's `SuggestionAction` vocabulary verbatim: `create-file` scaffolds
a vetted `.github/dependabot.yml`, `run-command` offers `npm audit fix` /
`npm outdated`. A small *Supply Chain* section in the AdvisoryPanel shows
prod-vs-dev counts and audit state.

## Architecture & Data Flow

```
AgenticDetector.scan(graphContext)                 [existing, modify]
  ├─ SignalScanner / AdapterRegistry / maturity    [existing, untouched]
  ├─ NEW SupplyChainScanner.scanWorkspace(deps)    [DI: readFile, fileExists]
  │     ├─ packageJsonParser      ← content string
  │     ├─ lockfileParser         ← content string
  │     ├─ botConfigDetector      ← presence flags + dependabot YAML (yaml pkg)
  │     └─ auditReducer(cachedPayload?)            [pure]
  │            ├─ semverLite.compare(pin, fixedIn)
  │            └─ scope classification (prod/dev)
  ├─ profile.supplyChain = SupplyChainReport       [types.ts, extend]
  └─ generate(profile, dismissed)                  [advisoryEngine, modify]
        └─ RULES ⊕ SC_RULES (supplyChainRules.ts)  [new table, same pattern]
              └─ Suggestion{ actions: SuggestionAction[] }   [FEAT-032, reuse]

User path for audit (R6/R7) — NEVER inside scan():
  AdvisoryPanel button / palette command
      └─ postMessage 'runSupplyChainAudit' → AdvisoryCoordinator
            └─ AuditRunner.run()  — child_process.execFile('npm',
               ['audit','--json'], {timeout: 15000})   [the ONLY new I/O edge]
            └─ cache payload (module-level, session-only) → scheduleScan()
            └─ next scan: auditReducer sees fresh payload → SC-02 rules
```

The extension host **never** issues HTTP itself (R13): `npm audit` is a
local npm process the user explicitly invoked, mirroring
`src/verifier/codeQualitySetup.ts`, which likewise shells out to local
tooling (`npx` formatters/linters) on demand rather than importing or
networking from extension code.

## Affected Files

| File | Action | Reason |
|------|--------|--------|
| `src/supply-chain/types.ts` | create | `SupplyChainReport`, `AuditState`, `ScopedFinding`, `OverridePin` — serializable data only |
| `src/supply-chain/packageJsonParser.ts` | create | pure: JSON string → deps/devDeps/overrides maps (R1) |
| `src/supply-chain/lockfileParser.ts` | create | pure: lock string → resolved versions + dev flags per package (R1, R11) |
| `src/supply-chain/botConfigDetector.ts` | create | pure: config-presence map (+ `yaml` parse of dependabot yml) → `botConfigPresent` (R3) |
| `src/supply-chain/semverLite.ts` | create | pure numeric-dot version compare (`7.28.0` vs `7.29.0`); avoids a `semver` dependency (R9) |
| `src/supply-chain/auditReducer.ts` | create | pure: audit JSON + overrides → scoped findings + stale-pin list (R9, R11) |
| `src/supply-chain/dependabotTemplate.ts` | create | the vetted `.github/dependabot.yml` string constant (R4) |
| `src/supply-chain/scanner.ts` | create | orchestrator; DI `{readFile, fileExists}` like `SignalScanner`'s `{findFiles, readFile}` (R1, R2, R14) |
| `src/supply-chain/auditRunner.ts` | create | the only file touching `child_process`; single bounded execFile + timeout (R7, R8) |
| `src/agentic-detector/types.ts` | modify | add optional `supplyChain?: SupplyChainReport` + `auditState` to `AgenticProfile` |
| `src/agentic-detector/supplyChainRules.ts` | create | `SC_RULES: SuggestionRule[]` — same table shape as FEAT-029's `RULES` (R3, R9, R10) |
| `src/agentic-detector/advisoryEngine.ts` | modify | iterate `[...RULES, ...SC_RULES]`; rules stay pure over `profile.supplyChain` |
| `src/agentic-detector/agenticDetector.ts` | modify | invoke `SupplyChainScanner` in `scan()`; hold cached audit payload; expose `runAudit()` |
| `src/coordinators/AdvisoryCoordinator.ts` | modify | handle new `runSupplyChainAudit` webview message (R6, R7) |
| `src/types.ts` | modify | add `'runSupplyChainAudit'` to `WebviewMessageType` |
| `src/webview/AdvisoryPanel.tsx` | modify | *Supply Chain* section: counts, audit state, Run-audit button (R12) |
| `src/extension.ts` | modify | register `harness-dashboard.runSupplyChainAudit` command (R6) |
| `src/test/fixtures/supply-chain/*` | create | fixture dirs: `node-basic/`, `no-node/`, `stale-override/`, `dependabot-present/`, `audit-payloads/*.json` |
| `.github/dependabot.yml` (this repo) | create (T1) | dogfood: the repo itself gets the config SC-01 would prescribe |

`actionExecutor.ts` needs **no change** — `create-file` (stat-then-write,
R5 already holds) and `run-command` (terminal sendText) exist from
FEAT-032. That reuse is the point.

> **Implementation resolution note (2026-09-09):** the claim "R5 already
> holds" proved inaccurate — FEAT-032's `create-file` silently *returned*
> when the file existed, satisfying R5's non-destructive clause but not
> its second clause ("opens it in the editor instead"). Resolution: the
> existing-file branch now calls `showTextDocument(uri)` before returning
> (one line). Write/skip semantics for all other action types are
> unchanged; both clauses of R5 are pinned by tests.

## Key Signatures

```ts
// src/supply-chain/types.ts
export interface SupplyChainReport {
  hasPackageJson: boolean;
  dependencies: Record<string, string>;      // name -> declared range
  devDependencies: Record<string, string>;
  overrides: Record<string, string>;         // name -> pinned range (may be non-exact)
  lockfilePresent: boolean;
  resolvedVersions: Record<string, string>;  // name -> resolved (from lock)
  botConfig: { dependabotNpm: boolean; renovate: boolean };
  audit: AuditSummary;                       // derived, never the raw payload
}
export type AuditState = 'not-run' | 'unavailable' | 'captured';
export interface AuditSummary {
  state: AuditState;
  prodCount: number; devCount: number;
  staleOverrides: Array<{ name: string; pinned: string; patched: string }>;
}

// src/supply-chain/scanner.ts — mirrors SignalScanner's DI pattern
export interface SupplyChainFsDeps {
  readFile(relPath: string): Promise<string | null>;   // null = absent
  exists(relPath: string): Promise<boolean>;
}
export async function scanWorkspace(deps: SupplyChainFsDeps,
  auditPayload: unknown | null, auditState: AuditState): Promise<SupplyChainReport>;

// src/supply-chain/semverLite.ts
export function compare(a: string, b: string): -1 | 0 | 1;  // numeric-dot only

// src/supply-chain/auditRunner.ts
export function runNpmAudit(cwd: string, timeoutMs = 15_000):
  Promise<{ ok: true; payload: unknown } | { ok: false; reason: 'spawn' | 'timeout' | 'parse' }>;
```

`npm audit --json` exit code 1 *with* valid JSON is a **success** payload
(vulnerabilities exist); exit ≠ 0 with non-JSON stdout is `parse`
failure. `overrides` keys are matched to audit `fixVersion` entries by
exact package name (npm overrides are flat name→range maps).

## Rule family (SC) — same table pattern as FEAT-029

| id | condition (over `profile.supplyChain`) | actions |
|----|------------------------------------------|---------|
| `sc-add-update-bot` (SC-01) | `hasPackageJson && !botConfig.dependabotNpm && !botConfig.renovate` | `create-file` (`.github/dependabot.yml`, template of R4) |
| `sc-stale-override:<name>` (SC-02) | `audit.state === 'captured'` and `semverLite.compare(pinned, patched) === -1` for an override entry | `run-command: npm audit fix`, `run-command: npm outdated` |
| `sc-audit-findings` (SC-03, low impact) | `audit.state === 'captured' && prodCount + devCount > 0` | `run-command: npm audit fix` |

IDs are stable per package (`sc-stale-override:undici`) so dismissal works
with the existing `dismissedSuggestionIds` persistence.

## Dependabot template (SC-01 payload, R4)

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    groups:
      minor-patch:
        patterns: ["*"]
        update-types: ["minor", "patch"]
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
    groups:
      minor-patch:
        patterns: ["*"]
        update-types: ["minor", "patch"]
```
(dependencies and dev-dependencies are both covered by default — no
`open-pull-requests-limit: 0` anywhere.)

## Error Handling / Degradation (R2, R8)

| Condition | Response |
|-----------|----------|
| No `package.json` | empty report, `hasPackageJson:false`, zero SC rules; scan OK |
| Malformed `package.json` JSON | treated as absent for rule purposes + `log.warn`; no throw |
| No `package-lock.json` | report keeps declared ranges; `lockfilePresent:false`; SC-03 still allowed if audit ran |
| `npm` not on PATH / spawn error | `AuditState='unavailable'`; audit-derived rules silent; static rules (SC-01) unaffected |
| audit timeout (15 s) | kill child, `unavailable`, log reason |
| audit non-JSON stdout | `unavailable`, reason `parse` |
| `.github/dependabot.yml` exists but no npm ecosystem | still counts as missing for npm (R3 wording) |
| Webview `runSupplyChainAudit` while one is in flight | second request ignored (single-run, R7) |

Every failure path is *inside* the supply-chain layer — the outer
advisoryEngine already wraps rule evaluation in try/catch, so a malformed
report can never error the whole scan (pattern proven by FEAT-029).

## Test Strategy

Matches `src/agentic-detector/*.test.ts`: Vitest, **pure functions fed
string/JSON inputs** — no VS Code host in unit tests.

- `packageJsonParser` / `lockfileParser` / `botConfigDetector` /
  `semverLite` / `auditReducer`: table-driven unit tests incl. the exact
  repo scenario (override `undici:"7.28.0"`, patched `7.29.0` → stale).
- `scanner.scanWorkspace`: fixture dirs under `src/test/fixtures/supply-chain/`
  via an in-memory `SupplyChainFsDeps` (mirrors how `SignalScanner` tests
  inject findFiles/readFile fakes). Covers R2, R14 (double-run identity).
- `supplyChainRules` through `advisoryEngine.generate(profile)`: use
  `testUtils.makeProfile` extended with `supplyChain` — asserts R3 exact
  count=1, R9 per-package SC-02 ids, R10 action payloads, dismissal ids.
- `ActionExecutor` tests: R5 non-destructive create-file with existing
  file (fake fs).
- `auditRunner` (R7/R8): spawned against a tmp fixture with a stub
  `npm` (`process.execPath` + inline script) covering ok / timeout /
  garbage-output; the three `AuditState` transitions asserted.
- `AdvisoryPanel.test.tsx`: R12 section renders counts/state; hidden when
  report empty.
- Traceability: each `R<n>` ↔ ≥1 named test recorded in tasks closure.

## Performance & Size

Static scan adds 3 small file reads + pure parsing (< 5 ms typical; no
glob walks). `SupplyChainReport` is a few KB — no VSIX impact (< 300 KB
goal preserved). Activation cost zero: everything lazy behind the first
scan. No new npm dependency; `child_process`, `yaml`, and the FEAT-032
action vocabulary already exist.

## Discarded Alternatives

- **`semver` npm package** for pin-vs-patched comparison → rejected:
  needs is exact `x.y.z` compare (override pins are concrete versions,
  ranges skipped); a 30-line pure `semverLite` is fully testable.
  DESIGN.md requires naming an existing-dep alternative: none of
  `yaml`/React tools offer version compare, so a pure internal util wins
  over a new dep (zero-dep constraint).
- **`deprecate`/`snyk`/`npm-outdated` libraries or OSV.dev API** →
  rejected outright: violates §6 *no external HTTP* and adds deps.
  `npm audit` locally already resolves the advisory data; GitHub alerts
  are read by humans via `gh` CLI (explicit non-goal).
- **Dedicated 5th webview tab (like OptimizerPanel)** → rejected: the
  advisory loop already surfaces suggestions + actions; a section in
  AdvisoryPanel keeps the data next to the rules that consume it and
  avoids another coordinator + message round-trip.
- **Running `npm audit` automatically per scan** → rejected: violates
  user trust/R6 (network-touching tooling launched silently); also adds
  multi-second latency to a watch-triggered debounced loop.
- **Extending FEAT-034 optimizer instead of the advisory engine** →
  rejected: optimizer scores *architecture files*, not workspace health;
  the suggestion+action loop (FEAT-029/031/032) is the established home
  for actionable workspace advice.

## Non-goals (binding)

No GitHub REST/API calls; no auto-writes without the user's click on an
action; no new npm dependencies; no LLM in detection or scoring; no
workspaceState persistence of audit payloads (session-only cache).
