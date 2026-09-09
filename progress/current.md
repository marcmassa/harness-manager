# Current Session State

## Active Feature
FEAT-038 `vsix-asset-diet` — **in_progress, BLOCKED at T9 (STOP branch)**.
Implementation T1–T8 done and verified; the T9 measurement failed the
budget gate honestly. **Human decision required** (see below).

## Status
- Branch `chore/vsix-asset-diet` (from `main` @ cde7d98), 3 commits:
  spec state, T1–T5 diet+gate, T6 DESIGN.md wording. NOT pushed.
- **Measured post-diet VSIX: 361,604 B ≥ 300,000 B → GATE FAIL (R5).**
  Diet works (screenshots gone from the package — 1,537,660 B of zip
  bytes removed; pre-diet was 1,899,264 B) but the `dist/` trio alone
  compresses to **309,467 B** — over budget before icons/README/manifest.
  The spec's "~190 KB code payload" premise was falsified by measurement.
- Threshold NOT raised (design §6 forbids it). T10/T11 NOT executed.
- FEAT-037 R12 waiver: **NOT retired** (R8 requires a passing artifact).
- Gate failure paths all exercised on temp copies (T8): pre-diet fixture
  → size+exclusion FAIL; polluted post-diet → exclusion FAIL; icon
  deleted → presence FAIL; +400 KB padding → size-only FAIL. All exit 1.
- `npm test`: **819/819 green** (57 files). `./check.sh`: **exit 0** (governance
  includes the backlog done-ID rule — passes; the size-report's FEAT-037
  citation is not in the backlog file).
- Full evidence: `.kiro/specs/vsix-asset-diet/size-report.md`.

## Human decision needed (one of)
1. **Amend the budget** — DESIGN.md amendment PR (e.g. 400,000 B passes
   with ~11% headroom); or
2. **Commission a code-diet feature** — `dist/webview.js` is 214 KB
   compressed of the 309 KB payload.
Then re-run T9 → T10 → T11. Note: CI's new package step keeps the branch
red until one of the above lands — intended (design §6).

## Notes
- Zero `src/` changes, zero dependency diffs, `git diff main...HEAD
  check.sh` empty, no `git rm` of screenshots — promises held.
- CHANGELOG: intentionally NOT touched — feature is not done; an entry
  would assert a size outcome that did not happen.
- Marketplace + landing-page render checks: PENDING-HUMAN (post-merge /
  post-publish respectively); raw URL verified live this session:
  `github.com/.../raw/main/...whiteboard.png` → 302 → 200 `image/png`
  171,849 B (matches tracked file).
- Deviation recorded: design §7 R2 evidence command `grep -c
  'raw/main/media/screenshots/' README.md` counts LINES (3); the 5 refs
  are on 3 table lines. True evidence: `grep -o … | wc -l` = 5 and
  `grep '](media/screenshots/'` = 0. R2 itself (5 absolute URLs, zero
  relative) is satisfied.
