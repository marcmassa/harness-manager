# Requirements — Semantic Skill Discovery

> Feature FEAT-010 from `feature_list.json`. Infers subagent↔skill relationships
> from description semantics using TF-IDF cosine similarity, with optional
> LLM re-ranking via `vscode.lm`. No hard-links required — relationships emerge
> from what the descriptions say.
>
> Each requirement is written in strict EARS and is verifiable by at least one test.

## Patterns

| Pattern | Syntax | When to use |
|---------|--------|-------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — Description tokenization on parse
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL tokenize the `description` field of every subagent and every skill node during the parsing phase, normalizing to lowercase and filtering common stopwords.

### R2 — TF-IDF cosine similarity
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL compute a TF-IDF vector for each tokenized description, and SHALL calculate the cosine similarity for every (subagent, skill) pair, producing a score in the range [0.0, 1.0].

### R3 — Suggested edge creation
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL create a `suggested` edge for every (subagent, skill) pair whose similarity score meets or exceeds the configured threshold (default 0.25), unless a `uses` or `discovered` edge already exists for that pair.

### R4 — Suggested edge visual style
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL render `suggested` edges using a dashed amber/gold stroke (#d4a84a), 2.5px width, visually distinct from `uses`, `discovered`, `manages`, and `executing` edges.

### R5 — Accept suggestion via edge context menu
- **Pattern:** Event
- **Wording:** WHEN a user right-clicks a `suggested` edge, THEN the context menu SHALL include an "Accept Suggestion → uses" option that converts the edge to a `uses` relationship and persists the hard-link to disk.

### R6 — Show skill suggestions on node
- **Pattern:** Event
- **Wording:** WHEN a user right-clicks a subagent node, THEN the context menu SHALL offer a "Show skill suggestions" action that opens a list of all `suggested` skills for that subagent, sorted by similarity score descending.

### R7 — Score in edge metadata
- **Pattern:** Ubiquitous
- **Wording:** The system SHALL attach the similarity score and match method (`tfidf` / `llm` / `hybrid`) as metadata on every `suggested` edge, displayed as a tooltip on hover.

### R8 — LLM re-ranking (optional)
- **Pattern:** Optional
- **Wording:** WHERE the setting `harness.semanticMatcher.llm.enabled` is true, the system SHALL use `vscode.lm` to re-rank the top 5 TF-IDF candidates per subagent, incorporating the LLM's relevance assessment into the final score.

### R9 — No external network calls
- **Pattern:** Unwanted
- **Wording:** IF an LLM enhancement is requested, the system SHALL use exclusively the built-in `vscode.lm` API; the system SHALL NOT make external HTTP calls or require user-provided API keys.

### R10 — No duplicate edges
- **Pattern:** Unwanted
- **Wording:** IF a `uses` or `discovered` edge already exists for a (subagent, skill) pair, the system SHALL NOT create a `suggested` edge for that same pair.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|------------|
| Descriptions are tokenized on parse | R1 |
| TF-IDF scores are computed for all pairs | R2 |
| Suggested edges appear above threshold | R3 |
| No suggested edge when hard-link exists | R10 |
| Suggested edges are visually amber/dashed | R4 |
| Hover shows score + method | R7 |
| Right-click suggested edge offers accept | R5 |
| Right-click subagent shows suggestion list | R6 |
| Accept converts to uses + persists | R5 |
| LLM re-rank uses only vscode.lm, no HTTP | R8, R9 |
