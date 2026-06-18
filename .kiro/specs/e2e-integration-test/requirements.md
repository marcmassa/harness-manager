# Requirements — End-to-end integration test of the critical user path

> Feature FEAT-021 from `feature_list.json`. Adds an automated
> integration test that runs the Harness Dashboard extension in a
> real VS Code instance (headless, via `@vscode/test-electron`),
> opens a small synthetic Harness SDD workspace as a fixture,
> exercises the critical user path
> **activate → whiteboard renders → click a node → detail panel
> shows MD content → click "Open in editor" → file opens in VS
> Code's text editor**,
> and asserts the on-disk and on-screen state at each step.
>
> Closes the "zero integration tests" gap noted in the 2026-06-10
> project analysis: the project ships 126 unit tests but no test
> that exercises the webview in a real VS Code instance. The
> purpose is **regression protection for the user-visible flow**,
> not coverage of every code path.
>
> Each requirement is written in strict EARS and is verifiable by
> at least one specific assertion in the test runner.

## EARS Patterns

| Pattern | Syntax | When to use |
|---|---|---|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a continuous state holds |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — Test runner integration
- **Pattern:** Ubiquitous
- **Wording:** The project SHALL include `@vscode/test-electron` (and its required peer dependencies) as a `devDependency` in `package.json`, and SHALL expose a new npm script `test:integration` that runs the integration test suite.

### R2 — Synthetic fixture workspace
- **Pattern:** Ubiquitous
- **Wording:** The repository SHALL contain a directory `src/test/fixtures/harness-sdd-minimal/` that is a self-contained Harness SDD workspace (a directory with `.agents/agentic.json` defining one agent and one subagent, one `SUBAGENT.md` describing the subagent, and a `feature_list.json` with at least one `done` feature) and that is the workspace used by the integration test as the `vscode.workspace.rootPath`.

### R3 — Single integration test, critical path
- **Pattern:** Ubiquitous
- **Wording:** The integration test suite SHALL contain at least one test (named `E2E: critical path — activate → click node → open in editor`) that exercises the full critical path described in the feature summary, and SHALL pass on a clean `main` branch.

### R4 — VS Code launch and activation
- **Pattern:** Event
- **Wording:** WHEN the test starts, the runner SHALL launch a real VS Code instance (headless, Xvfb on Linux / native on macOS and Windows) pointed at the fixture workspace from R2, and SHALL wait until the `harness-dashboard` extension is activated (i.e., until `extensions.getExtension('marcmassacapo.harness-dashboard-vscode').isActive === true`).

### R5 — Activity bar reveal
- **Pattern:** Event
- **Wording:** WHEN the extension is active, the test SHALL programmatically execute the command `workbench.view.extension.harness-dashboard` to reveal the Harness Dashboard view in the activity bar.

