# FEAT-034 — Component Optimizer

> **Feature ID:** FEAT-034
> **Feature Name:** component-optimizer
> **Type:** feat
> **Priority:** P1
> **Sprint:** Next
> **Release:** v0.8.0
> **Agent:** typescript-implementer

---

## Context

Harness Dashboard has three analysis layers today, and none of them looks *inside* a component:

| Layer | Scope | Granularity |
|---|---|---|
| `src/agentic-detector/` (Advisory) | workspace signals, maturity L0–L5, architecture patterns | **workspace** |
| `src/idoneity.ts` + `src/semanticMatcher.ts` | subagent↔skill semantic fit | **relationship** |
| `src/verifier/codeQualityRunner.ts` (KISS/DRY) | TypeScript source files | **source code, not architecture** |

Nobody evaluates the quality of a `SKILL.md`, a `SUBAGENT.md`, a steering file or a hook script. A skill whose description never states *when* to use it will never be loaded by progressive disclosure. A subagent carrying 4 000 tokens of inline boilerplate silently burns the context budget of every session that touches it. Two skills that overlap at 90 % semantic similarity fragment the model's routing decision. Today all of that is invisible: the graph tells the user **what exists**, never **whether it is well built**.

The **Component Optimizer** closes that gap. It is a linter and refactoring assistant for the architecture's own files.

### Design stance

The engine is **deterministic**. Every finding is produced by a pure, table-driven rule with a stable ID and a reproducible score contribution. No LLM participates in detection or scoring — that is a direct application of `DESIGN.md` principle 3 ("Frugal AI, no surprises") and principle 5 ("Testable, by construction"). AI-assisted rewriting is explicitly **out of scope** for this release and is tracked separately in the backlog.

### Non-goals (this release)

- No LLM-based analysis, scoring or rewriting.
- No `feature` nodes — SDD specs are already served by the Specs Manager panel.
- No `discovered-*` / `cli-install` nodes — those are read-only detection artefacts, not components the user owns.
- No network access of any kind.
- No changes to the semantics of `agentic.json`.

---

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

---

## A — Component model and loading

### R1 — Optimizable component types
- **Pattern:** Ubiquitous
- The optimizer SHALL treat exactly these `NodeType` values as optimizable components: `agent`, `subagent`, `skill`, `steering`, `hook`.
- The optimizer SHALL NOT produce findings for `feature`, `discovered-agent`, `discovered-skill`, `discovered-tool`, `discovered-resource` or `cli-install` nodes.

### R2 — ComponentSource normalization
- **Pattern:** Ubiquitous
- `loadComponent()` SHALL produce a `ComponentSource` for each optimizable node containing: `nodeId`, `nodeType`, `filePath`, `raw` (full file text), `frontmatter` (parsed record), `body` (text after frontmatter), `exists`, and `tokenEstimate`.
- `ComponentSource.raw` SHALL be read from disk via `vscode.workspace.fs` using `metadata._filePath`, NOT from the parser's `body` / `_fullBody` / `_preview` metadata, because those are truncated or type-dependent.

### R3 — Missing file handling
- **Pattern:** Unwanted
- IF a node's `metadata._filePath` is absent, empty, or points at a file that cannot be read, THEN `loadComponent()` SHALL return a `ComponentSource` with `exists: false`, `raw: ''`, `frontmatter: {}`, `body: ''`, `tokenEstimate: 0`, and SHALL NOT throw.

### R4 — Token estimation
- **Pattern:** Ubiquitous
- `estimateTokens(text)` SHALL return a deterministic integer estimate computed locally, without any tokenizer dependency and without any network call.
- The estimator SHALL weight fenced code blocks more densely than prose, because code tokenizes at a lower character-per-token ratio.
- For any two inputs where one is a strict superset of the other, the estimate of the superset SHALL be greater than or equal to that of the subset (monotonicity).

### R5 — Scan scope cap
- **Pattern:** Unwanted
- IF the graph contains more than 500 optimizable nodes, THEN the optimizer SHALL analyze the first 500 in stable node order, SHALL set `report.truncated: true`, and SHALL record the total count in `report.totalComponents`.

---

## B — Rule engine and scoring

