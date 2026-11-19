# FEAT-048 — Shared abstractions for duplicated code

Baseline at the FEAT-046 hold: 985 unit tests; VSIX 345,151 B.

## T1 — Git through the guarded runner

`gitState` (the Delegate dirty check) now calls `createGitRunner(root.fsPath)(['status', '--porcelain'])`. That runner adds `-c core.fsmonitor=false` and spawns git without a shell. Its earlier hand-written spawn had neither safeguard: a repository could configure `core.fsmonitor` to start a process during the check. A non-zero exit, a timeout or a spawn error still reports `no-vcs`, and truncated output counts as dirty.

| Requirement | Verification |
|---|---|
| R5 | gitState.test.ts: the spawn arguments include `-c core.fsmonitor=false`, with `shell: false`; clean, dirty and no-vcs are mapped; no other source file spawns git by hand. |

## T3 — Optimizer rule helpers

- `finding()` now lives in `rules/ruleUtils.ts`. The seven copies in budget, consistency, cost, drift, hygiene, overlap and structure are gone.
- `OPTIMIZABLE_TYPES` in `optimizer/types.ts` replaces seven other copies of the full list:
  - `ALL_OPTIMIZABLE` in hygiene and consistency;
  - the full-list `appliesTo` arrays in drift and overlap;
  - the set in `componentLoader`;
  - `ALL_TYPES` in the webview.
- Partial `appliesTo` lists stay: each is a rule's own subset.

`layoutUtils.ts` `ARCH_TYPES`, `profileV1.ts` `ENTITY_TYPES` and the tree's `TYPE_ORDER` also list the same five types, but they are separate concepts (layout tiers, profile entity types, display order), as the review concluded.

| Requirement | Verification |
|---|---|
| R3 | sharedHelpers.test.ts: `finding()` is defined only in `ruleUtils.ts`; the full type list is written once in the Optimizer and webview (layout tiers excepted); `ALL_TYPES` is the constant. The rule suites pass with assertions unchanged. |

## T6 — Host helpers

| Helper | Replaces |
|---|---|
| `src/test/integration/fixtures.ts` | `snapshot(dir, { skipGit })`: five copies. `fakeContext()`: four copies, also repeated, beyond what the review listed. |
| `src/agentic-detector/summary.ts` | `activeSuggestions` and `buildArchitectureSummary`, which `extension.ts` and `HarnessDashboardProvider.ts` both built. |
| `viewRelations.ts` constants | The workspace-state key literals, now defined once alongside `CUSTOM_USES_EDGES_KEY`. `DISMISSED_SUGGESTIONS_KEY` and `DISABLED_CONNECTIONS_KEY` were written out six times; one integration test also spelled out a key that already had a constant. |
| `OperationGate.describeAll(nodes)` | The two ownership-map constructions. |

The webview's own suggestion filter also applies dismissals made in the panel itself, so it is a different computation and stays as it is.

| Requirement | Verification |
|---|---|
| R7 | sharedHostHelpers.test.ts: the summary maths; one definition each for the summary, the state keys and the ownership map; `snapshot` and `fakeContext` exist only in `fixtures.ts`. panel.test.ts (FEAT-045 R20) still checks the key values, now in `viewRelations.ts`. |

## T2 — One test mock (cherry-picked from 8ab6007)

`src/test/vscodeMock.ts` is now the one in-memory workspace. It holds:
- the single `normalize`;
- the single `globToRegExp`, which handles `**/`, `**`, `*`, `?` and nested `{a,b}`;
- `stat`, which derives directories from the seeded files;
- configuration, recordable watchers, and `Disposable`, `FileType`, `ThemeIcon`, `TreeItem` and `EventEmitter`.

It is one superset, and no test needed an override. `detectorTestHarness.ts` re-exports it.

Seven test files switched to it:
- KiroAdapter, adapterRegistry, ConfigurationRegistry;
- byohProviders, adapterLoadModes;
- hooksAndSteering, harnessConfig.

The change removes 820 lines and adds 183.

No fixture or assertion changed. The two suites that used a simplified glob (byohProviders, adapterLoadModes) pass under the full one, so they did not depend on its gaps.

| Requirement | Verification |
|---|---|
| R2 | vscodeMockUsage.test.ts: no test file defines its own `globToRegExp` or `normalize`. The seven suites pass on the shared mock with their assertions unchanged. |
