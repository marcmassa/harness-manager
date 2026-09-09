# Current Session State

## Active Feature
_(none in_progress — FEAT-038 `vsix-asset-diet` spec drafted 2026-09-09,
status `spec_ready`, awaiting human approval)_

## Status
- FEAT-037 (react-flow-12-migration) merged as `cde7d98` — v0.8.1 (shared
  with FEAT-036) on `main`; tag/publish still a human decision.
- FEAT-038 spec authored under `.kiro/specs/vsix-asset-diet/`
  (requirements R1–R9 / design / tasks T1–T11):
  - Repo **verified PUBLIC** (`gh repo view --json visibility`) ⇒ standard
    mechanism: absolute `raw/main` image URLs in README.md +
    `.vscodeignore` exclusion of `media/screenshots/**` only.
  - `<ref>` = `main` (0.8.1 untagged; broken-window for a tag ref;
    screenshots are living docs) — alternatives (tag pin, `HEAD`,
    vsce auto-rewrite, PNG shrink, wiki, git-lfs) measured/rejected in
    design §§4, 9.
  - New `scripts/vsix-gate.sh`: <300,000 B size assertion + `unzip -l`
    exclusion + required-media presence (icon.png, icon.svg, dist trio);
    enforced in `npm run package`, CI, and publish.yml — **check.sh stays
    free of packaging**.
  - Payoff task T9 measures the dieted artifact, records the new living
    baseline at `.kiro/specs/vsix-asset-diet/size-report.md`, and
    **retires the FEAT-037 R12 human waiver**.
- `./check.sh`: exit 0, `npm test` 819/819 (57 files) green.
- Housekeeping this session: removed 9 **untracked byte-identical** Finder
  duplicates (`* 2.*` files under `src/webview/`, `.kiro/specs/react-flow-12-migration/`,
  `progress/`) that were breaking FEAT-037's static-audit tests (the
  `src/webview/reactFlow12Migration.test 2.ts` copy tripped its own
  forbidden-property walker). md5-verified identical to tracked originals
  before deletion — zero data loss. Working tree otherwise pristine.

## Notes
- Spec-phase only: no changes to `src/`, `package.json`, `.vscodeignore`,
  README.md, or CHANGELOG.md. Those are T1–T5 after approval.
- Marketplace listing render (R3, Marketplace half) is a post-publish
  human check, like FEAT-037's M1–M7.
