# Requirements — VSIX Asset Diet (FEAT-038)

> Feature FEAT-038 from `feature_list.json`. The packaged VSIX is
> **1,899,264 B** (measured at FEAT-037 T12, 2026-09-09), of which
> **1,751,438 B raw / ~1.71 MB packaged** is the five README screenshot PNGs
> in `media/screenshots/` (whiteboard.png 171,849 · sdd-panel.png 130,635 ·
> achitecture-advisory.png 267,808 · full-window.png 748,418 ·
> optimizer-panel.png 432,728). The code payload zips to roughly ~190 KB.
> The screenshots ride along because vsce packages the whole tree minus
> `.vscodeignore` coverage, and `.vscodeignore` does not exclude them.
> DESIGN.md §2.4's "<300 KB VSIX" budget predates the screenshots (the
> 0.1.2-era package was 256 KB) and has become a fiction: FEAT-037's R12
> size gate was **human-waived** precisely for this (progress/progress.md
> 2026-09-09; `.kiro/specs/react-flow-12-migration/size-report.md`), and
> the waiver defers the fix to this follow-up feature.
>
> The diet de-bundles **only** the screenshots. `media/icon.png` (manifest
> `package.json#icon`, 16,609 B) and `media/icon.svg` (activity-bar
> view-container icon, 993 B) are runtime-required and stay; a grep of
> `src/` confirms no other media is referenced at runtime. The repo is
> **PUBLIC** (`gh repo view --json visibility` → `PUBLIC`, verified
> 2026-09-09), so the standard public-repo mechanism applies: absolute
> hosted image URLs in README.md + `.vscodeignore` exclusion (design §§2–4).
> Sprint **0.8.1** — the tag does not exist yet, so 0.8.1 ships already
> dieted.
>
> Docs-only spec. No `src/` behavior changes; zero runtime dependency
> changes. Implementation touches README.md, `.vscodeignore`, `package.json`
> scripts, two workflows, and one new dev-time gate script.
>
> Each requirement is strict EARS, verifiable by a package-inspection
> assertion or a documented rendering check (design §7).

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies by configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures / edges |

## Requirements

### R1 — The VSIX carries zero screenshot bytes
- **Pattern:** Ubiquitous
- The packaged VSIX SHALL NOT contain any zip entry under
  `extension/media/screenshots/` (asserted against the `unzip -l` listing of
  the produced artifact — the package's manifest, not the repo tree).

### R2 — README.md references screenshots via absolute hosted URLs
- **Pattern:** Ubiquitous
- README.md SHALL reference all five screenshots via absolute URLs of the
  form
  `https://github.com/marcmassa/harness-manager/raw/main/media/screenshots/<file>.png`
  (ref `main` — justified in design §4), and SHALL NOT contain any relative
  `media/screenshots/` image reference.

### R3 — GitHub landing and Marketplace listing both render the screenshots
- **Pattern:** Ubiquitous
- The five screenshots SHALL render both on the repository README page on
  GitHub and on the VS Code Marketplace listing (the packaged README keeps
  the same absolute URLs — vsce passes absolute links through unrewritten,
  design §3), possible because the repo is public (verified, design §2).

### R4 — Runtime-referenced media stay in the package, pinned
- **Pattern:** Event
- When the packaging gate inspects a VSIX, the listing SHALL contain
  `extension/media/icon.png`, `extension/media/icon.svg`, and
  `extension/dist/extension.cjs` + `extension/dist/webview.js` +
  `extension/dist/webview.css`, and the gate SHALL treat any missing entry
  as a violation (the diet excludes screenshots and nothing else).

### R5 — The <300 KB budget becomes an enforced size gate
- **Pattern:** Event
- When the packaging gate runs on a produced VSIX whose size is
  ≥ 300,000 decimal bytes, the gate SHALL exit non-zero (decimal-KB
  convention, threshold rationale in design §6).

### R6 — Listing violations fail the package
- **Pattern:** Unwanted
- If the inspected VSIX listing contains an `extension/media/screenshots/`
  entry (counterpart of R1) or lacks any entry required by R4, then the
  gate SHALL print the offending listing lines and exit non-zero.

### R7 — The gate guards every packaging path; check.sh stays fast
- **Pattern:** Ubiquitous
- The packaging gate SHALL run in the `npm run package` flow, in the CI
  workflow on every push-to-main and PR targeting main, and in the publish
  workflow before `vsce publish`, and `./check.sh` SHALL NOT invoke vsce
  packaging or the gate (enforcement-point placement rationale in design §6).

### R8 — The FEAT-037 R12 waiver is retired against a measured artifact
- **Pattern:** Event
- When the first post-diet VSIX passes R1/R4/R5/R6, the release record
  SHALL mark the FEAT-037 R12 human waiver retired and SHALL record the
  measured package size as the new living baseline per design §8.

### R9 — DESIGN.md states the budget as enforced, not aspirational
- **Pattern:** Ubiquitous
- DESIGN.md §2.4 and §6 SHALL describe the <300 KB VSIX budget as enforced
  at package time and in CI (naming the gate mechanism), within DESIGN.md's
  own ≤250-line cap.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|------------|
| `unzip -l` shows zero `extension/media/screenshots/` entries | R1, R6 |
| Post-diet VSIX < 300,000 B, measured and recorded | R5, R8 |
| GitHub landing page renders all 5 screenshots | R2, R3 |
| Marketplace README renders the same hosted images (vsce absolute-URL behavior stated) | R2, R3 |
| Icons + dist bundles untouched and pinned in the listing | R4 |
| Gate enforced on local packaging, CI, and publish — check.sh untouched | R7 |
| FEAT-037 R12 waiver explicitly retired; size-report convention updated | R8 |
| DESIGN.md §2.4/§6 wording aligned from aspirational to enforced, ≤250 lines | R9 |
| Non-regression: `./check.sh` green, `npm test` green, zero runtime dep changes | R4, R5, R7 (gate is dev-time only; `scripts/` is already `.vscodeignore`d) |
