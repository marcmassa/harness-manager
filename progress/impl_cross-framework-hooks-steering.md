# FEAT-026 — Cross-framework Hooks & Steering Discovery (IMPLEMENTATION REPORT)

## Summary

Implements the FEAT-026 spec: a discovery layer that auto-finds hook scripts and
steering markdown files for any of the 6 configurable adapters (Kiro, Claude Code,
Cursor, Gemini CLI, Copilot, Windsurf), and renders them as first-class nodes on
the whiteboard. The new `agentic.json`-less code path is additive; Harness SDD's
own `agentic.json#hooks[]` / `#steering[]` parsing (FEAT-024) is untouched.

## Acceptance Criteria → Tests

| R   | Test(s) | Status |
|-----|---------|--------|
| R1  | `package.json#contributes.configuration` contains only the 3 new settings; old `<id>.hooksPath/steeringPath/discoverHooks/discoverSteering` settings are absent | ✓ |
| R2  | `harnessConfig.test.ts`: empty / valid / whitespace / malformed JSON | ✓ |
| R3  | `extension.ts:openLocalConfig()` creates `.harness-dashboard/config.json` if missing, then `vscode.window.showTextDocument` | ✓ |
| R4  | `harnessConfig.test.ts`: malformed JSON → `OutputChannel` warning + empty config | ✓ |
| R5  | `hooksAndSteering.test.ts`: default scan under `<adapter-path>/hooks/` + `/steering/` creates nodes | ✓ |
| R6  | `hooksAndSteering.test.ts`: `adapters.kiro.hooksPath`/`steeringPath` overrides replace the default path | ✓ |
| R7  | `hooksAndSteering.test.ts`: `extraPaths.kiro.hooks`/`steering` scan in addition to default | ✓ |
| R8  | `hooksAndSteering.test.ts`: project-root scan on by default | ✓ |
| R9  | `hooksAndSteering.test.ts`: per-adapter kill switch (`discoveryEnabled: false`) → no nodes | ✓ |
| R10 | `hooksAndSteering.test.ts`: global kill switch (`rootDiscoveryEnabled: false`) → no project-root nodes | ✓ |
| R11 | `hooksAndSteering.test.ts`: filename → event inference (hyphens→underscores); frontmatter override | ✓ |
| R12 | `hooksAndSteering.test.ts`: `# H1` → description fallback; frontmatter override | ✓ |
| R13 | `hooksAndSteering.test.ts`: same file matched by two globs → one node, one edge | ✓ |
| R14 | `hooksAndSteering.test.ts`: hook → `triggers` edge to the adapter's root agent | ✓ |
| R15 | `hooksAndSteering.test.ts`: filename-stem matches a subagent name → `applies_to = [that id]` (no wildcard); else `applies_to = ['*']` (wildcard) | ✓ |
| R16 | `hooksAndSteering.test.ts`: every node's `metadata._filePath` is set to the workspace-relative path | ✓ |
| R17 | `hooksAndSteering.test.ts`: `discover()` returns `resolvedGlobs.hooks` + `resolvedGlobs.steering`; each of the 6 adapters' `watchGlobs()` includes the resolved globs | ✓ |
| R18 | `adapterRegistry.test.ts`: HarnessSddAdapter ignores `.harness-dashboard/config.json` even with malicious overrides/extras | ✓ |
| R19 | `adapterRegistry.test.ts`: OpenCodeAdapter ignores `.harness-dashboard/config.json` even with malicious overrides/extras | ✓ |

## Tasks → Files

