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

## T2 — Session cost per provider

`computeSessionCost` (src/cost/sessionCost.ts, pure) groups resources by owner:

| Load mode | Counted as |
|---|---|
| `always` | session baseline |
| `on-trigger` | its description in the session catalog, its body on demand |
| `delegated`, `manual` | on demand |
| `on-event` | nothing (hooks run scripts, not context) |
| `unknown` | listed as unpriced with its estimate, never counted as zero in any total |

A provider with no declared mode is unevaluated: it shows the missing evidence and is excluded from the workspace total.

A calibration factor scales every figure only when the user configures one for the selected model family (`calibrationFor`), and the report then names the factor.

`costSourcesFrom` builds the inputs from the components the Optimizer already loaded, reusing the local token estimator. Synthetic and missing nodes have no content to load and are excluded.

| Requirement | Verification |
|---|---|
| R4 | sessionCost.test.ts: baseline, catalog and on-demand sums per owner, including `on-event` and `manual`. |
| R5 | sessionCost.test.ts: unknown resources are listed with their tokens and kept out of every total. |
| R6 | sessionCost.test.ts: the factor applies only when configured for the family; invalid factors are ignored; inputs come from the local estimator. |
| R10 | sessionCost.test.ts: a provider with no declared mode is unevaluated and excluded from the total. |

Verified: 36 cost tests in the full suite.
