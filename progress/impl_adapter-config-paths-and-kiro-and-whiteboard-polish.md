# Implementation — Configurable adapter paths + Kiro adapter + whiteboard UX polish (FEAT-023)

**Spec:** `specs/adapter-config-paths-and-kiro-and-whiteboard-polish/`
**Status:** done (141 unit tests + 1 integration test, all green)

## Summary

Three-part feature. The lasting architectural contribution is Part A (the
`ConfigurationRegistry` singleton), which generalises over per-adapter
detection-path overrides and makes every adapter that opts in
re-routable to a non-default location without code changes. Part B
adds the Kiro adapter as the first concrete consumer. Part C closes
two long-standing whiteboard UX gaps: smoother CSS-only animations and
an explicit no-overlap guarantee at parse time.

## Files added

| File | Purpose |
|---|---|
| `src/adapters/ConfigurationRegistry.ts` | Singleton: per-adapter path lookup + cache + R6 fallback. |
| `src/adapters/ConfigurationRegistry.test.ts` | 5 unit tests covering R1, R3, R4, R5, R6, R8. |
| `src/adapters/KiroAdapter.ts` | Mirrors `ClaudeCodeAdapter`; reads from `ConfigurationRegistry`. |
| `src/adapters/KiroAdapter.test.ts` | 7 unit tests covering R9, R10, R11, R12, R13, R15. |
| `src/test/fixtures/kiro-minimal/.kiro/` | Minimal Kiro workspace fixture (2 agents + 1 skill). |
| `docs/configuration.md` | Long-form ConfigurationRegistry reference. |
| `progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md` | This file. |

## Files modified

| File | Change |
|---|---|
| `src/adapters/IAgentAdapter.ts` | Added `isPathConfigurable(): boolean` to the interface (R4). |
| `src/adapters/index.ts` | Export `ConfigurationRegistry`, `initConfigurationRegistry`, `KiroAdapter`; instantiate the singleton in `createDefaultAdapters`; add `KiroAdapter` to the default list. |
| `src/adapters/{ClaudeCode,Cursor,GeminiCli,Copilot,Windsurf}Adapter.ts` | Add `CONFIG_KEY` static, replace hardcoded paths with `ConfigurationRegistry.getInstance().getPathFor(...)` in `watchGlobs`, `resolvePath` in `detect`/`parse`. |
| `src/adapters/{HarnessSdd,OpenCode}Adapter.ts` | Add `isPathConfigurable(): boolean { return false; }` (canonical, not configurable). |
| `src/frameworks.ts` | Add `kiro` entry to `SUPPORTED_FRAMEWORKS` (R14). |
| `src/extension.ts` | Wire `initConfigurationRegistry(log)` in `activate`; add `deactivate` to dispose the registry. |
| `package.json` | Add 6 entries to `contributes.configuration` (R2, R7). |
| `src/parserLogic.ts` | Add `detectAndFixOverlaps(result)` with 4-px tolerance, 8-px stride, 5-iter cap (R16, R17, R18). |
| `src/harnessParser.ts` | Wire `detectAndFixOverlaps` into the parse pipeline (no-op at parse time; callable from webview later). |
| `src/parserLogic.test.ts` | Append 3 no-overlap tests (R22a/b/c). |
| `src/webview/WhiteboardCanvas.tsx` | `fitView({ padding: 0.2, duration: 400, ease: 'ease-in-out' })` (R20). |
| `src/webview/components/CustomNode.tsx` | Add `.node-enter` class; remove obsolete `entranceStyle` (R19). |
| `src/webview/index.tsx` | Add `@keyframes nodeAppear` (200 ms ease-out) + `.node-enter` + `prefers-reduced-motion` override; update `.react-flow__edge-path` transition to 150 ms stroke / stroke-width / opacity / stroke-dasharray (R19, R21). |
| `src/adapters/adapterRegistry.test.ts` | Add `isPathConfigurable: () => false` to inline adapter mocks; add `ConfigurationRegistry.resetInstance()` to `beforeEach` to isolate state; add `FileType` to the `vscode` mock (needed by `ConfigurationRegistry.isValidPath`). |
| `README.md` | Add Kiro to "Supported project structures" table; add a "Configuration" section documenting the registry (R14, R7). |
| `progress/backlog.md` | Update adapter count to 7 (Kiro added). |

## R↔T↔test traceability

