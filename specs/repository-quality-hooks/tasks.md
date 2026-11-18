# FEAT-040 — Implementation after approval

- [ ] T1. Exercise each catalog rule with a positive fixture and a clean control through the contributor hook runner. Verify both events produce valid reports. (R1, R2)
- [ ] T2. Remove activation, manifest contributions and unused verifier code. Document the contributor invocation and retirement of legacy settings. (R1, R3, R4)
- [ ] T3. Run a host regression on a dirty TS buffer with workspace sentinel hooks and legacy settings. Observe a successful save and zero invocations and verifier diagnostics. Inspect the packaged manifest. (R3, R4)
- [ ] T4. Rescan a workspace with declared hooks and assert they remain visible with native source paths. (R5)
- [ ] T5. Record traceability, run build, tests, integration, package and project checks, then hand off for review. (R1–R5)