### R6 — Rule contract
- **Pattern:** Ubiquitous
- Every rule SHALL be an `OptimizerRule` object exposing: a stable `id`, an `appliesTo` array of `NodeType`, a `dimension`, a `severity`, and an `evaluate(ctx)` function returning zero or more `OptimizerFinding` objects.
- `evaluate()` SHALL be a pure function of its `RuleContext` argument and SHALL perform no I/O.

### R7 — Stable rule identifiers
- **Pattern:** Ubiquitous
- Rule IDs SHALL follow the form `OPT-<F><NN>` where `<F>` is the family letter (`S` structure, `B` budget, `O` overlap, `D` drift, `H` hygiene, `C` consistency — `C` added post-approval, see §H) and `<NN>` is a zero-padded ordinal.
- A rule ID, once shipped, SHALL NOT be reused for a different rule.

### R8 — Finding shape
- **Pattern:** Ubiquitous
- Every `OptimizerFinding` SHALL carry: `ruleId`, `nodeId`, `nodeType`, `filePath`, `severity`, `dimension`, `title`, `detail`, an optional `line` (1-based), an optional `relatedNodeIds` array, and an optional `fix` descriptor.

### R9 — Scoring dimensions
- **Pattern:** Ubiquitous
- Each finding SHALL belong to exactly one dimension.
- **AMENDED post-approval — see §H.** The dimension set is `structure`, `clarity`, `budget`, `integration`, `hygiene`, `consistency` (six). The approved text named four: `structure`, `budget`, `integration`, `hygiene`.

### R10 — Deterministic score computation
- **Pattern:** Ubiquitous
- Each dimension score SHALL be computed as `max(0, 100 − Σ weight(severity))` over the findings in that dimension for that component, with weights `error: 25`, `warning: 10`, `info: 3`.
- The component score SHALL be the arithmetic mean of the dimension scores, rounded to the nearest integer.
- Given the same `ComponentSource` set and the same configuration, two runs SHALL produce identical scores.

### R11 — Score tiers
- **Pattern:** Ubiquitous
- A component score SHALL map to a tier: `A` (90–100), `B` (75–89), `C` (60–74), `D` (40–59), `F` (0–39).

### R12 — Architecture rollup
- **Pattern:** Ubiquitous
- `OptimizerReport` SHALL include an `architectureScore` equal to the arithmetic mean of all component scores, rounded to the nearest integer, and `0` when there are no components.
- `OptimizerReport` SHALL include `findingCounts` broken down by severity and by dimension.

---

## C — Rule packs

### R13 — OPT-S01 missing or invalid frontmatter
- **Pattern:** Ubiquitous
- FOR `agent`, `subagent`, `skill`, `steering`: WHEN the file has no YAML frontmatter block, or the block fails to parse, the optimizer SHALL emit `OPT-S01` at severity `error`, dimension `structure`.

### R14 — OPT-S02 name / directory mismatch
- **Pattern:** Ubiquitous
- FOR `subagent`, `skill`: WHEN `frontmatter.name` is present and does not equal the containing directory name, the optimizer SHALL emit `OPT-S02` at severity `warning`, dimension `structure`, and SHALL attach a fix of type `set-frontmatter-field`.

### R15 — OPT-S03 description length bounds
- **Pattern:** Ubiquitous
- FOR `agent`, `subagent`, `skill`: WHEN `frontmatter.description` is absent or shorter than 20 characters, the optimizer SHALL emit `OPT-S03` at severity `error`.
- WHEN `frontmatter.description` exceeds 1024 characters, the optimizer SHALL emit `OPT-S03` at severity `warning`.

### R16 — OPT-S04 description states no trigger condition
- **Pattern:** Ubiquitous
- FOR `skill`: WHEN `frontmatter.description` is present, is at least 20 characters, and contains none of the configured trigger markers (case-insensitive `use when`, `use this when`, `when the user`, `for when`, `invoke when`, `triggers on`, `apply when`), the optimizer SHALL emit `OPT-S04` at severity `warning`, dimension `structure`.
- The finding detail SHALL explain that progressive disclosure selects a skill from its description alone, so a description without a trigger condition is unlikely to ever be loaded.

### R17 — OPT-S05 missing required sections
- **Pattern:** Ubiquitous
- FOR `skill`: WHEN the body contains no heading matching `/^#{1,3}\s*(usage|how to use|examples?)/im`, the optimizer SHALL emit `OPT-S05` at severity `warning`, dimension `structure`, with a fix of type `append-section-stubs`.
- FOR `subagent`: WHEN the body contains no heading matching `/^#{1,3}\s*(role|responsibilit)/im`, the optimizer SHALL emit `OPT-S05` at severity `warning` with the same fix type.

