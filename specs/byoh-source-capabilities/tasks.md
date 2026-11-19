# Tasks — BYOH source ownership and operation capabilities

- [x] **T1** — Wire the shared source registry and migrate graph and persisted IDs. Add collision, shared-file, rescan and custom-path tests with the existing built-in fixtures. _(R1, R2, R8)_
- [x] **T2** — Implement the profile and companion registration contracts. Test unknown versions, duplicate IDs, disposal, invalid references, symlink escapes and provider failure isolation. _(R1, R5, R6, R7)_
- [x] **T3** — Render source and capability information and use the host decision at command and webview entry points. Test read-only, stale, unknown and mixed targets with zero writes or launches, plus a supported positive control. _(R3, R4)_
- [x] **T4** — Exercise SDD-only, Claude-only, custom-profile, mixed and unrecognized folders in the Extension Host. Verify native files and script sentinels are unchanged by discovery. Record evidence and the seven advertised adapters’ real-workspace results separately. _(R1, R2, R3, R4, R5, R6, R7, R8)_

Record the R-to-test results before independent review. Run build, unit tests, integration, packaging and project checks on the implementation candidate.
