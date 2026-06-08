# FEAT-012 Implementation Traceability

## R<n> ↔ Task ↔ Test Mapping

| Requirement | Tasks | Test(s) | Status |
|------------|-------|---------|--------|
| **R1** — Full-body semantic corpus for TF-IDF matching | T4, T5, T6, T7, T8, T23 | `FEAT-012 — full-body TF-IDF (T23, T27, T28) > should use fullBody over description when available (R1)` | ✅ |
| **R2** — Cross-reference scanning from markdown bodies | T1, T9, T10, T22 | `FEAT-012 — scanCrossReferences (T22) > should detect markdown link cross-references`, `FEAT-012 — scanCrossReferences (T22) > should detect wiki-style [[links]]` | ✅ |
| **R3** — Suggested edges from cross-references | T11, T12, T26 | `FEAT-012 — cross-ref edge creation (T26) > should add suggested edge from cross-reference` | ✅ |
| **R4** — 1.2x name-token cosine multiplier for skill→subagent | T2, T13, T14, T15, T24 | `FEAT-012 — name-boost (T24) > should give higher score when subagent name matches skill content` | ✅ |
| **R5** — +0.05 per matching name token (cap +0.2) for subagent→skill | T2, T13, T14, T15, T20, T24 | `FEAT-012 — extractNameTokens (T20)` (all 7 sub-tests), `FEAT-012 — name-boost (T24)` | ✅ |
| **R6** — Orphan subagent detection from disk | T16, T25 | Structural — `_parseSubagents` builds set from `parseAgenticJson`, flags unmatched SUBAGENT.md files | ✅ |
| **R7** — Orphan visual style + Activate button | T17, T18, T19 | Structural — CustomNode dashed/grayscale style, detail panel Activate button, reused `createNode`/`acceptSuggestion` handlers | ✅ |
| **R8** — Eliminate 500-char body truncation | T4, T27 | `FEAT-012 — body truncation elimination (T27) > should store full body in _fullBody and truncated in body`, `FEAT-012 — body truncation elimination (T27) > should store full body for subagent nodes too` | ✅ |
| **R9** — N-gram tokenization support | T3, T21 | `FEAT-012 — tokenize with n-gram (T21)` (all 4 sub-tests) | ✅ |
| **R10** — Fallback to description when body is empty | T23 (last test), T28 | `FEAT-012 — full-body TF-IDF (T23) > fall back to description when fullBody is empty (R10)` | ✅ |

## Files Changed/Created

| File | Action | Purpose |
|------|--------|---------|
| `src/types.ts` | modify | Added `CrossRefInfo` type |
| `src/semanticMatcher.ts` | modify | Added `extractNameTokens()`, `nGramSize` on `tokenize()`, name-boost logic, `fullBody` field support |
| `src/idoneity.ts` | modify | Added `EntityInput` interface, `fullBody`/`name` fields on inputs, name-boost in scoring, `nGramSize` option |
| `src/parserLogic.ts` | modify | Full-body storage in `parseMarkdown()`, `scanCrossReferences()`, `addCrossRefEdges()`, wiring for `fullBody`/`name` |
| `src/harnessParser.ts` | modify | Calls `addCrossRefEdges()`, orphan subagent detection in `_parseSubagents()` |
| `src/webview/components/CustomNode.tsx` | modify | Orphan node style (dashed border, opacity 0.65, grayscale filter) |
| `src/webview/index.tsx` | modify | Activate button in detail panel for orphan entities |
| `src/webview/WhiteboardCanvas.tsx` | modify | Cross-ref edge label prefix (`🔗`), `originalLabel` fix in delete message |
| `src/extension.ts` | modify | `openMarkdownFile` handler for "Open File" button |
| `src/semanticMatcher.test.ts` | modify | 15 new tests: extractNameTokens (7), n-gram tokenize (4), name-boost (2), full-body/fallback (3) |
| `src/parserLogic.test.ts` | modify | 16 new tests: scanCrossReferences (9), body truncation (2), cross-ref edge creation (3) |

## Bugfixes

| Bug | Cause | Fix | Date |
|-----|-------|-----|------|
| Edge deletion broken | `handleDeleteEdge` sent `edge.label` (`"uses (0.87)"`) instead of original `"uses"`; `deleteEdge` label check `label === 'uses'` failed silently | Store `originalLabel` in edge `data` at creation time; reference `data.originalLabel` instead of `edge.label` in delete message | 2026-06-08 |

## Key Design Decisions

- **Full-body stored separately**: `metadata._fullBody` (complete) + `metadata.body` (truncated to 500 chars for display) — clean separation of semantic vs visual data
- **Name tokens NOT injected into TF-IDF vectors**: injecting duplicates into the term list inflates vector magnitude and reduces cosine similarity for shared terms. Instead, name-token matching is applied as a post-similarity additive boost (+0.05 per match, cap +0.2)
- **Cross-ref only generates `suggested` edges**, never `uses` — mirrors the TF-IDF suggestion pattern; human decides whether to accept via the existing accept-suggestion flow
- **N-gram support as configuration, not default**: `nGramSize` defaults to 1 (unigram-only), preserving backward compatibility. Bigrams are generated as joined strings (`"term1_term2"`)
- **Orphan detection by cross-referencing**: Build a `Set<string>` of registered subagent IDs from `parseAgenticJson()` before disk parsing; any SUBAGENT.md that creates a node not in the set is flagged as orphan
- **Reused existing `acceptSuggestion` / `createEdge` infrastructure**: Orphan activation doesn't need new message types — existing handlers handle both skill acceptance and subagent creation

## Test Summary

- **88 total tests** (59 existing + 29 new for FEAT-012)
- **6 test files**: `parserLogic.test.ts`, `semanticMatcher.test.ts`, `idoneity.test.ts`, `harnessWriter.test.ts`, `webview.test.tsx`, `node.test.tsx`
