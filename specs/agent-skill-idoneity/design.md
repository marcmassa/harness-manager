# Design — Agent-Skill Idoneity & Semantic Ownership

> Technical decisions to implement feature FEAT-011. Extends the TF-IDF infrastructure from FEAT-010 (`src/semanticMatcher.ts`) with a bidirectional idoneity matrix, best-owner assignment, mismatch detection, and visual refactors. The feature touches the parser pipeline, the whiteboard rendering, and the context menus.

## Summary

FEAT-010 introduced unidirectional TF-IDF suggestions (subagent→skill). FEAT-011 completes the picture by computing scores in **both directions** and introducing the concept of **idoneity** — how well a skill fits a subagent's purpose. Every (subagent, skill) pair gets a composite score; every skill gets a "best semantic owner"; existing `uses` edges become visually informative about match quality; mismatches are highlighted. This turns the whiteboard from a structural diagram into a **semantic fitness map**.

## Affected Files

| File | Action | Reason |
|---------|--------|-------|
| `src/idoneity.ts` | **create** | New module: `computeIdoneityMatrix()`, `detectMismatches()`, types (`IdoneityRecord`, `IdoneityMatrix`, `MismatchInfo`) |
| `src/idoneity.test.ts` | **create** | Tests for idoneity matrix, best owner, mismatch detection |
| `src/types.ts` | modify | Add `IdoneityRecord`, `IdoneityMatrix`, `MismatchInfo` interfaces |
| `src/semanticMatcher.ts` | modify | Export `computeIdf()`, `cosineSimilarity()`, `tokenize()` as shared utilities (currently private); add `computeBidirectionalScore()` |
| `src/parserLogic.ts` | modify | Call `computeIdoneityMatrix()` after reconciliation; enrich skill nodes' metadata with `_bestOwner`/`_bestOwnerScore`; enrich `uses` edges with `metadata.idoneity` |
| `src/webview/WhiteboardCanvas.tsx` | modify | Modulate `uses` edge style by idoneity score; compute mismatch set; render mismatch highlight; add idoneity mode toggle |
| `src/webview/components/CustomNode.tsx` | modify | Add best-owner badge on skill nodes; add mismatch border animation; add "Suggest as subagent of X" in node context menu |
| `src/webview/components/EdgeContextMenu.tsx` | modify | Show idoneity score for `uses` edges; show mismatch warning if applicable |
| `src/harnessParser.ts` | — | No changes needed (pipeline is in parserLogic) |

## Signatures and Structures

### New module: `src/idoneity.ts`

```typescript
export interface IdoneityRecord {
    skillId: string;
    subagentId: string;
    forwardScore: number;    // subagent→skill TF-IDF (R1)
    reverseScore: number;    // skill→subagent TF-IDF (R1)
    compositeScore: number;  // (forwardScore + reverseScore) / 2 (R1)
}

export interface IdoneityMatrix {
    records: IdoneityRecord[];
    // Per-skill: best semantic owner and its composite score (R2)
    bestOwnerBySkill: Map<string, { subagentId: string; score: number }>;
    // Per-subagent: skills ranked by composite score (R7)
    bestSkillsBySubagent: Map<string, { skillId: string; score: number }[]>;
}

export interface MismatchInfo {
    skillId: string;
    currentOwner: string;        // subagent with the 'uses' edge
    bestOwner: string;           // subagent with highest composite score
    currentScore: number;        // idoneity of current uses edge
    bestScore: number;           // idoneity of best owner pair
    gap: number;                 // bestScore - currentScore (≥ 0.2 = mismatch)
}

// Compute full matrix from parsed graph nodes (R1, R2)
export function computeIdoneityMatrix(
    subagents: { id: string; description: string }[],
    skills: { id: string; description: string }[],
    existingEdges: { source: string; target: string; label: string }[]
): IdoneityMatrix;

// Find mismatches: skills whose uses edge owner is not the best owner (R6)
export function detectMismatches(
    matrix: IdoneityMatrix,
    existingEdges: { source: string; target: string; label: string }[]
): MismatchInfo[];
```

### Shared utilities (from `src/semanticMatcher.ts`)

```typescript
// Already implemented but currently private — make public:
export function tokenize(text: string): string[];
export function computeIdf(corpus: Map<string, string[]>): Map<string, number>;
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number;

// New:
export function computeBidirectionalScore(
    descA: string, descB: string, idf: Map<string, number>, vectors: Map<string, Map<string, number>>
): { forward: number; reverse: number; composite: number };
```

### Metadata enrichment (in `parserLogic.ts`)

```typescript
// On each skill node (after idoneity matrix):
node.metadata._bestOwner = matrix.bestOwnerBySkill.get(skillId)?.subagentId || null;
node.metadata._bestOwnerScore = matrix.bestOwnerBySkill.get(skillId)?.score || 0;

// On each uses edge (after idoneity matrix):
const key = `${edge.source}::${edge.target}`;
edge.metadata = { ...edge.metadata, idoneity: idoneityMap.get(key)?.compositeScore || 0 };
```

