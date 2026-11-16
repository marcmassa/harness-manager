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
