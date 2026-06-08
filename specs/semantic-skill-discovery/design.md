# Design — Semantic Skill Discovery

> Technical decisions to implement feature FEAT-010. Infers relationships
> from description text instead of requiring explicit hard-links in
> agentic.json or SUBAGENT.md.

## Summary

Currently, subagent↔skill relationships require explicit hard-links
(`skills[]` array, `## Skills` section). This feature adds a **semantic
matching layer** that proposes relationships by comparing description
texts using TF-IDF cosine similarity. The suggestions appear as visually
distinct `suggested` edges alongside the existing `discovered` edges.
Users can accept suggestions to convert them into persistent `uses`
edges. An optional LLM re-ranking (via `vscode.lm`) improves suggestion
quality without requiring external API keys.

Suggested edges are **never persisted to disk** — they are recomputed
fresh on every parse, consistent with agentskills.io principles.

## Affected Files

| File | Action | Reason |
|------|--------|--------|
| `src/types.ts` | modify | Add `'suggested'` to `EdgeLabel` union type |
| `src/semanticMatcher.ts` | **create** | TF-IDF vectorizer + cosine similarity + LLM re-ranking |
| `src/semanticMatcher.test.ts` | **create** | Tests covering R1–R10 |
| `src/parserLogic.ts` | modify | Import and call `computeSemanticSuggestions()` |
| `src/harnessParser.ts` | modify | Pass subagent/skill descriptions to outline |
| `src/harnessWriter.ts` | modify | `acceptSuggestion()` — writes hard-link on user accept |
| `src/extension.ts` | modify | Handler for `acceptSuggestion` message |
| `src/webview/WhiteboardCanvas.tsx` | modify | Visual style for `suggested` edges |
| `src/webview/components/EdgeContextMenu.tsx` | modify | "Accept Suggestion → uses" option for `suggested` edges |
| `src/webview/components/CustomNode.tsx` | modify | Optional 💡 badge on subagents with pending suggestions |

## Signatures and Structures

### `src/types.ts` addition

```typescript
export type EdgeLabel = 'manages' | 'uses' | 'executing' | 'discovered' | 'suggested';
```

### `src/semanticMatcher.ts` — new module

```typescript
export interface SemanticMatch {
  subagentId: string;
  skillId: string;
  score: number;           // 0.0 – 1.0
  method: 'tfidf' | 'llm' | 'hybrid';
}

export interface SemanticMatcherOptions {
  threshold?: number;       // default 0.25
  llmEnabled?: boolean;     // default false
  llmTopK?: number;         // default 5 (candidates re-ranked per subagent)
}

export function computeSemanticSuggestions(
  subagents: { id: string; description: string }[],
  skills: { id: string; description: string }[],
  existingEdges: { source: string; target: string }[],
  options?: SemanticMatcherOptions
): SemanticMatch[];
```

Internal helpers (not exported):

```typescript
function tokenize(text: string): string[];                    // lowercase, split, stopword filter
function computeTf(terms: string[]): Map<string, number>;     // term frequency
function computeIdf(corpus: Map<string, string[]>): Map<string, number>; // inverse doc frequency
function cosineSim(a: Map<string, number>, b: Map<string, number>): number;
// Optional (only if llmEnabled):
async function llmReRank(matches: SemanticMatch[], subagents: Map, skills: Map, topK: number): Promise<SemanticMatch[]>;
```

### Extension messages (new)

| Message | Direction | Payload |
|---------|-----------|---------|
| `acceptSuggestion` | webview → ext | `{ subagentId, skillId }` |
| `getSkillSuggestions` | webview → ext | `{ subagentId }` → returns `SemanticMatch[]` |

## Algorithm / Flow

```
1. Parse completes → parserLogic.ts has all subagents + skills + existing edges
2. Extract descriptions: map<subagentId, description> + map<skillId, description>
3. Tokenize all descriptions (R1)
4. Build TF-IDF vectors for all documents (R2)
5. For each (subagent, skill) pair:
   a. Compute cosine similarity
   b. IF score >= threshold AND no existing edge → push to results (R3, R10)
6. Optional LLM step:
   a. IF llmEnabled:
      i.  For each subagent, take top 5 TF-IDF candidates
      ii. Build prompt: "Rate relevance 0-10 between subagent '{desc}' and skill '{desc}'"
      iii. Call vscode.lm.sendChatRequest()
      iv.  Average LLM score with TF-IDF score → new hybrid score
      v.   Re-sort suggestions (R8, R9)
7. Attach score + method to each suggested edge metadata (R7)
8. Return SemanticMatch[] → caller adds suggested edges to graph
```

## Error Handling

| Condition | Response |
|-----------|----------|
| Empty description | Skip pair (score = 0) |
| All descriptions empty | Return empty array |
| `vscode.lm` unavailable (LLM mode) | Fall back to TF-IDF silently |
| `vscode.lm` request fails / times out | Fall back to TF-IDF for affected subagent |
| Accept suggestion for already-linked pair | No-op (edge already exists) |

## Visual style for `suggested` edges

```typescript
'suggested': {
  style: {
    stroke: '#d4a84a',           // amber/gold
    strokeWidth: 2.5,
    strokeDasharray: '8,4',      // dashed (different from discovered's '4,4' dotted)
    strokeLinecap: 'round',
    opacity: 0.7,
  },
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 12, color: '#d4a84a' },
}
```

Tooltip on hover: `"Suggested (TF-IDF: 0.72) — Right-click to accept"`

## Discarded Alternative

**Embeddings-only matching** — Using a local word-embedding model (e.g.,
sentence-transformers via ONNX runtime) was discarded because:
1. ONNX runtime adds ~20MB to the VSIX bundle
2. Embedding dimension for short texts (1–2 sentence descriptions) is overkill
3. TF-IDF achieves comparable accuracy on the limited corpus (5 subagents × 4 skills)
4. LLM enhancement via `vscode.lm` provides a superior experience when available
   without any bundle size penalty

## Risks and Edge Cases

- **Low scores across the board** — If descriptions are too terse or
  dissimilar, threshold may need adjustment. Mitigation: expose threshold
  as a configuration setting (`harness.semanticMatcher.threshold`).
- **LLM latency** — `vscode.lm` requests may take 2–5s. Mitigation: LLM
  step is optional and only re-ranks top 5 (not all pairs); pending state
  shown in UI.
- **Duplicate suggestions when hard-links already exist** — Mitigation:
  R10 explicitly filters out pairs that already have `uses` or
  `discovered` edges.
