# FEAT-048 — Shared abstractions for duplicated code

Proposed for Harness Dashboard v0.9.0, from the duplication review of 2026-11-19 and the maintainer's go-ahead the same day. Each item below exists in at least three copies, or is copy-pasted logic in two places. The DRY steering asks for one authoritative representation of each; the KISS steering asks for plain functions over class hierarchies. Behaviour does not change, except where a copy had drifted from the others (R2, R5).

## Context

Measured on `spec/tree-view-presentation` at the FEAT-046 hold commit:

| # | Duplicated logic | Copies |
|---|---|---|
| 1 | Adapter discovery wiring: `setHarnessConfig`, the per-adapter and root discovery flags, and the `parse()` tail that reads local config and appends discovered nodes | 6 adapters |
| 2 | In-memory `vscode` workspace mock for unit tests: `normalize` (8 copies), `globToRegExp` (5 copies, two of them simplified with different semantics), `findFiles`, `readFile`, `Uri` | 7 test files |
| 3 | Optimizer `finding()` helper | 7 rule files |
| 4 | `OptimizableType` list | 7 places |
| 5 | `gitState` spawns `git status` without `-c core.fsmonitor=false`. `createGitRunner` (FEAT-044 R15) already enforces that flag and no shell. | 1 hand-written copy |
| 6 | Adapter `body` / `_fullBody` metadata, with the magic number 500 | 15 places in 8 adapters |
| 7 | Root-agent node construction (title, first six lines, missing-file source) | 3 adapters |
| 8 | Webview AI generate/refine icon buttons | 4 in 2 files |
| 9 | Context-menu styles | 3 |
| 10 | Two pairs of identical button style constants; tier colours; keyframes (one copy unused) | 2 + 2 + 2 |
| 11 | Integration `snapshot(dir)` | 5 suites |
| 12 | Active-suggestion filter and architecture summary; workspace-state key literals; the ownership map | 3 + 6 + 2 |

`./check.sh` reports PASS when unit tests fail. Its line `npm test … \| tail -10 && pass \|\| warn` takes the exit status of `tail`, not of `npm test`, and a failure would only warn anyway.

## Requirements

### R1 — Adapter discovery

All file-based adapters SHALL get their discovery flags and append discovered hook and steering nodes through one shared function. No adapter SHALL keep its own copy of the flag reading.

### R2 — One test mock

Unit tests that need an in-memory workspace SHALL use one shared `vscode` mock module with one glob implementation: the one with brace, `**` and `?` support. A test that relied on the simplified glob SHALL still pass under the shared one, or SHALL be corrected with its fixture.

### R3 — Optimizer rule helpers

All Optimizer rules SHALL build findings through one `finding()` helper. Every list of optimizable types SHALL derive from one exported constant.

### R4 — Adapter node helpers

Adapters SHALL build `body` / `_fullBody` metadata through one helper with a named preview-length constant. The three root-agent nodes SHALL come from one helper.

### R5 — Git through the guarded runner

Every git invocation in the extension host SHALL go through `createGitRunner`, so it runs without a shell and with `core.fsmonitor` disabled.

### R6 — Webview helpers

The AI icon buttons, context-menu styles, duplicated button styles, tier colours and keyframes SHALL each have one definition that every user imports. No new import edge SHALL merge the whiteboard and Optimizer chunks: a chunk imports shared style modules only.

### R7 — Host helpers

The following SHALL each have one definition:
- the integration `snapshot(dir)`;
- the active-suggestion filter and architecture summary;
- the workspace-state keys for dismissed suggestions, disabled connections and custom edges;
- the per-node ownership map.

### R8 — No behaviour change

WHEN the feature is complete:
- every existing unit test SHALL pass unchanged in its assertions, except tests rewritten onto the shared mock (R2);
- all Extension Host runs SHALL pass;
- the packaged VSIX SHALL NOT be larger than before FEAT-048.

### R9 — Honest project check

`./check.sh` SHALL fail WHEN the unit tests fail, and SHALL report the number of failing tests.
