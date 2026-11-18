// Launch both suites against the development bundle in a real VS Code host.
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import * as path from 'path';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';

async function checkSaveIsolation(vscodeExecutablePath: string, extensionDevelopmentPath: string) {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'dashboard-save-'));
    try {
        for (const dir of ['src', '.vscode', '.kiro/hooks']) {
            await fs.mkdir(path.join(root, dir), { recursive: true });
        }
        await fs.writeFile(path.join(root, 'src/sample.ts'), 'export const value = 1;\n');
        await fs.writeFile(path.join(root, '.vscode/settings.json'), JSON.stringify({
            'harness-dashboard.codeQuality.verifyOnSave': true,
            'harness-dashboard.codeQuality.blockOnSave': true,
            'harness-dashboard.codeQuality.warnBeforeSaveOnError': true,
            'harness-dashboard.codeQuality.severity': 'error',
        }));
        for (const kind of ['kiss', 'dry']) {
            const script = path.join(root, '.kiro/hooks', 'on-file-saved-' + kind + '-check.sh');
            await fs.writeFile(script, '#!/bin/sh\ntouch "$(dirname "$0")/../../hook-ran"\n', { mode: 0o755 });
        }
        await runTests({
            vscodeExecutablePath, extensionDevelopmentPath, launchArgs: [root],
            extensionTestsPath: path.join(__dirname, 'saveIsolation.cjs'),
        });
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

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
        await checkSaveIsolation(vscodeExecutablePath, extensionDevelopmentPath);
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
