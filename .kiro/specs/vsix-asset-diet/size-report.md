# VSIX Size Report — VSIX Asset Diet (FEAT-038) — LIVING BASELINE

> Gate: DESIGN.md §2.4 — **400 KB budget** (300,000 B originally; amended
> to 400,000 decimal bytes by ADR-005 — see re-run section at the bottom),
> **enforced** by `scripts/vsix-gate.sh` (design §6). This file is the living
> size record per design §8: **future** size gates append/update here.
> Historical pre-diet record (frozen): `.kiro/specs/react-flow-12-migration/size-report.md`.
>
> **VERDICT (current): GATE PASSED at 361,604 B / 90% utilization** — after
> the T9 STOP branch below resolved into the human-approved ADR-005
> amendment; see "Re-run after ADR-005 amendment — PASS".
>
> ~~**VERDICT: GATE FAILED — T9 STOP BRANCH TRIGGERED (design §6, tasks T9).**~~
> (Original T9 record, kept intact as history below.)
> The diet removed 1.54 MB of screenshot bytes and every mechanism verified
> green — but the measured post-diet artifact is **361,604 B ≥ 300,000 B**.
> The design's "~190 KB code payload" premise (requirements header, design
> §1/§6 estimate ≈ 210–230 KB) is **falsified by measurement**: the `dist/`
> trio alone occupies **309,467 B compressed** — already over budget before
> icons, README, manifest and changelog. Per design §6 the response to a
> legitimate over-budget artifact is an **explicit DESIGN.md amendment
> decision — NOT a quietly raised threshold**. Threshold unchanged: 300,000.

## Measurement — post-diet, T9, 2026-09-09

Environment: branch `chore/vsix-asset-diet` @ d286027 (T1–T6), version
`0.8.1` (untagged), vsce 3.9.2, `npm run package` →
`harness-dashboard-vscode-0.8.1.vsix`.

| Artifact | Bytes | vs budget 300,000 |
|---|---:|---|
| **Pre-diet full VSIX (FEAT-037 T12 baseline)** | **1,899,264** | +1,599,264 (533% over) |
| **Post-diet full VSIX (measured here)** | **361,604** | **+61,604 (20.5% over) — FAIL** |
| Removed by the diet (5 screenshot zip entries, compressed) | 1,537,660 | — |

Post-diet composition (`unzip -v`, compressed bytes):

| Entry group | Compressed | Raw |
|---|---:|---:|
| `dist/webview.js` | 214,390 | 785,109 |
| `dist/extension.cjs` | 92,428 | 310,474 |
| `dist/webview.css` | 2,649 | 15,869 |
| **dist trio (code payload)** | **309,467** | 1,111,452 |
| `media/icon.png` + `media/icon.svg` | ~16,100 | 17,602 |
| readme.md + package.json + changelog.md + LICENSE + manifests | ~35,000 | 89,316 |
| `media/screenshots/*` | **0 (absent — R1 achieved)** | — |

