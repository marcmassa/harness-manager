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
