# Tasks: enhanced-entity-intelligence (FEAT-012)

> Discrete steps in order. The implementer marks `[x]` upon completing each one. Each task references the R<n> it covers.

## Foundation

- [ ] **T1** — Add `CrossRefInfo` type to `src/types.ts` with fields `targetId`, `linkType`, `confidence`, `context`. _(R2)_
- [ ] **T2** — Add `extractNameTokens()` to `src/semanticMatcher.ts`: split on hyphens, underscores, and camelCase; filter to tokens ≥ 2 chars; return deduplicated array. _(R5)_
- [ ] **T3** — Add `nGramSize` parameter to `tokenize()` in `src/semanticMatcher.ts`: when nGramSize ≥ 2, generate overlapping bigrams as `"term1_term2"` and append to the token array; deduplicate; default remains `1`. _(R9)_

## Full-Body Semantic Signal (R1, R8)

- [ ] **T4** — In `src/parserLogic.ts` `parseMarkdown()`: stop truncating body to 500 chars; store full body in `metadata._fullBody`; keep `metadata.body` truncated to 500 chars for display only. _(R1, R8)_
- [ ] **T5** — Update `computeSemanticSuggestions()` in `src/semanticMatcher.ts`: accept optional `fullBody` field alongside `description`; build corpus from `fullBody || description || ''`. _(R1)_
- [ ] **T6** — Update `computeIdoneityMatrix()` in `src/idoneity.ts`: accept `fullBody` and `name` fields on subagent/skill inputs; use `fullBody || description` for TF-IDF corpus building. _(R1, R8)_
- [ ] **T7** — Update `enrichWithIdoneity()` in `src/parserLogic.ts`: pass `_fullBody` from node metadata as `fullBody` to `computeIdoneityMatrix()`. _(R1)_
- [ ] **T8** — Update `addSemanticSuggestions()` in `src/parserLogic.ts`: pass `_fullBody` from node metadata as `fullBody` to `computeSemanticSuggestions()`. _(R1)_

## Cross-Reference Scanning (R2, R3)