### R18 — OPT-S06 hook and steering contract
- **Pattern:** Ubiquitous
- FOR `hook`: WHEN `metadata.event` is absent or empty, the optimizer SHALL emit `OPT-S06` at severity `error`, dimension `structure`.
- FOR `hook`: WHEN `metadata.script` names a path that does not exist in the workspace, the optimizer SHALL emit `OPT-S06` at severity `error`.
- FOR `steering`: WHEN `frontmatter.appliesTo` (or `applies_to`) is absent, the optimizer SHALL emit `OPT-S06` at severity `warning`.

### R19 — OPT-B01 component over token budget
- **Pattern:** Optional
- **AMENDED post-approval — see §H, supersedes the approved text below.**
- WHEN a component's `tokenEstimate` exceeds `budgetMedianMultiple × the median of same-typed components`, the optimizer SHALL emit `OPT-B01`, dimension `budget`.
- WHERE the workspace holds fewer than `MIN_SAMPLE_FOR_RELATIVE` components of that type, the configured absolute `tokenBudget.<type>` SHALL be used as a fallback.
- The finding detail SHALL state which basis was used, and for the relative basis the median and sample size.
- ~~WHEN the estimate exceeds three times the budget, the severity SHALL be `error`.~~ Superseded by R56: `OPT-B01` is `opinion`-tier and capped at `info`.

### R20 — OPT-B02 extractable reference content
- **Pattern:** Ubiquitous
- WHEN a component exceeds its token budget AND its body contains three or more top-level (`##`) sections, the optimizer SHALL emit `OPT-B02` at severity `info`, dimension `budget`, naming the sections after the second one as extraction candidates, with a fix of type `extract-to-references`.

### R21 — OPT-B03 agent context rollup
- **Pattern:** Ubiquitous
- FOR `agent` and `subagent`: the optimizer SHALL compute a rollup estimate equal to the component's own estimate plus the estimates of every component reachable over a `uses` or `governs` edge.
- WHEN the rollup exceeds `harness-dashboard.optimizer.tokenBudget.agentRollup`, the optimizer SHALL emit `OPT-B03`, dimension `budget`, listing the three largest contributors.
- **AMENDED post-approval:** severity is `info`, not `warning` — `OPT-B03` is `opinion`-tier per R56.

### R22 — OPT-O01 semantic overlap between components
- **Pattern:** Ubiquitous
- The optimizer SHALL compute pairwise cosine similarity between the descriptions of same-typed components using the existing `src/semanticMatcher.ts` TF-IDF implementation.
- WHEN a pair's similarity is at or above `harness-dashboard.optimizer.overlapThreshold`, the optimizer SHALL emit `OPT-O01` at severity `warning`, dimension `integration`, on **both** components, each naming the other in `relatedNodeIds`.

### R23 — OPT-O02 orphan and under-connected components
- **Pattern:** Ubiquitous
- FOR `skill`: WHEN no edge with label `uses` targets it, the optimizer SHALL emit `OPT-O02` at severity `warning`, dimension `integration`.
- FOR `subagent`: WHEN it owns no `uses` edge and is the target of no `governs` edge, the optimizer SHALL emit `OPT-O02` at severity `info`.
- FOR `steering`: WHEN its `appliesTo` glob matches no file in the workspace, the optimizer SHALL emit `OPT-O02` at severity `warning`.

### R24 — OPT-O03 ownership mismatch
- **Pattern:** Ubiquitous
- The optimizer SHALL reuse `detectMismatches()` from `src/idoneity.ts` and SHALL emit `OPT-O03` at severity `info`, dimension `integration`, for every reported mismatch, naming the better-scoring owner in `relatedNodeIds`.

### R25 — OPT-D01 manifest / filesystem drift
- **Pattern:** Ubiquitous
- WHEN a component is declared in `.agents/agentic.json` but its file does not exist on disk, the optimizer SHALL emit `OPT-D01` at severity `error`, dimension `integration`.
- WHEN two components of the same type share a `frontmatter.name` across different frameworks, the optimizer SHALL emit `OPT-D01` at severity `warning` on both.

