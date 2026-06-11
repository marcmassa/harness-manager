/**
 * runIntegrationTests.ts — entry point for the end-to-end integration
 * test suite (FEAT-021).
 *
 * This file is the script that `@vscode/test-electron`'s `runTests()`
 * function downloads and executes in a separate Node process. It uses
 * Mocha (the test runner that `@vscode/test-electron` ships with) to
 * discover and run the actual test files in this directory.
 *
 * Why Mocha and not Vitest: `@vscode/test-electron` is hard-wired to
 * Mocha. Using Vitest would require custom glue code that is not worth
 * the complexity for a single test file. The unit tests (Vitest) and
 * the integration test (Mocha) are disjoint by `include`/`exclude`
 * rules in `vitest.config.ts` and this entry point respectively.
 *
 * Lifecycle:
 *   1. `downloadAndUnzipVSCode()` — downloads a real VS Code build
 *      (≈ 100 MB on first run) into a cache directory. Subsequent
 *      runs reuse the cache.
 *   2. `runTests({ ... })` — launches the cached VS Code binary with
 *      the extension's `.vsix` installed, pointing `vscode.workspace`
 *      at the fixture from `src/test/fixtures/harness-sdd-minimal/`.
 *   3. Inside the launched VS Code, Mocha runs the test files matched
 *      by the `tests` glob below. Each test uses the real `vscode`
 *      API to drive the extension's message channel.
 *   4. The exit code is propagated back to the parent process so that
 *      `npm run test:integration` fails loudly on a test failure.
 */

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import * as path from 'path';

async function main(): Promise<void> {
    // The extension root is the parent of `out/test/integration/`. The
    // `extensionDevelopmentPath` tells VS Code to load the extension
    // directly from source (not from a packaged VSIX), so the test
    // always exercises the current `dist/extension.cjs`.
    const extensionDevelopmentPath = path.resolve(__dirname, '../../..');

    // The workspace the test will open. This is the fixture from R2
    // of `specs/e2e-integration-test/requirements.md`.
    const fixtureWorkspace = path.resolve(
        extensionDevelopmentPath,
        'src/test/fixtures/harness-sdd-minimal'
    );

    // Download a real VS Code build (Stable channel, matching the
    // project's `engines.vscode ^1.85.0` baseline). The downloaded
    // binary is cached in `~/.vscode-test/` by default; the CI
    // workflow sets `VSCODE_TEST_CACHE` to a stable path so
    // subsequent CI runs hit the cache.
    //
    // Honour `VSCODE_TEST_PATH` if the developer points it at an
    // existing VS Code install. This is what the local smoke test
    // (T9 in the spec) uses — it avoids the ~100 MB download on
    // every machine that has VS Code already installed.
    const vscodeExecutablePath = process.env.VSCODE_TEST_PATH
        ? process.env.VSCODE_TEST_PATH
        : await downloadAndUnzipVSCode({});

    try {
        // The path passed to `extensionTestsPath` is loaded by the
        // extension host (inside VS Code) and must export a `run()`
        // function. We point at the compiled bootstrap file
        // (`bootstrap.cjs`), which is a separate esbuild entry point
        // that loads Mocha and runs `criticalPath.test.cjs`.
        const bootstrapPath = path.resolve(
            __dirname,
            './bootstrap.cjs'
        );

        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            launchArgs: [fixtureWorkspace],
            extensionTestsPath: bootstrapPath,
            // Pass the fixture root path to the test so it can
            // locate on-disk assets without relying on a fragile
            // `__dirname`-relative path (which differs between
            // compiled output and source). See criticalPath.test.ts
            // for the consumer side.
            extensionTestsEnv: {
                ...process.env,
                HARNESS_DASHBOARD_E2E: '1',
                HARNESS_DASHBOARD_FIXTURE: fixtureWorkspace,
            },
        });
    } catch (err) {
        // `runTests` throws on any test failure. We log and re-throw
        // with a non-zero exit code so `npm run test:integration`
        // surfaces a clear failure to the developer / CI.
        console.error('[runIntegrationTests] Integration test suite FAILED:');
        console.error(err);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[runIntegrationTests] Fatal error during setup:');
    console.error(err);
    process.exit(2);
});
