# FEAT-048 — Shared abstractions for duplicated code

Baseline at the FEAT-046 hold: 985 unit tests; VSIX 345,151 B.

## T1 — Git through the guarded runner

`gitState` (the Delegate dirty check) now calls `createGitRunner(root.fsPath)(['status', '--porcelain'])`. That runner adds `-c core.fsmonitor=false` and spawns git without a shell. Its earlier hand-written spawn had neither safeguard: a repository could configure `core.fsmonitor` to start a process during the check. A non-zero exit, a timeout or a spawn error still reports `no-vcs`, and truncated output counts as dirty.

| Requirement | Verification |
|---|---|
| R5 | gitState.test.ts: the spawn arguments include `-c core.fsmonitor=false`, with `shell: false`; clean, dirty and no-vcs are mapped; no other source file spawns git by hand. |
