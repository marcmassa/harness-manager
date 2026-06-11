# Design — End-to-end integration test of the critical user path

> Technical decisions to implement feature FEAT-021. Adds
> `@vscode/test-electron` as a devDependency, a synthetic fixture
> workspace, a single integration test that drives the critical
> user path through the real VS Code message channel, and a CI
> step that runs the test on every PR.

## Summary

The Harness Dashboard has 126 unit tests (Vitest) that cover the
parser, the semantic layer, the adapters, and the webview
mappers. These are **fast** (< 500 ms total) and **deterministic**
because they do not touch the VS Code runtime. What they do
**not** cover is the actual user-visible flow: open a workspace,
let the extension activate, reveal the activity bar, mount the
webview, click a node, and have the file open in the editor.

That gap matters because the webview ↔ host message channel has
~12 different message types (`getData`, `selectNode`,
`openInEditor`, `acceptSuggestion`, `createNode`, etc.), and
every one of them is a potential regression site that the unit
tests cannot reach.

This feature closes the gap with **one** integration test that
exercises the single most important user path. The design is
deliberately minimal:

- **One** fixture workspace (a self-contained Harness SDD
  project, ~10 files, all under `src/test/fixtures/`).
- **One** integration test file (`src/test/integration/criticalPath.test.ts`).
- **One** new npm script (`test:integration`).
- **One** new devDependency (`@vscode/test-electron`).
- **One** new CI step (`Run integration test`) added to
  `.github/workflows/ci.yml` with `continue-on-error: true` for
  the first 30 days, because headless `@vscode/test-electron`
  is known to be flaky in fresh CI runners and the
  maintainer needs a grace period to tune it.

No production source code is modified. No new runtime
dependency. The test runs in the existing VS Code CI runner
(ubuntu-latest, Node 20.x) with no extra setup.

## Affected Files

| File | Action | Reason |
|---|---|---|
| `package.json` | modify | Add `@vscode/test-electron` to devDependencies; add `test:integration` script (R1) |
| `src/test/fixtures/harness-sdd-minimal/.agents/agentic.json` | **create** | Fixture agentic manifest with one agent + one subagent (R2) |
| `src/test/fixtures/harness-sdd-minimal/.agents/subagents/<name>/SUBAGENT.md` | **create** | Fixture subagent description, the target of the "open in editor" test (R2, R10) |
| `src/test/fixtures/harness-sdd-minimal/feature_list.json` | **create** | Minimal feature list with one `done` feature (R2) |
| `src/test/fixtures/harness-sdd-minimal/README.md` | **create** | One-line README so the workspace opens cleanly (R2) |
| `src/test/integration/criticalPath.test.ts` | **create** | The single integration test (R3, R4–R11) |
| `src/test/integration/runIntegrationTests.ts` | **create** | The `@vscode/test-electron` entry point that downloads VS Code, launches it, and runs the test above (R4) |
| `.github/workflows/ci.yml` | modify | Add "Run integration test" step (R12) |
| `vitest.config.ts` | modify (optional) | Add `exclude: ['src/test/integration/**']` so Vitest does not try to run the integration test under the unit suite (R14) |
| `progress/impl_e2e-integration-test.md` | create | Implementation report |
| `progress/progress.md` | modify | Append summary |
| `progress/backlog.md` | modify | Remove the P1 item this feature closes |
| `feature_list.json` | modify | Add FEAT-021 entry (already done) and mark `done` |

**Not** modified (R15): any file under `src/` that ships in the
production VSIX — specifically, the implementation files
(`extension.ts`, `harnessParser.ts`, `harnessWriter.ts`,
`parserLogic.ts`, `semanticMatcher.ts`, `idoneity.ts`,
`types.ts`, `frameworks.ts`, `webview/`, `adapters/`) are
**forbidden** in this feature. The integration test must drive
the extension as a black box, not collaborate with it via
test-only hooks.

## Test Architecture

```
src/test/integration/
  ├── runIntegrationTests.ts     ← downloaded by @vscode/test-electron
  │                                  launches VS Code, points at the
  │                                  fixture, runs criticalPath.test.ts
  └── criticalPath.test.ts       ← the actual test (a Mocha suite)
                                     uses VS Code API to drive the
                                     extension through its message channel
```

