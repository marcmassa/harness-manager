# Tasks — Component Optimizer

> Discrete steps in implementation order. Mark `[x]` on completion.
> Each task references the R<n> it covers.
> Groups A–H are ordered so that every group is independently testable:
> A–D are pure modules with no `vscode` import, E wires them into the host,
> F–G surface them in the webview, H closes the release.

---

## Group A — Foundation (pure, no `vscode`)

- [x] **T1** — Create `src/optimizer/types.ts` with `OptimizerDimension`, `OptimizerSeverity`, `ScoreTier`, `OptimizableType`, `ComponentSource`, `QuickFixType`, `QuickFix`, `OptimizerFinding`, `RuleContext`, `OptimizerRule`, `ComponentScore`, `OptimizerReport`, `OptimizerConfig` exactly as specified in `design.md` §A _(R1, R2, R6, R8, R9, R31)_

- [x] **T2** — Implement `estimateTokens(text)` in `src/optimizer/tokenEstimator.ts`: split on fenced code blocks, `ceil(len/4)` for prose, `ceil(len/3)` for code _(R4)_

- [x] **T3** — Write `src/optimizer/tokenEstimator.test.ts`: known-fixture ranges, code blocks estimate denser than equal-length prose, monotonicity over a superset pair, empty string yields 0 _(R4)_

- [x] **T4** — Implement `loadComponents(nodes, root, readFile)` in `src/optimizer/componentLoader.ts`: filter to the five optimizable types, read via the injected `readFile` using `metadata._filePath`, split frontmatter with `src/frontmatter.ts`, compute `tokenEstimate` _(R1, R2)_

- [x] **T5** — Add the missing-file path to `loadComponents`: absent/empty/unreadable `_filePath` yields `exists: false` with empty `raw`/`body`/`frontmatter` and `tokenEstimate: 0`, never throwing _(R3)_

- [x] **T6** — Write `src/optimizer/componentLoader.test.ts`: the six non-optimizable node types are excluded, frontmatter/body split is correct, missing file is handled, parser metadata (`body`, `_fullBody`, `_preview`) is provably not consulted _(R1, R2, R3)_

---

## Group B — Rule packs (pure, no `vscode`)

- [x] **T7** — Implement `src/optimizer/rules/structure.ts`: `OPT-S01` frontmatter presence/parse, `OPT-S02` name↔directory mismatch with a `set-frontmatter-field` fix, `OPT-S03` description length bounds _(R13, R14, R15)_

- [x] **T8** — Add `OPT-S04` to `structure.ts`: skill description with no trigger marker from the configured list, with the progressive-disclosure rationale in `detail` _(R16)_

- [x] **T9** — Add `OPT-S05` and `OPT-S06` to `structure.ts`: required-section headings per type with an `append-section-stubs` fix; hook `event`/`script` contract and steering `appliesTo` presence _(R17, R18)_

- [x] **T10** — Write `src/optimizer/rules/structure.test.ts`: one positive and one negative case per rule, per applicable node type _(R13–R18)_

- [x] **T11** — Implement `src/optimizer/rules/budget.ts`: `OPT-B01` over-budget with ×3 escalation to `error`, `OPT-B02` extractable sections with an `extract-to-references` fix _(R19, R20)_

- [x] **T12** — Add `OPT-B03` to `budget.ts`: rollup over `uses` and `governs` edges, threshold against `tokenBudget.agentRollup`, three largest contributors named in `detail` _(R21)_

- [x] **T13** — Write `src/optimizer/rules/budget.test.ts`: threshold boundaries (at, just under, just over), the ×3 escalation, contributor ordering, rollup on an agent with no outgoing edges _(R19, R20, R21)_

- [x] **T14** — Implement `src/optimizer/rules/overlap.ts` `OPT-O01`: build the corpus with `tokenize`/`computeIdf`/`buildTfidfVectors` from `src/semanticMatcher.ts`, pairwise `cosineSimilarity`, emit on **both** components with each naming the other in `relatedNodeIds` _(R22)_

- [x] **T15** — Add `OPT-O02` to `overlap.ts`: orphan skill, under-connected subagent, steering whose glob matches nothing (glob match resolved from `ctx.existingPaths`) _(R23)_

