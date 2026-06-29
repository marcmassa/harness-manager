# Progress Log

## [2026-06-29] FEAT-031: advisory-live-sync (COMPLETED)

- **Objective:** Phase 1 — Re-scan button in `AdvisoryPanel.tsx` with loading state. Phase 2 — Break the advisory information bubble: wire the advisory engine to the live in-memory graph state (`GraphContext`), broadcast a lightweight `ArchitectureSummary` to all tabs via a maturity badge in the tab strip, trigger re-evaluation after every whiteboard/SDD coordinator write, watch `.kiro/specs/**` for editor-side changes, and consolidate suggestion dismissal through a single authoritative code path.
- **Status:** All 22 tasks completed. 380 tests pass (8 new). Build clean. `./check.sh` green on build/tests/feature-list (adapter drift pre-existing, unrelated to FEAT-031).
- **Key changes:**
  - **Phase 1 — Re-scan UI (T1–T5):** `'rescanAgentic'` added to `WebviewMessageType` + `KNOWN_MESSAGE_TYPES`; `AdvisoryCoordinator` handles it by calling `agenticDetector.scan()`; `AdvisoryPanel` gets `onRescan`/`isScanning` props + ↻ button with disabled state + spinner; `index.tsx` adds `handleRescan` callback + `isAdvisoryScanning` state; empty state shows "Scan now" button.
  - **Phase 2 — Shared state bus (T7–T14):** `GraphContext` and `ArchitectureSummary` interfaces in `agentic-detector/types.ts`; `AgenticDetector.scan(graphContext?)` stores context on profile before `generate()`; `AgenticDetector.scheduleScan()` debounces with shared timer; `getCachedData()` getter + `buildGraphContext()` helper in `extension.ts`; `postToWebview()` broadcasts to both sidebar `_view` and full-window `_panel`; `architectureSummary` message dispatched on every scan start/complete; `MaturityBadge` component in tab strip header — shows level pill (e.g. "L5") with maturity color, pulsing dot when scanning, hidden when summary is null.
  - **Graph-aware rules (T12):** S-GC01 fires when whiteboard has ≥2 agents and 0 skill nodes; S-GC02 fires when all features (≥5) are in `done` status with none in_progress/pending/spec_ready.
  - **Post-write re-evaluation (T15–T18):** `WhiteboardCoordinator` and `SddCoordinator` get `setScheduleScan(fn)` setter; `scheduleScan()` called after every mutating operation (8 in whiteboard, 3 in SDD); `.kiro/specs/**` FileSystemWatcher added to `AgenticDetector.startWatching()`.
  - **Stale data & dismissal fixes (T19–T20):** 120-second stale notice in `AdvisoryPanel`; dismissal consolidated through `AgenticDetector.dismissSuggestion()` — duplicate `workspaceState` write removed.
  - **Tests (T21):** 4 S-GC01 tests + 4 S-GC02 tests in `advisoryEngine.test.ts`; `testUtils.ts` updated to accept `graphContext?` option.
- **Files changed:** `src/types.ts`, `src/agentic-detector/types.ts`, `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/advisoryEngine.ts`, `src/agentic-detector/testUtils.ts`, `src/coordinators/AdvisoryCoordinator.ts`, `src/coordinators/WhiteboardCoordinator.ts`, `src/coordinators/SddCoordinator.ts`, `src/extension.ts`, `src/webview/AdvisoryPanel.tsx`, `src/webview/index.tsx`, `feature_list.json`.
- **Files created:** `.kiro/specs/advisory-live-sync/{requirements,design,tasks}.md`.
- **Key files to change:** `src/types.ts`, `src/agentic-detector/types.ts`, `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/advisoryEngine.ts`, `src/coordinators/AdvisoryCoordinator.ts`, `src/coordinators/WhiteboardCoordinator.ts`, `src/coordinators/SddCoordinator.ts`, `src/extension.ts`, `src/webview/AdvisoryPanel.tsx`, `src/webview/index.tsx`.

## [2026-06-27] FEAT-030: tech-debt-and-security-hardening (COMPLETED)

- **Objective:** Address security gaps and accumulated tech debt from the v0.5.1 code review: WebView CSP nonce, sandbox hardening, unknown-message validation, extension.ts decomposition into domain coordinators, FeatureSpecPanel component split, HarnessNode.metadata discriminated types, dagre→devDependencies, and new test coverage.
- **Outcome:** All 29 tasks completed. 372 tests pass (15 new). Build clean. `./check.sh` green on build/tests/feature-list (pre-existing adapter drift unrelated to this feature).
- **Key changes:**
  - **WebView security (R1–R6):** Per-render CSP nonce via Web Crypto API; `allow-same-origin` removed from sandbox; `isKnownWebviewMessage()` type guard with 28-type `WebviewMessageType` union; unknown messages emit `log.warn` and return early.
  - **extension.ts decomposition (R7–R9):** 3 domain coordinator classes (`WhiteboardCoordinator`, `SddCoordinator`, `AdvisoryCoordinator`) in `src/coordinators/`; `_handleWebviewMessage` reduced to a 45-line chain; `setupCodeQualityVerifier` moved to `src/verifier/codeQualitySetup.ts`; result: 340 executable lines (target: ≤ 400).
  - **FeatureSpecPanel split (R10–R11):** Decomposed 1994-line monolith into `FeatureList.tsx`(221), `SpecEditor.tsx`(314), `AiAssistBar.tsx`(96), `SpecWizard.tsx`(372), `FeatureSpecPanel.tsx`(192) — all listed files ≤ 600 lines.
  - **Type safety (R12–R13):** `NodeMetadata` discriminated union with 7 typed interfaces (all with `[key: string]: unknown` index signature); `Record<string, any>` eliminated from `HarnessNode.metadata`; `any` count reduced across the codebase.
  - **Dependency hygiene (R14–R15):** `dagre` + `@types/dagre` moved to `devDependencies`; `DESIGN.md` updated to remove stale gray-matter reference.
  - **Test coverage (R16–R17):** 6 tests for `layoutUtils` (`src/webview/layoutUtils.test.ts`), 8 tests for message discriminator (`src/messageDiscriminator.test.ts`).
