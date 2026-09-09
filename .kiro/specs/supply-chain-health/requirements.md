# Requirements — Supply-Chain Health (FEAT-036)

> Feature FEAT-036 from `feature_list.json`. Supply-chain observability and
> remediation for any workspace, wired into the existing advisory loop
> (FEAT-029/031 engine, FEAT-032 suggestion actions). Detects missing
> dependency-update bots, stale security `overrides` pins versus patched
> versions reported by a user-triggered local `npm audit`, and classifies
> audit findings by dependency scope (prod vs dev). Deterministic only —
> no LLM in detection or scoring, no new npm dependencies, no external
> HTTP calls from extension code.
>
> Each requirement is written in strict EARS and is verifiable by at least
> one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Terms

- **SupplyChainReport** — the deterministic output of parsing workspace
  dependency manifests (`package.json`, `package-lock.json`, bot-config
  presence). Pure data; no process launches, no network.
- **Audit payload** — the parsed JSON of a single user-triggered
  `npm audit --json` run, cached in-memory for the session.
- **SC suggestion** — a suggestion emitted by the `SC` rule family in the
  advisory engine.

## Requirements

### R1 — Static supply-chain report
- **Pattern:** Ubiquitous
- The system SHALL parse the workspace's `package.json` and, when present,
  `package-lock.json` into a `SupplyChainReport` containing the direct
  `dependencies` set, the `devDependencies` set, every `overrides` entry
  (key and pinned range), and the lockfile presence with resolved versions
  for each direct dependency.

### R2 — Non-Node workspace degrades to silence
- **Pattern:** Unwanted
- If a workspace contains no `package.json` at its root, the supply-chain
  scanner SHALL return an empty report and the advisory engine SHALL emit
  no SC suggestion, and the enclosing scan SHALL complete without error.

### R3 — Missing dependency-update bot detection (SC-01)
- **Pattern:** Event
- WHEN a scan completes for a workspace whose report has a `package.json`
  and whose files contain neither a Dependabot configuration
  (`.github/dependabot.yml` or `.github/dependabot.yaml` declaring the
  `npm` ecosystem) nor a Renovate configuration (`renovate.json`,
  `renovate.json5`, or `.renovaterc`), the advisory engine SHALL emit
  exactly one SC-01 suggestion titled to add a dependency-update bot.

### R4 — Dependabot scaffold action payload
- **Pattern:** Ubiquitous
- The SC-01 suggestion SHALL carry a `create-file` SuggestionAction whose
  payload `relPath` is `.github/dependabot.yml` and whose payload
  `template` declares both the `npm` and `github-actions` ecosystems with
  a weekly update schedule, grouped `minor` and `patch` updates, and
  coverage of both production and development dependencies.

### R5 — Non-destructive scaffold execution
- **Pattern:** Event
- WHEN a `create-file` action is executed for a path that already exists,
  the ActionExecutor SHALL leave the existing file unmodified and SHALL
  open it in the editor instead.

### R6 — Audit only on explicit user action
- **Pattern:** Ubiquitous
- The extension SHALL launch an `npm audit` child process only in direct
  response to an explicit user action (command palette or panel button),
  and SHALL NOT launch it during workspace scans, activation, or
  file-watcher events.

### R7 — Single bounded audit run with cached result
- **Pattern:** Event
- WHEN the user triggers *Run npm audit*, the system SHALL execute
  `npm audit --json` exactly once as a local child process with a 15-second
  timeout, SHALL cache the parsed JSON payload in memory for the current
  session, and SHALL schedule a re-scan on completion.

### R8 — Audit failure degrades, never breaks the scan
- **Pattern:** Unwanted
- If the audit child process fails to spawn, exceeds its 15-second
  timeout, or exits with output that is not parseable JSON, the system
  SHALL record audit state `unavailable`, SHALL emit no audit-derived
  suggestion, and SHALL complete the current scan without error.

### R9 — Stale security-override detection (SC-02)
- **Pattern:** Event
- WHEN the cached audit payload reports a fixed-in version for a package
  that is higher than the version pinned for that same package key in
  `package.json#overrides`, the advisory engine SHALL emit one SC-02
  suggestion per such package naming the package, the current pin, and
  the patched version.

### R10 — Remediation command actions
- **Pattern:** Ubiquitous
- Every audit-derived SC suggestion SHALL carry a `run-command`
  SuggestionAction with payload command `npm audit fix`, and the SC-02
  suggestion SHALL additionally carry a `run-command` action with payload
  command `npm outdated`.

### R11 — Production vs development scope classification
- **Pattern:** Ubiquitous
- The system SHALL classify every audit finding as `production` or
  `development` using the dev metadata in the audit payload and the
  lockfile, and the `SupplyChainReport` SHALL expose the findings and the
  counts per scope separately.

### R12 — Panel surfacing
- **Pattern:** State
- WHILE the Advisory panel displays a profile whose `SupplyChainReport` is
  non-empty, the panel SHALL render a *Supply Chain* section showing the
  production and development finding counts and the audit state
  (`not-run`, `unavailable`, or `captured`).

### R13 — No network from extension code
- **Pattern:** Ubiquitous
- The extension code SHALL NOT perform any external HTTP or network
  request for supply-chain analysis; the only acquisition paths are
  workspace file reads and the user-triggered local `npm` process of R7.
  *(Positive counterpart: R1, R3, R7.)*

### R14 — Deterministic output
- **Pattern:** Ubiquitous
- Two scans of an unchanged workspace with an identical cached audit
  payload SHALL produce byte-identical `SupplyChainReport` objects and an
  identical ordered list of SC suggestions (same ids, titles, payloads).

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|------------|
| Node workspaces get a parsed deps/devDeps/overrides/lock report | R1 |
| Non-Node workspaces are silent and error-free | R2 |
| Missing dependabot/renovate config raises exactly one SC-01 | R3 |
| SC-01 offers a working, grouped, weekly npm+github-actions scaffold | R4 |
| Scaffolding never overwrites an existing config | R5 |
| No surprise `npm audit` processes; user-triggered only | R6 |
| One bounded audit run, cached, triggers re-scan | R7 |
| Broken/absent npm audit never breaks the scan | R8 |
| Stale `overrides` pin (e.g. undici 7.28.0 vs 7.29.0) raises SC-02 with versions named | R9 |
| One-click remediation commands on audit suggestions | R10 |
| Prod vs dev breakdown visible | R11 |
| AdvisoryPanel shows counts + audit state | R12 |
| Extension makes zero external HTTP calls | R13 |
| Repeated scans are reproducible | R14 |
| Dogfooding: this repo has `.github/dependabot.yml` and a fresh undici override, `npm audit` dev findings drop to 0 | R3, R4, R9 (tasks T1) |
