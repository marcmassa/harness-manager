# Current session state

Version 0.9.0 (Bring Your Own Harness) is declared: `package.json`, CHANGELOG and README describe the release.

The branches are stacked: `spec/tree-view-presentation` (FEAT-046, FEAT-047), then `spec/shared-abstractions` (FEAT-048) on top. They are not yet pushed. FEAT-039 to FEAT-045 are already on `main` (PR #32).

FEAT-039 to FEAT-048 are `blocked`, waiting for the maintainer's closing reviews; agents cannot record their own closing review. Each feature's evidence is in `progress/impl_<name>.md`.

Release checks on the 0.9.0 candidate:
- 1024 unit tests;
- 19 Extension Host runs;
- `check.sh`, which now fails when tests fail;
- VSIX gate, under the 400,000-byte budget.

Open follow-ups are in `progress/backlog.md`:
- retake the README screenshots;
- upstream the `check.sh` fix to the framework template.