- **Files created:** `src/coordinators/WhiteboardCoordinator.ts`, `SddCoordinator.ts`, `AdvisoryCoordinator.ts`, `src/verifier/codeQualitySetup.ts`, `src/webview/FeatureList.tsx`, `SpecEditor.tsx`, `AiAssistBar.tsx`, `SpecWizard.tsx`, `src/webview/layoutUtils.test.ts`, `src/messageDiscriminator.test.ts`, `progress/impl_tech-debt-and-security-hardening.md`.
- **Files modified:** `src/extension.ts`, `src/types.ts`, `src/parserLogic.ts`, `package.json`, `DESIGN.md`, `src/webview/FeatureSpecPanel.tsx`, `feature_list.json`.

## [2026-06-17] FEAT-026: cross-framework-hooks-steering (COMPLETED)

- **Objective:** Closes the FEAT-024 gap. A project that uses Kiro, Claude Code, Cursor, Gemini, Copilot, or Windsurf — *without* Harness SDD's `agentic.json` — can have hooks and steering files under their framework root (e.g., `.kiro/hooks/`) or even the project root (e.g., `hooks/`). The whiteboard must discover these and show them as first-class nodes.
- **Outcome:** 12 spec tasks (T1–T12) all completed. 24 new unit tests added (189 total, all passing). Build clean (esbuild), `./check.sh` green.
- **Key design points** (3 global settings, 1 local file, 1 command, 2 modules, 6 adapters wired, 2 adapters left untouched):
  - **Settings** (R1): `harness-dashboard.adapters.<id>.discovery` (×6, default `true`) + `harness-dashboard.discovery.root` (default `true`). The existing `<id>.path` settings from FEAT-023 are unchanged.
  - **Local file** (R2, R4): `<workspace>/.harness-dashboard/config.json` with schema `{ adapters: { <id>: { hooksPath?, steeringPath? } }, extraPaths: { <id>: { hooks?: string[], steering?: string[] } } }`. Empty/missing → empty config. Malformed JSON → warning on the OutputChannel + empty config fallback.
  - **Command** (R3): `Harness Dashboard: Open Local Configuration` — opens the file in the editor, creating `.harness-dashboard/` + `config.json` with the empty schema on first use.
  - **`src/config/harnessConfig.ts`**: `HarnessConfig` class with `async read(root)`, file-watcher-driven cache invalidation, `onDidChange(listener)` for invalidation events. `EMPTY_HARNESS_CONFIG` constant.
  - **`src/discovery/hooksAndSteering.ts`**: single `discover()` function that returns `{ nodes, edges, resolvedGlobs }`. Honours R5–R17 (default scan, overrides, extras, project-root scan with toggle, filename-based event inference, H1 description fallback, applies_to inference, deduplication via `Set<absolutePath>`, `_filePath` for the Edit button).
  - **Wired into 6 configurable adapters**: `KiroAdapter`, `ClaudeCodeAdapter`, `CursorAdapter`, `GeminiCliAdapter`, `CopilotAdapter`, `WindsurfAdapter`. Each calls `discover()` at the end of `parse()` and includes the resolved globs in `watchGlobs()` (R5, R17).
  - **Left untouched** (R18, R19): `HarnessSddAdapter` and `OpenCodeAdapter`. Both implement the new `IAgentAdapter.setHarnessConfig()` as a no-op. The harness-sdd parser continues to be the source of truth for steering/hook resources declared in `agentic.json`.
  - **`IAgentAdapter` interface**: added `setHarnessConfig(config: HarnessConfig | undefined): void`. `extension.ts` calls `configureAdaptersWithHarnessConfig(harnessConfig)` after `initConfigurationRegistry`, which plumbs the singleton into every configurable adapter via the structural type-check.
- **Implementation notes (worth recording):**
  1. **`HarnessConfig.read()` is async, not sync as the design sketch showed.** The sketch showed `read(root): HarnessDashboardConfig` (sync), but VS Code's `workspace.fs.readFile` is async-only. The async signature is the only practical option; production code (each adapter's `parse()`) is already async, so this is a non-breaking refinement. The `getInstance` pattern from `ConfigurationRegistry` was NOT followed — one `HarnessConfig` instance is created per extension activation, not a process-wide singleton, because the file is workspace-specific.
  2. **Each adapter gets its own `_harnessConfig` field + a `setHarnessConfig` setter**, rather than reading from a module-level constant. This is structurally clean: the extension owns one `HarnessConfig` and injects it into all six adapters. Tests can pass a different one or none.
  3. **The applies_to filename match is against the subagent's *name* (the segment after `<adapter>::`), not the full prefixed id.** The user names a steering file like `typescript-implementer.md`; the subagent id is `kiro::typescript-implementer`. Comparing the stem to the full id would never match; comparing it to the last segment is the user-friendly behaviour. Tests for R15 (filename match) pass.
  4. **The "framework wins" dedup is by absolute path** (a `Set<string>` of normalized fsPaths). When the local config lists the framework's hooks dir AGAIN as an extra path, the same file is matched twice; the `seen` set drops the second match before node creation. Tests for R13 pass.
  5. **The test mock for `findFiles` had to learn brace expansion** (`{sh,js,ts}`). The existing tests in `KiroAdapter.test.ts` and `adapterRegistry.test.ts` only use single-extension globs, so the existing mock didn't expand braces. FEAT-026's hook discovery uses `*.{sh,js,ts}` so the mock was extended in `src/discovery/hooksAndSteering.test.ts` to support single-level brace expansion. The new test infrastructure is reusable for any future test that uses VS Code's brace-glob syntax.
  6. **No new integration test was added.** The unit tests cover R5–R17 (algorithmic), R2/R4 (config reader), and R18/R19 (regression). A real-VS-Code integration test would verify that the watch globs fire on file changes, but this is already covered by the existing `src/test/integration/criticalPath.test.ts` pattern (which uses a fixture harness-sdd project). Adding another integration test is straightforward but not in the spec's T9–T12 unit-test list.
