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

## Post-migration (AFTER) — T12

_(to be filled after the swap — see below)_

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