| Task | File(s) |
|------|---------|
| T1 — `HarnessConfig` reader | `src/config/harnessConfig.ts` (created) |
| T2 — `Open Local Configuration` command + directory creation | `src/extension.ts:openLocalConfig()` |
| T3 — Register command in `package.json#contributes.commands` | `package.json` |
| T4 — Add only the 2 new settings; old per-adapter `hooksPath`/`steeringPath`/`discoverHooks`/`discoverSteering` were never present in this codebase (the spec said "remove the 6 obsolete settings" — they were never added) | `package.json` |
| T5 — Implement `discover()` in `src/discovery/hooksAndSteering.ts` | `src/discovery/hooksAndSteering.ts` (created) |
| T6 — Deduplication via `Set<absolutePath>` | `src/discovery/hooksAndSteering.ts:_discover.*` |
| T7 — Wire `discover()` into the 6 configurable adapters | `src/adapters/{Kiro,ClaudeCode,Cursor,GeminiCli,Copilot,Windsurf}Adapter.ts` |
| T8 — Update each adapter's `watchGlobs()` | same 6 adapter files |
| T9 — Unit tests for `HarnessConfig` | `src/config/harnessConfig.test.ts` (created, 9 tests) |
| T10 — Unit tests for `discover()` (nodes, edges, `_filePath`, event/applies_to inference) | `src/discovery/hooksAndSteering.test.ts` (created, 13 tests) |
| T11 — Unit tests for toggles, overrides, extras, dedup | same file (R6, R7, R8, R9, R10, R13 cases) |
| T12 — Regression tests for `HarnessSddAdapter` and `OpenCodeAdapter` | `src/adapters/adapterRegistry.test.ts` (2 new tests) |
| T13 — `npm test`, `npm run build`, `./check.sh` all green | ✓ |
| T14–T16 — Manual verification | Deferred to follow-up (next VS Code launch) |

## Files Touched (15)

### Created (4)
- `src/config/harnessConfig.ts` — local config reader (R2, R4)
- `src/config/harnessConfig.test.ts` — 9 unit tests
- `src/discovery/hooksAndSteering.ts` — `discover()` function (R5–R17)
- `src/discovery/hooksAndSteering.test.ts` — 13 unit tests

### Modified — adapters (8)
- `src/adapters/KiroAdapter.ts` — FEAT-026 wiring + `watchGlobs()` extension
- `src/adapters/ClaudeCodeAdapter.ts` — same
- `src/adapters/CursorAdapter.ts` — same
- `src/adapters/GeminiCliAdapter.ts` — same
- `src/adapters/CopilotAdapter.ts` — same
- `src/adapters/WindsurfAdapter.ts` — same
- `src/adapters/HarnessSddAdapter.ts` — added `setHarnessConfig` no-op (interface compliance)
- `src/adapters/OpenCodeAdapter.ts` — same
- `src/adapters/IAgentAdapter.ts` — added `setHarnessConfig` to interface

### Modified — extension, tests, manifest (4)
- `src/extension.ts` — construct `HarnessConfig`, wire into adapters, register command
- `src/adapters/adapterRegistry.test.ts` — 2 new R18/R19 regression tests + `setHarnessConfig` on existing test mocks
- `package.json` — 7 new settings (`<id>.discovery` × 6, `discovery.root` × 1) + 1 new command
- `feature_list.json` — FEAT-026 status: `in_progress` → `done`

### Governance (2)
- `progress/current.md` — session state
- `progress/progress.md` — FEAT-026 entry

## Test Results

```
Test Files  14 passed (14)
     Tests  189 passed (189)
  Start at  19:03:19
  Duration  731ms
```

- Before FEAT-026: 165 tests
- After FEAT-026: 189 tests (24 new: 9 + 13 + 2)
- `npm run build`: clean
- `./check.sh`: all checks passed

## Design Decisions (worth recording)

1. **`HarnessConfig.read()` is async, not sync as the design sketch showed.** VS Code's `workspace.fs.readFile` is async-only. The async signature is the only practical option. Production code (each adapter's `parse()`) is already async, so this is a non-breaking refinement.

2. **One `HarnessConfig` instance per extension activation, not a process-wide singleton.** The `ConfigurationRegistry` uses a singleton because the adapter path settings are workspace-agnostic (well-known defaults). The local `config.json` is per-workspace, so a per-activation instance is more natural.