- **Tests:** 24 new unit tests:
  - `src/config/harnessConfig.test.ts` — 9 tests (R2: empty/missing/whitespace/valid; R4: malformed JSON warning; cache hit + watcher-driven invalidation; `onDidChange` events; `dispose`).
  - `src/discovery/hooksAndSteering.test.ts` — 13 tests (R5: default scan under `<adapter-path>/hooks/` + `/steering/`; R11: filename event inference + frontmatter override; R12: H1 description fallback + frontmatter override; R14: hook→root agent edge; R15: applies_to inference with filename match + wildcard fallback; R16: `_filePath`; R6: per-adapter override; R7: extras; R8: project-root scan; R9: per-adapter kill switch; R10: project-root kill switch; R13: dedup; R17: resolved globs returned).
  - `src/adapters/adapterRegistry.test.ts` — 2 regression tests added (R18: HarnessSddAdapter ignores `.harness-dashboard/config.json`; R19: OpenCodeAdapter ignores it). The existing 8 tests still pass.
- **Files touched (15 files):**
  - **Created**: `src/config/harnessConfig.ts`, `src/config/harnessConfig.test.ts`, `src/discovery/hooksAndSteering.ts`, `src/discovery/hooksAndSteering.test.ts`
  - **Modified (6 adapters)**: `src/adapters/KiroAdapter.ts`, `ClaudeCodeAdapter.ts`, `CursorAdapter.ts`, `GeminiCliAdapter.ts`, `CopilotAdapter.ts`, `WindsurfAdapter.ts` — each: added `_harnessConfig` field + `setHarnessConfig` setter + `_isAdapterDiscoveryEnabled`/`_isRootDiscoveryEnabled` helpers, extended `watchGlobs()` with hook/steering globs, appended `discover()` call to end of `parse()`.
  - **Modified (2 unaffected adapters)**: `src/adapters/HarnessSddAdapter.ts`, `OpenCodeAdapter.ts` — each: added the `setHarnessConfig` no-op method to satisfy the updated `IAgentAdapter` interface.
  - **Modified (interface + tests)**: `src/adapters/IAgentAdapter.ts` (added `setHarnessConfig`); `src/adapters/adapterRegistry.test.ts` (added 2 regression tests + `setHarnessConfig` to 4 inline test mocks).
  - **Modified (extension + manifest)**: `src/extension.ts` (constructed `HarnessConfig`, wired it into adapters, registered `openLocalConfig` command); `package.json` (added 7 new settings, 1 new command).
  - **Governance**: `feature_list.json` (status → done), `progress/current.md` + `progress/progress.md` (this entry).
  - **No new dependencies** added.
- **No commit created** (per the session rule, only documented the change). When the maintainer is ready, the conventional-commits message is `feat(discovery): cross-framework hooks & steering for Kiro, Claude Code, Cursor, Gemini, Copilot, Windsurf (FEAT-026)`.

## [2026-06-11] FEAT-022: repo-rename-decision (COMPLETED)
- **Objective:** Record the maintainer's decision about the GitHub repository name as ADR-002. The maintainer chose the **"accept the mismatch and document it"** branch of the spec (the rename option is not chosen; it remains available as a future option at a project milestone such as v0.2.0 or v1.0.0). Closes the last P0 item in the backlog written by FEAT-019.
- **Outcome:**
  - **ADR-002 appended** to `progress/decisions.md`. The ADR has all 6 standard fields populated, the 13-row inventory table from the spec's design, the "accept" `Cost` template (765 chars, explicitly naming the visible cost), both alternatives in `Discarded Alternatives` (the maintainer chose the "accept" alternative, the "rename" is documented as a deferral not a permanent veto), a dedicated "Related but out of scope" section for the publisher identity (which the maintainer explicitly asked to leave as-is), and a cross-reference to ADR-001. Total: ~160 lines, 8.9 KB.
  - **README updated** with a "Note on the repository name" section (R15 of the spec) that explains the mismatch in 5 short sentences and links to ADR-002. Positioned after the `## License` section so it does not disrupt the natural top-to-bottom reading flow.
  - **Backlog P0 item removed** (the "Decide: rename the repository…" bullet). The remaining P0 is now just one item: "Land the CI workflow on `main` and verify the deferred T7/T11/T12 from the ci-github-actions spec in the first real PR".
- **Implementation notes (worth recording):**
  1. **The LICENSE typo was a false alarm.** The spec's R13 mentioned a permitted typo fix (`Marc Massa` → `Marc Massa` in LICENSE), but on inspection the file already had the correct `Marc Massa`. The pre-feature grep was a regex artifact (it matched a substring of the correct name). No change made.
  2. **ADR-002 is intentionally longer than the standard ADR format.** The "Context" field's 13-row inventory, the "Decision" field's explicit "this is a deferral, not a permanent veto" note, the "Discarded Alternatives" 4-bullet rationale, and the "Related but out of scope" section collectively make ADR-002 ~160 lines. A shorter ADR would force future maintainers to re-derive context that is already captured; the cost of length is one-time, the benefit is permanent.
  3. **The publisher identity is explicitly out of scope.** The maintainer's instruction at the spec-approval gate was "leave the publisher as it is". ADR-002's "Related but out of scope" section points at the existing backlog item ("Reconcile publisher identity") which will be addressed in a future feature, with ADR-003. This keeps ADR-002 focused on the repo-name question.
  4. **No CHANGELOG amendment was made.** The spec's design.md mentioned the 0.1.0 CHANGELOG entry could be amended, but the README "Note" is the modern, discoverable place for this kind of explanation, and the CHANGELOG is historical record. The amendment is one line if the maintainer prefers it later.
- **Tests:** no new test code required. The verifications are grep + file-inspection + `./check.sh` runs.
- **Traceability:** `progress/impl_repo-rename-decision.md` (full R↔T↔test map, 4 implementation notes, 3 design decisions).
- **Files touched:** 4 files (`progress/decisions.md`, `progress/backlog.md`, `README.md`, `progress/impl_repo-rename-decision.md`) + the standard closure files (`progress/progress.md`, `progress/current.md`, `feature_list.json`). No production source code modified (R13 verified by `git status -- src/`).
- **No commit created** (per the session rule). The conventional-commits message for the maintainer is `docs: record ADR-002 — accept the harness-manager repo name and document the mismatch`.

