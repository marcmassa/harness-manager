# FEAT-044 implementation evidence

## T1 — Owner-declared load modes

`SourceIdentity.loadMode` records when a resource enters a model's context. `src/cost/loadMode.ts` resolves it from the owning provider:

- **Built-in providers** use one table, keyed by the native semantics their adapter already reads. Only the table counts; a `_loadMode` written in a built-in format's own frontmatter is ignored.

| Provider | Resource | Load mode |
|---|---|---|
| Claude Code | `CLAUDE.md` | always |
| Claude Code | agents | delegated |
| Claude Code | skills | on-trigger |
| Harness SDD | subagents | delegated |
| Harness SDD | skills | on-trigger |
| Harness SDD | steering with `applies_to` `*` | always |
| Harness SDD | steering for named roles | delegated |
| Gemini CLI | `GEMINI.md` | always |
| Gemini CLI | TOML commands | manual |
| Copilot | `copilot-instructions.md` | always |
| Copilot | `*.instructions.md` with `applyTo` | on-trigger |
| Copilot | `*.instructions.md` without `applyTo` | always |
| Copilot | prompt files | manual |
| Cursor | `.cursorrules` | always |
| Cursor | `.mdc` with `alwaysApply` | always |
| Cursor | `.mdc` with `globs` or a description | on-trigger |
| Cursor | other `.mdc` | manual |
| Kiro | skills | on-trigger |
| Kiro | steering, by `inclusion` | always (default), on-trigger (`fileMatch`), manual (`manual`) |
| Windsurf | `.windsurfrules` | always |
| OpenCode | subagents | delegated |
| any provider | hooks | on-event (scripts, not context) |

- **Profile v1 entities** may declare `loadMode`. An invalid value is reported and skips the entity; omitting it keeps the profile valid and the resources `unknown`.
- **Companions** declare `metadata._loadMode` per node.
- **Everything else is `unknown`.** That includes a branded file name claimed by a profile or companion without a declaration.

`sourceGraph.attributeSources` stamps the result on every node's source record, so the graph, Advisory and Optimizer all see it.

| Requirement | Verification |
|---|---|
| R1 | loadMode.test.ts: every table row (25 cases), plus resources a provider does not describe yielding `unknown`. byohProviders.test.ts: a profile entity's declaration reaches the source record. |
| R2 | loadMode.test.ts: `CLAUDE.md` and `GEMINI.md` claimed by a profile or companion without a declaration stay `unknown`; frontmatter in a built-in format is ignored. |
| R3 | loadMode.test.ts: a v1 profile is valid with or without the field, and an invalid value is reported; profile and companion declarations apply; a v1 companion without the field validates. |

Verified: 944 unit tests.