`runIntegrationTests.ts` is the **entry point** — it is the
script that `@vscode/test-electron`'s `runTests()` function calls
in a separate Node process. It uses `Mocha` (which is what
`@vscode/test-electron` ships) to discover and run the test
files. `criticalPath.test.ts` is the **test** — it imports
`vscode` (the real extension host API) and uses it to drive the
extension.

Why Mocha and not Vitest for the integration test? Because
`@vscode/test-electron` is hard-wired to Mocha (it uses Mocha's
`run()` API internally). Using Vitest would require
custom-glue code that is not worth the complexity for a single
test file. The test suite is split cleanly: **Vitest for unit
tests, Mocha for the integration test**, and they are
disjoint by `include`/`exclude` rules in `vitest.config.ts` and
the `@vscode/test-electron` launcher.

## Critical Path: How the Test Drives the Extension

```typescript
// src/test/integration/criticalPath.test.ts (sketch)

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('E2E: critical path — activate → click node → open in editor', () => {
    test('full flow', async function () {
        this.timeout(60_000);

        // 1. R4: wait for extension activation
        const ext = vscode.extensions.getExtension('marcmassacapo.harness-dashboard-vscode');
        assert.ok(ext, 'extension is registered');
        await ext.activate();
        assert.strictEqual(ext.isActive, true, 'extension activated');

        // 2. R5: reveal the activity bar
        await vscode.commands.executeCommand('workbench.view.extension.harness-dashboard');

        // 3. R6: wait for the webview to mount
        // (use VS Code's internal API to find the webview; in practice
        //  this is done by polling for a view with the right viewId)
        await waitForWebviewVisible('harness-dashboard.dashboard', 10_000);

        // 4. R7: send getData and assert response
        const parserResult = await sendMessageAndAwaitResponse(
            { type: 'getData' },
            (msg) => msg.type === 'parserResult' || msg.type === 'data',
            5_000,
        );
        const nodes = parserResult?.graph?.nodes ?? [];
        assert.ok(nodes.length > 0, 'parserResult contains at least one node');
        const subagentNode = nodes.find((n: any) => n.type === 'subagent');
        assert.ok(subagentNode, 'parserResult contains the fixture subagent node');

        // 5. R8: simulate click on the subagent node
        await sendMessage({ type: 'selectNode', nodeId: subagentNode.id });
        await waitForDetailPanelContent(subagentNode.metadata._filePath, 5_000);

        // 6. R9 + R10: simulate "Open in editor" and assert the text
        //    document is now open in a tab backed by the fixture file
        await sendMessage({ type: 'openInEditor', filePath: subagentNode.metadata._filePath });
        await waitFor(async () => {
            const tabs = vscode.window.tabGroups.all
                .flatMap(g => g.tabs)
                .filter(t => t.input instanceof vscode.TabInputText);
            return tabs.some(t =>
                (t.input as vscode.TabInputText).uri.fsPath.endsWith('SUBAGENT.md')
            );
        }, 5_000, 'SUBAGENT.md tab opened');

        // 7. R11: extension host still alive
        const reply = await sendMessageAndAwaitResponse(
            { type: 'getData' },
            (msg) => msg.type === 'parserResult' || msg.type === 'data',
            5_000,
        );
        assert.ok(reply, 'extension host responds to a follow-up getData');
    }).timeout(60_000);
});
```

The `sendMessage` and `sendMessageAndAwaitResponse` helpers are
thin wrappers around the production message channel that the
extension already uses internally — they do not require
modifying `extension.ts`. They use the `acquireVsCodeApi()`
that the webview exposes (the test creates a hidden webview
mirror that talks to the same channel; or, more simply, uses
the `vscode-test-web` shim to inject a fake `acquireVsCodeApi`
that captures outgoing messages and lets the test inject
incoming ones). The exact mechanism is an implementation
detail that the spec does not pin down.

## Fixture Workspace Layout

```
src/test/fixtures/harness-sdd-minimal/
├── .agents/
│   ├── agentic.json                ← one agent + one subagent
│   └── subagents/
│       └── demo-subagent/
│           └── SUBAGENT.md         ← ~30 lines, the "click target"
├── feature_list.json               ← one done feature (so the
│                                      timeline view has something
│                                      to render)
└── README.md                       ← "Fixture workspace for the
                                       Harness Dashboard E2E test"
```

