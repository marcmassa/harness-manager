import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        // FEAT-021: the integration test file uses Mocha's `suite`/
        // `test` globals (because `@vscode/test-electron` requires
        // Mocha), not Vitest's `describe`/`it`. If Vitest picked
        // it up, it would fail with a confusing "suite is not
        // defined" error. Excluding `src/test/integration/**` keeps
        // the unit-test command (`npm test`) cleanly disjoint from
        // the integration-test command (`npm run test:integration`).
        exclude: [
            'node_modules/**',
            'dist/**',
            'out/**',
            'src/test/integration/**',
        ],
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/test/**',
                'src/webview/**',
                'src/types.ts',
            ],
        },
    },
});
