# Tasks — Configurable adapter paths + Kiro adapter + whiteboard UX polish (FEAT-023)

> Discrete steps in order. The implementer marks `[x]` upon
> completing each one. Each task references the R<n> it covers.
> Tasks are organized into Part A (ConfigurationRegistry,
> R1–R8), Part B (Kiro adapter, R9–R15), Part C
> (whiteboard polish, R16–R22), with Verification,
> Documentation, and Closure sections.

## Pre-flight

- [ ] **T0** — Confirm `src/adapters/` has 7 existing
  adapters and that no `ConfigurationRegistry.ts` exists
  yet. _(prereq)_

## Part A — ConfigurationRegistry (R1–R8)

- [ ] **T1** — Create `src/adapters/ConfigurationRegistry.ts`
  with the `ConfigurationRegistry` class (singleton pattern
  via `getInstance()`). Implement:
  - constructor: register `onDidChangeConfiguration` listener
  - `isPathConfigurable(adapterId)`: returns true if
    `adapterId in DEFAULT_PATHS`
  - `getPathFor(adapterId)`: read setting, fall back to
    `DEFAULT_PATHS[adapterId]` for empty/whitespace
  - `isValidPath(uri, path)`: stat the path, return true
    iff it exists AND is a directory
  - `dispose()`: dispose the change listener _(R1, R3, R4, R6)_
