# Tasks — Semantic Skill Discovery (FEAT-010)

> Discrete steps in order. The implementer marks `[x]` upon completing each
> one. Each task references the R<n> it covers.

## Implementation

- [ ] **T1** — Create `src/semanticMatcher.ts`: `tokenize()`, TF-IDF vectorizer, cosine similarity, `computeSemanticSuggestions()` entry point _(R1, R2, R3, R10)_
- [ ] **T2** — Add `'suggested'` to `EdgeLabel` in `src/types.ts`; integrate `computeSemanticSuggestions()` into `parserLogic.ts` / `harnessParser.ts` _(R3)_
- [ ] **T3** — Add `suggested` edge style (dashed amber #d4a84a) to `WhiteboardCanvas.tsx`; attach score + method as edge metadata _(R4, R7)_
- [ ] **T4** — Add "Accept Suggestion → uses" to `EdgeContextMenu.tsx` for `suggested` edges; add "Show skill suggestions" to node context menu _(R5, R6)_
- [ ] **T5** — Implement `acceptSuggestion()` in `harnessWriter.ts` + handler in `extension.ts` → convert `suggested` to `uses` and persist hard-link _(R5, R7)_
- [ ] **T6** — Implement optional LLM re-ranking via `vscode.lm` in `semanticMatcher.ts`; add `harness.semanticMatcher.llm.enabled` setting _(R8, R9)_
- [ ] **T7** — Add optional 💡 suggestion badge on subagent nodes in `CustomNode.tsx` when pending suggestions exist _(R6)_

## Tests

- [ ] **T8** — Unit tests for `tokenize()`: stopword filtering, empty string, punctuation, capitalization _(R1)_
- [ ] **T9** — Unit tests for TF-IDF + cosine similarity: identical descriptions → 1.0, orthogonal → 0.0, partial match → 0.25–0.75 _(R2)_
- [ ] **T10** — Unit tests for threshold filtering + duplicate prevention _(R3, R10)_
- [ ] **T11** — Integration test: parse → suggested edges appear on whiteboard _(R4, R7)_
- [ ] **T12** — Integration test: accept suggestion → edge converts to `uses` + persists _(R5)_
- [ ] **T13** — Integration test: LLM fallback when `vscode.lm` unavailable _(R8, R9)_

## Closure

- [ ] **T14** — Document traceability `R<n> ↔ test` map in `progress/impl_semantic-skill-discovery.md`
- [ ] **T15** — Run `./check.sh` and verify all tests pass
- [ ] **T16** — Update `feature_list.json`: set `status` to `"done"`
- [ ] **T17** — Log summary in `progress/progress.md`
