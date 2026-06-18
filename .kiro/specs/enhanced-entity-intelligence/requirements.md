# Requirements: enhanced-entity-intelligence (FEAT-012)

> Feature FEAT-012 from `feature_list.json`. Improves subagent/skill detection and
> agent-skill relationship inference through full-body semantic signal,
> cross-reference scanning from markdown bodies, name-boosted scoring, n-gram support,
> orphan entity detection, and elimination of the arbitrary 500-char body truncation.
>
> Each requirement is written in strict EARS and is verifiable by at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — Full-body semantic corpus
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL use the full markdown body content (not only the frontmatter `description` field) of SUBAGENT.md and SKILL.md files when computing TF-IDF vectors for semantic matching (FEAT-010) and idoneity scoring (FEAT-011).

### R2 — Cross-reference scanning from markdown body
- **Pattern:** Event
- **Wording:** WHEN the system parses a SUBAGENT.md or SKILL.md file, it SHALL scan the body content for markdown-style links `[text](path)` and wiki-style links `[[target]]` that reference node identifiers, AND SHALL record each detected reference as metadata `_crossRefs` on the parser's output node.

### R3 — Cross-reference edge suggestion
- **Pattern:** Event
- **Wording:** WHEN node B is detected as a cross-reference inside node A's body, the system SHALL add a `suggested` edge from A to B with `metadata.source = 'cross-ref'` AND `metadata.confidence = 'high'` IF no `uses`, `suggested`, or `discovered` edge already exists between them.

### R4 — Name-boosted TF-IDF scoring
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL boost TF-IDF cosine similarity by a multiplier of 1.2x when the name of a skill or subagent (as an exact lowercase token) appears anywhere in the counterpart's analyzed content.

### R5 — Subagent name-token augmentation
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL extract meaningful tokens from subagent names (splitting on hyphens, underscores, and camelCase boundaries), and SHALL include those tokens in the subagent's TF-IDF vector with a weight multiplier of 1.5x relative to body-derived tokens.

### R6 — Orphan subagent detection
- **Pattern:** Event
- **Wording:** WHEN the system finds a SUBAGENT.md file in `.agents/subagents/` whose agent name is NOT present in `agentic.json#subagents[]`, the system SHALL create a subagent node with `metadata._orphan = true` AND `metadata._discovery = 'scanned'`, AND SHALL emit a parser warning.

### R7 — Orphan skill activation display
- **Pattern:** Event
- **Wording:** WHEN a skill node has `_discovery = 'orphan'`, the whiteboard SHALL render it with a distinct visual style (dashed border, muted opacity) AND the detail panel SHALL display an "Activate" button that sends an `acceptSuggestion` message to assign the orphan to the primary agent.

### R8 — Body truncation elimination
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL store the full body content of SUBAGENT.md and SKILL.md files in a metadata field `_fullBody`, removing the current 500-character truncation, AND SHALL use `_fullBody` (falling back to `description`) for all semantic computation.

### R9 — N-gram tokenization
- **Pattern:** Ubiquitous
- **Wording:** The semantic matcher SHALL support configurable n-gram tokenization where bigram features (pairs of adjacent tokens) are generated alongside unigram tokens, controlled by a `nGramSize` parameter defaulting to 1 (unigram-only).

### R10 — Fallback for entities without body
- **Pattern:** Unwanted
- **Wording:** IF an entity has no body content (only frontmatter), the system SHALL fall back to using only the `description` field for semantic computation, preserving the current behavior for minimal entities.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|--------------|
| Semantic matching uses full body text, not only description | R1, R8 |
| Link references in markdown bodies are detected and recorded | R2 |
| Cross-reference links generate suggested edges | R3 |
| Scores are boosted when entity name appears in counterpart's content | R4 |
| Subagent name tokens (hyphen/camelCase split) improve matching | R5 |
| SUBAGENT.md files outside agentic.json are detected as orphans | R6 |
| Orphan skills have distinct visual style and activation button | R7 |
| No arbitrary 500-char body truncation in stored content | R8 |
| Bigram tokenization improves phrase-level matching | R9 |
| Minimal entities (frontmatter only) still match correctly | R10 |
