# Requirements — Agent-Skill Idoneity & Semantic Ownership

> Feature FEAT-011 from `feature_list.json`. Refactors subagent↔skill relationships to be based on **bidirectional semantic idoneity** rather than arbitrary hard-links. Builds on the TF-IDF infrastructure from FEAT-010, adding a full matrix of (subagent, skill) scores in both directions, a "best semantic owner" per skill, visual indication of mismatch when the current `uses` owner is not the best match, and edge styling modulated by idoneity score.
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

### R1 — Bidirectional Idoneity Matrix
- **Pattern:** Ubiquitous
- The system SHALL compute a bidirectional idoneity matrix for every (subagent, skill) pair that has a non-empty description in both nodes, where:
  - forward score = TF-IDF cosine similarity(subagent description, skill description)
  - reverse score = TF-IDF cosine similarity(skill description, subagent description)
  - composite score = arithmetic mean of forward and reverse scores

### R2 — Best Semantic Owner per Skill
- **Pattern:** Ubiquitous
- For each skill node, the system SHALL identify the subagent with the highest composite idoneity score as the "best semantic owner" and SHALL store the best owner's ID and composite score in the skill node's metadata under `_bestOwner` and `_bestOwnerScore`.

### R3 — Idoneity Score on Uses Edges
- **Pattern:** Ubiquitous
- For each existing `uses` edge, the system SHALL store the composite idoneity score of its (source subagent, target skill) pair in the edge's metadata under `metadata.idoneity`.

### R4 — Best Owner Badge on Skill Nodes
- **Pattern:** Ubiquitous
- Each skill node SHALL display a visual badge showing the best semantic owner subagent label and the composite idoneity score, formatted as `→ subagentId (score)`.

### R5 — Idoneity-Modulated Edge Styling
- **Pattern:** Ubiquitous
- Uses edges SHALL have their stroke width and opacity modulated by the composite idoneity score, where:
  - score ≥ 0.7 → strokeWidth 4, opacity 1.0 (high idoneity)
  - score ≥ 0.4 → strokeWidth 3, opacity 0.75 (medium idoneity)
  - score < 0.4 → strokeWidth 2, opacity 0.5 (low idoneity)
  - no score / score = 0 → default uses styling (strokeWidth 3, opacity 0.7)

### R6 — Mismatch Detection and Highlight
- **Pattern:** Event
- WHEN a skill has an existing `uses` edge to subagent A but its best semantic owner is subagent B, and the difference between bestOwnerScore and the edge's idoneity score is ≥ 0.2, THEN the system SHALL apply a visual mismatch indicator to that skill node (orange border pulse) and to the uses edge (orange dashed overlay).

### R7 — Subagent "Show Idoneous Skills" Menu
- **Pattern:** State
- WHILE the subagent node context menu is open and at least one skill exists in the idoneity matrix with a composite score ≥ 0.1 for that subagent, the menu SHALL display a "Show idoneous skills (N)" option that, when clicked, opens a dialog listing those skills sorted by composite idoneity score descending, each showing its score and a visual bar indicator.

### R8 — Mismatch Re-Assignment Suggestion
- **Pattern:** Event
- WHEN the user opens the context menu on a skill node that is classified as a mismatch (R6), the menu SHALL display a "Suggest as subagent of &lt;bestOwner&gt;" option that, when clicked, opens a confirmation dialog to convert the suggestion into an action.

### R9 — Backward Compatibility with Empty Descriptions
- **Pattern:** Unwanted
- IF a subagent or skill node has an empty or missing description, THEN the system SHALL assign a composite idoneity score of 0 for all pairs involving that node, SHALL NOT assign a best owner (`_bestOwner` = null), and SHALL NOT apply any idoneity styling or mismatch detection to edges involving that node.

### R10 — Stability with Small Corpora
- **Pattern:** Unwanted
- IF the number of nodes with descriptions is fewer than 2, THEN the idoneity matrix SHALL be empty and the system SHALL behave as if FEAT-011 is not active, falling back to pre-FEAT-011 behavior without errors.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|--------------|
| Every (subagent, skill) pair has a composite idoneity score | R1 |
| Every skill node shows its best semantic owner | R2, R4 |
| Every uses edge has an idoneity score in metadata | R3 |
| Edges visually reflect the quality of the match | R5 |
| Mis-assigned skills are clearly highlighted | R6 |
| Users can explore idoneity-ranked skills per subagent | R7 |
| Mismatched skills can be re-assigned from the context menu | R8 |
| Missing descriptions cause graceful fallback, not errors | R9, R10 |