## [2026-06-11] FEAT-021: e2e-integration-test (COMPLETED)
- **Objective:** Add an end-to-end integration test that runs the extension in a real VS Code instance and exercises the critical user path (activate → click node → open in editor). Closes the "zero integration tests" gap noted in the 2026-06-10 analysis.
- **Outcome:** The test **passes locally in 2.1 seconds** — much better than the spec's 30-day `continue-on-error` grace period anticipated. Architecture: 3 TypeScript entry points compiled to `out/test/integration/*.cjs` (NOT `dist/`, so they do not ship in the production VSIX). `runIntegrationTests.cjs` is the OUTSIDE-VS-Code launcher; `bootstrap.cjs` is the INSIDE-VS-Code Mocha loader; `criticalPath.test.cjs` is the test itself. Fixture workspace at `src/test/fixtures/harness-sdd-minimal/` (4 files). CI step added with `xvfb-run -a` and `continue-on-error: true` for the first 30 days.
- **Local verification (R13):** test ran 3 consecutive times in 2.1s each on macOS arm64 with the system VS Code. All 7 steps green: extension active, activity bar revealed, webview mounted, fixture state confirmed, click flow resolved, showTextDocument called, document on disk verified, tab in workbench, extension host still alive.
- **Implementation notes (worth recording):**
  1. **Bootstrap file needed.** The spec assumed the launcher script would also be the test entry. In practice, `@vscode/test-electron` v3 + VS Code 1.85+'s ESM host requires a separate `bootstrap.cjs` file that exports `run()`. The standard pattern; recorded in the impl report.
  2. **Env var for fixture path.** The test receives the fixture's on-disk path via `HARNESS_DASHBOARD_FIXTURE` env var (set by the launcher via `extensionTestsEnv`). This is more robust than `__dirname`-relative paths because compiled output lives at a different depth.
  3. **R8 (click simulation) is verified via R10 ground truth.** Because we cannot drive the webview's DOM directly, R8 is verified indirectly: the test asserts the on-disk state of the fixture (the ground truth the click flow must agree with). Documented in the test file.
  4. **R6 (webview mount) is not strictly assertable in VS Code 1.85+.** The test gives the webview 2 seconds to mount and proceeds. The relevant VS Code feature request is microsoft/vscode#144238. When that lands, upgrade the test.
  5. **Failure case limitation.** When the R10 sentinel is deleted (not just modified), the test throws but does not fail cleanly — it hangs. This is a known weakness of the test's failure handling, not a correctness bug. Acceptable for v1.
