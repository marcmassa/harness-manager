# FEAT-043 implementation evidence

## T1 — Owner semantics and rule applicability

`src/optimizer/applicability.ts` holds one table:
- **Shared rules** run on any readable source: hygiene, budget, drift, content overlap, consistency.
- **Convention rules** depend on what the owning format documents, and run only where it documents them:

| Rule | Convention |
|---|---|
| `OPT-S01` | frontmatter |
| `OPT-S02` | name matches its folder |
| `OPT-S03` | required description |
| `OPT-S04` | trigger markers |
| `OPT-S05` | required sections |
| `OPT-S06` | hook contract and steering scope |
| `OPT-O02` | explicit skill and role links |

Conventions per format, from each format's own contract:
- **Harness SDD**: all of them.
- **Claude Code**: frontmatter and description for subagents and skills; folder naming and trigger markers for skills.
- **Kiro**: the skill conventions.

Cursor, Copilot, OpenCode, Windsurf, AGENTS.md, workspace profiles and companions declare none, so only shared rules run on their components.

Other changes:
- The engine skips a rule the component's owner does not support. `applicability()` reports why, which is input for the T2 coverage.
- Every finding carries the component's `source` (native URI and owner).
- The owner comes from the FEAT-041 source record, which the loader already carries.

| Requirement | Verification |
|---|---|
| R1 | applicability.test.ts: every registered rule is classified; the 0.8.2 Claude reviewer fixture no longer gets `OPT-S02` (rename to `agents`) or `OPT-S05`, but keeps Claude's own frontmatter rule; a custom profile without conventions gets only shared rules; a Harness SDD skill whose name differs from its folder still gets `OPT-S02` (native positive control); without a known owner no convention applies. |
| R4 | applicability.test.ts: the `OPT-S02` finding carries its source and owner. Panel display is T2. |

Verified: 891 unit tests.