- [ ] **T2** — Modify `src/adapters/IAgentAdapter.ts`: add
  `isPathConfigurable(): boolean` to the interface. Add a
  JSDoc explaining when adapters SHOULD return true
  (their detection path is a convention, not canonical)
  vs false (their path is canonical and changing it
  would break the framework's own tooling). _(R4)_
- [ ] **T3** — Register `ConfigurationRegistry` in
  `src/adapters/index.ts`: add `export {
  ConfigurationRegistry } from './ConfigurationRegistry.js';`
  and instantiate it at module load time (or expose a
  factory function). Add a `dispose()` call to the
  extension's `deactivate()` hook. _(R1, R3)_
- [ ] **T4** — Modify the 5 configurable adapters
  (ClaudeCode, Cursor, GeminiCli, Copilot, Windsurf) to:
  1. Return `true` from `isPathConfigurable()`
  2. Replace hardcoded path strings with calls to
     `ConfigurationRegistry.getInstance().getPathFor(<id>)`
  3. Update `watchGlobs()` to use the dynamic path
  Specifically: `ClaudeCodeAdapter` reads
  `adapters.claude-code.path`; `CursorAdapter` reads
  `adapters.cursor.path`; etc. _(R1, R3)_
- [ ] **T5** — Update `package.json`: add a
  `contributes.configuration` block with the 6 settings
  (one per configurable adapter), each with
  `type: "string"`, `default: <DEFAULT_PATHS[id]>`,
  `description: "..."`, and `scope: "resource"`
  (workspace-level). _(R2, R7)_
- [ ] **T6** — Add 5 unit tests in a new
  `ConfigurationRegistry.test.ts` (or append to
  `adapterRegistry.test.ts`): opts-in reads setting,
  opts-out does NOT, empty-string falls back, non-existent
  path warns + falls back, non-directory path warns + falls
  back. _(R8)_
- [ ] **T7** — Verify in a local `npm test` run that the 5
  unit tests pass and that the 6 existing adapter unit
  tests in `adapterRegistry.test.ts` are NOT broken by
  the modifications. _(R8 + R5 regression check)_

## Part B — Kiro adapter (R9–R15)

- [ ] **T8** — Create `src/adapters/KiroAdapter.ts` mirroring
  the `ClaudeCodeAdapter` structure:
  - `id()` returns `'kiro'`
  - `label()` returns `frameworkLabel('kiro')`
  - `isPathConfigurable()` returns `true`
  - `watchGlobs()` returns
    `[<path>/, <path>/agents/**/*.md, <path>/skills/**/SKILL.md]`
    using the configured path
  - `detect()` returns `fileExists(root, path)` where path
    comes from the registry
  - `parse()` discovers agents + skills under the
    configured path and infers `uses` edges from the
    subagent body's "Skills:" section _(R9, R10, R11, R12, R13)_
- [ ] **T9** — Register the new adapter in
  `src/adapters/index.ts`: add
  `export { KiroAdapter } from './KiroAdapter.js';` and add
  it to the `allAdapters` array. Verify that
  `AdapterRegistry.runAll()` returns 8 adapters (7 existing
  + Kiro). _(R13)_
- [ ] **T10** — Add `kiro: 'Kiro'` to the `frameworkLabel`
  map in `src/frameworks.ts`. Verify that
  `frameworkLabel('kiro')` returns `'Kiro'`. _(R14)_
- [ ] **T11** — Create the Kiro fixture workspace at
  `src/test/fixtures/kiro-minimal/.kiro/`:
  - `agents/demo-agent.md` (H1 + body + "Skills:
    demo-skill" line for R12)
  - `skills/demo-skill/SKILL.md` (with frontmatter)
  - `.custom-path-test-config.md` (sentinel file: the
    R15 custom-path test reads
    `adapters.kiro.path` from a test setting, points it at
    a non-default value, and asserts the adapter finds
    this sentinel file)
  - `README.md` (one-liner describing the fixture) _(R15)_
- [ ] **T12** — Add the 6 Kiro unit tests in
  `KiroAdapter.test.ts` (new file, for clarity):
  detection-positive with default path, detection-positive
  with custom path, detection-negative, subagent
  discovery, skill discovery, relationship inference. The
  custom-path test verifies the registry wiring (R1–R3 +
  R9). _(R15)_
- [ ] **T13** — Update `README.md`: add `Kiro` to the
  "Supported project structures" table with detection
  file `.kiro/`. Kiro IS advertised (unlike Windsurf per
  ADR-003). _(R14)_

## Part C — Whiteboard UX polish (R16–R22)

- [ ] **T14** — In `src/parserLogic.ts`, add a new exported
  function `detectAndFixOverlaps(result: ParserResult):
  ParserResult` that:
  1. Builds a `Map<positionKey, nodeId[]>` with 4-px bins
  2. For each bucket with > 1 entries, emits a
     `ParserError` and applies `(x + N*8, y + N*8)` offset
  3. Iterates up to `MAX_ITERATIONS = 5` for cascading
     overlaps
  4. Returns the de-overlapped ParserResult
  Constants `OVERLAP_TOLERANCE_PX = 4`,
  `OVERLAP_OFFSET_STRIDE_PX = 8`, `MAX_ITERATIONS = 5`
  at the top. _(R16, R17, R18)_
- [ ] **T15** — Wire `detectAndFixOverlaps()` into the parse
  pipeline: call it after `enrichWithIdoneity()` and before
  `reconcileSkillDiscovery()`. Verify the OutputChannel
  emits the warning on overlapping inputs. _(R17)_
- [ ] **T16** — Add the 3 no-overlap tests in
  `parserLogic.test.ts`:
  - 5-node graph with all manual positions set to `(0, 0)`
    → after merge, no two nodes share a position
  - 10-node graph with dagre auto-layout only → no two
    nodes share a position
  - Mixed graph (some manual, some auto) → no two nodes
    share a position _(R22)_
- [ ] **T17** — In `src/webview/WhiteboardCanvas.tsx`, change
  the `fitView` call to use `duration: 400, ease:
  'ease-in-out'` parameters. Apply to ALL fitView call
  sites (initial mount, refresh, Cmd+0 shortcut). _(R20)_
- [ ] **T18** — In `src/webview/components/CustomNode.tsx`,
  add the `node-enter` class on mount and define the
  `@keyframes nodeAppear` animation (200 ms ease-out,
  opacity 0→1, scale 0.85→1). Add
  `prefers-reduced-motion: reduce` media query to disable.
  _(R19)_
- [ ] **T19** — In the edge styles (likely in
  `src/webview/index.tsx`'s `<style>` block), add
  `transition: stroke 150ms ease, stroke-width 150ms ease,
  opacity 150ms ease, stroke-dasharray 150ms ease;` to
  the base edge class. Add `prefers-reduced-motion:
  reduce` media query to disable. _(R21)_

## Verification

- [ ] **T20** — Run `./check.sh` and verify exit 0 with 33
  passes, 0 fails. The new tests should bring the count
  to ~140 (126 existing + 5 ConfigurationRegistry + 6
  Kiro + 3 overlap = 140 unit tests + 1 integration
  test). _(overall)_
- [ ] **T21** — Run `npm test` and verify all 140 unit tests
  pass. The new 14 tests (5 + 6 + 3) should pass on a
  clean main. _(R8, R15, R22)_
- [ ] **T22** — Run `npm run test:integration` (with
  `VSCODE_TEST_PATH` pointing at the system VS Code) and
  verify the critical-path test still passes in < 5 s. The
  new fixture is exercised automatically by the
  integration test's existing flow. _(regression check)_

## Documentation

- [ ] **T23** — Document the R↔T↔test traceability map in
  `progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md`
  (table with the 22 requirements and the T1–T22
  verifications that cover them).
- [ ] **T24** — Create `docs/configuration.md`: long-form
  documentation of the ConfigurationRegistry. Sections:
  (1) Which adapters are configurable and why; (2) How
  to override a path (settings UI + JSON example); (3)
  Edge cases (empty string, non-existent path,
  non-directory path); (4) Why Harness SDD is NOT
  configurable (canonical); (5) How to add a NEW
  configurable adapter (1-line change). _(R1, R7)_
- [ ] **T25** — Update `progress/backlog.md`:
  - Remove the P0 item about land CI on main if already
    done (operational, not a code change).
  - Update the "Validate each of the 6 active universal
    adapters" item to "7 active universal adapters" (now
    includes Kiro) OR rephrase the item to be
    Kiro-specific OR leave the count generic.
  Choose whichever is least churn. _(general hygiene)_

## Closure

- [ ] **T26** — Run `./check.sh` one final time and confirm
  zero failures.
- [ ] **T27** — Update `feature_list.json`: set FEAT-023
  `status` to `"done"`.
- [ ] **T28** — Append a summary in `progress/progress.md`
  following the format of prior entries (FEAT-001
  through FEAT-022).
- [ ] **T29** — Reset `progress/current.md` to template form.
- [ ] **T30** — Commit as ONE commit (per the project's
  "atomic release commit" convention) with a
  conventional-commits message:
  `feat(config+kiro+whiteboard): add ConfigurationRegistry + Kiro adapter + whiteboard polish (no overlap, animations)`
  The body SHALL list the 22 R<n> covered.
- [ ] **T31** — Push to `origin/main`. The CI workflow
  re-runs; if the 14 new tests pass, the PR is green.
