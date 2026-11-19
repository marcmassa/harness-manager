# Design — BYOH context cost, optimization and inference usage

FEAT-044 prices any harness on one scale. A token in an `always` resource is paid in every session; a skill body is paid only when it triggers; a delegated role is paid in its own context. Today the Optimizer has a per-file estimate (`estimateTokens`, ceil(len/4) prose, ceil(len/3) code) and per-component budget rules OPT-B01–B03, but no notion of when content enters a context. `lmUtils.openAiCompatibleRequest` reads only `choices[0].message.content` and drops `usage`. No path records what the extension's own AI actions cost.

### Load mode ownership

Add `loadMode` to the FEAT-041 source record, not to the graph node type. The owner declares it. Built-in adapters use one pure table in `src/cost/loadMode.ts`, keyed by adapter ID and native semantics the adapter already reads: Cursor `alwaysApply`/`globs`, Copilot `applyTo`, Kiro steering `inclusion`, Harness SDD `applies_to`, skill files `on-trigger`, Claude/SDD/OpenCode subagents `delegated`, hooks `on-event`, prompt files and Gemini commands `manual`, root instruction files `always`. Anything else is `unknown`. Profile v1 entities and the companion `ParserResult` gain an optional `loadMode` field; omission is valid within version 1, so FEAT-041 R7's unknown-version rule is unaffected.

```ts
type LoadMode = 'always' | 'on-trigger' | 'delegated' | 'on-event' | 'manual' | 'unknown';
interface SessionCost { owner: string; baseline: number; catalog: number;
  onDemand: { source: SourceRef; tokens: number }[]; unpriced: SourceRef[]; evaluated: boolean }
function computeSessionCost(sources: CostSource[], calibration?: number): SessionCost[]; // pure
```

### Findings and presentation

New pure rules in `src/cost/rules.ts`, run by the Optimizer engine under FEAT-043 applicability: `OPT-K01` duplicated paragraphs across `always` resources of different owners (normalized-paragraph hash, reuses `src/semanticMatcher.ts` normalization), `OPT-K02` share of baseline per `always` resource (`opinion` tier, `info` ceiling), `OPT-K03` `always` resource whose owner declares an `on-trigger` format (for example a Cursor rule without `globs`). Cost is a new Optimizer section, not a seventh score dimension, so FEAT-043 scores and coverage stay unchanged. The panel shows baseline, catalog, on-demand, unpriced and unevaluated providers, and the calibration factor and price date beside any money figure.

Settings: `harness-dashboard.cost.calibration` (`{ [modelFamily]: number }`), `harness-dashboard.cost.prices` (`{ date, models: { [model]: { inputPerMTok, outputPerMTok } } }`). No defaults ship for prices; an empty table shows tokens only.

### Inference ledger and baseline diff

`src/cost/inferenceLedger.ts` appends `{ ts, action, provider, model, inputTokens, outputTokens, reported }` to `workspaceState` (capped at 500 entries). The OpenAI-compatible path reads `usage.prompt_tokens`/`completion_tokens` (`reported: true`). The `vscode.lm` path calls `model.countTokens` when present (engine is `^1.85`, so feature-detect) and falls back to `estimateTokens` (`reported: false`). Callers: AI refine, spec assist, semantic LLM scorer. The diff reads `git show HEAD:<path>` through the existing `spawn('git', …)` pattern in OptimizerCoordinator, read-only, per source, bounded to sources of detected owners.

### Alternative and risks

A tokenizer dependency (gpt-tokenizer, tiktoken) gives exact counts for one vendor only and costs VSIX budget (375 of 400 KB after FEAT-041 T2); discarded, the calibration factor is the vendor-neutral knob. Inferring load mode from file names was discarded because it re-creates vendor bias; `unknown` is honest. Bundled price defaults were discarded because they go stale silently. Risks: load semantics change between vendor versions (table is one module with tests, profile can override); duplicate detection on large files (cap per source, reuse debounced scan); `countTokens` may itself cost a request on some providers (call once per action, after completion). Out of scope: runs delegated to an external terminal agent are not metered, because the Dashboard does not capture their output; measuring them belongs to a behavioural-evaluation feature.