### Idoneity styling thresholds (in `WhiteboardCanvas.tsx`)

```typescript
const IDONEITY_STYLES = {
    high: { strokeWidth: 4, opacity: 1.0, threshold: 0.7 },
    medium: { strokeWidth: 3, opacity: 0.75, threshold: 0.4 },
    low: { strokeWidth: 2, opacity: 0.5, threshold: 0 },
    fallback: { strokeWidth: 3, opacity: 0.7 },
};
```

## Algorithm / Flow

### Parse pipeline (extended from FEAT-010)

```
1. parseAgenticJson()
2. parseMarkdown()        → skill nodes + uses edges
3. reconcileSkillDiscovery() → discovered edges
4. computeIdoneityMatrix()   ★ NEW
   ├─ Collect all subagents with descriptions
   ├─ Collect all skills with descriptions
   ├─ Build corpus → TF-IDF vectors (reuses tokenize + computeIdf from semanticMatcher)
   ├─ For each (subagent, skill) pair:
   │   ├─ forward  = cosineSimilarity(subagentVec, skillVec)
   │   ├─ reverse  = cosineSimilarity(skillVec, subagentVec)
   │   └─ composite = (forward + reverse) / 2
   └─ Return IdoneityMatrix with bestOwnerBySkill + bestSkillsBySubagent
5. Enrich skill nodes with _bestOwner / _bestOwnerScore
6. Enrich uses edges with metadata.idoneity
7. detectMismatches()     ★ NEW
   └─ For each uses edge, compare owner score vs bestOwner score
   └─ Return mismatches where gap ≥ 0.2
8. addSemanticSuggestions()  → suggested edges (unchanged)
```

### Visual rendering (WhiteboardCanvas)

```
1. Compute mismatch set from detectMismatches() on the parsed graph
2. For each skill node:
   ├─ If _bestOwner exists → show badge "→ subagentX (0.87)"
   └─ If skill is in mismatch set → add orange border pulse animation
3. For each uses edge:
   ├─ Look up idoneity score from edge.metadata.idoneity
   ├─ Apply IDONEITY_STYLES based on threshold
   └─ If edge is part of a mismatch → add orange dashed overlay
4. For each subagent context menu:
   └─ If bestSkillsBySubagent has entries → show "Show idoneous skills (N)"
```

## Error Handling

| Condition | Response |
|-----------|-----------|
| Empty description on subagent | Score = 0 for all pairs involving this subagent; no bestOwner assignment (R9) |
| Empty description on skill | Score = 0 for all pairs involving this skill; no _bestOwner (R9) |
| No subagents or no skills | computeIdoneityMatrix returns empty matrix (R10) |
| Fewer than 2 documents in corpus | Empty matrix; no idoneity features active (R10) |
| Best owner tie (gap < 0.01) | First subagent alphabetically wins; store tie flag in metadata |
| Mismatch gap < 0.2 | Skill is not classified as mismatch; no highlight |

## Discarded Alternative

### Alternative: LLM-based idoneity (discarded)

Considered using `vscode.lm` (same approach as FEAT-010 R8) to evaluate each (subagent, skill) pair with an LLM prompt asking "how well does this skill fit this subagent's purpose?". This was discarded because:

1. **N² calls**: For a project with 5 subagents and 10 skills, that's 50 LLM calls per parse — unacceptable latency vs TF-IDF microseconds.
2. **Non-determinism**: LLM scores vary between runs, making mismatch detection unreliable.
3. **Dependency on vscode.lm availability**: If no model is installed, the entire feature degrades silently.
4. **TF-IDF is sufficient**: The bidirectional approach (forward + reverse) already captures the semantic relationship better than the unidirectional approach from FEAT-010, without any external dependency.

### Alternative: Embeddings-based (discarded)

Using a local embeddings model (e.g., `@xenova/transformers` or a WASM-based sentence transformer) was considered for higher-quality semantic matching. Discarded because:

1. **Bundle size**: Adding a tokenizer model + embedding model would increase the extension bundle by 5–15 MB.
2. **Cold start**: Model loading on first parse adds 200–500ms latency.
3. **Overkill**: For the domain of agent/skill descriptions (short texts, 10–50 words each), TF-IDF captures the same signal.

## Risks and Edge Cases

- **Large projects**: With 50+ skills and 20+ subagents, the N² loop is 1000 pairs × 2 cosine calculations = 2000 dot products, still < 5ms in JS. Acceptable.
- **Short descriptions**: A subagent with a 3-word description will have poor TF-IDF signal. The composite score will naturally be low (R9 handles the extreme case).
- **Edge metadata mutation**: Enriching `metadata.idoneity` on edges after creation requires careful handling of the existing edge objects — use `result.graph.edges.map()` or direct mutation before rendering.
- **Mismatch flicker**: If a user accepts a suggestion and the parse re-runs, the mismatch state may change. This is expected — the visual updates on next parse.
- **Alpha tie-breaking**: If two subagents have nearly identical composite scores for the same skill, picking the first alphabetically is arbitrary but deterministic. The mismatch highlight will alert the user if the chosen owner seems wrong.
