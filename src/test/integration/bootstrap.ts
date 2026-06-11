/**
 * bootstrap.ts — Internal entry point for the end-to-end integration
 * test (FEAT-021). This file is loaded by `@vscode/test-electron`
 * INSIDE the extension host (i.e., inside a real VS Code process
 * that has the `harness-dashboard` extension activated). It must
 * export a `run(): Promise<void>` function (per the v3 API contract
 * in `node_modules/@vscode/test-electron/out/runTest.d.ts`).
 *
 * Inside `run()`, we:
 *   1. Set up Mocha with a 60-second per-test timeout (R13).
 *   2. Add the test file (compiled to CJS) to Mocha's glob.
 *   3. Run Mocha. Mocha's promise resolves when all tests complete.
 *   4. If any test fails, Mocha rejects the promise, which makes
 *      `@vscode/test-electron` exit with a non-zero code, which
 *      makes `npm run test:integration` fail loudly.
 *
 * Why Mocha and not Vitest: `@vscode/test-electron` requires Mocha
 * (its `run()` is the Mocha test runner). Vitest cannot be used
 * inside the extension host.
 */

import Mocha from 'mocha';
import * as path from 'path';

export async function run(): Promise<void> {
    const mocha = new Mocha({
        // R13: 60-second per-test timeout. The critical path
        // typically takes 15–30 seconds, so 60s is generous
        // and absorbs the cold-start of a fresh extension host.
        timeout: 60_000,
        reporter: 'spec',
        ui: 'tdd', // `suite` / `test` (Mocha TDD interface)
    });

    // The compiled test file lives next to this bootstrap. esbuild
    // compiles both with the same configuration (CJS, target
    // node, external: vscode) so they share the runtime.
    const testFile = path.resolve(__dirname, './criticalPath.test.cjs');
    mocha.addFile(testFile);

    return new Promise<void>((resolve, reject) => {
        try {
            mocha.run((failures) => {
                if (failures && failures > 0) {
                    reject(
                        new Error(
                            `${failures} test(s) failed in the integration suite`
                        )
                    );
                } else {
                    resolve();
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}