### R6 — Webview mount
- **Pattern:** State
- **Wording:** WHILE the webview is mounted, the test SHALL be able to find a webview with the type `webview` and view ID `harness-dashboard.dashboard` in the workbench DOM (or the equivalent VS Code API surface, depending on the test runner's access path), and SHALL assert that its `visible` state is `true` within 10 seconds of the activation in R4.

### R7 — First message round-trip
- **Pattern:** Event
- **Wording:** WHEN the test sends the `getData` message from the test runner to the webview's message channel (mirroring the production `webview.postMessage({ type: 'getData' })` call), the extension host SHALL respond with a `ParserResult` payload within 5 seconds, and the payload SHALL include at least one `nodes` entry whose `id` corresponds to the agent or subagent declared in the fixture's `agentic.json`.

### R8 — User click simulation on a node
- **Pattern:** Event
- **Wording:** WHEN the test simulates a user click on the node identified in R7 (via the webview's message channel, sending a `selectNode` message with the node's `id`), the extension host SHALL acknowledge the selection by writing the node's Markdown content to the detail panel.

### R9 — "Open in editor" triggers `vscode.window.showTextDocument`
- **Pattern:** Event
- **Wording:** WHEN the test simulates a user click on the "Open in editor" button (via the webview's message channel, sending an `openInEditor` message with the node's `_filePath`), the extension host SHALL call `vscode.workspace.openTextDocument` followed by `vscode.window.showTextDocument` (these are observable in `vscode.window.tabGroups.all` as a new editor tab whose `input` is a `TextDocument` with the same URI as the node's `_filePath`).

### R10 — Document on disk
- **Pattern:** Ubiquitous
- **Wording:** The `TextDocument` opened in R9 SHALL be backed by a real file on disk (the `SUBAGENT.md` of the fixture's subagent), and the file SHALL contain the expected text the fixture declares.

### R11 — No extension host crash
- **Pattern:** Unwanted
- **Wording:** IF the critical path completes without error, the extension host SHALL still be alive at the end of the test (the runner can assert this by sending one more benign message, e.g. `getData`, and confirming a response is received within 5 seconds).

### R12 — Test runs in CI
- **Pattern:** Event
- **Wording:** WHEN the GitHub Actions workflow (FEAT-018) runs on a pull request, the integration test SHALL be invoked as a new step (named "Run integration test") on the `ubuntu-latest` runner, and SHALL pass. If the integration test is flaky in CI (which is a known risk for `@vscode/test-electron` in headless environments), the CI step SHALL be marked as `continue-on-error: true` for the first 30 days after this feature lands, with a tracking issue referenced in the workflow file.

### R13 — Local run
- **Pattern:** Optional
- **Wording:** WHERE a developer runs `npm run test:integration` on a workstation with a graphical session (macOS, Windows, or Linux with Xvfb), the integration test SHALL pass within 60 seconds (typical time: 15–30 seconds, allowing for VS Code startup + extension activation + the 5-second timeouts in R6/R7/R11).

### R14 — No regression in unit tests
- **Pattern:** Unwanted
- **Wording:** IF the integration test dependencies are added to `package.json` and the test infrastructure is set up, the existing `npm test` Vitest suite SHALL continue to pass with the same 126 tests green, and SHALL NOT be slowed down by more than 1 second (i.e., the new dependencies SHALL be `devDependencies`, not `dependencies`, so they do not affect the production bundle).

### R15 — No new production code
- **Pattern:** Unwanted
- **Wording:** The implementation of FEAT-021 SHALL NOT modify any file under `src/` that ships in the production VSIX (i.e., `src/extension.ts`, `src/parserLogic.ts`, `src/harnessParser.ts`, `src/harnessWriter.ts`, `src/semanticMatcher.ts`, `src/idoneity.ts`, `src/types.ts`, `src/frameworks.ts`, `src/webview/**`, `src/adapters/**` are all off-limits). The only new files SHALL be in `src/test/integration/`, `src/test/fixtures/`, and `.github/workflows/ci.yml` (the CI step).

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| `@vscode/test-electron` added as devDep, `npm run test:integration` script | R1 |
| Fixture workspace exists and is the test's workspace root | R2 |
| One integration test named "E2E: critical path" exists and passes | R3 |
| VS Code launches in headless mode, extension activates | R4 |
| `workbench.view.extension.harness-dashboard` is invoked | R5 |
| Webview is visible within 10 s of activation | R6 |
| `getData` message round-trip succeeds with expected node in payload | R7 |
| `selectNode` message triggers detail-panel write | R8 |
| `openInEditor` message opens a text editor tab | R9 |
| The opened text document is backed by the fixture's `SUBAGENT.md` on disk | R10 |
| Extension host is alive at end of test | R11 |
| CI workflow runs the integration test (with `continue-on-error: true` for 30 days) | R12 |
| Local `npm run test:integration` passes within 60 s | R13 |
| 126 unit tests still pass, no slowdown > 1 s | R14 |
| No production source code modified | R15 |
