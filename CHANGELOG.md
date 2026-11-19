# Changelog

All notable changes to Harness Dashboard are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **On test counts:** Every feature in this project that has `"sdd": true` in
> `feature_list.json` goes through Spec-Driven Development. Each spec adds a set
> of EARS requirements (R1..Rn), each requirement has one or more corresponding
> unit tests. The test count therefore grows by 5–30 per feature — it is not
> a fixed metric but a direct reflection of the requirement surface. Test counts
> in this changelog are informational checkpoints, not targets.

---

## [0.9.0] — 2026-11-19

> **Bring Your Own Harness.** Every capability reads, evaluates and prices the harness a workspace already has, built-in format or declared profile, without assuming a framework. 1024 unit tests and 19 Extension Host runs pass; the VSIX is 346,545 bytes.

### Added

- **Source ownership and profiles** (FEAT-041): each resource keeps its provider, native identity and path; one host decision (`OperationGate`) governs every visible and executable operation by owner capability. Custom layouts are declared as **harness profile v1** in `.harness-dashboard/config.json`; other extensions register providers through the read-only **companion API v1** returned by `activate()`.
- **Context cost** (FEAT-044): per-session token cost per provider from owner-declared load modes (baseline, skill catalog, on demand), unknown modes listed but never priced as zero, optional money estimates from a user price table (`harness-dashboard.cost.prices`, nothing fetched), a local ledger of the Dashboard's own model usage, and an on-request comparison with git HEAD. Informational cost findings K01–K03 never affect scores.
- **Native views presentation** (FEAT-046): Sources and Findings show type icons from one vocabulary shared with whiteboard badges (person, robot, lightning bolt, steering wheel, hook, flag…), an **Open Dashboard** entry, per-resource type · load mode · tokens · score, per-provider session cost, and findings coloured like the Problems view, with escaped, untrusted Markdown tooltips.

### Changed

