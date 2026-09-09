# Design — VSIX Asset Diet (FEAT-038)

> Requirements: `requirements.md` (R1–R9). Scope: strip ~1.71 MB of README
> screenshot PNGs from the packaged VSIX, keep every consumer (GitHub
> landing, Marketplace listing, extension runtime) working, and convert
> DESIGN.md §2.4's <300 KB budget from aspirational text into an enforced
> gate. This document records the verified facts the mechanism rests on —
> a diet based on assumptions about vsce behavior is how the 300 KB budget
> silently rotted in the first place.

---

## 1. Current state (measured 2026-09-09, all numbers re-verified this session)

| Fact | Value | Source |
|---|---|---|
| Packaged VSIX (post-FEAT-037, version 0.8.1, untagged) | **1,899,264 B** | `.kiro/specs/react-flow-12-migration/size-report.md` T12 |
| `media/screenshots/` raw bytes (5 PNGs) | **1,751,438 B** | `stat` (sizes in the requirements header) |
| Code payload zipped (dist/ trio + rest) | ~190 KB | FEAT-036/037 session measurement; full-VSIX minus screenshot zip entries |
| `media/icon.png` / `media/icon.svg` | 16,609 B / 993 B | `stat` — **keep** (manifest icon + activity-bar icon) |
| `media/icon-color.svg` | 4,394 B | already excluded by `.vscodeignore` |
| Runtime media refs in `src/` | **none** | `grep -rn "media/\|\.png\|\.svg" src/ --include='*.ts*'` → empty; only `package.json#icon` and `contributes...viewsContainers...icon` reference media |
| README screenshot refs | lines 17, 19, 21 (5 image links, all relative) | README.md |
| `0.8.1` git tag | does not exist yet | progress/current.md ("ready to tag/publish when the human decides"); publish.yml triggers on `v*.*.*` |

**`.vscodeignore` today** (read in full): excludes sources, configs, dev
tooling, `node_modules/`, `.git/`, and one media file (`media/icon-color.svg`).
It does **not** mention `media/screenshots/`.

## 2. Repo visibility finding (gates the whole mechanism)

```
$ gh repo view --json visibility
{"visibility":"PUBLIC"}
```

Verified 2026-09-09 against `github.com/marcmassa/harness-manager`.

- **PUBLIC ⇒ the standard mechanism applies** (§3): hosted `raw` URLs are
  fetchable by GitHub's own landing-page renderer, by the Marketplace, and
  by any anonymous visitor. The `<ref>` choice is justified in §4.
- **IF the repo were PRIVATE** (it is not — recorded so a future reader
  does not re-derive this): `github.com/.../raw/...` URLs return 404 to
  anonymous clients, so neither the Marketplace nor a logged-out visitor
  would render the images, and this design would have had to pick an
  alternative and say so plainly. Realistic alternatives ranked: (a) attach
  the PNGs to the GitHub **Release** and reference
  `https://github.com/.../releases/download/<tag>/<file>.png` — still
  private for a private repo, so effectively (b) commit a size-capped copy
  back into the package (defeats the diet — reject), or (c) host the images
  on a public bucket/CDN outside the repo (new infra, new supply-chain
  surface — last resort). None is needed here. **The finding is: PUBLIC,
  mechanism (standard) chosen.**

## 3. Mechanism — exact, with the vsce behavior it relies on

Two source edits + one gate script. The framing "vsce bundles the
screenshots because the README references them" is **imprecise and is
corrected here**: vsce 3.9.2 packages *every file not covered by
`.vscodeignore`* (README references do not pull files in). The README
references matter only for how images **render** in each consumer:

1. **`.vscodeignore`**: add `media/screenshots/**` (commented section
   "README screenshots — served from GitHub raw, see README.md"). This is
   the edit that actually removes the bytes → **R1**.
