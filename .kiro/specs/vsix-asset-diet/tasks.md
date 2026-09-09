# Tasks — VSIX Asset Diet (FEAT-038)

> Sequence matters: the README edit (T2) and the ignore rule (T1) land in
> the same MR (design §10). T9 is the measurement that pays off the whole
> feature — it produces the new living baseline and retires the FEAT-037
> R12 waiver (R8). Gate: everything ends with `./check.sh` green.

- [ ] T1. Add `media/screenshots/**` to `.vscodeignore` as a commented
      section ("README screenshots — served from GitHub raw; see
      README.md + FEAT-038"). Touch nothing else in the file — the icon
      lines must survive untouched.
      _Covers: R1 (mechanism half). Refs: design §3.1._
- [ ] T2. Rewrite the five screenshot image targets in `README.md`
      (lines 17, 19, 21) from `media/screenshots/<file>.png` to
      `https://github.com/marcmassa/harness-manager/raw/main/media/screenshots/<file>.png`.
      Alt-text, table layout, and the line-10 relative `media/icon.png`
      ref stay as-is. Do not delete the screenshots from git.
      _Covers: R2. Refs: design §§3.2, 4._
- [ ] T3. Create `scripts/vsix-gate.sh` (executable): size check
      (`wc -c < vsix` < 300000, decimal), exclusion check
      (`unzip -l` contains no `extension/media/screenshots/`), presence
      checks (icon.png, icon.svg, dist/extension.cjs, dist/webview.js,
      dist/webview.css); prints offending listing lines and exits non-zero
      on any violation; usage banner when no argument given.
      _Covers: R4, R5, R6. Refs: design §5._
- [ ] T4. Wire the gate into `package.json` `scripts.package`
      (`npm run build && vsce package --no-dependencies &&
      scripts/vsix-gate.sh harness-dashboard-vscode-<version>.vsix` —
      resolve the artifact name the same way the script produces it) and
      leave `scripts.publish` consistent (route it through
      `npm run package` or append the same gate call). Scripts-section
      only: zero dependency diffs. Confirm `./check.sh` and its runtime
      are unchanged (`git diff check.sh` empty).
      _Covers: R7 (local + check.sh-stays-free halves). Refs: design §6._
- [ ] T5. CI + publish enforcement: add a `Package VSIX + size gate` step
      (`npm run package`, which carries T4's gate) to `.github/workflows/ci.yml`;
      add a `bash scripts/vsix-gate.sh harness-dashboard.vsix` step to
      `.github/workflows/publish.yml` between "Package VSIX" and "Publish
      to Marketplace".
      _Covers: R7 (CI + publish halves). Refs: design §6._
- [ ] T6. Update DESIGN.md §2.4 ("keeps the VSIX under 300 KB") and §6
      "Distribution" to state the budget is **enforced** at package time
      and in CI by `scripts/vsix-gate.sh` — reword in place to respect
      the file's ≤250-line cap (currently 249: additions must be
      offset).
      _Covers: R9. Refs: design §7 R9 row._
- [ ] T7. Rendering verification, GitHub side: after the MR merges (or on
      the branch preview), confirm the repository landing page renders all
      five screenshots from the hosted URLs, and
      `grep -c 'raw/main/media/screenshots/' README.md` = 5 with zero
      remaining relative screenshot refs.
      _Covers: R3 (GitHub half), R2 (evidence). Refs: design §7._
- [ ] T8. Exercise the gate's failure paths (design §7 R6 row): (a) run it
      against a copy of the pre-diet VSIX if available, or against the
      post-diet artifact with one screenshot re-added via `zip` into a
      temp copy — expect non-zero on the exclusion assertion; (b) same
      trick with `media/icon.png` removed from a temp copy — expect
      non-zero on presence; (c) oversized fixture (pad with `zip`-ing a
      >300 KB junk file into a temp copy) — expect non-zero on size.
      Record all three outputs.
      _Covers: R5, R6 (test evidence). Refs: design §§5, 7._
- [ ] T9. **Measure + record (the payoff task).** `npm run package` on the
      dieted tree; capture: full artifact bytes, `unzip -l` listing
      (evidence of R1), gate PASS output. Create
      `.kiro/specs/vsix-asset-diet/size-report.md` as the new living
      baseline with these numbers (pre-diet 1,899,264 B → post-diet
      <measured> B), a "FEAT-037 R12 waiver: RETIRED <date, MR>" section,
      and the convention note that future size gates update this file.
      If the measured artifact is ≥ 300,000 B: STOP, report — do not
      raise the threshold (design §6).
      _Covers: R1 (evidence), R5, R8. Refs: design §8._
- [ ] T10. Freeze the old record: prepend a one-line banner to
      `.kiro/specs/react-flow-12-migration/size-report.md` —
      "HISTORICAL BASELINE — superseded by
      .kiro/specs/vsix-asset-diet/size-report.md (FEAT-038); numbers below
      are pre-diet and must not be edited." No number changes in that file.
      _Covers: R8 (record convention). Refs: design §8._
- [ ] T11. Non-regression + close-out: `npm test` green; `./check.sh`
      exit 0; `git diff` review shows zero changes under `src/`, zero
      dependency diffs, no `git rm` of screenshots; feature_list FEAT-038
      → done; progress/progress.md entry records the measured size, the
      waiver retirement, and notes the post-release Marketplace listing
      render check (R3 Marketplace half) as a follow-the-publish human
      verification.
      _Covers: R3 (handoff of Marketplace half), R4 (evidence),
      non-regression. Refs: design §7 last row._

## Order & dependencies

T1, T2 (the diet proper) → T3 (gate) → T4, T5 (wiring) → T6 (docs).
T7–T9 need T1–T5 merged/packaged. T10 after T9 (needs the new file to
exist). T11 last. One MR: T1–T6; verification T7–T11 may span the merge
boundary as marked.

## Requirement → task map

| R | Tasks |
|---|---|
| R1 | T1, T9 (evidence) |
| R2 | T2, T7 |
| R3 | T7 (GitHub), T11 (Marketplace handoff) |
| R4 | T3, T8(b), T11 |
| R5 | T3, T8(c), T9 |
| R6 | T3, T8(a)(b) |
| R7 | T4, T5 |
| R8 | T9, T10 |
| R9 | T6 |
