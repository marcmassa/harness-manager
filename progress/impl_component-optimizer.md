# FEAT-034 — Component Optimizer — Implementation Log

**Date:** 2026-08-03
**Release:** v0.8.0
**Status:** Done — 75/75 tasks, `check.sh` green, smoke test confirmed by the maintainer

---

## R↔T Traceability

| Requirement | Task(s) | Test | Outcome |
|---|---|---|---|
| R1 — optimizable types only | T4, T6 | `componentLoader.test.ts` | Five types loaded; `feature`, `discovered-*`, `cli-install` excluded |
| R2 — ComponentSource from disk | T4, T6 | `componentLoader.test.ts` | Reads `metadata._filePath` via injected `readFile`; parser `body`/`_fullBody`/`_preview` provably unused |
| R3 — missing file non-fatal | T5, T6 | `componentLoader.test.ts` | `exists:false`, empty fields, never throws |
| R4 — local token estimate | T2, T3 | `tokenEstimator.test.ts` | Prose 4 chars/token, fenced code 3; monotonicity property test |
| R5 — 500-component cap | T27, T29 | `optimizerEngine.test.ts` | Stable order, `truncated:true`, `totalComponents` untruncated |
| R6 — rule contract | T1, T23 | `rules/index.test.ts` | `OptimizerRule` with pure `evaluate(ctx)`; no I/O in any rule |
| R7 — stable rule IDs | T23 | `rules/index.test.ts` | Module-level uniqueness + `/^OPT-[SBODHC]\d{2}$/` assertion |
| R8 — finding shape | T1 | typed across all rule tests | All required fields present |
| R9 — dimensions | T1, T24, T67, T73 | `scorer.test.ts` | Six: structure, clarity, budget, integration, hygiene, consistency |
| R10 — deterministic scoring | T24, T25, T29 | `scorer.test.ts`, `optimizerEngine.test.ts` | Weights 25/10/3; determinism test deep-equals two scans minus timestamp |
| R11 — score tiers | T24, T25 | `scorer.test.ts` | All eight boundaries: 39/40, 59/60, 74/75, 89/90 |
| R12 — architecture rollup | T24, T26 | `scorer.test.ts` | Mean of component scores; 0 when empty |
| R13 — OPT-S01 frontmatter | T7, T10 | `rules/structure.test.ts` | Missing or unparseable → `error` |
| R14 — OPT-S02 name mismatch | T7, T10 | `rules/structure.test.ts` | `warning` + `set-frontmatter-field` fix |
| R15 — OPT-S03 description bounds | T7, T10 | `rules/structure.test.ts` | `<20` → error; `>1024` → warning |
| R16 — OPT-S04 no trigger condition | T8, T10 | `rules/structure.test.ts` | Skill descriptions lacking configured trigger markers |
| R17 — OPT-S05 required sections | T9, T10 | `rules/structure.test.ts` | Per-type headings + `append-section-stubs` fix |
| R18 — OPT-S06 hook/steering contract | T9, T10 | `rules/structure.test.ts` | Hook `event`/`script`, steering `appliesTo` |
| R19 — OPT-B01 over budget | T11, T13, T64 | `rules/budget.test.ts` | **Amended by R54:** relative threshold with absolute fallback; ×3 escalation removed (capped at `info` by R56) |
| R20 — OPT-B02 extractable content | T11, T13 | `rules/budget.test.ts` | `info` + `extract-to-references` fix |
| R21 — OPT-B03 agent rollup | T12, T13 | `rules/budget.test.ts` | `uses` + `governs` reachability; three largest contributors |
| R22 — OPT-O01 semantic overlap | T14, T17 | `rules/overlap.test.ts` | Reuses `semanticMatcher.ts`; symmetric emission on both components |
| R23 — OPT-O02 orphans | T15, T17 | `rules/overlap.test.ts` | Orphan skill, under-connected subagent, dead steering glob |
| R24 — OPT-O03 ownership mismatch | T16, T17 | `rules/overlap.test.ts` | Delegates to `idoneity.detectMismatches()` |
| R25 — OPT-D01 manifest drift | T18, T19 | `rules/drift.test.ts` | Missing file → error; duplicate name → warning on both |
| R26 — OPT-D02 broken links | T18, T19 | `rules/drift.test.ts` | Reuses `parserLogic.scanCrossReferences()` |
| R27 — OPT-H01 absolute paths | T20, T22 | `rules/hygiene.test.ts` | `line` reported; conditional `relativize-path` fix |
| R28 — OPT-H02 credentials | T20, T22 | `rules/hygiene.test.ts` | **Asserts the matched secret appears nowhere in the serialized finding** |
| R29 — OPT-H03 vague density | T21, T22, T67 | `rules/hygiene.test.ts` | One aggregate `info`; boundary at 1 per 150 tokens; moved to `clarity` by R57 |
| R30 — rule disablement | T23, T26, T29 | `optimizerEngine.test.ts` | Disabled rules contribute no findings **and** no score deduction |
| R31 — five fix types | T31, T32, T33 | `quickFix.test.ts` | All transforms round-trip to valid frontmatter + body |
| R32 — preview before write | T39 | manual (T62) | `vscode.diff` + modal precede every write |
| R33 — virtual document | T34 | `optimizerDiffProvider.test.ts` | `harness-optimizer:` scheme, in-memory Map, no temp file |
| R34 — write path | T39 | manual (T62) | `HarnessWriter.writeFileAtPath` + `scheduleScan()` |
| R35 — fix failure non-fatal | T39 | manual (T62) | `quickFixResult {ok:false, reason}` on every path; file untouched |
| R36 — extract safety | T32, T33 | `quickFix.test.ts` | Refuses an existing `references/<slug>.md` |
| R37 — fourth tab | T52 | manual (T62) | Follows the existing tab-render pattern |
| R38 — score header | T45 | manual (T62) | Score, tier, counts, Re-scan with spinner |
| R39 — component table | T46, T53 | `OptimizerPanel.test.ts` | Worst-first, label tie-break for stable order |
| R40 — row expansion | T47 | manual (T62) | Severity, rule ID, title, detail, fix button |
| R41 — filters | T48, T53 | `OptimizerPanel.test.ts` | AND composition; empty set = no constraint |
| R42 — open at line | T49 | — | `openFileInEditor(root, path, line?)` with clamp |
| R43 — dismissal | T38, T50 | `optimizerEngine.test.ts` | `<ruleId>::<nodeId>`; filtered **before** scoring |
| R44 — empty state | T51, T53 | `OptimizerPanel.test.ts` | Explanatory copy, not an empty table |
| R45 — node score chip | T54, T55 | `OptimizerPanel.test.ts` (palette) | Tier-coloured; absent score → no chip |
| R46 — chip tooltip | T55 | manual (T62) | Score, tier, finding count |
| R47 — re-scan wiring | T42 | manual (T62) | Rides the existing `scheduleScan` debounce, no second timer |
| R48 — message types | T35, T36 | `messageDiscriminator.test.ts` | Seven types in the union **and** `KNOWN_MESSAGE_TYPES` |
| R49 — settings | T40, T44, T69 | `optimizerConfig.test.ts` | Eight keys with documented defaults (`budgetMedianMultiple` added by R54) |
| R50 — kill switch | T41, T51 | `optimizerConfig.test.ts` | No scan runs at all; panel names the setting |
| R51 — command | T43 | manual (T62) | `harness-dashboard.optimizeComponents` |
| R52 — performance | T30 | `optimizerEngine.test.ts` | 100 × 2 KB components under 1 000 ms |
| R53 — scan failure non-fatal | T28, T29 | `optimizerEngine.test.ts` | Per-rule try/catch; top-level returns `{ok:false, error}` |

