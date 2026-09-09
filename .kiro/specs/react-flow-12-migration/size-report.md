> **HISTORICAL BASELINE — superseded by `.kiro/specs/vsix-asset-diet/size-report.md` (FEAT-038); numbers below are pre-diet and must not be edited.**

# VSIX Size Report — React Flow 12 & React 19 Migration (FEAT-037)

> Gate: DESIGN.md §2.4 — "keeps the VSIX under 300 KB".
> Requirement R12: record before/after `vsce package` sizes; after-size must
> remain below the budget; if exceeded, the migration SHALL NOT be declared done.
> ⚠ See "Gate interpretation" below — the budget was already exceeded by
> non-code assets BEFORE this migration.

## Baseline (BEFORE migration) — T1, 2026-09-09

Environment: branch `feat/react-flow-12` @ 7c3623f, `reactflow@^11.11.4`,
`react@^18.2.0`, node_modules as installed, `npm run package` →
`harness-dashboard-vscode-0.8.1.vsix`.

| Artifact | Bytes | KB |
|---|---:|---:|
| **Full VSIX (before)** | **1,871,439** | **1.78 MB** |
| — of which `dist/extension.cjs` (host, untouched by FEAT-037) | 310,474 | 303.2 KB |
| — of which `dist/webview.js` (the graph bundle) | 696,260 | 679.94 KB |
| — of which `dist/webview.css` | 7,322 | 7.15 KB |
| — of which PNG screenshots + icons (README assets) | ~1,727,000 | ~1.71 MB |

Test baseline: `npm test` → **773 tests / 56 files passed**.

## Post-migration (AFTER) — T12, 2026-09-09

Branch `feat/react-flow-12` @ 9e5b107 (T1–T8 complete), `npm run package` →
`harness-dashboard-vscode-0.8.1.vsix`.

| Artifact | Before (bytes) | After (bytes) | Δ raw | Δ in VSIX (zip) |
|---|---:|---:|---:|---:|
| **Full VSIX** | 1,871,439 | **1,899,264** | — | **+27,825 (+27.2 KB)** |
| `dist/webview.js` | 696,260 | 785,109 | +88,849 | (≈ +26 KB zipped) |
| `dist/webview.css` | 7,322 | 15,869 | +8,547 | (≈ +2 KB zipped) |
| `dist/extension.cjs` (untouched) | 310,474 | 310,474 | 0 | 0 |

vsce-reported: webview.js 679.94 KB → 766.71 KB; webview.css 7.15 → 15.5 KB;
full VSIX 1.78 MB → 1.81 MB.

## Verdict — R12

1. **Literal gate (< 300 KB full VSIX): FAILED — but ALREADY FAILED BEFORE
   this migration.** Baseline is 1.78 MB; the breach is ~1.71 MB of README
   screenshot PNGs that predate FEAT-037 (DESIGN.md §2.4's 300 KB figure
   describes the code era of 0.1.2, where the whole VSIX was 256 KB).
   The migration contributes nothing to that term.
2. **Migration-attributable growth: +27.2 KB zipped** (raw webview.js+css
   +97 KB, compressed to +27.8 KB in the VSIX). This EXCEEDS design §9's
   *prediction* of ±15 KB (v12's @xyflow/system + zustand runtime is heavier
   than v11's; React 19 saving does not offset it). §9's ±15 KB was a
   forecast, not the R12 gate, but it is worth surfacing.
3. **R12 instruction: "if the budget is exceeded, the migration SHALL NOT
   be declared done."** → **STOP + REPORT. T15 closure is HELD.**
   Decision needed from the orchestrator/human: either (a) accept the
   migration on the basis that the gate is unmeasurable-until-assets-move
   (code-only budget: webview bundle 766.71 KB uncompressed is *within* the
   spirit of §2.4's "no surprises" but above 300 KB literal), or (b) move
   the screenshots out of the package (`.vscodeignore` the PNGs or use
   hosted README images) — a SEPARATE concern this branch must not mix in
   (AGENTS.md §3, one feature at a time), or (c) reject the migration
   (rollback is trivial per design §8: revert the branch).

**Gate status: NOT GREEN — closure blocked by R12 as written. Reported,
not glossed.**

## Gate interpretation

The **literal** full-VSIX <300 KB check is **already violated at baseline**
(1.78 MB) — entirely by README screenshot PNGs (~1.71 MB) added long after
DESIGN.md §2.4 was written (FEAT-020 era: whole VSIX was 256 KB). The
migration touches only `dist/webview.js` + `dist/webview.css`; design §9
predicts a net change within ±15 KB.

Verdict strategy:
1. Record full-VSIX before/after (honest literal number).
2. The *migration-attributable* delta (webview.js + webview.css before/after)
   is the fair gate for R12; design §9 expected ±15 KB.
3. The pre-existing literal breach is **not caused by this migration** but
   R12 says "if exceeded … SHALL NOT be declared done" — surfaced to the
   orchestrator at T12 for an explicit decision.
