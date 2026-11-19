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

## T3 — Cost findings and the cost section

Three deterministic rules (`src/optimizer/rules/cost.ts`) run under the FEAT-043 applicability table, in the existing budget dimension; they add no seventh score dimension:

| Rule | Fires on | Tier and severity | Applicability |
|---|---|---|---|
| `OPT-K01` | normalized paragraphs (≥ 80 characters) shared between `always` resources of different owners | fact, warning | shared |
| `OPT-K02` | one `always` resource holding ≥ 60 % of its owner's baseline of ≥ 1,500 tokens | opinion, info (unvalidated thresholds) | shared |
| `OPT-K03` | an `always` resource in a format with an on-trigger form | opinion, info | convention, declared only by Cursor (globs or description), Copilot (`applyTo`), Kiro (`inclusion: fileMatch`) and Harness SDD (`applies_to` roles) |

`OPT-K01` names every other file and owner in its detail and links them through `relatedNodeIds`.

The Optimizer report now carries `cost`:
- **Session cost** from T2, built from the scanned components.
- **Money estimates** (`src/cost/money.ts`, pure and offline), only when the user sets `harness-dashboard.cost.prices`. No prices ship. Each estimate shows the price date and the calibration factor from `harness-dashboard.cost.calibration` for the model's family; tokens alone stay uncalibrated estimates.

The panel's cost section shows:
- the session total;
- per owner, the baseline, catalog and on-demand figures;
- providers that are not evaluated, with the missing evidence;
- unpriced resources;
- labelled money lines.

Findings on resources the host would not let you edit (`editing.reviewedTextEdit` denied, from the FEAT-041 ownership already sent to the webview) show "Read-only for its owner" instead of fix, AI refine, chat or delegate buttons.

| Requirement | Verification |
|---|---|
| R7 | money.test.ts: no estimate without a dated price table; each estimate carries the date and factor; the module contains no network call. costRules.test.ts: cost section with and without prices. CostSection.test.ts renders the labelled line. |
| R8 | costRules.test.ts: duplication across `CLAUDE.md`, a profile `AGENTS.md` and `copilot-instructions.md`; no finding within one owner or for non-`always` resources; baseline share; on-trigger form only for formats that have one. |
| R9 | costRules.test.ts: the K01 finding names every affected owner and file. CostSection.test.ts: a read-only resource offers no edit action, and an editable one does. |
| R10 | costRules.test.ts and CostSection.test.ts: an unevaluated provider is shown with its missing evidence and excluded from the total. |

Verified: 960 unit tests, build.

## T4 — Inference ledger

`src/cost/inferenceLedger.ts` records each completed model call made by the Dashboard itself: action, provider, model, input and output tokens, and whether the counts were reported or estimated. Both providers in `lmUtils` record at one point each:

- **OpenAI-compatible:** reads `usage.prompt_tokens` and `usage.completion_tokens` (reported), or falls back to the local estimate (estimated). The action is captured when the request starts, because the response callback may run outside the caller's context.
- **`vscode.lm`:** calls `model.countTokens` when the API offers it. The engine range is `^1.85`, so it is feature-detected, and a throwing count falls back. It is called once per action, after completion.

Callers label their calls with `withInferenceAction` (AsyncLocalStorage): AI refine, spec assistance in the coordinator (draft, generate, feature description; the legacy SDD view keeps the default `ai-assist` label), agent descriptions, semantic matching and the provider check. The ledger:
- lives in workspace state, capped at the newest 500 entries;
- stores counts and labels only, never prompts, responses, keys or paths;
- feeds the cost section's "Dashboard AI actions here" line.

Delegated terminal runs are not metered, as stated in design.md.

| Requirement | Verification |
|---|---|
| R11 | inferenceLedger.test.ts: reported OpenAI-compatible usage with its action label; a local estimate flagged as estimated when no usage is reported; `countTokens` present, absent and failing; the 500-entry cap and summary. |
| R12 | inferenceLedger.test.ts: stored entries have exactly the metadata keys, and contain neither the prompt, the response nor the API key. |

Verified: 973 unit tests, build.

## T5 — Cost against git HEAD

The cost section has a "Compare with HEAD" button. It sends `compareCostWithHead`, a read: no operation decision is needed and nothing is written. The coordinator then:
1. runs `git rev-parse` and `git show HEAD:<path>` through `src/cost/gitRunner.ts` (argument array, no shell, 5 s timeout, bounded output);
2. compares, with the pure `compareWithHead`, the session cost of each resource now and at HEAD. Load modes are re-derived from the HEAD frontmatter, so toggling `alwaysApply` counts.

Each resource is reported as changed, new (not in HEAD or untracked) or deleted, and each provider gets its change. A folder that is not a git repository, a repository without commits, or a missing git binary yields "comparison unavailable" with the reason; the cost analysis itself never fails.

`vscodeApi.ts` now tolerates the absence of `window`, so webview components that post messages can be rendered in unit tests. The webview behaves as before.

| Requirement | Verification |
|---|---|
| R13 | baselineDiff.test.ts: changed, new and deleted resources and per-owner totals; unchanged resources counted but not listed. CostSection.test.ts renders both. |
| R14 | baselineDiff.test.ts: not a repository, no commit, git failing; an untracked file is reported as new against a real temporary repository. |
| R15 | baselineDiff.test.ts: the working tree status is identical after reading HEAD. Extension Host check is T6. |

Verified: 978 unit tests, build.