2. **`README.md`**: replace the five relative image targets
   `media/screenshots/<file>.png` with absolute
   `https://github.com/marcmassa/harness-manager/raw/main/media/screenshots/<file>.png`
   → **R2**. Verified behavior (vsce 3.9.2 `out/package.js`,
   `MarkdownProcessor`):
   - `rewriteRelativeLinks` defaults to `true`; relative links are prefixed
     with an auto-detected `baseImagesUrl` =
     `https://github.com/<project>/raw/<githubBranch||'HEAD'>` (detected
     from `package.json#repository`).
   - **Absolute (`^\w+://`) links pass through untouched.** The packaged
     README is byte-identical for these image links → GitHub landing and
     Marketplace render the *same* URLs → **R3, R4's README half**.
   - Why we still write absolute URLs by hand instead of relying on that
     auto-rewrite: see Discarded Alternative (c).
   - Line 10 of README (`![Harness Dashboard icon](media/icon.png)`) stays
     relative and harmless: icon.png remains in the package AND vsce
     rewrites the link to a hosted URL for the Marketplace. Either path
     renders; it costs 16.6 KB, which the budget absorbs.
   - The 2026-era Marketplace renders README images from public GitHub raw
     URLs; this is the documented standard for public repos (the same URL
     shape vsce itself generates). Stated plainly per the brief: this is
     vsce/Marketplace behavior we assert, and §7 verifies it on the
     published page, not just by inspection.