- [x] **T16** — Add `OPT-O03` to `overlap.ts`: call `computeIdoneityMatrix()` + `detectMismatches()` from `src/idoneity.ts` and map each `MismatchInfo` to one `info` finding _(R24)_

- [x] **T17** — Write `src/optimizer/rules/overlap.test.ts`: symmetric emission, threshold boundary at exactly `overlapThreshold`, orphan detection, mismatch mapping preserves `bestOwner` in `relatedNodeIds` _(R22, R23, R24)_

- [x] **T18** — Implement `src/optimizer/rules/drift.ts`: `OPT-D01` manifest-declared but file-missing plus cross-framework duplicate `frontmatter.name`; `OPT-D02` broken cross-references via `scanCrossReferences()` from `src/parserLogic.ts` _(R25, R26)_

- [x] **T19** — Write `src/optimizer/rules/drift.test.ts`: missing file, duplicate name emits on both components, link resolving to a known node ID produces no finding, link resolving to an existing file produces no finding _(R25, R26)_

- [x] **T20** — Implement `src/optimizer/rules/hygiene.ts`: `OPT-H01` absolute paths with `line` and a conditional `relativize-path` fix, `OPT-H02` credential patterns with `line` _(R27, R28)_

- [x] **T21** — Add `OPT-H03` to `hygiene.ts`: vague-quantifier density as a **single** `info` finding above one occurrence per 150 estimated tokens _(R29)_

- [x] **T22** — Write `src/optimizer/rules/hygiene.test.ts`: each credential pattern matches; **assert no finding `detail` or `title` contains the matched secret substring**; density boundary just under and just over; a long document with sparse vague words yields no finding _(R28, R29)_

- [x] **T23** — Create `src/optimizer/rules/index.ts` exporting `ALL_RULES` and `activeRules(disabled)`; assert at module level that every rule ID is unique and matches `/^OPT-[SBODH]\d{2}$/` _(R7, R30)_

---

## Group C — Scoring and engine

- [x] **T24** — Implement `src/optimizer/scorer.ts`: `SEVERITY_WEIGHT`, `scoreComponent`, `tierFor`, `rollup` per `design.md` §E _(R10, R11, R12)_

- [x] **T25** — Write `src/optimizer/scorer.test.ts`: weight arithmetic per dimension, clamp at 0 for five errors in one dimension, all eight tier boundaries (39/40, 59/60, 74/75, 89/90), empty rollup returns 0 _(R10, R11, R12)_

- [x] **T26** — Implement `src/optimizer/optimizerEngine.ts` `scan(sources, edges, nodeIds, existingPaths, config, dismissed)`: build `RuleContext`, run `activeRules`, filter dismissed keys **before** scoring, aggregate `findingCounts`, return `OptimizerReport` _(R12, R30, R43)_

- [x] **T27** — Add the 500-component cap to the engine: stable node order, `truncated: true`, `totalComponents` set to the untruncated count _(R5)_

- [x] **T28** — Wrap rule evaluation in a per-rule try/catch and the whole scan in a try/catch returning `{ ok: false, error }`; a throwing rule must not abort the other rules _(R53)_

- [x] **T29** — Write `src/optimizer/optimizerEngine.test.ts`: the cap, rule disablement removes findings **and** their score contribution, a throwing rule is contained, dismissed findings do not affect scores, and a determinism check running the same scan twice and asserting deep equality minus `scanTimestamp` _(R5, R10, R30, R43, R53)_

- [x] **T30** — Add the performance assertion to `optimizerEngine.test.ts`: 100 generated 2 KB components, pre-loaded sources, full scan under 1 000 ms _(R52)_

---

## Group D — Quick fixes

- [x] **T31** — Implement `computeFix(source, fix)` in `src/optimizer/quickFix.ts` for `insert-frontmatter`, `set-frontmatter-field` and `append-section-stubs`, re-serializing frontmatter through `src/frontmatter.ts` _(R31)_

- [x] **T32** — Implement `extract-to-references` and `relativize-path` in `quickFix.ts`; `extract-to-references` returns `{ ok: false, reason }` when the target `references/<slug>.md` already exists _(R31, R36)_