### R26 — OPT-D02 broken cross-references
- **Pattern:** Ubiquitous
- The optimizer SHALL reuse the cross-reference scan from `src/parserLogic.ts` and SHALL emit `OPT-D02` at severity `warning`, dimension `integration`, for every markdown or wiki link in a component body whose target resolves to no known node ID and to no existing file.

### R27 — OPT-H01 absolute paths and machine-specific values
- **Pattern:** Ubiquitous
- WHEN a component body contains an absolute filesystem path matching `/(^|\s)(\/Users\/|\/home\/|[A-Z]:\\)/m`, the optimizer SHALL emit `OPT-H01` at severity `warning`, dimension `hygiene`, with a `line`, and SHALL attach a fix of type `relativize-path` when the path is inside the workspace root.

### R28 — OPT-H02 credential-shaped strings
- **Pattern:** Ubiquitous
- WHEN a component body matches any configured credential pattern (`sk-[A-Za-z0-9]{16,}`, `ghp_[A-Za-z0-9]{20,}`, `AKIA[0-9A-Z]{16}`, `-----BEGIN [A-Z ]*PRIVATE KEY-----`), the optimizer SHALL emit `OPT-H02` at severity `error`, dimension `hygiene`, with a `line`.
- The finding `detail` SHALL NOT reproduce the matched secret; it SHALL report only the pattern name and the line number.

### R29 — OPT-H03 vague-quantifier density
- **Pattern:** Ubiquitous
- The optimizer SHALL count occurrences of configured vague quantifiers (`appropriate`, `as needed`, `if necessary`, `some`, `various`, `etc.`, `and so on`) in the body.
- WHEN the count exceeds one occurrence per 150 estimated tokens, the optimizer SHALL emit a **single** `OPT-H03` finding at severity `info`, dimension `hygiene`, reporting the density.
- The optimizer SHALL NOT emit one finding per occurrence, because per-occurrence reporting produces an unacceptable false-positive rate.

### R30 — Rule disablement
- **Pattern:** Optional
- WHERE a rule ID appears in `harness-dashboard.optimizer.disabledRules`, the engine SHALL skip that rule entirely and its findings SHALL NOT contribute to any score.

---

## D — Quick fixes

### R31 — Supported fix types
- **Pattern:** Ubiquitous
- The optimizer SHALL support exactly these deterministic fix types: `set-frontmatter-field`, `insert-frontmatter`, `append-section-stubs`, `extract-to-references`, `relativize-path`.
- Every fix SHALL be computed as a pure function `applyFix(source, fix) → string` returning the proposed full file content.

### R32 — Preview before write
- **Pattern:** Event
- WHEN the user requests a quick fix, the extension SHALL open a native VS Code diff between the current file and the proposed content, and SHALL NOT write anything to disk until the user explicitly confirms.

### R33 — Diff virtual document
- **Pattern:** Ubiquitous
- The proposed content SHALL be served through a registered `TextDocumentContentProvider` on the `harness-optimizer` URI scheme, so that no temporary file is created in the user's workspace.

### R34 — Write path
- **Pattern:** Event
- WHEN the user confirms a quick fix, the extension SHALL write the proposed content through `HarnessWriter` using the same atomic-write path used by every other mutation, and SHALL then trigger a re-scan.

### R35 — Fix failure is non-fatal
- **Pattern:** Unwanted
- IF a quick fix cannot be computed or the write fails, THEN the extension SHALL post a `quickFixResult` message with `ok: false` and a human-readable reason, SHALL log to the output channel, and SHALL leave the file untouched.

### R36 — extract-to-references safety
- **Pattern:** Unwanted
- IF the target `references/<slug>.md` file already exists, THEN the `extract-to-references` fix SHALL be reported as unavailable rather than overwriting the existing file.

---

## E — Optimizer panel

### R37 — Fourth tab
- **Pattern:** Ubiquitous
- The webview SHALL render a fourth tab labelled "Optimizer" alongside Whiteboard, Specs Manager and Advisory, following the existing tab-rendering pattern in `src/webview/index.tsx`.

### R38 — Architecture score header
- **Pattern:** Ubiquitous
- The Optimizer panel SHALL render a header showing the architecture score, its tier, the total component count, and the finding counts by severity.
- The header SHALL include a Re-scan button that follows the same disabled/spinner behaviour as the Advisory panel's Re-scan button.