**Premise correction (recorded because the whole spec rests on it):**
requirements/design cited "~190 KB code payload" (attributed to a
FEAT-036/037 session measurement computed as "full-VSIX minus screenshot
zip entries"). The actual minus-screenshot figure on the same artifact is
361,604 B, and the true compressed dist payload is 309,467 B. The 190 KB
number appears to predate the FEAT-037 bundle growth (+27 KB zipped) and
the FEAT-036 supply-chain scanner, or measured a smaller subset. **The
budget cannot be met by asset diet alone.**

## Evidence — R1 (exclusion), R4 (presence), R5/R6 (gate)

`unzip -l` of the post-diet artifact — 11 entries, **zero**
`extension/media/screenshots/`, all pinned presences present:

```
     3228  extension.vsixmanifest
      633  [Content_Types].xml
    14370  extension/package.json
    14048  extension/readme.md
     1067  extension/LICENSE.txt
    55970  extension/changelog.md
      993  extension/media/icon.svg
    16609  extension/media/icon.png
   785109  extension/dist/webview.js
    15869  extension/dist/webview.css
   310474  extension/dist/extension.cjs
```

Gate run on the post-diet artifact (exit 1 — size only):

```
GATE FAIL [size]: harness-dashboard-vscode-0.8.1.vsix is 361604 bytes (budget: < 300000 B, DESIGN.md §2.4).
GATE PASS [exclusion]: zero extension/media/screenshots/ entries.
GATE PASS [presence]: icon.png, icon.svg, dist/extension.cjs, dist/webview.js, dist/webview.css all packaged.
```

Gate failure-path exercise (T8, temp copies in mktemp dirs — real
artifacts never mutated; full outputs in the T8 session record):
(a) pre-diet 1,899,264 B fixture → FAIL size + FAIL exclusion with the 5
offending `unzip -l` lines printed; post-diet copy with `whiteboard.png`
re-added via `zip` → FAIL exclusion (negative pin, design §7 R6 row);
(b) copy with `icon.png` deleted via `zip -d` → FAIL presence;
(c) copy padded with a 400 KB junk entry → FAIL size **only**
(exclusion + presence green, 761,701 B). All exits non-zero. Gate logic
verified, not trusted blindly.

## FEAT-037 R12 waiver — retirement status

**NOT RETIRED — BLOCKED by R5.** R8 retires the waiver only "when the
first post-diet VSIX passes R1/R4/R5/R6". The artifact passes R1, R4, R6;
it **fails R5** at 361,604 B. The FEAT-037 R12 human waiver (progress/
progress.md 2026-09-09) therefore **remains in force**. What this feature
*did* change: the budget is no longer aspirational text — it is a running,
verified gate on every package, CI run, and publish attempt, and the
screenshot term (~1.54 MB packaged) is gone forever. The residual breach
is pure code payload (+61,604 B).

Retirement requires a human decision on exactly one of:
1. **Amend the budget** — DESIGN.md amendment PR raising/redefining the
   threshold for the code era (design §6's prescribed path; e.g. 400,000 B
   would pass with ~11% headroom); or
2. **Shrink the code** — webview.js is 214 KB of the 309 KB payload
   (@xyflow/react + React 19 runtime + recharts etc.); a code-diet
   follow-up feature.
Then T9 is re-run on the decision's tree and this section becomes the
"waiver retired: budget enforceable and enforced" record.

## Convention note

Per design §8 this file is the **living baseline**: future size gates
append/update here; the react-flow-12-migration report is frozen history
(its T10 banner was NOT added — T10 is downstream of this STOP and is
held, together with T11).

## CI consequence (accepted, by design)

`ci.yml`'s new `Package VSIX + size gate` step will keep this branch — and
any main PR after merge — **red** while the artifact is ≥ 300,000 B. That
is the budget functioning as intended (design §6: "a budget not run on
every PR is not a budget"), and it is why the human decision above gates
the merge.

## Re-run after ADR-005 amendment — PASS

**Supersedes the FAIL verdict above for gate status; the measurement
section stays intact as history.** Human decision taken (option 1 of the
list above): budget amended **300,000 B → 400,000 B**, recorded as
**ADR-005** (progress/decisions.md, Accepted 2026-09-09) via design §6's
own amendment path. `scripts/vsix-gate.sh` LIMIT updated accordingly,
plus a new non-blocking ≥80% utilization review signal.

Environment: branch `chore/vsix-asset-diet` @ 8a4cc38 + ADR-005 gate
amendment (uncommitted at packaging time), version `0.8.1`, vsce 3.9.2,
`npm run package` → `harness-dashboard-vscode-0.8.1.vsix`.

Fresh measurement: **361,604 B** (identical to the T9 measurement above —
the diet tree is unchanged; only the threshold moved). Utilization:
**90%** of the amended 400,000 B budget (~38,396 B / ~10.7% headroom).

Full gate output (exit 0):

```
GATE PASS [size]: harness-dashboard-vscode-0.8.1.vsix is 361604 bytes (< 400000 B budget).
budget utilization: 90% (of 400000 B)
REVIEW: payload ≥80% of budget — growth should be a conscious decision (ADR-005)
GATE PASS [exclusion]: zero extension/media/screenshots/ entries.
GATE PASS [presence]: icon.png, icon.svg, dist/extension.cjs, dist/webview.js, dist/webview.css all packaged.

VSIX GATE: PASSED (harness-dashboard-vscode-0.8.1.vsix, 361604 B)
```

### FEAT-037 R12 waiver — RETIRED (R8 satisfied, 2026-09-09)

R8 required retirement "when the first post-diet VSIX passes
R1/R4/R5/R6". The re-run above passes **all four**: R1 exclusion green,
R4 presence green, R5 size green under the amended 400,000 B budget
(ADR-005), R6 listing assertions green. **FEAT-037's R12 human waiver is
therefore formally retired as of 2026-09-09.** The waiver had been
granted on the FEAT-037 migration branch (reviewed and shipped via
PR #13, merged as commit cde7d98) when the 1,899,264 B artifact
breached the then-300 KB budget; that breach's dominant term — 1.54 MB
of packaged README screenshots — is permanently gone (this feature), and
the residual code-payload term now sits under a measured, enforced
budget. CI's `Package VSIX + size gate` step goes green with this
amendment; the "budget is theatre" failure mode from design §6 is closed.

The ≥80% REVIEW signal fires on day one **by design** (ADR-005): 90%
utilization means the next UI-dependency bump deserves a conscious
decision — tracked as the P2 payload-watch backlog item, not a second
amendment.