3. **Runtime media untouched and pinned**: the diet adds exactly one ignore
   line, scoped to `media/screenshots/**`. `media/icon.png`,
   `media/icon.svg`, and the `dist/` trio are pinned by a presence
   assertion in the gate (§5) so a future `.vscodeignore` edit cannot
   silently strip them → **R4** ("pinned" in the requirement's sense).

No `src/` change, no dependency change, no `esbuild.js` change.

## 4. `<ref>` choice: `main` (not a release tag, not `HEAD`)

| Option | Verdict | Why |
|---|---|---|
| **`raw/main/...`** | ✅ **chosen** | (1) Resolves the instant the README edit merges — zero broken-window. (2) `0.8.1` is **not tagged yet**; a `raw/v0.8.1/...` reference in the repo README would render 404 images on the landing page from merge until the tag exists. (3) Screenshots are living docs of the *current* UI — tracking `main` is the semantically right target; version-correctness of a marketing image is not load-bearing (unlike code). (4) `main` is a real ref that every renderer (GitHub, Marketplace, offline viewers, link-checkers) resolves identically. |
| release tag (`raw/v0.8.1/...`) | ❌ | Broken-image window above; per-release repinning means rewriting README.md on every release (tag-churn commits) or a publish-time `sed`; both add machinery for zero user value. **Discarded.** |
| `raw/HEAD/...` (vsce's own default shape) | ❌ | Works on GitHub.com (HEAD → default branch) but is a pseudo-ref weaker renderers and tools may not resolve; `main` costs nothing more and is concrete. **Discarded.** |

**Known trade-off, accepted:** old Marketplace listings pull screenshots
from `main`, so a renamed/moved PNG on `main` 404s on the *previous*
listing until the next release. Mitigations: filenames are stable since
June 2026; the diet adds no new rename incentive; and R1's gate means the
bytes can never creep back if a URL ever breaks (the honest failure mode
is a missing image on a stale listing, not a 1.9 MB package).

## 5. The gate: `scripts/vsix-gate.sh` (single source of assertions)

One dev-time bash script (consistent with `scripts/ci-diagnostic.sh`; bash +
`unzip` + `wc` exist on macOS and ubuntu runners alike). Input: path to the
`.vsix`. Assertions:

```
GATE: size            stat/wc -c bytes < 300000            → R5
GATE: exclusion       unzip -l shows no extension/media/screenshots/…  → R6/R1
GATE: presence        unzip -l shows each of:
                        extension/media/icon.png
                        extension/media/icon.svg
                        extension/dist/extension.cjs
                        extension/dist/webview.js
                        extension/dist/webview.css          → R6/R4
```

Non-zero exit on any violation, printing the offending `unzip -l` lines.
`scripts/` is already `.vscodeignore`d → the gate adds **zero** package
bytes. The exact dist filenames are pinned here and re-checked if
`esbuild.js` entry points ever change (a rename should update the gate in
the same PR — caught by the presence assertion failing loudly).

## 6. Enforcement placement — decision + rationale (R7)

**Chosen: package-time script, wired at three call sites; check.sh untouched.**

| Placement | Decision | Why |
|---|---|---|
| `scripts/vsix-gate.sh` appended to `npm run package` (`… && vsce package … && scripts/vsix-gate.sh <artifact>`) | ✅ primary | Single choke point. Whoever packages, locally or in any workflow that uses the npm script, hits the gate — fail-fast at the moment the artifact exists. |
| `ci.yml`: new step `npm run package` (build already run; vsce + gate ≈ 10–20 s) | ✅ | Currently CI **never packages** — the 1.9 MB package was only discovered manually at FEAT-037 T12. A budget not run on every PR is not a budget. |
| `publish.yml`: explicit `scripts/vsix-gate.sh harness-dashboard.vsix` step before `vsce publish` | ✅ | publish.yml calls `npx vsce package` directly (not the npm script), so it needs its own gate step — belt-and-suspenders at the point of no return. |
| `check.sh` | ❌ NOT added | check.sh is the sub-minute local loop gate run by every session (build + 819 tests + governance). vsce packaging adds a second full build + package + network-resilient tool run to the hottest script in the repo, and check.sh runs in environments (offline, partial checkouts) where packaging may fail for unrelated reasons. The invariant belongs to *packaging*, not to *code health*. R7 pins check.sh free of it; design §7's evidence is that `git diff check.sh` stays empty. |

**Threshold: 300,000 decimal bytes.** "Under 300 KB" in decimal matches
vsce's own reporting convention (it prints KB/MB as bytes/1000 — e.g. the
1.78 MB figure in the size report). Stricter than a KiB reading of the
budget, with room to spare: expected post-diet artifact is roughly
190 KB code payload + ~17 KB icons + README/manifest/changelog ≈ **~210–230 KB**
(measured per T9, not asserted here). If the measured artifact ever
exceeds 300,000 B through legitimate code growth, the response is an
explicit DESIGN.md amendment PR — never a quietly raised threshold in the
script.

**Amendment record (human-approved 2026-09-09):** the threshold above was
amended from **300,000 B to 400,000 B** via this section's own prescribed
path ("an explicit DESIGN.md amendment PR — never a quietly raised
threshold"). Evidence: the T9 measurement (`.kiro/specs/vsix-asset-diet/
size-report.md`) — post-diet artifact 361,604 B with the `dist/` trio
alone at 309,467 B compressed, falsifying the "≈190 KB code payload"
premise; the 300,000 B gate was arithmetically unreachable by asset diet
without cutting shipped features. Decision recorded as **ADR-005**
(`progress/decisions.md`), human-approved option "A" of the T9 STOP
report. The amendment ships with a non-blocking ≥80% utilization review
signal in `scripts/vsix-gate.sh` (current utilization ~90%). Prior text
in this section is left unaltered as the original decision record.

## 7. Test strategy (how each R is verified)

| R | Verification |
|---|---|
| R1 | `unzip -l harness-dashboard-0.8.1.vsix | grep 'extension/media/screenshots/'` → **no match** (this exact listing assertion lives in the gate). Evidence pasted into the T9 record. |
| R2 | static grep: `grep -c 'raw/main/media/screenshots/' README.md` = 5 and `grep '](media/screenshots/' README.md` = 0 (image refs). |
| R3 | GitHub: view the landing README after merge (all 5 render). Marketplace: after the 0.8.1 publish, view the listing page — recorded as a post-release human check (same class of check as FEAT-037's M1–M7). |
| R4 | gate presence assertions (§5) run on every package; plus `git diff` shows zero `src/` and zero dependency changes. |
| R5 | gate self-test: run against the *pre-diet* artifact if kept locally (expect FAIL on size) and the post-diet artifact (expect PASS); CI runs it every PR. |
| R6 | negative pin: inject a fake screenshot entry check via `bash scripts/vsix-gate.sh` against a deliberately polluted temp package in T9 (copy the artifact, `zip` one file in, expect non-zero) — the gate's own failure path is exercised, not trusted blindly. |
| R7 | CI green with the new package step; publish.yml diff shows the gate step ordered before publish; `git diff check.sh` empty. |
| R8 | the retirement record exists (progress/progress.md FEAT-038 entry + size-report banner, §8) citing the measured number. |
| R9 | DESIGN.md diff names the gate in §2.4/§6; `wc -l DESIGN.md` ≤ 250; check.sh governance pass. |

Non-regression: `npm test` (819+ tests) green; `./check.sh` exit 0;
`git diff package.json` limited to the `scripts` section; zero
`dependencies`/`devDependencies` changes.

## 8. Size-report convention (where the new number lives)

- **New living baseline:** `.kiro/specs/vsix-asset-diet/size-report.md`
  (created at T9) — records the measured post-diet full-VSIX byte count,
  the `unzip -l` evidence, the gate result, and the retirement statement
  for FEAT-037's R12 waiver ("waiver retired: budget now enforceable and
  enforced"). **Future** size gates append/update this file; it is the
  living record, exactly as FEAT-037's report was for its gate.
- **Historical baseline:** `.kiro/specs/react-flow-12-migration/size-report.md`
  becomes frozen history (1,871,439 → 1,899,264 B). T10 adds a one-line
  banner at its top pointing to the new file — no numbers are edited there,
  preserving the auditable record.

## 9. Discarded alternatives

- **(a) Shrink the PNGs instead of de-bundling.** Measured first (brief
  requirement): the five files total **1,751,438 B**; even an aggressive
  lossy quantizer achieving 70 % (realistic for UI screenshots — pngquant
  at q60–80) leaves ~**525 KB** in the package — still **1.75× over the
  300,000 B gate**, while degrading the landing page that is the repo's
  shop window. It also keeps the coupling this feature exists to break
  (README bytes inside a code artifact). Fully solved by exclusion
  instead. **Discarded.**
- **(b) Move screenshots to the GitHub wiki / a docs site.** Breaks the
  README self-containedness on GitHub (relative-path browsing, offline
  clone readability), adds a second storage surface with its own
  contribution flow, and the wiki is still tied to repo visibility. The
  `raw/main` URL already *is* hosted serving with zero new infrastructure.
  **Discarded.**
- **(c) Rely on vsce's automatic relative-link rewrite + `.vscodeignore`**
  (keep README relative; vsce rewrites to `raw/HEAD` at package time —
  verified behavior, §3). It would pass every gate in this spec. Rejected
  because the README's *rendered* URLs would then depend on tool
  heuristics (`rewriteRelativeLinks` default, `repository` detection,
  the `HEAD` pseudo-ref): a vsce upgrade flipping the default or a
  manifest edit would silently 404 Marketplace images while all *size*
  gates stay green — exactly the "silent rot" that made the 300 KB budget
  a fiction. Explicit absolute URLs make README.md self-describing:
  GitHub and Marketplace provably render the same strings. (This was the
  mechanism assumed by an earlier draft of this spec; corrected after
  reading the vsce 3.9.2 source.) **Discarded.**
- **(d) git-lfs for `media/screenshots/`.** LFS objects do not ride in the
  VSIX either, so it fixes the size — at the cost of requiring `git-lfs`
  in every clone/CI environment, `GIT_LFS_SKIP_SMUDGE` audit of the two
  workflows, and an opaque failure mode (smudge-pointer text instead of
  images) for tooling that misses setup. For marketing images on a public
  repo, `raw/main` achieves the same without new infrastructure or CI
  config. **Discarded.**

## 10. Rollback & risk

- Rollback = revert one commit (README URLs + `.vscodeignore` line + gate
  wiring). The PNGs stay tracked in git throughout — nothing is deleted,
  only un-bundled. `git rm` of the screenshots is explicitly out of scope.
- Risk: GitHub raw-URL rate limits or outage → landing images fail
  temporarily; the Marketplace re-fetches at publish time (its own
  caching). Acceptable for decorative docs imagery.
- Risk: README edit and `.vscodeignore` edit land in separate commits and
  CI's new package step fails mid-PR — avoided by making both edits plus
  the gate in one MR (T1–T5 sequence, single branch).