- [x] **T33** — Write `src/optimizer/quickFix.test.ts`: every transform produces content that re-parses to valid frontmatter + body, `extract-to-references` refuses an existing target, `relativize-path` leaves a path outside the workspace root untouched _(R31, R36)_

- [x] **T34** — Implement `src/optimizer/optimizerDiffProvider.ts`: a `TextDocumentContentProvider` on the `harness-optimizer` scheme with `stage(uri, content)` / `clear(uri)` over an in-memory `Map` _(R33)_

---

## Group E — Host wiring

- [x] **T35** — Add `getOptimizerReport`, `optimizerReport`, `runOptimizerScan`, `applyQuickFix`, `quickFixResult`, `dismissOptimizerFinding`, `restoreOptimizerFindings` to the `WebviewMessageType` union **and** to `KNOWN_MESSAGE_TYPES` in `src/types.ts` _(R48)_

- [x] **T36** — Extend `src/messageDiscriminator.test.ts` to assert `isKnownWebviewMessage` accepts all seven new types _(R48)_

- [x] **T37** — Create `src/coordinators/OptimizerCoordinator.ts` following the existing `handle(msg, postMessage, sendData): Promise<boolean>` contract; handle `getOptimizerReport` (cached or scan) and `runOptimizerScan`; hold the cached `OptimizerReport` _(R48)_

- [x] **T38** — Add `dismissOptimizerFinding` and `restoreOptimizerFindings` to the coordinator, persisting `<ruleId>::<nodeId>` to `workspaceState` under `harness-dashboard.dismissedOptimizerFindings`, then re-scanning _(R43)_

- [x] **T39** — Add `applyQuickFix` to the coordinator: `computeFix` → `diffProvider.stage` → `vscode.diff` → modal confirmation → `HarnessWriter` write → `scheduleScan()`; post `quickFixResult` with `ok` and a reason on every path _(R32, R34, R35)_

- [x] **T40** — Add `readOptimizerConfig()` reading the seven `harness-dashboard.optimizer.*` settings with the documented defaults _(R49)_

- [x] **T41** — Wire the coordinator into `src/extension.ts`: instantiate it, register the diff provider in `context.subscriptions`, append it to the `||` handler chain, and short-circuit every path when `optimizer.enabled` is `false` _(R48, R50)_

- [x] **T42** — Recompute and re-broadcast the optimizer report inside the existing `scheduleScan` debounce path so writes from any coordinator refresh it _(R47)_

- [x] **T43** — Contribute the `harness-dashboard.optimizeComponents` command ("Harness: Optimize Components") in `package.json` and register it in `extension.ts` to reveal the dashboard, activate the Optimizer tab and trigger a scan _(R51)_

- [x] **T44** — Contribute the seven `harness-dashboard.optimizer.*` settings in `package.json#contributes.configuration` with the defaults from R49 _(R49)_

---

## Group F — Optimizer panel

- [x] **T45** — Create `src/webview/OptimizerPanel.tsx` with the header: architecture score, tier, component count, counts by severity, and a Re-scan button matching the `AdvisoryPanel` disabled/spinner behaviour _(R38)_

- [x] **T46** — Add the component table to `OptimizerPanel.tsx`: one row per component with label, type, score, tier, token estimate and finding count, sorted by score ascending by default _(R39)_

- [x] **T47** — Add row expansion listing that component's findings with severity pill, rule ID, title, detail, and a fix button where `finding.fix` exists _(R40)_

- [x] **T48** — Add the type / severity / dimension filters with AND composition _(R41)_

- [x] **T49** — Add the open-in-editor action on a finding's file reference, posting `openInEditor` with `line` when present _(R42)_

- [x] **T50** — Add finding dismissal, the dismissed count, and the restore-all control _(R43)_

- [x] **T51** — Add the empty state (no optimizable components) and the disabled state naming `harness-dashboard.optimizer.enabled` _(R44, R50)_

- [x] **T52** — Add the fourth tab to `src/webview/index.tsx` following the existing tab pattern, add `optimizerReport` and `isOptimizerScanning` state, and handle the `optimizerReport` and `quickFixResult` messages _(R37)_