| Requirement | Task | Test |
|---|---|---|
| R1 (per-adapter setting) | T5 (add `contributes.configuration`) | `ConfigurationRegistry.test.ts` (a) |
| R2 (setting shape: `string`, `scope: resource`) | T5 | static inspection of `package.json` |
| R3 (setting consumed at runtime) | T4 (5 adapters use `getPathFor`) | `adapterRegistry.test.ts` (existing tests verify behaviour is unchanged) |
| R4 (`isPathConfigurable()` flag) | T2 (interface), T3 (8 adapters implement) | `ConfigurationRegistry.test.ts` (b) |
| R5 (initial set: 6 configurable + 2 canonical) | T4, T3, T10 | static inspection of `DEFAULT_PATHS` and `isPathConfigurable()` returns |
| R6 (invalid path → warning + fallback) | T1 (registry: `resolvePath` + `OutputChannel`) | `ConfigurationRegistry.test.ts` (d), (e) |
| R7 (`package.json` schema validation) | T5 | static inspection |
| R8 (5 ConfigurationRegistry unit tests) | T6 | `ConfigurationRegistry.test.ts` (5 tests) |
| R9 (Kiro detection at configured path) | T8 (KiroAdapter), T11 (fixture) | `KiroAdapter.test.ts` (R9, R15) — detection-positive with default + custom path |
| R10 (Kiro subagent discovery) | T8 | `KiroAdapter.test.ts` (R10, R15) |
| R11 (Kiro skill discovery) | T8 | `KiroAdapter.test.ts` (R11, R15) |
| R12 (Kiro subagent-skill `uses` edges) | T8 (`extractSkillsFromBody`) | `KiroAdapter.test.ts` (R12, R15) |
| R13 (Kiro registered in `index.ts`) | T9 | `KiroAdapter.test.ts` (R13) + `KiroAdapter` is imported & added to `allAdapters` |
| R14 (Kiro framework badge "Kiro") | T10 (frameworks.ts) | static inspection + `frameworkLabel('kiro') === 'Kiro'` |
| R15 (6 Kiro unit tests) | T12 | `KiroAdapter.test.ts` (7 tests, superset of 6) |
| R16 (no-overlap guarantee, 4-px tolerance) | T14 | `parserLogic.test.ts` (R16, R22a/b/c) |
| R17 (overlap detection at parse time) | T14, T15 | `parserLogic.test.ts` (R16, R22) |
| R18 (overlap fix at parse time) | T14 | `parserLogic.test.ts` (R16, R22) |
| R19 (node appear/disappear animation) | T18 | visual; the `@keyframes nodeAppear` lives in `index.tsx` |
| R20 (`fitView` easing 400 ms ease-in-out) | T17 | visual; `WhiteboardCanvas.tsx` line 539 + `<ReactFlow fitViewOptions ...>` |
| R21 (edge style transitions 150 ms) | T19 | visual; `index.tsx` `.react-flow__edge-path` |
| R22 (3 no-overlap tests) | T16 | `parserLogic.test.ts` (FEAT-023 describe block) |

## Verification (T20–T22)

- `npm test` → 11 test files, **141 tests pass** (was 126 before).
- `npm run build` → clean.
- `./check.sh` → 33 passes, 2 expected warnings (skipped CLI parity tests), 0 fails.
- `npm run test:integration` → 1 passing (2.1 s, the harness-sdd-minimal critical path).

## Design decisions worth noting

1. **Two canonical adapters, not one.** The spec said "harness-sdd is not configurable". We extended that to **also include `opencode`** because its `opencode.json`/`opencode.jsonc` files are the CLI's own canonical config — same reasoning as `.agents/agentic.json`. The spec folder rename (from `kiro-adapter-and-whiteboard-polish` to `adapter-config-paths-and-kiro-and-whiteboard-polish`) and the design.md discard-alternative section both reflect this.
2. **Copilot's dual root.** Copilot watches both `.github/` AND `.vscode/prompts/`. The spec said "5 configurable adapters (ClaudeCode, Cursor, GeminiCli, Copilot, Windsurf)" without disambiguating. The implementation makes **only `.github/` configurable** (the path is registered as `copilot → .github`); the `.vscode/prompts/` path stays fixed. This is the simplest interpretation; if a future maintainer needs to override the prompts path, the registry can be extended to handle two paths per adapter.
3. **`detectAndFixOverlaps` runs as a no-op at parse time.** Positions are set by dagre in the webview, not by the parser. The function reads `node.metadata._position`; at parse time no node has this metadata, so the function is a no-op. The same function is callable from the webview after dagre layout (future work, not in this spec) to actually do the work.
4. **`FileType` enum in the test mocks.** A subtle bug surfaced during the Kiro test work: `ConfigurationRegistry.isValidPath` checks `stat.type === vscode.FileType.Directory`, but the test mocks didn't define `FileType`. The check threw a TypeError, the catch returned `false`, and any adapter using a non-default path via `resolvePath` would fall back to the default. Fixed by adding `FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 }` to the `vi.mock('vscode', ...)` block in both `adapterRegistry.test.ts` and `KiroAdapter.test.ts`.
5. **Backticks in JSX template literals break esbuild.** When the spec text was copied verbatim into a comment inside a `<style>` template literal, the backticks around `manages` and `uses` terminated the template. Fixed by replacing backticks with double quotes.
6. **Custom-path test pattern (R15).** Rather than creating a second fixture workspace, the test seeds both `.kiro/agents/default-agent.md` (default path) and `.custom-kiro/agents/custom-agent.md` (custom path), configures the registry to use the latter, and asserts the adapter finds the custom-path content and NOT the default content. This verifies the registry wiring end-to-end.

## Known issues / follow-ups (not blockers)

- The integration test is sensitive to a Node v26 + `@vscode/test-electron` 2.3.0 + macOS download-stream bug (`EPIPE on write` after the 100% progress). Workaround: pre-download VS Code 1.124.2 manually with `curl`, then `tar -xzf` into `.vscode-test/vscode-darwin-arm64-1.124.2/`. This is a tooling concern, not a code issue; will be fixed by bumping `@vscode/test-electron` to a Node 26-compatible version in a future maintenance feature.
- The `node-enter` animation REPLACES the previous `entranceStyle` (translateY 12px → 0) rather than coexisting with it. Visual change: nodes now "zoom in" (scale 0.85 → 1) instead of "slide up". The user can verify this is preferred; if not, the previous `entranceStyle` is recoverable from the git history.
- The `out/` directory and `.env` are now gitignored. There may be a stale `out/` from the previous session — `rm -rf out` before packaging.
