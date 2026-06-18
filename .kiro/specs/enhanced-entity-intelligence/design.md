# Design: enhanced-entity-intelligence (FEAT-012)

> Technical decisions to implement feature FEAT-012. Builds directly on FEAT-010
> (Semantic Skill Discovery), FEAT-011 (Agent-Skill Idoneity), and the core
> parser infrastructure.

## Summary

This feature improves the "intelligence" of entity detection and relationship mining
in three areas:

1. **Richer semantic signal** — Use full body content (not just frontmatter `description`)
   for TF-IDF and idoneity, eliminating the arbitrary 500-char truncation.
2. **Cross-reference & name-boosted scoring** — Scan markdown bodies for links/mentions
   to generate additional `suggested` edges; boost scores when entity names match.
3. **Orphan detection & activation** — Find unregistered subagents/skills; make them
   actionable from the whiteboard UI.

## Affected Files

| File | Action | Reason |
|---------|--------|-------|
| `src/types.ts` | modify | Add `_fullBody` to metadata shape expectations; add `CrossRefInfo` type |
| `src/parserLogic.ts` | modify | Add `scanCrossReferences()` function; update `parseMarkdown()` to call it; stop truncating body; add orphan subagent handling |
| `src/harnessParser.ts` | modify | Update `_parseSubagents()` to detect orphans; pass full body to parser |
| `src/semanticMatcher.ts` | modify | Add `extractNameTokens()`; add `n-gram` support to `tokenize()`; add name-boost multiplier to `computeSemanticSuggestions()` |
| `src/idoneity.ts` | modify | Update `computeIdoneityMatrix()` to use `_fullBody` and pass name-boost map; add name-token augmentation |
| `src/parserLogic.test.ts` | modify | Add tests for cross-reference scanning, orphan detection, full-body storage |
| `src/semanticMatcher.test.ts` | modify | Add tests for name-boost, n-gram, name-token extraction |
| `src/idoneity.test.ts` | modify | Add tests for full-body idoneity, cross-ref edge creation |
| `src/webview/index.tsx` | modify | Add "Activate" button in detail panel for orphan skills |
| `src/webview/WhiteboardCanvas.tsx` | modify | Add distinct visual style for orphan nodes (dashed border, muted opacity) |
| `src/extension.ts` | modify | Handle orphan activation message |

## Signatures and Structures

### New/Modified Types

```typescript
// In src/types.ts

export interface CrossRefInfo {
    targetId: string;
    linkType: 'markdown' | 'wiki';
    confidence: 'high' | 'medium';
    context: string; // surrounding text snippet
}
```

### Modified HarnessNode metadata

The `metadata` field of skill and subagent nodes gains:

```typescript
{
    // Existing fields...
    _fullBody?: string;         // R8 — Full body content (no truncation)
    _crossRefs?: CrossRefInfo[]; // R2 — Detected cross-references
    _orphan?: boolean;          // R6 — True if SUBAGENT.md exists but not in agentic.json
}
```

### New Functions

```typescript
// In src/parserLogic.ts

/**
 * Scan markdown body for cross-references:
 * - Markdown links: [text](../skills/foo/SKILL.md) → target = "foo"
 * - Wiki links: [[foo]] or [[foo|label]] → target = "foo"
 * Returns deduplicated list of detected references.
 */
function scanCrossReferences(
    body: string,
    sourceNodeId: string,
    allNodeIds: Set<string>
): CrossRefInfo[];
```

```typescript
// In src/semanticMatcher.ts

/**
 * Extract meaningful tokens from a kebab/camelCase name.
 * "terraform-implementer" → ["terraform", "implementer"]
 * "typescriptImplementer" → ["typescript", "implementer"]
 */
export function extractNameTokens(name: string): string[];
```

```typescript
/**
 * Tokenize with optional n-gram support.
 * nGramSize=1: ["hello", "world"] (default, unigram)
 * nGramSize=2: ["hello", "world", "hello_world"] (unigram + bigram)
 */
export function tokenize(text: string, nGramSize?: number): string[];
```

### Modified Function Signatures

```typescript
// In src/semanticMatcher.ts
export function computeSemanticSuggestions(
    subagents: { id: string; description: string; fullBody?: string; name?: string }[],
    skills: { id: string; description: string; fullBody?: string; name?: string }[],
    existingEdges: { source: string; target: string }[],
    options?: SemanticMatcherOptions & {
        nGramSize?: number;        // R9: default 1
        nameBoostMap?: Map<string, number>;  // R4-R5: id → multiplier
    }
): SemanticMatch[];

// In src/idoneity.ts
export function computeIdoneityMatrix(
    subagents: { id: string; description: string; fullBody?: string; name?: string }[],
    skills: { id: string; description: string; fullBody?: string; name?: string }[],
    options?: { nGramSize?: number; nameBoostMap?: Map<string, number> }
): IdoneityMatrix;
```

### New Visual Style (WhiteboardCanvas)

```typescript
// Orphan skill / subagent node style
const orphanNodeStyle = {
    border: '2px dashed #888',
    opacity: 0.65,
    background: 'var(--vscode-editor-background)',
};
```

## Algorithm / Flow

### Flow 1: Full-body semantic pipeline (R1, R8)