The agentic.json declares:

- one `agent` (id: `fixture-agent`),
- one `subagent` (id: `demo-subagent`, referencing
  `.agents/subagents/demo-subagent/SUBAGENT.md`).

The SUBAGENT.md is ~30 lines of plain prose so the detail
panel has real Markdown to render (rather than a 5-line stub
that would not exercise the Markdown viewer).

The test asserts (R10) that the document opened in the editor
contains the text `Demo Subagent for E2E test` (a sentinel
line at the top of the SUBAGENT.md) — that way the assertion
is robust against cosmetic changes to the rest of the file.

## CI Integration (R12)

The new step in `.github/workflows/ci.yml`:

```yaml
      - name: Run integration test
        # Initial 30-day grace period: flaky in fresh runners,
        # allow merge while we tune. Remove continue-on-error after
        # we have 30 days of green runs. Tracking issue: <URL>.
        continue-on-error: true
        run: xvfb-run -a npm run test:integration
        timeout-minutes: 10
        env:
          # @vscode/test-electron downloads a real VS Code build;
          # tell it to use the system /tmp instead of the runner's
          # default cache to avoid stale-build issues.
          VSCODE_TEST_CACHE: /tmp/vscode-test-cache
```

`xvfb-run -a` provides a virtual display so VS Code can launch
in the headless `ubuntu-latest` runner. The `-a` flag picks an
unused display number automatically. The 10-minute timeout
matches the workflow's overall timeout (FEAT-018 R13).

`continue-on-error: true` is a deliberate choice for the first
30 days: `@vscode/test-electron` in CI is **known to be flaky**
(the first run on a fresh runner is ~3 minutes, subsequent
runs ~30 seconds, and intermittent failures on the first run
are common due to the download step). Allowing the failure
during the grace period means the CI gate is not a
"permanently red" gate while the maintainer tunes the
configuration. After 30 days of stable green runs, the
`continue-on-error` is removed.

The 30-day grace period is recorded as a tracking issue
referenced in the workflow file (the issue URL is a placeholder
at merge time and is replaced with a real GitHub issue once
the maintainer opens one).

## Discarded Alternatives

**1. Use Playwright or Puppeteer instead of `@vscode/test-electron`**

Playwright and Puppeteer can drive a headless Chromium that
runs the VS Code webview, but they cannot exercise the
**extension host** (the Node.js side of the extension that
reads files, calls the VS Code API, and sends messages to
the webview). The whole point of this feature is to test the
**host ↔ webview** contract, so the test must run inside a
real VS Code instance. Playwright is a different tool for a
different problem (UI tests for web pages, not extension
integration tests).

**2. Use `vscode-test-web` (the browser variant of VS Code)**

`vscode-test-web` runs VS Code in a browser via `vscode.dev`,
which is great for showing a demo in a browser tab, but it
does not exercise the full native VS Code API (it cannot,
for example, open a text editor tab backed by a real file
on disk — R10 requires this). It is the right tool for a
"demo on the web" workflow, not for an integration test.

**3. Mock the extension entirely and test the message
protocol in isolation**

A pure-Node test that creates a fake webview, a fake
extension host, and asserts the message protocol would be
fast and deterministic, but it would **not** catch bugs
that depend on the real VS Code API (e.g., R10's assertion
that `vscode.window.tabGroups.all` contains a real editor
tab). The whole purpose of the feature is to catch the
class of bugs that mocks cannot catch, so a mock-based
test would be self-defeating.

**4. Test more than the critical path in this feature
(e.g., semantic suggestions, dismissed-suggestion
persistence, the timeline view)**

Adding more integration tests is a strict superset of
"add one integration test", and it is tempting. It is
discarded because:

- The single test exercises 6 of the ~12 message types
  (`ready`/`getData` → response, `selectNode`,
  `openInEditor`, and a final `getData` re-assertion for
  R11). That is a meaningful coverage baseline.
- Each additional test is ~30–60 minutes of work to
  implement + tune, and the headless-flakiness tuning is
  per-test, not per-suite.
