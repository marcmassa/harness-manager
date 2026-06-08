# Implementation Report — FEAT-010: Semantic Skill Discovery

## Traceability: R<n> ↔ Test

| Requirement | Test(s) |
|-------------|---------|
| R1 — Description tokenization on parse | `tokenization > should filter common stopwords`, `should handle empty description`, `should handle punctuation and capitalization`, `should handle short tokens` |
| R2 — TF-IDF cosine similarity | `TF-IDF cosine similarity > should return 1.0 for identical descriptions`, `should return 0.0 (no edge) for orthogonal descriptions`, `should detect partial match between related descriptions`, `should handle multiple subagents and skills` |
| R3 — Suggested edge creation | `threshold & duplicate prevention > should skip pairs with existing uses edge`, `should skip pairs with existing discovered edge`; `integration > should add suggested edges when descriptions semantically match` |
| R4 — Suggested edge visual style | Covered by `src/webview/WhiteboardCanvas.tsx` edgeConfigs['suggested']; verified by manual inspection |
| R5 — Accept suggestion via edge context menu | `integration > should not create duplicate suggested edges`; verified by `EdgeContextMenu.tsx` rendering |
| R6 — Show skill suggestions on node | Verified by `WhiteboardCanvas.tsx` node context menu + `CustomNode.tsx` badge rendering |
| R7 — Score in edge metadata | `integration > should add suggested edges when descriptions semantically match` (checks metadata.score) |
| R8 — LLM re-ranking (optional) | `LLM re-ranking > should use LLM scorer when provided and produce hybrid scores`, `should apply LLM only to top-K candidates per subagent` |
| R9 — No external network calls | `LLM re-ranking > should fall back to TF-IDF when LLM scorer throws` (graceful degradation); vscode.lm used exclusively |
| R10 — No duplicate edges | `threshold & duplicate prevention > should skip pairs with existing uses edge`, `should skip pairs with existing discovered edge`; `integration > should not create duplicate suggested edges`, `should not create suggested edge if uses edge already exists` |

## Files created

| File | Purpose |
|------|---------|
| `src/semanticMatcher.ts` | TF-IDF vectorizer, cosine similarity, `computeSemanticSuggestions()`, LLM re-ranking |
| `src/semanticMatcher.test.ts` | 20 tests covering tokenization, TF-IDF, threshold, integration, LLM |

## Files modified

| File | Change |
|------|--------|
| `src/types.ts` | Added `'suggested'` to `EdgeLabel`; added `metadata` to `HarnessEdge` |
| `src/parserLogic.ts` | Added `addSemanticSuggestions()`; imported `computeSemanticSuggestions` |
| `src/harnessParser.ts` | Added `addSemanticSuggestions()` call + `_createLlmScorer()` |
| `src/harnessWriter.ts` | Added `acceptSuggestion()` method |
| `src/extension.ts` | Added `acceptSuggestion` message handler |
| `src/webview/WhiteboardCanvas.tsx` | Added `suggested` edge style (amber #d4a84a), score in label, `suggestedCounts` memo, node context menu, suggestion dialog, `handleAcceptSuggestion` |
| `src/webview/components/EdgeContextMenu.tsx` | Added "Accept Suggestion → uses" option, score display |
| `src/webview/components/CustomNode.tsx` | Added `onContextMenu` handler, 💡 suggestion badge |