```
Before:
  parseMarkdown() → metadata.body = body.substring(0, 500)  // truncated
  semanticMatcher uses metadata.description only

After:
  parseMarkdown() → metadata._fullBody = body  // full content
                    metadata.body = body.substring(0, 500)  // truncated for display only
  semanticMatcher uses (metadata._fullBody || metadata.description)
```

### Flow 2: Cross-reference scanning (R2, R3)

```
1. parseMarkdown() extracts frontmatter + body
2. scanCrossReferences(body, sourceId, allNodeIds) is called
3. For each markdown link [text](path):
   a. Extract path's last directory/filename
   b. Match against known node IDs (from allNodeIds set)
   c. If match found: add CrossRefInfo
4. For each wiki link [[target]] or [[target|label]]:
   a. target is matched directly against node IDs
   b. If match found: add CrossRefInfo
5. Results stored in metadata._crossRefs
6. In reconcile/discovery phase:
   For each cross-ref where source & target both exist as nodes:
   If no uses/suggested/discovered edge exists:
     Add suggested edge with metadata.source = 'cross-ref'
```

### Flow 3: Name-boosted scoring (R4, R5)

```
1. extractNameTokens("terraform-implementer") → ["terraform", "implementer"]
2. Build nameBoostMap:
   For each subagent:
     nameTokens = extractNameTokens(subagent.name)
     For each nameToken:
       Add nameToken to subagent's term vector with weight * 1.5
3. In cosineSimilarity:
   If a term appears in both subagent and skill vectors AND
   the term matches a name token of either entity:
     Apply 1.2x multiplier to the term's contribution to the dot product
```

### Flow 4: Orphan detection (R6, R7)

```
1. _parseSubagents():
   a. Find all SUBAGENT.md files in .agents/subagents/**/
   b. For each file:
      - Parse frontmatter to get agent name or use folder name
      - Check if name exists in agentic.json#subagents[] (from parseAgenticJson result)
      - If NOT found: create node with { _orphan: true, _discovery: 'scanned' }
      - Emit parser warning
2. WhiteboardCanvas:
   - If node.metadata._orphan: apply orphanNodeStyle
   - If node.metadata._discovery === 'orphan': apply orphanStyle
3. Detail panel (index.tsx):
   - If node has _orphan: show "Activate" button
   - On click: send 'acceptSuggestion' message → extension creates entry in agentic.json
```

## Error Handling

| Condition | Response |
|-----------|-----------|
| Cross-reference target doesn't match any node ID | Reference is stored but no edge is created; logged as debug |
| Entity has no body and no description | Score 0 for all semantic comparisons (existing behavior) |
| Name token extraction yields empty array | Skip name-boost; no penalty |
| Orphan activation fails (disk write error) | Show error via `vscode.window.showErrorMessage()` |
| N-gram tokenization produces duplicate n-grams | Deduplicate within the token array before TF-IDF |

## Discarded Alternatives

**Alternative 1: Separate semantic indexer service**
Instead of modifying the existing parser/matcher functions in-process, considered
building a standalone semantic indexer that runs as a VS Code sidecar or language
server plugin. This would allow caching TF-IDF vectors and incremental updates.
Discarded because the current corpus is small (< 50 documents) and in-process
computation takes < 5ms. A sidecar adds deployment and IPC complexity that is
not justified by performance gains.

**Alternative 2: Graph database for relationship detection**
Considered using a lightweight embedded graph DB (e.g., levelgraph or ase
in-memory) to store and query entity relationships including cross-references,
allowing graph traversal queries. Discarded because the existing array-based
edge storage in HarnessGraph is sufficient for the current scale, and adding
a graph DB dependency introduces significant complexity without measurable
benefit.

**Alternative 3: External NLP for body semantic extraction**
Considered using a lightweight NLP library (e.g., compromise.js or natural)
for better body tokenization (stemming, lemmatization, POS-based filtering).
Discarded to maintain the zero-dependency approach of the current TF-IDF
implementation. N-gram support (R9) provides a reasonable middle ground
without external dependencies.

## Risks and Edge Cases

- **Risk**: Full-body content could be very large (5,000+ words), slowing down TF-IDF
  - *Mitigation*: TF-IDF is O(N×M×T) where T = unique terms; large bodies increase T but
    also improve discrimination. For expected corpus sizes (< 50 docs), still < 50ms.
    If performance becomes an issue, cap body tokens at 2,000 per document.
- **Risk**: Name-boost could introduce false positives (e.g., skill "terraform" matches
  subagent "terraform-implementer" but skill is actually about Terraform cloud)
  - *Mitigation*: 1.2x boost is modest; the base TF-IDF score still dominates. The
    boost only applies when the name token is a real match in the counterpart's content,
    not a free boost.
- **Risk**: Wiki-link [[target]] may match unrelated entities with short names
  - *Mitigation*: Only generate edges when node ID is an exact match (case-sensitive).
    Medium-confidence cross-refs don't auto-link; they only generate suggested edges.
- **Edge case**: Body contains a link to an external URL that happens to match a node ID
  - *Mitigation*: `scanCrossReferences` only scans relative paths (no protocol prefix).
    External URLs like `[docs](https://example.com/foo)` are ignored.
- **Edge case**: Orphan subagent also has no skills → no uses edges
  - *Mitigation*: Orphan node is still created and displayed. User can activate it and
    then add skills manually.