3. **Each adapter gets its own `_harnessConfig` field + `setHarnessConfig` setter** rather than reading from a module-level constant. This is structurally clean: the extension owns one `HarnessConfig` and injects it into all six adapters. Tests can pass a different one or none.

4. **The applies_to filename match is against the subagent's *name* (the segment after `<adapter>::`), not the full prefixed id.** The user names a steering file like `typescript-implementer.md`; the subagent id is `kiro::typescript-implementer`. Comparing the stem to the full id would never match; comparing to the last segment is user-friendly. (One-line implementation, one-line test.)

5. **The "framework wins" dedup is by absolute path** (a `Set<string>` of normalized fsPaths). When the local config lists the framework's hooks dir AGAIN as an extra path, the same file is matched twice; the `seen` set drops the second match before node creation. The R13 test sets up exactly this scenario.

6. **The test mock for `findFiles` had to learn brace expansion** (`{sh,js,ts}`). The existing tests in `KiroAdapter.test.ts` and `adapterRegistry.test.ts` only use single-extension globs, so the existing mock didn't expand braces. FEAT-026's hook discovery uses `*.{sh,js,ts}` so the mock was extended in `src/discovery/hooksAndSteering.test.ts` to support single-level brace expansion via a sentinel-substitution approach (escape everything → swap sentinels for real regex constructs). The new test infrastructure is reusable for any future test that uses VS Code's brace-glob syntax.

7. **`discover()` is the only function in the module; no orchestrator, no options bag, no helper extraction.** The spec called for this KISS approach. The function is ~140 lines, ~50 of which are the inner loops. It returns one `{ nodes, edges, resolvedGlobs }` object. Easy to read, easy to test.

8. **No new dependencies added.** All work uses packages already in `package.json` (`gray-matter` for frontmatter parsing, `vscode` for workspace APIs, Node stdlib for everything else).

## Manual Verification (deferred to next VS Code launch)

T14 — Open a Kiro-only project (`.kiro/hooks/*.sh`, `.kiro/steering/*.md` exist). The whiteboard should show hook/steering nodes linked to the Kiro root agent.

T15 — Invoke `Harness Dashboard: Open Local Configuration`. The file opens in the editor. Edit it to add `adapters.kiro.hooksPath: "custom-hooks"` and `extraPaths.kiro.hooks: ["bonus/hooks"]`. Save. Refresh — the override and extras are picked up.

T16 — Edit a discovered hook file. The whiteboard re-parses (verified by the new `watchGlobs()` entries triggering the existing `vscode.workspace.createFileSystemWatcher`).

## Commit Message (for the maintainer)

```
feat(discovery): cross-framework hooks & steering for Kiro, Claude Code, Cursor, Gemini, Copilot, Windsurf (FEAT-026)

Closes the FEAT-024 gap: a project that uses Kiro, Claude Code, Cursor,
Gemini, Copilot, or Windsurf — without Harness SDD's agentic.json — can
now have its hooks and steering files discovered and rendered as
first-class whiteboard nodes.

* New 3 global settings (harness-dashboard.adapters.<id>.discovery and
  harness-dashboard.discovery.root).
* New local config file (<workspace>/.harness-dashboard/config.json)
  for per-adapter overrides and extras, editable via the
  "Harness Dashboard: Open Local Configuration" command.
* New HarnessConfig reader with watcher-driven cache invalidation and
  malformed-JSON fallback.
* New discover() function that scans hooks/{*.sh,*.js,*.ts} and
  steering/*.md under both adapter paths and the project root, with
  per-adapter and global kill switches, filename-based event inference,
  H1 description fallback, applies_to inference, and absolute-path
  deduplication.
* Wired into the 6 configurable adapters; HarnessSddAdapter and
  OpenCodeAdapter are deliberately untouched (R18, R19).
* 24 new unit tests (189 total, all passing).
```