## Key files created

`src/optimizer/` — `types.ts`, `tokenEstimator.ts`, `componentLoader.ts`, `scorer.ts`, `optimizerEngine.ts`, `quickFix.ts`, `optimizerDiffProvider.ts`, `rules/{structure,budget,overlap,drift,hygiene,ruleUtils,index}.ts` + colocated tests.

`src/coordinators/OptimizerCoordinator.ts`, `src/coordinators/optimizerConfig.ts` (+ test), `src/webview/OptimizerPanel.tsx` (+ test).

## Key files modified

`src/types.ts` (7 message types), `src/extension.ts` (coordinator, diff provider, command, scheduleScan), `src/harnessWriter.ts` (`writeFileAtPath`), `src/fileUtils.ts` (`line` param), `src/coordinators/SddCoordinator.ts` (line pass-through), `src/webview/index.tsx` (tab, state, handlers), `src/webview/WhiteboardCanvas.tsx` + `components/CustomNode.tsx` (score chip), `package.json` (7 settings, 1 command, v0.8.0), `README.md`, `CHANGELOG.md`, `DESIGN.md`.

## Deviations from design.md

1. **`optimizerDiffProvider` is not a `vscode.TextDocumentContentProvider`.** The design named that type, but it lives in the `vscode` module, which `src/optimizer/` is forbidden to import — the design contradicted its own constraint. Resolved with structural typing: the class exposes a compatible `provideTextDocumentContent(uri)` and is registered directly by `extension.ts`, with no adapter shim.

2. **`loadComponents(nodes, root, readFile)` takes `root: string`, not `vscode.Uri`.** Same constraint. `root` is inert — reading is fully delegated to `readFile` — and is retained only for call-site parity.

3. **Pure helpers live in `optimizerConfig.ts`, not on the coordinator.** `OptimizerCoordinator.ts` imports `vscode` at module scope, so anything importing it is unloadable under Vitest. `readOptimizerConfig`, `dismissalKey` and `disabledReport` moved to a vscode-free sibling, re-exported from the coordinator for call-site compatibility.

4. **`HarnessWriter.writeFileAtPath()` added.** Not in the design. Every existing writer method is entity-specific, but quick fixes rewrite arbitrary existing files. Added with a path-traversal guard rather than bypassing the writer.

