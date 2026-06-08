# Tasks — Agent-Skill Idoneity & Semantic Ownership

> Discrete steps in order. The implementer marks `[x]` upon completing each one. Each task references the R<n> it covers.

## Implementation

- [ ] **T1** — Create `src/idoneity.ts` with `IdoneityRecord`, `IdoneityMatrix`, `MismatchInfo` types; implement `computeIdoneityMatrix()` that builds a full bidirectional TF-IDF matrix reusing shared utilities from `semanticMatcher.ts`; implement `detectMismatches()` with 0.2 gap threshold _(R1, R2, R6)_
- [ ] **T2** — Export `tokenize()`, `computeIdf()`, `cosineSimilarity()` from `src/semanticMatcher.ts` as shared utilities; add `computeBidirectionalScore()` that returns `{ forward, reverse, composite }` _(R1)_
- [ ] **T3** — In `src/parserLogic.ts`, call `computeIdoneityMatrix()` after `reconcileSkillDiscovery()`; enrich skill nodes with `_bestOwner` / `_bestOwnerScore` in metadata; enrich `uses` edges with `metadata.idoneity`; call `detectMismatches()` and store mismatch set in result metadata _(R1, R2, R3, R6)_
- [ ] **T4** — In `src/webview/WhiteboardCanvas.tsx`, modulate `uses` edge stroke width and opacity by `metadata.idoneity` using the three-tier threshold system (high ≥0.7, medium ≥0.4, low <0.4); apply orange dashed overlay for edges in mismatch set; add idoneity mode toggle to the toolbar _(R5, R6, R8)_
- [ ] **T5** — In `src/webview/components/CustomNode.tsx`, render best-owner badge (`→ subagentId (score)`) on skill nodes with `_bestOwner` metadata; apply orange border pulse animation on skill nodes in mismatch set; add "Suggest as subagent of <bestOwner>" option in skill node context menu that triggers a re-assignment message _(R4, R6, R8)_
- [ ] **T6** — In `src/webview/WhiteboardCanvas.tsx`, add "Show idoneous skills (N)" to the subagent node context menu (alongside the existing "Show skill suggestions"); implement a dialog listing skills sorted by composite idoneity score descending, each with a visual bar indicator and score _(R7)_
- [ ] **T7** — Verify backward compatibility: `computeIdoneityMatrix()` returns empty matrix when descriptions are empty or missing; no crash when fewer than 2 documents exist; no idoneity styling applied when scores are 0 _(R9, R10)_
- [ ] **T8** — Handle re-assignment in `src/harnessWriter.ts` and `src/extension.ts`: add a `reassignSkill` message type that deletes the old `uses` edge and creates a new one from the best-owner subagent to the skill, then triggers a re-parse _(R8)_
- [ ] **T9** — Show idoneity score in `src/webview/components/EdgeContextMenu.tsx` for `uses` edges when `metadata.idoneity` exists; show mismatch warning text when the edge is part of a mismatch set _(R3, R6)_

## Tests

- [ ] **T10** — Test `computeIdoneityMatrix()`: full matrix with correct forward/reverse/composite scores; bestOwnerBySkill correctly identifies the top subagent per skill; bestSkillsBySubagent correctly ranks skills per subagent; empty corpus returns empty matrix _(R1, R2, R9, R10)_
- [ ] **T11** — Test `detectMismatches()`: detects mismatch when gap ≥ 0.2; does not flag when gap < 0.2; does not flag when bestOwner equals currentOwner; handles case with no existing uses edges _(R6)_
- [ ] **T12** — Test `computeBidirectionalScore()`: forward and reverse scores are symmetric when descriptions are identical; forward ≠ reverse when descriptions differ; composite is the arithmetic mean _(R1)_
- [ ] **T13** — Test parser integration: after full parse, skill nodes have `_bestOwner` / `_bestOwnerScore` when descriptions are present; uses edges have `metadata.idoneity`; no idoneity enrichment when descriptions are missing _(R2, R3, R9)_
- [ ] **T14** — Test mismatch states: a skill with a uses edge to subagent A but bestOwner = subagent B with gap ≥ 0.2 is flagged as mismatch; confirm mismatch list contains correct data _(R6)_
- [ ] **T15** — Test backward compat: empty description on subagent → 0 idoneity for all its pairs, no _bestOwner; single node → empty matrix; zero skills → empty matrix _(R9, R10)_
- [ ] **T16** — Test re-assignment message: harnessWriter.reassignSkill() correctly deletes old edge and creates new; extension.ts handler parses the message and calls the writer _(R8)_

## Closure

- [ ] **T17** — Document traceability `R<n> ↔ test` in `progress/impl_agent-skill-idoneity.md`
- [ ] **T18** — Run `./check.sh` and verify all tests pass
- [ ] **T19** — Update `feature_list.json`: set `status` to `"done"`
- [ ] **T20** — Log summary in `progress/progress.md`