### R39 — Component table
- **Pattern:** Ubiquitous
- The panel SHALL render one row per analyzed component showing: node label, node type, score, tier, token estimate, and finding count.
- Rows SHALL be sorted by score ascending (worst first) by default.

### R40 — Row expansion
- **Pattern:** Event
- WHEN a component row is activated, the panel SHALL expand it to list that component's findings, each showing severity, rule ID, title, detail, and — where a fix exists — a fix button.

### R41 — Filters
- **Pattern:** Ubiquitous
- The panel SHALL offer filters by node type, by severity, and by dimension. Filters SHALL compose with AND semantics.

### R42 — Open in editor
- **Pattern:** Event
- WHEN the user activates a finding's file reference, the extension SHALL open the component file in the editor at the finding's `line` when one is present.

### R43 — Finding dismissal
- **Pattern:** Event
- WHEN the user dismisses a finding, the key `<ruleId>::<nodeId>` SHALL be persisted to `workspaceState` under `harness-dashboard.dismissedOptimizerFindings`, and the finding SHALL be excluded from subsequent reports and from all score computations.
- The panel SHALL display the dismissed count and SHALL offer a control to restore all dismissed findings.

### R44 — Empty state
- **Pattern:** State
- WHILE no optimizable component exists in the graph, the panel SHALL render an explanatory empty state rather than an empty table.

---

## F — Whiteboard integration

### R45 — Score chip on nodes
- **Pattern:** Optional
- WHERE a node has a score in the current report, `CustomNode` SHALL render a compact score chip whose colour is derived from the tier.
- Nodes with no score in the report SHALL render no chip.

### R46 — Chip tooltip
- **Pattern:** Ubiquitous
- The score chip's `title` SHALL state the score, the tier, and the number of findings.

### R47 — Re-scan wiring
- **Pattern:** Event
- WHEN a component file is written by any code path that already calls `scheduleScan()`, the optimizer report SHALL be recomputed and re-broadcast, using the same debounce as the advisory scan.

### R48 — Message types
- **Pattern:** Ubiquitous
- The following message types SHALL be added to `WebviewMessageType` and to `KNOWN_MESSAGE_TYPES` in `src/types.ts`: `getOptimizerReport`, `optimizerReport`, `runOptimizerScan`, `applyQuickFix`, `quickFixResult`, `dismissOptimizerFinding`, `restoreOptimizerFindings`.

---

## G — Configuration and performance

### R49 — Settings contributions
- **Pattern:** Optional
- `package.json#contributes.configuration` SHALL declare: `harness-dashboard.optimizer.enabled` (boolean, default `true`), `harness-dashboard.optimizer.tokenBudget.skill` (number, default `500`), `harness-dashboard.optimizer.tokenBudget.subagent` (number, default `1500`), `harness-dashboard.optimizer.tokenBudget.steering` (number, default `800`), `harness-dashboard.optimizer.tokenBudget.agentRollup` (number, default `8000`), `harness-dashboard.optimizer.overlapThreshold` (number, default `0.8`), `harness-dashboard.optimizer.disabledRules` (array of string, default `[]`).

### R50 — Kill switch
- **Pattern:** Optional
- WHERE `harness-dashboard.optimizer.enabled` is `false`, no scan SHALL run, no chip SHALL render, and the Optimizer tab SHALL render a disabled state naming the setting.

### R51 — Command contribution
- **Pattern:** Ubiquitous
- A command `harness-dashboard.optimizeComponents` titled "Harness: Optimize Components" SHALL be contributed; invoking it SHALL reveal the dashboard, activate the Optimizer tab, and trigger a scan.

### R52 — Performance budget
- **Pattern:** Ubiquitous
- For a workspace of 100 components averaging 2 KB each, a full scan SHALL complete in under 1 000 ms on the CI runner, excluding file I/O.
- Rule evaluation SHALL run entirely in the extension host and SHALL NOT block the webview.