- [x] **T53** — Write `src/webview/OptimizerPanel.test.ts` covering sort order, filter AND composition, empty state and disabled state, following the `AdvisoryPanel.test.ts` pattern _(R39, R41, R44, R50)_

---

## Group G — Whiteboard integration

- [x] **T54** — Thread a `scoresByNodeId: Map<string, ComponentScore>` from `index.tsx` through `WhiteboardCanvas.tsx` into each node's `data` _(R45)_

- [x] **T55** — Render the score chip in `src/webview/components/CustomNode.tsx`, coloured by tier, omitted when the node has no score, with a `title` stating score, tier and finding count _(R45, R46)_

---

## Group H — Release

- [x] **T56** — Bump `package.json#version` to `0.8.0` _(release)_

- [x] **T57** — Add the `src/optimizer/` row to the components table in `DESIGN.md` §4 and note the deterministic-scoring stance in §2 _(governance)_

- [x] **T58** — Add the `[0.8.0]` entry to `CHANGELOG.md` and the "What's new in 0.8.0" section plus the version badge and a features-table row in `README.md` _(governance)_

- [x] **T59** — Add the AI-assisted component rewriting follow-up to `progress/backlog.md` under P2, referencing the discarded-alternative rationale in this spec's `design.md` _(governance)_

- [x] **T60** — Write `progress/impl_component-optimizer.md` with the `R<n> → test` traceability map _(governance)_

- [x] **T61** — Run `npm run build`, `npx vitest run` and `./check.sh`; all three green before flipping FEAT-034 to `done` _(gate)_

- [x] **T62** — Manual smoke test in a real workspace: open the Optimizer tab, verify scores render, expand a row, apply one quick fix of each type through the diff preview, dismiss and restore a finding, toggle `optimizer.enabled` off and confirm the disabled state _(R32, R34, R43, R50)_

---

## Group I — Post-approval amendments (R54–R61)

> Added after the approval gate following the calibration audit. See
> `requirements.md` §H for what triggered them.

- [x] **T63** — Add `corpusStats.ts`: per-type median, sample sizes, derived frontmatter-key and heading conventions; `resolveBudget()` with absolute fallback below the sample floor _(R54, R58)_

- [x] **T64** — Rework `OPT-B01`/`OPT-B02`/`OPT-B03` onto the relative threshold, reporting which basis was used _(R54)_

- [x] **T65** — Add `RuleConfidence` to `OptimizerRule`; tag all 19 rules with their tier and the reason _(R55)_

- [x] **T66** — Add `SEVERITY_CEILING` + `applySeverityCeiling()` to the scorer and apply it in the engine after each rule emits _(R56)_

- [x] **T67** — Move `OPT-S04` and `OPT-H03` to the new `clarity` dimension _(R57)_

- [x] **T68** — Add `rules/consistency.ts` with `OPT-C01` and `OPT-C02`, deriving conventions from the corpus _(R58)_

- [x] **T69** — Recalibrate the absolute fallbacks above the observed corpus median and add `budgetMedianMultiple` _(R54)_

- [x] **T70** — Add `DimensionRadar` to `OptimizerPanel.tsx`: six fixed axes, direct labels, numbered radial scale, banded ranges, ring vertices, inline SVG, theme-aware _(R59)_

- [x] **T71** — Add `RadarLegend`: per-dimension question, feeding rules, current value, finding count, plus the deduction and ceiling explanation _(R60)_

- [x] **T72** — Replace the tier palette with the validated four-role status steps; sync `CustomNode.tsx` _(R61)_

- [x] **T73** — Derive `scoreComponent`'s dimension map and the engine's `byDimension` from `DIMENSIONS` — hand-maintained literals produced `NaN` scores and `null` counts when the set grew _(R9)_

- [x] **T74** — Tests for `corpusStats`, `consistency`, the severity ceiling, `tierOf`, `weakestDimension` and the recalibrated budgets _(R54–R61)_

- [x] **T75** — Verify the calibrated engine against this repository's own skills: OPT-B01 must fire on 0 of 5, not 4 of 5 _(R54)_
