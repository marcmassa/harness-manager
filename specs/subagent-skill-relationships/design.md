# Design: subagent-skill-relationships (FEAT-007)

## Architecture

This feature enhances the existing parser and layout to properly visualize subagent-skill relationships. The changes are:

1. **Data Layer** (`parserLogic.ts`): Already supports reading from both `agentic.json` (`sa.skills` array) and `SUBAGENT.md` (`## Skills` section). Need to ensure both sources are properly populated.

2. **Configuration** (`.agents/agentic.json`): Add `skills` array to each subagent entry listing the skill IDs they use.

3. **Documentation** (`.agents/subagents/*/SUBAGENT.md`): Add `## Skills` section to each subagent's markdown file.

4. **Layout** (`layoutUtils.ts`): Already implements rank-based hierarchy (agent:0, subagent:1, skill:2, feature:3) which places subagents north of skills. Verify this works correctly.

## Data Model

### agentic.json subagent entry (extended)
```json
{
  "name": "spec-author-vscode",
  "mode": "subagent",
  "description": "...",
  "role_file": ".agents/subagents/spec-author-vscode/SUBAGENT.md",
  "skills": ["ears-requirements", "vscode-extension-best-practices"],
  "permission": { ... }
}
```

### SUBAGENT.md (extended)
```markdown
---
name: spec-author-vscode
type: subagent
...
---

## Mission
...

## Skills
- ears-requirements
- vscode-extension-best-practices
```

## Layout Algorithm

The existing Dagre layout in `layoutUtils.ts` assigns ranks:
- `agent` (primary): rank 0 → top
- `subagent`: rank 1 → below agent
- `skill`: rank 2 → below subagents (north/south relationship)
- `feature`: rank 3 → bottom

This satisfies R4 automatically. The `ranksep: 120` provides sufficient vertical spacing.

## Edge Deduplication

In `parserLogic.ts`, edges are created from:
1. `agentic.json` `sa.skills` (lines 47-56)
2. `SUBAGENT.md` `## Skills` section (lines 126-134)

To prevent duplicates (R9), we'll add a check before pushing edges to verify the edge doesn't already exist (same source, target, and label).

## Missing Skill Handling

For R8: Before creating an edge, verify the target skill node exists in `result.graph.nodes`. If not, log a warning to `result.errors` instead of creating a broken edge.

## Discarded Alternatives

- **Alternative: Auto-discover skills from imports/references in code**
  - *Reason*: Too complex, unreliable, and not the Harness SDD way. Explicit declaration in manifest/markdown is clearer.

- **Alternative: Use a separate relationship file**
  - *Reason*: Adds complexity. The existing `agentic.json` and `SUBAGENT.md` are the canonical sources.

## Risks

- **Risk**: Skill IDs in `agentic.json` might not match skill folder names / `name` in SKILL.md
  - *Mitigation*: Use consistent naming. The parser uses skill `name` from frontmatter or folder name as ID.

- **Risk**: Circular edges if skills reference subagents
  - *Mitigation*: Skills don't reference subagents in current schema. Layout is strictly top-down.

## External Dependencies

- None (uses existing dagre, parser logic)