- [ ] **T9** — Implement `scanCrossReferences()` in `src/parserLogic.ts`:
  - Regex for markdown links: `\[([^\]]*)\]\(([^)]+)\)` — extract path, parse filename/dirname
  - Regex for wiki links: `\[\[([^\]|]+)(?:\|[^\]]*)?\]\]` — extract target ID
  - Match target against `allNodeIds` set; return `CrossRefInfo[]`
  - Skip external URLs (http://, https://, file://)
  - Deduplicate by targetId + linkType _(R2)_
- [ ] **T10** — Call `scanCrossReferences()` from `parseMarkdown()` after body extraction; store result in `metadata._crossRefs`. _(R2)_
- [ ] **T11** — In `reconcileSkillDiscovery()` or after enrichment phase: iterate all nodes with `_crossRefs`; for each cross-ref where target exists as a node and no `uses|suggested|discovered` edge exists, add a `suggested` edge with `metadata.source = 'cross-ref'` and `metadata.confidence = 'high'`. _(R3)_
- [ ] **T12** — In `WhiteboardCanvas.tsx`: ensure `suggested` edges with source `'cross-ref'` use the same visual style as other suggested edges (dashed amber) but with an added `🔗` icon label prefix to distinguish them from TF-IDF suggestions. _(R3)_

## Name-Boosted Scoring (R4, R5)

- [ ] **T13** — Build name-boost map in `computeSemanticSuggestions()`: for each subagent, call `extractNameTokens(sa.id)`; add tokens to subagent's term vector with weight multiplier `1.5x`; for each skill, if any name token appears in subagent's vector, apply `1.2x` multiplier to the cosine similarity contribution. _(R4, R5)_
- [ ] **T14** — Apply same name-boost logic to `computeIdoneityMatrix()`. _(R4, R5)_
- [ ] **T15** — Wire name extraction in `enrichWithIdoneity()` and `addSemanticSuggestions()`: pass node `id` as `name` to both matrix and suggestion functions. _(R4, R5)_

## Orphan Detection & Activation (R6, R7)

- [ ] **T16** — In `harnessParser.ts` `_parseSubagents()`: after finding all SUBAGENT.md files, cross-reference against existing node IDs (already registered from `parseAgenticJson()`). For each unmatched subagent, call `parseMarkdown()` and then mark the resulting node with `metadata._orphan = true` and emit parser warning. _(R6)_
- [ ] **T17** — In `WhiteboardCanvas.tsx`: add orphan node style — dashed border, opacity 0.65, muted text color — applied when `node.data.metadata?._orphan === true` or `node.data.metadata?._discovery === 'orphan'`. _(R7)_
- [ ] **T18** — In `src/webview/index.tsx` detail panel: when `selectedNode.data.metadata?._orphan === true` or `_discovery === 'orphan'`, display an "Activate" button that sends `{ type: 'acceptSuggestion', subagentId: primaryAgentId, skillId: selectedNode.id }` for skills, or `{ type: 'createNode', nodeType: 'subagent', ... }` for orphans. _(R7)_
- [ ] **T19** — In `src/extension.ts`: ensure `acceptSuggestion` handler works for orphan-to-primary-agent activation; verify it creates a `uses` edge and updates agentic.json. _(R7)_

## Tests

- [ ] **T20** — Unit test for `extractNameTokens()`: verify splitting on hyphens, underscores, camelCase; verify empty input returns empty array; verify single-word returns single-element array. _(R5)_
- [ ] **T21** — Unit test for `tokenize()` with n-gram: verify `nGramSize=1` returns unigrams only; `nGramSize=2` returns unigrams + bigrams; deduplication; bigrams are `"term1_term2"` format. _(R9)_
- [ ] **T22** — Unit test for `scanCrossReferences()`: verify detection of markdown links, wiki links; verify external URLs are ignored; verify match against known node IDs; verify deduplication. _(R2)_
- [ ] **T23** — Unit test for full-body TF-IDF: verify that a document with rich body but no description produces non-zero scores; verify that body + description combined produces different scores than description alone. _(R1, R8)_
- [ ] **T24** — Unit test for name-boost: verify that `computeSemanticSuggestions` with name tokens produces higher scores for matching name/skill pairs compared to without name boost. _(R4, R5)_
- [ ] **T25** — Unit test for orphan subagent detection: simulate SUBAGENT.md file whose agent is NOT in agentic.json; verify node is created with `_orphan: true` and parser warning emitted. _(R6)_
- [ ] **T26** — Unit test for cross-ref edge creation: verify that when node A has a `_crossRefs` entry pointing to node B, a `suggested` edge is created if no `uses/discovered/suggested` edge exists. _(R3)_
- [ ] **T27** — Unit test for body truncation elimination: verify `metadata._fullBody` contains the full body; verify `metadata.body` is truncated to 500 chars; verify semantic computation uses `_fullBody`. _(R8)_
- [ ] **T28** — Unit test for fallback (R10): verify that entity with body=null and description="foo" still matches correctly. _(R10)_

## Closure

- [ ] **T29** — Document traceability `R<n> ↔ test` in `progress/impl_feat-012.md`
- [ ] **T30** — Run `npm run build` and `./check.sh` — verify all tests pass
- [ ] **T31** — Update `feature_list.json`: set `status` to `"done"` for FEAT-012
- [ ] **T32** — Log summary in `progress/progress.md`

## Skill Assignment
- **Agent**: `typescript-implementer` (should load `ears-requirements` skill)

## Task Dependencies

```
T1 (types) ────────────────────────────────────────────────────────────────────────
T2 (extractNameTokens) ──── T13, T14 ──┐
T3 (n-gram tokenize) ── T21            │
                                       ├── T15 ── T24
T4 (full-body store) ───── T5, T6 ── T7, T8 ── T22, T23, T27, T28
T9, T10 (scanCrossRefs) ── T11 ── T12 ── T26
T16 (orphan subagent) ── T17, T18, T19 ── T25
T20-T28 (tests)
T29-T32 (closure)
```
