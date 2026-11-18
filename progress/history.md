# Session History

## 2026-11-16 — Framework PR and dependency/macOS maintenance
- Framework snapshot rebased unchanged to 9768f1c; PR #27 open, all requested checks pass.
- Main audit: 9 dev / 0 production findings; compatible updates and scoped overrides: 0 / 0.
- macOS stable 1.146.0 with test-electron 3.1.0: e2e passes; corresponding backlog items cleared.
- Maintenance validation: build, 819 tests, package (373,009 B) and check.sh pass.
- PR #26 and real-repository adapter validations remain pending; spec discrepancies inventoried in review-2026-11-16.md.

## 2026-11-16 — Post-merge packaging verification
- Main 58120c5 contains PRs #26/#27/#28; audits remain 0/0 and macOS e2e passes.
- Local packaging exposed .harness backups and development hooks in the VSIX: 478,724 B (failed gate).
- Exclude .harness/, .githooks/ and hooks/ via .vscodeignore; package now 373,009 B (93%), with 33 backup files retained on disk.
- Build, 819 tests, package, ZIP runtime-asset checks and check.sh (36 checks) pass; pre-existing missing adapter-test warnings remain.
- Regenerated local Claude/Gemini adapters; moved obsolete Codex fallback to /private/tmp/harness-codex-fallback-20261116.toml. No spec, release or framework update.

## 2026-11-17 — Agent Run closure reconciliation
- Reviewed T22/T40 against main 990470d; checked T40 using historical closure and current green verification.
- T22/R16 remains unimplemented; documented missing Runs UI and task prefill without changing feature status.
- Recorded history-test coverage and interactive command-preview discrepancies in progress/reconcile-agent-run-studio.md and backlog.
- Build, 819 tests, package and check.sh pass; no production code or approved requirement/design changed.
- 358 unchecked markers remain across 20 specs; other specs and real-repository adapter checks remain pending.

## 2026-11-17 — Complete repository checklist audit
- All 358 remaining tasks across 20 specs classified in progress/spec-review/README.md; 37 directly verified operational/status markers checked, 321 retained with explicit dispositions.
- Concrete writer-test, save-blocking, e2e-coverage, overlap and traceability gaps recorded; no production code or feature status changes.
- Original framework/audit/macOS/packaging work merged (#27–#29); study #26 merged without implementation.
- Build, 819 tests, package (373,009 B) and 36 checks pass; inherited adapter-test warnings remain.
- PR #30 expanded to the complete review; maintainer merge and feature follow-up decisions remain separate.

## 2026-11-18 — BYOH architecture review candidate
- Classified the 38 baseline features and documented eight built-in adapters, including legacy Windsurf.
- Added inventory checks to the normal test suite and prepared FEAT-040 for human review.
- Build, 821 tests, package (373,009 B), and check.sh (35 checks) pass.

## 2026-11-18 — Contributor quality checks (FEAT-040)
- Removed the installed extension's verifier, command and settings. Kept both contributor hooks and read-only graph discovery.
- Verified all nine rules and clean controls, native hook attribution, and a real macOS save with both legacy options enabled.
- Build, 817 unit tests, both host runs, VSIX (371,609 bytes), and 35 project checks passed. Handoff for independent review.

## 2026-11-18 — BYOH code and security review
- Restricted host dispatch to the two documented toolbar actions, shared webview setup, and removed unused provider state and duplicate types.
- Confirmed the contributor hooks remain isolated on save. Both macOS Extension Host suites, 820 unit tests, build and VSIX gates passed (371,622 bytes). Full and production npm audits returned zero findings.
- The standalone TypeScript check reports the same 218 diagnostics before and after these changes. Independent feature closure review remains pending.