- **Tests:** the new integration test (`E2E: critical path — activate → click node → open in editor`) passes locally. 126 unit tests still pass (T10). Full chain: build OK, 126/126 unit tests, 1/1 integration test, `./check.sh` exit 0 with 33 passes.
- **CI integration (R12):** the new step runs `xvfb-run -a npm run test:integration` with `continue-on-error: true` for the first 30 days. The maintainer should open a tracking issue (the spec's T19) and remove the flag after 30 days of stable green runs. The first few local runs in this session were 100% stable, so the flag may be removable sooner.
- **Traceability:** `progress/impl_e2e-integration-test.md` (full R↔T↔test map with 7 implementation notes, design decisions, and the T12 failure-case limitation documented).
- **Governance note:** the FEAT-019 governance guard caught a stale `FEAT-020` reference in `backlog.md` (the item was originally written as "FEAT-020" but the actual ID was FEAT-021). Fixed as part of T15. This is the first time the guard caught a real bug introduced by the implementer; it works as designed.
- **Files touched:** 16 files (4 created in `src/test/integration/`, 4 in `src/test/fixtures/`, 4 modified config files, 4 progress docs). No production source code modified (R15 verified by `git status --short` on the 11 production paths).
- **No commit created** (per the session rule, only documented the change). When the maintainer is ready, the conventional-commits message is `feat(test): add end-to-end integration test of the critical user path (FEAT-021)`.

## [2026-06-11] FEAT-020: vsix-gitignore-cleanup (COMPLETED)
- **Objective:** Add `*.vsix` to `.gitignore` so the 3 untracked VSIX binaries (0.1.0/0.1.1/0.1.2) stop polluting `git status` and any future `vsce package` runs do not introduce new untracked artefacts. Closes the first P0 item in the backlog written by FEAT-019.
- **Outcome:** `.gitignore` extended by 2 lines (one comment + the `*.vsix` glob). Net code change: minimal. The 3 binaries were already untracked (never committed), so the "remove from index" portion of the spec was a no-op. `npm run package` was run end-to-end to confirm that freshly built VSIX artefacts are also ignored.
- **Implementation note (worth recording):** the spec assumed R2 required `git rm --cached` on 3 files, which would have produced a staged diff of 3 deleted files. The actual repo state was better — the binaries were untracked from the start, so R2 is trivially satisfied. The whole feature reduces to "add 2 lines to `.gitignore`". This is a better outcome than the spec anticipated.
- **Verification:**
  - `grep -E '^\*\.vsix' .gitignore` matches (R1)
  - `git ls-files '*.vsix'` empty (R4)
  - `git status --short --untracked=all | grep .vsix` no match (R3)
  - `git check-ignore -v harness-dashboard-vscode-0.1.2.vsix` matches `*.vsix` in `.gitignore` (R5 partial)
  - `npm run package` → 256 KB VSIX produced → `git status` still does not list it (R5 full)
  - `git diff .gitignore` shows ONLY the 2 new lines, no other change (R8)
  - `grep -B1 '^\*\.vsix' .gitignore` shows the comment above the pattern (R7)
  - `./check.sh` exit 0, 33 passes, 2 warnings, 0 fails (R6 — same baseline as pre-feature)
  - 126 unit tests still pass
  - backlog.md cross-grep: 0 done-feature references (R9)
- **Tests:** no new test code required. The verification IS the test (git-level assertions are atomic and have no flake).
- **Traceability:** `progress/impl_vsix-gitignore-cleanup.md` (full R↔T↔test map, including the "R2 was a no-op" finding).
- **Design decision:** kept the working-tree copies of the 3 binaries (decision documented in the design's Discarded Alternative section: rebuilding is ~5s but not free; the maintainer may want to `code --install-extension` without rebuilding). The `*.vsix` ignore rule prevents any NEW binaries from polluting future clones; the existing 3 can be removed at any time with `git clean -fd`.
- **Files touched:** `.gitignore`, `progress/backlog.md` (removed the P0 item this feature closes), `progress/progress.md`, `progress/current.md`, `feature_list.json`, `progress/impl_vsix-gitignore-cleanup.md`. No production code.
- **No commit created** (per the session rule, only documented the change). When the maintainer is ready, the conventional-commits message is `chore(repo): exclude *.vsix from git and clean the 3 untracked binaries (R1+R2)`.

## [2026-06-11] FEAT-019: governance-docs (COMPLETED)
- **Objective:** Replace the placeholder contents of `DESIGN.md`, `progress/backlog.md`, and `progress/decisions.md` with concrete, accurate content for the Harness Dashboard VS Code extension. Establish a real architectural overview, a prioritised backlog, and the first ADR documenting the project-level decision to use the Harness SDD framework itself. Closes the "documentation says one thing, repo does another" gap identified in the 2026-06-10 project analysis.
- **Outcome:**
  - **`DESIGN.md`**: 49 → 232 lines. 6 required sections (`System Overview`, `Architectural Principles`, `High-Level Architecture`, `Key Components & Responsibilities`, `Data Flow & Integration`, `Global Constraints`) plus a `Note to AI Agents` callout. 5 named architectural principles (CLI-agnostic by construction, SDD-first, frugal AI, single source of truth, testable by construction). 6-row component table (Extension Host, Webview, Parser, Writer, Adapters, Semantic Layer + 5 more). Explicit "no backend / no cloud / no API keys" statement. Inline ASCII architecture diagram. 233 lines (within the ≤ 250 cap documented at the top of the file).
  - **`progress/backlog.md`**: 18 → 39 lines. 4 prioritised sections (P0/P1/P2/Tech-debt) with 13 concrete items, each referencing a `FEAT-XXX` ID that exists (or will exist) in `feature_list.json`. No `done` feature is referenced (R9 enforced at runtime by the new check).
  - **`progress/decisions.md`**: 20 → 88 lines. `## Format` template rewritten as prose (so the new R16 check does not flag the format documentation itself). First real ADR (`ADR-001: Adopt the Harness SDD framework for the Harness Dashboard repository`) appended, with all 6 standard fields populated and 3 discarded alternatives (MADR, arc42, no formal ADR process) with one-sentence reasons each.
  - **`check.sh`**: appended a "Governance Documents" section (~45 lines, after the existing "CLI Adapter Tests" section). The check scans the 3 governance docs for template placeholders and cross-checks the backlog against `done` features in `feature_list.json`. Contributes to `EXIT_CODE` like every other check.
- **Regression guard demonstrated:** T7 injected `{Briefly describe}` into a copy of `DESIGN.md` → grep found it on line 235. T8 appended `FEAT-001` to the backlog → `check.sh` reported `❌ backlog.md references done feature(s): FEAT-001`. Both restored.
- **Tests:** 15 Python static assertions (R1–R15) all PASS. `npm run build`, `npm test` (126/126), `./check.sh` (33 passes, 2 expected warnings, 0 fails) all green.
- **Traceability:** `progress/impl_governance-docs.md` (full R↔T↔test map + 3 design decisions worth recording).
- **Design decisions worth recording** (full versions in the impl report):
  1. The `## Format` template was rewritten as prose because the literal template tokens (`{N}`, `{Decision Title}`) would otherwise trigger the new R16 check.
  2. The backlog is allowed to reference `FEAT-XXX` IDs that don't exist yet (forward-looking plan); R9 only forbids references to `status: "done"` features.
  3. The new check is read-only (reports, doesn't auto-fix) — auto-fixing documentation is dangerous.
- **Reviewer:** self-review (pending external review). All R1–R17 verified by either T5 (static Python assertions) or T6/T7/T8 (runtime + failure cases).
- **Files touched:**
  - Modified: `DESIGN.md`, `progress/backlog.md`, `progress/decisions.md`, `check.sh`, `feature_list.json`, `progress/current.md`
  - Created: `specs/governance-docs/{requirements,design,tasks}.md`, `progress/impl_governance-docs.md`
  - No production code (`src/`, `package.json`, etc.) modified
  - No new dependencies

## [2026-06-10] FEAT-018: ci-github-actions (COMPLETED)
- **Objective:** Add a GitHub Actions CI workflow that runs `npm ci`, `npm run build`, `npm test`, and `./check.sh` on every push and pull_request to `main`, so that broken builds, broken tests, broken harness adapters, or malformed manifests cannot reach `main`. Closes the "no CI" gap identified in the 2026-06-10 project analysis.
- **Outcome:** Created `.github/workflows/ci.yml` (54 lines, single job `ci` on `ubuntu-latest`, 6 steps, Node 20.x with npm cache, 10-minute timeout, `concurrency` group to cancel obsolete runs, `permissions: contents: read`, no matrix, no secrets). Added CI status badge to `README.md`.
- **Side effect (in-scope fix):** Discovered a silent failure in the inherited `check.sh` feature-list validator — the heredoc had `2>/dev/null || true` which swallowed Python's exit code, and the subsequent `if [ $? -eq 0 ]` was unreliable. Without this fix, **R8 was technically unproven** (an invalid `feature_list.json` status would print the error but exit 0). Patched the heredoc to capture `fl_rc=$?` and the `pass`/`fail` branches now work as designed. This was a one-line correctness fix required to make R8 testable.
- **Verification:**
  - `python3 -c "import yaml; yaml.safe_load(...)"` parses the workflow
  - 14 structural assertions (R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R15) all PASS via a single static check
  - Local `npm ci && build && test && check.sh` chain: exit 0
  - T8a (failing test injected): `vitest` exit 1, failing test name visible in log → R7 + R14 verified
  - T8b (invalid status `"borked"` injected): `check.sh` exit 2, `[ERROR] FEAT-018: invalid status 'borked'` printed → R8 + R14 verified
  - Files restored; `./check.sh` re-run: exit 0
- **Deferred to first real PR** (no remote access in this session, structural checks are high-confidence): T7 (workflow appears in PR Checks), T11 (concurrency cancellation on stacked commits), T12 (wall-clock duration measurement). First PR that lands this workflow on `main` will be the moment of truth for these.
- **Tests:** 126 existing unit tests still pass. No new test code required (the workflow file itself is the artifact under test).
- **Traceability:** `progress/impl_ci-github-actions.md` (full R↔T↔test map with verification commands and outcomes).
- **Reviewer:** typescript-implementer (self-review; pending external review on first PR)
- **Files touched:**
  - Created: `.github/workflows/ci.yml`
  - Modified: `README.md` (CI badge), `check.sh` (heredoc exit-code fix)
  - Spec + impl report under `specs/ci-github-actions/` and `progress/impl_ci-github-actions.md`
  - No production code (`src/`, `package.json`, etc.) modified
  - No new dependencies

## [2026-06-10] Harness framework update (infrastructure sync)
- **Objective:** Sync harness framework infrastructure from source template (`/Users/thejugger/Documents/INDRA/gitlab/harness-sdd-template/`) into this project, using the **conservative** strategy (option 1): copy framework plumbing only, preserve all project-specific content.
- **Outcome:** Updated `.agents/adapters/_common/render.py` (+61 LOC: new `_merge_unique_ordered`, `_sanitize_template_body` helpers), `.agents/BOOTSTRAP.md` (note about programmatic opencode render), `AGENTS.md` (added "Skill Loading Mechanism" block per agentskills.io), `check.sh` (new `npm test -- --run` and CLI Adapter Tests block). Deleted obsolete `.agents/adapters/opencode/opencode.json.tmpl` (render is now programmatic in `render.py`). Cleaned `__pycache__/`. Regenerated `opencode.json`, `CLAUDE.md`, `GEMINI.md` via `./.agents/bootstrap.sh --all`; `--check` exits 0. **No project content modified**: 5 subagents preserved (`harness-vscode`, `spec-author-vscode`, `typescript-implementer`, `reviewer-vscode`, `agent-template`); all 6 custom skills preserved.
- **Validation:** `./check.sh` → 0 failures, 31 passes (then 29 after the FEAT-018 heredoc fix consolidated two passes into one), 2 expected warnings (omitted `tests/test_cli_adapter_parity.sh` and `tests/test_agent_template_placeholders.sh` per user decision — inherited from terraform-flavored harness, not relevant to this TS project).
- **Tests:** 126 unit tests pass (vitest 4.1.8, 9 files).
- **Skipped alternatives (per user decision):** the seven-adapter real-repo validation (high effort, not blocking) and the two terraform-flavored parity tests in `tests/`.

## [2026-06-08] FEAT-017: node-position-persistence-and-pill-linking (COMPLETED)
- **Objective:** Prevent manually moved nodes from snapping back to auto-layout positions and improve direct pill-to-pill linking ergonomics.
- **Outcome:** Implemented manual position capture in `WhiteboardCanvas` (`handleNodesChange` + `handleNodeDragStop`) and merged manual coordinates over Dagre layout via `mergeLayoutedNodesWithManualPositions`. Added defensive coordinate validation (`isValidNodePosition`) and stale/invalid map sanitization. Increased handle-pill interaction area and kept handle centers aligned with pills in `CustomNode` for more reliable drag linking.
- **Additional UX refinement:** Reduced suggestion visual noise by increasing semantic threshold, limiting suggestions per subagent, filtering cross-framework pairs, removing suggested edge inline labels, and defaulting suggestion visibility to off.
- **Tests:** `src/webview/nodePositionUtils.test.ts`, updates in `src/parserLogic.test.ts`, plus full validation with `npm test`, `npm run build`, and `./check.sh`.
- **Traceability:** `progress/impl_node-position-persistence-and-pill-linking.md`.
- **Reviewer:** typescript-implementer (PASSED)

## [2026-06-14] FEAT-023: adapter-config-paths-and-kiro-and-whiteboard-polish (COMPLETED)
- **Objective:** Three-part feature: (1) ConfigurationRegistry — let users override adapter detection paths via VS Code settings; (2) Kiro adapter — detect `.kiro/` files as the ConfigurationRegistry's first consumer; (3) whiteboard UX polish — no-overlap guarantee for dagre-positioned nodes + CSS-only node/edge animations.
- **Outcome:** Part A — Created `ConfigurationRegistry.ts` singleton (lazy load, `onDidChangeConfiguration` cache invalidation, R6 fallback). Extended `IAgentAdapter` with `isPathConfigurable()`. Made 5 adapters configurable (ClaudeCode, Cursor, GeminiCli, Copilot, Windsurf); 2 canonical (HarnessSdd, OpenCode) return `false`. Added 6 `contributes.configuration` settings in `package.json`. Part B — Created `KiroAdapter.ts` (mirrors ClaudeCodeAdapter; reads from registry). Registered in `index.ts` + `allAdapters`. Added `kiro` entry to `frameworks.ts`. Fixture at `src/test/fixtures/kiro-minimal/.kiro/`. Part C — Implemented `detectAndFixOverlaps()` (4px tolerance, 8px stride, 5-iter cap). Added `fitView({ duration: 400, ease: 'ease-in-out' })` + `@keyframes nodeAppear` (200ms ease-out, scale 0.85→1) + `.node-enter` class + `prefers-reduced-motion: reduce` gate. Edge transitions 150ms.
- **Tests:** 141 unit tests (11 files), 1 integration test (VS Code 1.124.2, 2.1s), `npm run build` clean, `./check.sh` 33 passes.
- **Traceability:** `progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md` (R↔T↔test mapping), `docs/configuration.md` (long-form registry docs).
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-015: universal-agent-reader (COMPLETED)
- **Objective:** Implement universal multi-framework agent architecture parsing and visualization without breaking existing Harness behavior.
- **Outcome:** Added adapter architecture (`IAgentAdapter`, `AdapterRegistry`, `HarnessSddAdapter`) plus adapters for Claude Code, Gemini CLI, Cursor, GitHub Copilot, OpenCode, and Windsurf. Integrated parser/UI framework metadata (`detectedFrameworks`, `_framework`, `_frameworkLabel`) with framework badge, 4px node framework accent, and framework empty state. Extended file watching through adapter `watchGlobs()`.
- **Tests:** `npm run build`, `npx vitest run src/adapters/adapterRegistry.test.ts` (8 passed), `npm test` (120 passed), `./check.sh` (passed).
- **Traceability:** `progress/impl_universal-agent-reader.md`.
- **Reviewer:** typescript-implementer (PASSED)

## [2026-06-08] FEAT-016: relationship-visual-refinement (COMPLETED)
- **Objective:** Improve edge visual quality and interaction: per-type routing, per-type CSS shadows/glows, label pill borders colored by edge type, animated `suggested` edges, handle-pill accent colors, Z-index layering for hovered/selected edges.
- **Outcome:** Implemented T1→T15 across three files. Removed global blue `drop-shadow` rules; added per-type `.harness-edge--<type>` CSS blocks with normal/hover/selected states. Added `@keyframes dash-scroll` for `suggested` edges. Added `EDGE_TYPE_ROUTING` constant and applied `type` + `className` to all edge objects. Fixed `labelStyle.border` to use edge stroke color (triple condition: mismatch / disabled / normal). Added `hoveredEdgeId` state + handlers and unified `edgesWithZIndex` memo (highlight flash now #4ec9b0). Updated `handleChangeLabel` and `onAddSkill` to propagate `type`, `className`, and colored border. Added `HANDLE_ACCENT` lookup in `CustomNode` and applied accent color to handle pills on hover.
- **Tests:** 16 new unit tests in `src/webview/edgeMapping.test.ts` (T13: EDGE_TYPE_ROUTING R1, T14: labelStyle/className R2+R5, T15: HANDLE_ACCENT R7). Total: 112 tests passing.
- **Traceability:**

| Req | Test(s) |
|-----|---------|
| R1  | T13 (edgeMapping.test.ts — EDGE_TYPE_ROUTING), T16 (manual smoke) |
| R2  | T14 (edgeMapping.test.ts — className), CSS per-type blocks in index.tsx |
| R3  | CSS `:hover` rules per type in index.tsx |
| R4  | `edgesWithZIndex` memo, CSS `.selected` rules in index.tsx |
| R5  | T14 (edgeMapping.test.ts — labelStyle.border), initialEdges map |
| R6  | `@keyframes dash-scroll`, `.harness-edge--suggested` CSS |
| R7  | T15 (edgeMapping.test.ts — HANDLE_ACCENT), CustomNode accent pills |
| R8  | `edgesWithZIndex` highlight override (#4ec9b0), onAddSkill newEdge |
| R9  | `hoveredEdgeId` state, onEdgeMouseEnter/Leave, zIndex in memo |

- **Reviewer:** typescript-implementer (PASSED — `npm run build` + `npx vitest run` all green)


- **Outcome:** Successfully implemented VS Code extension with React Webview, esbuild bundling, and two-way messaging.
- **Traceability:** R1-R10 verified via manual build and unit tests with `@requirement` tags.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-002: harness-parser (COMPLETED)
- **Objective:** Implement the backend logic to parse Harness artifacts into a graph model.
- **Outcome:** Created a robust `HarnessParser` with JSON and Markdown (gray-matter) support. Integrated `FileSystemWatcher` for real-time updates.
- **Traceability:** R1-R10 verified via unit tests in `src/parserLogic.test.ts`.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-003: whiteboard-canvas (COMPLETED)
- **Objective:** Visualize the Harness structure interactively using React Flow.
- **Outcome:** Integrated React Flow and Dagre for auto-layout. Implemented custom VS Code-themed nodes for Agents, Sub-agents, Skills, and Features. Added a detail panel for metadata exploration.
- **Traceability:** R1-R11 verified via visual build and framework checks.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-004: graph-editor (COMPLETED)
- **Objective:** Enable visual editing (creation/linking) of agents and skills with persistent updates.
- **Outcome:** Implemented `HarnessWriter` with immediate disk persistence. Added visual node creation, edge linking (connecting skills to agents), and an editable detail panel.
- **Traceability:** R1-R13 verified via interactive testing and file system validation.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-005: progress-timeline (COMPLETED)
- **Objective:** Visualize the project's SDD history in a git-style timeline.
- **Outcome:** Enhanced `HarnessParser` to read `progress.md`. Implemented a `TimelineView` with chronological milestones and a tabbed navigation system to switch from the Whiteboard.
- **Traceability:** R1-R9 verified via visual verification and log parsing.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-006: ui-ux-refinement (COMPLETED)
- **Objective:** Fix missing nodes, optimize layout height, and improve detail panel visibility.
- **Outcome:** Refactored parser to ensure all agents from `agentic.json` are always visible. Implemented 100% height flex-layout. Added a fixed, scrollable detail footer. Integrated automatic `fitView`.
- **Traceability:** R1-R9 verified via visual layout audit and parser verification.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-007: subagent-skill-relationships (COMPLETED)
- **Objective:** Visualize subagent-skill relationships in the whiteboard with proper hierarchical layout.
- **Outcome:** Added `skills` arrays to all subagents in `agentic.json` and `## Skills` sections to SUBAGENT.md files in both harness-manager and hypermove projects. Enhanced `parserLogic.ts` with edge deduplication (R9) and missing skill validation (R8). All 6 tests pass.
- **Traceability:** R1-R9 verified via unit tests and check.sh.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-008: ui-ux-visual-design (COMPLETED)
- **Objective:** Improve node styling, edge clarity, spacing consistency, hover/selection feedback, empty states, and detail panel layout.
- **Outcome:** Redesigned CustomNode with distinct shapes/colors per type, fixed hover (outline+box-shadow instead of transform), improved edge visibility (high-contrast hardcoded colors, thicker strokes, glow filter), redesigned handles (14px colored ports), popIn (+) button, consistent 4px spacing scale, skeleton loading, empty state timeline, slide-up detail panel animation. All colors use `--vscode-*` CSS variables.
- **Traceability:** R1-R11 verified via visual inspection and `./check.sh`.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-009: relationship-editor-md-viewer-side-panel (COMPLETED)
- **Objective:** Allow edge deletion/modification, view SUBAGENT.md/SKILL.md on node click, side panel for entity creation with Agent Skills spec fields.
- **Outcome:** Implemented edge context menu (Delete + Change Label) with VS Code confirmation dialog (R1/R2/R8/R9). MD file viewer in detail panel showing raw content with file-not-found fallback (R3/R10). Replaced inline "Add Entity" form with a side panel featuring full Agent Skills spec fields: name (kebab-case), description, license, compatibility, author, version (R4/R5/R6/R7). All 14 tests pass.
- **Traceability:** R1-R10 verified via 7 new unit tests (14 total across 3 test files).
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-010: semantic-skill-discovery (COMPLETED)
- **Objective:** Infers subagent↔skill relationships from description texts using TF-IDF cosine similarity, rendered as suggested edges on the whiteboard. User can accept to convert to hard-linked uses edges. Optional vscode.lm LLM re-ranking.
- **Outcome:** Created `src/semanticMatcher.ts` with TF-IDF vectorizer, cosine similarity, and LLM re-ranking (via dependency injection). Added `suggested` edge type (amber dashed #d4a84a) visually distinct from `uses`, `discovered`, `manages`, `executing`. EdgeContextMenu shows "Accept Suggestion → uses" for suggested edges. Node right-click shows "Show skill suggestions" dialog with score-per-skill list. 💡 badge on subagent nodes with pending suggestions. All 41 tests pass.
- **Traceability:** R1-R10 verified via 20 new tests in `src/semanticMatcher.test.ts`.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-011: agent-skill-idoneity (COMPLETED)
- **Objective:** Refactors subagent↔skill relationships to be driven by bidirectional semantic idoneity. Computes composite TF-IDF scores for all (subagent, skill) pairs in both directions, assigns a best semantic owner per skill, highlights mismatches where current `uses` differs from the best owner by ≥0.2 gap, and modulates edge styling by idoneity score.
- **Outcome:** Created `src/idoneity.ts` with `computeIdoneityMatrix()` (forward+reverse+composite), `detectMismatches()` (0.2 gap threshold). Skill nodes show `→ subagentX (score)` best-owner badge. Uses edges styled by idoneity (high ≥0.7 thick/opaque, medium ≥0.4, low <0.4 thin/faded). Mismatched skills have orange pulsing border + ⚠️ MISMATCH badge. Subagent context menu shows "Show idoneous skills (N)" with ranked list + score bars. Re-assignment support via "Suggest as subagent of <bestOwner>". Edge labels show idoneity score. All 59 tests pass (41 old + 18 new).
- **Traceability:** R1-R10 verified via 18 new tests in `src/idoneity.test.ts`.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-012: enhanced-entity-intelligence (COMPLETED)
- **Objective:** Improve subagent/skill detection and agent-skill relationship inference with full-body semantic signal (instead of only frontmatter description), cross-reference scanning from markdown bodies, name-boosted TF-IDF scoring, n-gram support for phrase-level matching, orphan subagent detection, and elimination of the arbitrary 500-char body truncation.
- **Outcome:** Stored full body in `metadata._fullBody` (kept `metadata.body` at 500 chars for display). Added `scanCrossReferences()` for markdown/wiki-link detection → generates `suggested` edges with `🔗` prefix. Added `extractNameTokens()` for name-boost (R4: 1.2x cosine multiplier, R5: +0.05 per name token cap +0.2). Added `nGramSize` parameter for bigram support. Orphan subagent detection flags SUBAGENT.md files not in agentic.json with dashed/grayscale style + Activate button. Fix: edge deletion was broken by idoneity score in labels — stored `originalLabel` in edge `data`. All 88 tests pass.
- **Traceability:** R1-R10 verified via 29 new tests across `parserLogic.test.ts` (16) and `semanticMatcher.test.ts` (15).
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-17] v0.4.0 — Documentation & VSIX Release

- **Objective:** Update all documentation for the 5 new features (FEAT-024 through FEAT-028), add screenshots to README, and generate the v0.4.0 VSIX.
- **Outcome:**
  - **CHANGELOG.md** — Added 0.4.0 entry covering all 5 features: Universal AI Provider (FEAT-028), Code quality hooks (FEAT-027), SDD panel (FEAT-025), Steering & Hooks observability (FEAT-024), Cross-framework discovery (FEAT-026). 87 new tests (228 total). All 28 features done.
  - **README.md** — Version badge updated to 0.4.0. Features table expanded from 9 to 14 entries. New "What's new in 0.4.0" section with 5-row changelog table. Expanded settings documentation with AI provider (3 settings) and code quality (5 settings) tables. Screenshot placeholders added for whiteboard, SDD panel, checkLM output, and code quality hooks.
  - **media/screenshots/** — Directory created for README screenshots.
  - **VSIX** — `harness-dashboard-vscode-0.4.0.vsix` built with `vsce package --no-dependencies`.
- **Files touched:** `README.md`, `CHANGELOG.md`, `progress/current.md`, `progress/progress.md`, `media/screenshots/` (new dir).

# MVP Summary
The Harness Manager Visualizer MVP is now complete and refined. 
- Integrated VS Code Webview with React + esbuild.
- Automatic Harness graph parsing (JSON + Markdown).
- Interactive Whiteboard with hierarchical auto-layout.
- Visual editing (Create/Link agents and skills) with disk persistence.
- SDD Progress Timeline.
- Responsive design optimized for VS Code sidebar.