- **Advisory** (FEAT-042): findings come from attributed evidence and are qualified by owner (`<rule>@<provider>`); maturity follows capabilities rather than detected frameworks; earlier dismissals migrate once.
- **Optimizer** (FEAT-043): each component is evaluated only against rules its format supports; components nothing could evaluate show coverage instead of a score; fixes and delegation follow the owner's operations.
- **Startup and Activity Bar** (FEAT-045): activation registers only (51–55 ms measured in the Extension Host); the first scan waits until a Harness view or the Dashboard is shown, and changes while nothing is visible only mark results stale. The Activity Bar container, now "Harness", holds native **Sources** and **Findings** tree views with welcome content for no folder, a running scan and a workspace without a detected harness. The sidebar webview is gone: the Dashboard is one editor panel, restored after a reload on its last tab, whose tabs load on first display. A five-step walkthrough covers the Dashboard, sources, profiles, findings and context cost. **Re-scan Agentic Architecture** leaves the Command Palette; use **Refresh**.
- **Smaller package** (FEAT-047): the VSIX drops from 390 KB to 334 KB. The deprecated `@vscode/webview-ui-toolkit` gives way to native controls styled from the editor theme, and the icon is palettised. The **Specs Manager** tab appears only when a provider supplies feature or spec data.
- **Internal quality** (FEAT-048): one definition for duplicated adapter, rule, webview and test helpers; every git call goes through the guarded runner (`core.fsmonitor` disabled, no shell); `check.sh` now fails when unit tests fail.
- Releases 0.1.0–0.8.0 move from this file to [docs/changelog](https://github.com/marcmassa/harness-manager/blob/main/docs/changelog/README.md).

### Removed

- **Supply-chain audit** (FEAT-036, FEAT-047): the **Run npm Audit** command, the supply-chain Advisory suggestions and their section. It checked a workspace's npm dependencies rather than its agent harness; run `npm audit` directly instead. Dismissals of those suggestions are ignored.

## [0.8.2] — 2026-11-08

> Dependency and CI maintenance release incorporating every commit since `v0.8.1`. No new user-facing features, commands, settings, or intended whiteboard behavior changes. All 819 unit tests pass.

### Changed

- **Runtime dependencies** (#21, `d7c1c54`): `@xyflow/react` 12.11.6 → 12.12.0, `react` and `react-dom` 19.2.8 → 19.3.0, and `yaml` 2.9.0 → 2.9.1.
- **Development tooling** (#21, `d7c1c54`): `vitest` and `@vitest/coverage-v8` 5.0.0 → 5.0.2, and `mocha` 12.0.0 → 12.0.2. React type packages move to 19.3.0 through the lockfile.
- **GitHub Actions**: `actions/setup-node` 7.0.0 → 7.1.0 (#22, `c4bbe46`) and `codecov/codecov-action` 5.5.5 → 7.1.1 (#19, `2a3e550`). Both remain pinned to full commit SHAs in CI; the setup-node update also applies to the publish workflow.
- **Release metadata**: package and lockfile version bumped to 0.8.2; the React Flow migration source-contract assertion now tracks the current release version.

### Fixed

- **VSIX packaging compatibility**: `@types/vscode` is pinned to **1.85.0**, matching `engines.vscode@^1.85.0`. The 1.138.0 declaration introduced by #21 caused `vsce package` to reject the extension before producing an artifact; packaging now retains the declared VS Code 1.85 compatibility floor.

### Security snapshot

- `npm audit --omit=dev --json`: **0 production vulnerabilities** on 2026-11-08.
- `npm audit --json`: **18 development-tree findings** (7 high, 10 moderate, 1 low) on the same date. This release does not claim to remediate them; the affected packages and follow-up are recorded in [`docs/security/0.8.2.md`](docs/security/0.8.2.md) and the project backlog.
- The README screenshots remain hosted assets and are excluded from the VSIX; the existing package gate still enforces the 400,000-byte budget and required runtime entries.

---

## [0.8.1] — 2026-09-09

> **Three features, one release.** **Supply-Chain Health** (FEAT-036): the advisory loop gains a deterministic view of your dependency graph — missing update-bot config, stale security `overrides`, and prod-vs-dev audit findings — with one-click remediation. **React Flow 12 & React 19 migration** (FEAT-037): the whiteboard's graph runtime moves from `reactflow@11` + React 18 to `@xyflow/react@12` + React 19 with full behavior parity — and the v12 drag threshold closes a latent click-jitter-as-drag corruption path. **VSIX Asset Diet** (FEAT-038): README screenshots no longer ship inside the package (1,899,264 B → 361,604 B, −81%; they now render from GitHub raw URLs), and the size budget — amended to 400 KB by ADR-005 after the T9 measurement — is enforced by a packaging gate locally, in CI, and before publish, retiring the FEAT-037 size waiver. No user-visible regressions; **zero new runtime dependencies** (a swap, plus types-only devDependencies). All 819 unit tests pass.

### Added

#### Supply-chain scanner (`src/supply-chain/`)

- **Pure, deterministic modules** — `packageJsonParser` (deps / devDeps / `overrides` maps), `lockfileParser` (resolved versions + dev flags), `botConfigDetector` (Dependabot YAML parsed with the existing `yaml` package; Renovate presence), `semverLite` (numeric-dot compare — chosen over a `semver` dependency, see spec Discarded Alternatives), `auditReducer`, and a `scanner` orchestrating them behind an injected `{readFile, exists}` — the same DI pattern as `SignalScanner`. No `vscode` import anywhere; non-Node workspaces degrade to silence.
- **`SupplyChainReport`** attached to the advisory profile: declared and resolved versions, bot-config map, and an `AuditSummary` exposing prod/dev finding **counts and list** plus audit state (`not-run` / `unavailable` / `captured`).

#### SC rule family in the advisory engine

- `sc-add-update-bot` (SC-01) — fires exactly once when a Node workspace has neither a Dependabot `npm` config nor Renovate. Carries a `create-file` action scaffolding a vetted `.github/dependabot.yml` (npm + github-actions, weekly, grouped minor/patch, prod+dev).
- `sc-stale-override:<pkg>` (SC-02) — when a cached audit reports a patched version higher than a pinned `package.json#overrides` entry, names package, current pin and patched version. Stable per-package IDs keep dismissal persistence working.
- `sc-audit-findings` (SC-03) — aggregate summary with remediation actions while any finding remains.
- Actions reuse the FEAT-032 `SuggestionAction` vocabulary unchanged: `create-file` (non-destructive — an existing file is opened in the editor, never overwritten) and `run-command` (`npm audit fix`, `npm outdated`).

#### Audit execution edge — user-triggered, bounded

- `harness-dashboard.runSupplyChainAudit` command (palette + AdvisoryPanel button) runs **one** `execFile('npm', ['audit','--json'])` with a 15 s timeout, caches the payload for the session, and schedules a re-scan. Never launched during scans, activation, or watcher events (`noAutoAudit.test.ts` pins it); spawn/timeout/parse failures degrade to `unavailable` without breaking the scan.
- AdvisoryPanel gains a *Supply Chain* section: prod/dev counts, audit-state badge, Run-audit button — hidden for non-Node workspaces.

### Security / dogfooding

- **This repository now ships the config SC-01 prescribes**: `.github/dependabot.yml` added (npm + github-actions ecosystems, weekly, grouped minor/patch, dev + prod).
- **Stale security override fixed**: `overrides.undici` `7.28.0` → `7.29.0` (GHSA-4cwx-7wf7-3272 and four others), lockfile refreshed.
- `npm audit` — **0 vulnerabilities** (was 8: 7 high + 1 moderate, all dev-transitive at write-time, 12 alerts open on the default branch before this release).

### Changed

- `ActionExecutor` `create-file` existing-file branch now opens the file in the editor before returning (ADR-004) — completes R5's second clause for every action caller; write/skip semantics otherwise unchanged.
- **Packaging (internal tooling, FEAT-038 + ADR-005)**: `npm run package`, CI, and publish now enforce a size + listing gate (`scripts/vsix-gate.sh`) — VSIX < 400,000 B, zero README-screenshot entries, required icons/dist bundles present, plus a non-blocking ≥80% budget-utilization review signal; zero `src/` or runtime-dependency changes.

### Changed — React Flow 12 + React 19 (FEAT-037)

- **Dependency swap, zero new runtime packages**: `reactflow@^11.11.4` → `@xyflow/react@^12.11.6`; `react`/`react-dom` `^18.2.0` → `^19.0.0`. The only additions are types-only devDependencies (`@types/react@^19`, `@types/react-dom@^19`), required by `@xyflow/react`'s peer types. The webview still mounts via `react-dom/client` `createRoot` (already React-19-clean — design audit found zero `ReactDOM.render`, zero `defaultProps`).
- **Import surface** (7 files): `ReactFlow` is now a named export, the stylesheet moved to `@xyflow/react/dist/style.css`, and node/edge typing went generic-first — new `src/webview/nodeTypes.ts` (`FlowNodeData` / `HarnessFlowNode` / `HarnessNodeProps`) replaces the v11 `data: any` hole; `layoutUtils` dropped its `as any` position casts for `Position.Top/Bottom`.
- **Click-vs-drag fix (R6)**: `nodeDragThreshold={1}` is set explicitly. Under v11's default (0), any mousedown with ≥1 px of pointer jitter started a "drag" — and our FEAT-017 recorder persists final drag positions, so click noise silently corrupted the manual-position store. With threshold 1 a click is a click; intentional dragging and the pill-linking UX (which `stopPropagation`s before the drag machinery sees it) are unaffected.
- **Behavior parity (R1/R7)**: identical node set, layout geometry (pure-math `layoutUtils`, never reads v12's `measured` dims — inert here), per-type edge styling and the 1000/500/0 z-index layering for all 8 edge kinds; v12 additionally no-remounts edges on z-index change (smoother hover).
- **FitView easing**: v12 typed `ease` as a function; the legacy `ease: 'ease-in-out'` string was never a valid d3 resolver name and had no effect — removed, so v12's default cubic-in-out over 400 ms matches the pre-migration animation.
- **Verification**: +40 new tests (813 total, 57 files) pinning the source contract, the immutable-update-path invariant, and per-edge-kind parity; `tsc --noEmit` error lines fell repo-wide from 2 364 to 233 as real React 19 types landed (zero new errors in the migrated files — the webview type-check gate is deliberate backlog); VSIX grew +27 KB zipped (1.78 → 1.81 MB, dominated by pre-existing README screenshots — see the spec's `size-report.md`).

### Technical

- 92 new tests (FEAT-036) + 40 migration-parity tests (FEAT-037) — **813 total, 57 files**; `./check.sh` green including adapter-sync and governance gates.
- Zero new runtime dependencies across the release; extension code still performs no external HTTP. (FEAT-037's only additions are the two types-only devDependencies.)

---

## Earlier releases

Releases 0.1.0 to 0.8.0 are in the [changelog archive](https://github.com/marcmassa/harness-manager/blob/main/docs/changelog/README.md), kept out of the packaged extension to stay within the VSIX size budget (ADR-005).
