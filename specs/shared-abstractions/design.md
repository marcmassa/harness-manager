# Design — Shared abstractions for duplicated code

FEAT-048 is a refactor. Each helper is a plain exported function or constant next to its users, with no base classes and no new dependency. Each step is a mechanical replacement that the existing tests verify.

### Files

| File | Action | Reason |
|---|---|---|
| `src/adapters/adapterUtils.ts` | modify | `discoveryFlags(adapterId, config?)`, `appendDiscovery(result, adapterId, root, rootNodeId, config?)`, `bodyMetadata(text)`, `BODY_PREVIEW_CHARS = 500`, `rootAgentNode(...)` (R1, R4) |
| 6 adapters (Claude Code, Copilot, Cursor, Gemini CLI, Kiro, Windsurf) | modify | Use the helpers (R1, R4) |
| `src/test/vscodeMock.ts` | create | Moved from `agentic-detector/detectorTestHarness.ts`: `createVscodeMock()`, `seedWorkspace()`, `mockFiles`, one `globToRegExp` (R2) |
| 7 test files | modify | `vi.mock('vscode', async () => (await import('../test/vscodeMock.js')).createVscodeMock())` (R2) |
| `src/optimizer/ruleUtils.ts`, `src/optimizer/types.ts` | modify | `finding(ruleId, ctx, partial)` and `OPTIMIZABLE_TYPES` (R3) |
| 7 rule files, `componentLoader.ts`, `webview/optimizerParts.tsx` | modify | Use them (R3) |
| `src/coordinators/optimizerDelegation.ts` | modify | `gitState` on `createGitRunner(root)(['status', '--porcelain'])`; errors map to `'no-vcs'` (R5) |
| `src/webview/components/AiIconButton.tsx` | create | `AiIconButton({ kind, disabled, title, onClick })` (R6) |
| `src/webview/styles.ts` | modify | `CONTEXT_MENU`, `TIER_COLORS`, the button constants, `KEYFRAMES` used by `dashboardStyles.ts` (R6) |
| `src/test/integration/fsSnapshot.ts` | create | `snapshot(dir, { skipGit? })` (R7) |
| `src/agentic-detector/summary.ts` | create | `activeSuggestions(profile)`, `buildArchitectureSummary(profile)` (R7) |
| `src/coordinators/viewRelations.ts` | modify | The workspace-state key constants (R7) |
| `src/operations/operationGate.ts` | modify | `describeAll(nodes)` (R7) |
| `check.sh` | modify | `set -o pipefail` around the test step, `fail` instead of `warn`, and the failing count (R9) |

### Order

Each task is its own commit and passes the full suite:
1. R5, the security fix.
2. R2, because later tasks use the shared mock.
3. R3, then R1 and R4.
4. R6, then R7.
5. R9.

### Discarded alternatives

- **An abstract base adapter class.** Adapters differ in their file loops (Cursor globs, Copilot `applyTo`, Gemini TOML, Kiro skills); only the prologue and epilogue are shared. A base class would force a template-method shape on every adapter. Free functions keep each adapter's flow readable (KISS).
- **Merging near-duplicates the review rejected:** the per-adapter loops, the run-adapter command builders, the Optimizer test fixtures (fixture data is exempt under the DRY steering), the 12 px and 14 px close icons, `IMPACT_PALETTE` and `SEVERITY_PALETTE`, the three-line dismissal append, and the small row style fragments. Merging them would couple code that changes for different reasons.
- **A generated `check.sh` override.** `check.sh` comes from the Harness SDD framework scaffold. The change is a two-line fix there; it is also proposed upstream through the framework's backlog, so a framework update does not revert it silently.

### Risks

- **Glob semantics change for two tests (R2).** They may have passed by accident. Any fixture change is recorded with the reason.
- **Chunk boundaries (R6).** Shared style constants live in `styles.ts`, which every chunk already imports. The `webviewChunks` Extension Host suite guards loading per tab.
- **`check.sh` gets stricter (R9).** Any test that fails today blocks it. The suite is green at the start.