5. **`openFileInEditor` gained an optional `line`.** R42 required opening at a line; the existing helper ignored it, so R42 would have silently not been met.

6. **The `optimizerReport` message carries an `enabled` flag.** A disabled report is structurally identical to an empty one, so the webview could not distinguish "off" from "nothing found" and R50's disabled state would never render.

## Verification

- `npm run build` — clean.
- `npx vitest run` — **571 passed**, 41 files (was 421 / 27 before this feature).
- `./check.sh` — build, tests and governance green. The one failing section (Adapter Consistency) is a pre-existing drift of the generated `.claude/` and `.gemini/` files, verified unrelated via `git stash`.

## Closure

- **T62 manual smoke test** — run by the maintainer in a live window; confirmed working.
- **`check.sh` green.** The Adapter Consistency failure that persisted through the session was a **local environment artifact, not a repo defect**: all six generated adapter outputs are in `.gitignore` (lines 57–62) and none are tracked. The check only runs `bootstrap.sh --check` when at least one output exists in the repo root, so a fresh clone — and therefore CI — takes the `warn` branch and passes. Locally a stale `opencode.json` triggered the strict branch without its sibling adapters. Proved by moving that file aside and re-running: 0 failures. Resolved by `./.agents/bootstrap.sh --all`, which writes only gitignored paths (`git status` delta was empty).

---

## Post-approval amendments (R54–R61, T63–T75)

An audit of whether the shipped evaluations were actually correct produced these
changes after the gate. `requirements.md` §H records them against the approved
text.

| Requirement | Task(s) | Test | Outcome |
|---|---|---|---|
| R54 — relative budgets | T63, T64, T69 | `corpusStats.test.ts`, `rules/budget.test.ts` | `2.5 ×` per-type median, absolute fallback below 5 components; basis reported in the detail |
| R55 — confidence tiers | T65 | `rules/*.test.ts` | All 19 rules tagged `fact` / `heuristic` / `opinion` with the reason |
| R56 — severity ceiling | T66 | `scorer.test.ts` | `fact`→error, `heuristic`→warning, `opinion`→info, clamped in the engine |
| R57 — clarity dimension | T67 | `rules/structure.test.ts`, `rules/hygiene.test.ts` | `OPT-S04` + `OPT-H03` moved out of structure/hygiene |
| R58 — consistency dimension | T68 | `rules/consistency.test.ts` | `OPT-C01`/`C02`, conventions derived from the corpus, silent below the sample floor |
| R59 — dimension radar | T70 | `OptimizerPanel.test.ts` | Six fixed axes, numbered scale, banded ranges, inline SVG |
| R60 — evaluation legend | T71 | — | Per-dimension question, feeding rules, value, finding count |
| R61 — validated tier palette | T72 | `OptimizerPanel.test.ts` | Four validated status steps; A/B share `good` |

### Empirical result

The reason for the whole amendment. On this repository's own five skills:

| | Before | After |
|---|---|---|
| `OPT-B01` fires on | 4 of 5 (one as `error`) | **0 of 5** |
| Lowest-scoring components | the largest files | the two with **no frontmatter** |

### Defects found by verifying rather than reading

1. **`scoreComponent` produced `NaN` for every score.** Its dimension map was a
   hand-written literal of four while `DIMENSIONS` had grown to six. Both it and
   the engine's `byDimension` (which reported `null` counts for the new
   dimensions) are now derived from `DIMENSIONS` as the single source.
2. **The radar's top axis label was clipped by the viewBox.** Only visible once
   rendered — the earlier numeric check verified horizontal extent only. Fixed
   with vertical room; the check now covers all four label coordinates.
3. **The tier palette failed colour validation.** Tiers A and B measured ΔE 10.2
   in normal vision against a floor of 15.

## Defect found after closure (OPT-D01 false positive)

Smoke testing of FEAT-035's delegation surfaced a false positive in this feature:
`OPT-D01` reported `.kiro` as "component missing on disk" while the directory was
present and held 13 tracked files. `KiroAdapter` roots its synthetic workspace
node at the `.kiro` *directory*, and the loader could not distinguish a directory
from an absent path, so `exists:false` was read as drift.

This mattered more than an ordinary false positive: `OPT-D01` is `fact`-tier at
`error` severity — the one tier whose entire claim is that it verifies something
checkable, deducting 25 points for an assertion that was untrue.

Fixed by adding `ComponentSource.pathKind` (`file` / `directory` / `missing` /
`unresolved`), fed by a real `vscode.workspace.fs.stat` probe injected into the
loader. `OPT-D01` now fires only on `missing`. Three regression tests, including
the literal `.kiro` case.

The upstream imprecision remains in `KiroAdapter` (a directory declared as
`_filePath`); the optimizer is now robust to it, which also covers any other
adapter that does the same.

## Verification (post-amendment)

- `npm run build` — clean.
- `npx vitest run` — **610 passed**, 43 files.
- Calibrated engine re-measured against `.agents/skills/` — see the table above.