- The spec deliberately frames the goal as **"regression
  protection for the user-visible flow"**, not "comprehensive
  integration coverage". A second integration test
  (e.g., "E2E: dismiss suggestion → reload → suggestion
  still dismissed") is a follow-up feature if and when
  the maintainer has the bandwidth.

## Risks and Edge Cases

- **Headless flakiness** — the biggest known risk. Mitigation:
  30-day `continue-on-error` grace period (R12), plus the
  timeout budget (10 minutes) is generous enough to absorb
  cold-cache VS Code downloads.
- **VS Code download in CI** — `@vscode/test-electron`
  downloads a real VS Code build (≈ 100 MB) the first time
  it runs on a fresh runner. Mitigation: the cache directory
  is set via the `VSCODE_TEST_CACHE` env var to a stable
  path so subsequent runs hit the cache. Even on a cold
  cache, the download is ~30 seconds on a fast runner.
- **The webview's `acquireVsCodeApi()` is a singleton in
  the production bundle** — only one webview instance can
  have a given `acquireVsCodeApi` per page. The test
  approach uses a hidden webview mirror or a
  `@vscode/test-electron`-shimmed version of the API; the
  spec is permissive on the exact mechanism. The
  implementer should pick the approach that `@vscode/test-electron`
  best supports (as of v2.x, it provides a
  `WebviewPanelSerializer` integration for this purpose).
- **macOS / Windows runners in CI** — the spec targets
  `ubuntu-latest` for the integration test (R12). macOS and
  Windows runners are not required for the CI gate (the
  unit tests already cover platform-agnostic code via
  Vitest). If a future maintainer wants to expand CI to
  multi-OS, the test infrastructure supports it (just
  remove the `xvfb-run` prefix on non-Linux runners).
- **First-run after merge** — the very first CI run with
  the integration test enabled will be a "cold" run (no
  cache), and the download + extension activation takes
  longer than subsequent runs. The 10-minute timeout
  accommodates this. The 30-day grace period covers any
  initial tuning the maintainer needs.
- **Vitest picking up the integration test file** — the
  integration test file uses Mocha's `suite`/`test` globals,
  not Vitest's `describe`/`it`. If Vitest picks it up, the
  test would fail with a confusing error. Mitigation: the
  spec requires updating `vitest.config.ts` to add
  `exclude: ['src/test/integration/**']` (R14 cross-cuts).

## Test Plan (this section is informational — the
test is the test)

| Req | How verified |
|---|---|
| R1 | `package.json#devDependencies['@vscode/test-electron']` exists; `npm run test:integration` is a real script |
| R2 | `src/test/fixtures/harness-sdd-minimal/` exists with the 4 listed files |
| R3 | `src/test/integration/criticalPath.test.ts` contains a `suite('E2E: critical path — …')` and it passes on a clean `main` |
| R4 | Test asserts `ext.isActive === true` within 10 s of the test starting |
| R5 | Test calls `vscode.commands.executeCommand('workbench.view.extension.harness-dashboard')` |
| R6 | Test polls for the webview with view ID `harness-dashboard.dashboard` to be `visible` within 10 s |
| R7 | Test sends `getData` and awaits a `parserResult` (or equivalent) response within 5 s; asserts the fixture's node is in the payload |
| R8 | Test sends `selectNode` and waits for the detail panel to render the node's MD content within 5 s |
| R9 | Test sends `openInEditor` and waits for a new `TabInputText` in `vscode.window.tabGroups.all` within 5 s |
| R10 | Test reads the opened `TextDocument`'s contents and asserts it contains the sentinel line `Demo Subagent for E2E test` |
| R11 | Test sends a follow-up `getData` and awaits a response within 5 s |
| R12 | `.github/workflows/ci.yml` has a new step `Run integration test` with `continue-on-error: true` and a `xvfb-run -a` prefix |
| R13 | Local `npm run test:integration` finishes in < 60 s on a developer workstation (measured by the implementer and noted in the impl report) |
| R14 | `npm test` Vitest suite still shows 126/126 passing, runtime within 1 s of pre-feature baseline |
| R15 | `git diff --name-only origin/main -- src/extension.ts src/parserLogic.ts src/harnessParser.ts src/harnessWriter.ts src/semanticMatcher.ts src/idoneity.ts src/types.ts src/frameworks.ts src/webview/ src/adapters/` returns empty (no production source modified) |