### R53 — Scan failure is non-fatal
- **Pattern:** Unwanted
- IF the scan throws for any reason, THEN the error SHALL be logged to the `Harness Dashboard` output channel, an `optimizerReport` with `ok: false` SHALL be posted, and neither the whiteboard nor any other panel SHALL be affected.

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| Every architecture component gets a reproducible quality score | R1, R2, R9, R10, R11, R12 |
| Structural contract violations are detected per component type | R13–R18 |
| Context-budget waste is quantified per component and per agent | R4, R19, R20, R21 |
| Redundant, orphaned and misplaced components are surfaced | R22, R23, R24 |
| Manifest/filesystem drift and broken links are surfaced | R25, R26 |
| Machine-specific paths and credential-shaped strings are caught | R27, R28 |
| Prompt vagueness is reported without false-positive spam | R29 |
| Safe fixes can be applied without leaving the IDE | R31–R36 |
| The user can browse, filter and triage findings | R37–R44 |
| Component health is visible from the whiteboard | R45, R46, R47 |
| The feature is configurable and fully switchable off | R30, R49, R50, R51 |
| The feature never degrades existing functionality | R3, R5, R35, R52, R53 |

---

## H — Post-approval amendments

These requirements were added after the human approval gate, following an audit of
whether the shipped evaluations were actually correct. They are recorded here
rather than folded silently into A–G so the delta against the approved spec stays
visible.

**What triggered them.** Measured against the five real skills in this repository
(472, 719, 939, 1093 and 1991 estimated tokens), the approved fixed budget of 500
tokens for a skill flagged **four of the five**, one of them as an `error`. A rule
that reports 80% of a competent author's corpus is not measuring quality; it is
measuring that the constant was invented. The audit also found that several
thresholds presented as findings had no validated basis at all.

### R54 — Relative, self-calibrating budgets
- **Pattern:** Ubiquitous
- Budget rules SHALL judge a component against `budgetMedianMultiple × the median
  of same-typed components in the workspace`, falling back to the configured
  absolute budget only below `MIN_SAMPLE_FOR_RELATIVE` components of that type.
- A percentile SHALL NOT be used: a percentile always reports a fixed fraction of
  the corpus, so a workspace whose components are uniformly good would still be
  reported. A median multiple can legitimately report nothing.

### R55 — Rule confidence tiers
- **Pattern:** Ubiquitous
- Every rule SHALL declare a `confidence` of `fact`, `heuristic` or `opinion`:
  verifiable against the filesystem or graph; real mechanism with approximate
  detection; or firing on an unvalidated threshold.

### R56 — Severity ceiling by confidence
- **Pattern:** Ubiquitous
- The engine SHALL clamp every finding's severity to its rule's ceiling — `fact`
  → up to `error`, `heuristic` → up to `warning`, `opinion` → up to `info` — after
  the rule emits, so no rule can bypass it.
- An unvalidated threshold SHALL NOT be able to deduct as much as a verifiable
  defect.

### R57 — Clarity dimension
- **Pattern:** Ubiquitous
- `OPT-S04` (description states no trigger condition) and `OPT-H03` (vague
  quantifier density) SHALL belong to a `clarity` dimension rather than to
  `structure` and `hygiene`, leaving `structure` as pure contract and `hygiene`
  as pure safety.

### R58 — Consistency dimension
- **Pattern:** Ubiquitous
- `OPT-C01` (frontmatter keys) and `OPT-C02` (section headings) SHALL report a
  component that diverges from the conventions of its same-typed peers.
- The convention SHALL be DERIVED from the corpus — items present in at least
  `CONVENTION_MAJORITY` of same-typed components — never prescribed, and SHALL be
  inferred only at or above `MIN_SAMPLE_FOR_CONVENTION` components.

### R59 — Dimension radar
- **Pattern:** Ubiquitous
- The panel SHALL render a radar of the dimension scores at architecture level and
  per component, with a fixed axis order, every axis direct-labelled with its
  value, the radial scale numbered at 0/25/50/75/100, and banded ranges.
- The chart SHALL be inline SVG with no charting dependency, and SHALL take grid
  and text colours from VS Code theme variables.

### R60 — Evaluation legend
- **Pattern:** Ubiquitous
- The panel SHALL offer a collapsible legend stating, per dimension, the question
  it asks, the rule IDs that feed it, its current value, and the finding count,
  plus the deduction model and the confidence ceiling.

### R61 — Validated tier palette
- **Pattern:** Ubiquitous
- Tier colours SHALL come from the validated four-role status palette. The
  originally shipped five hand-picked hues measured ΔE 10.2 between tiers A and B
  in normal vision against a floor of 15 — indistinguishable — so A and B SHALL
  share the `good` step and the tier letter SHALL carry the five-way distinction.
- A tier colour SHALL never appear without its numeric score adjacent.
