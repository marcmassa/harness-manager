// ============================================================================
// harnessConfig.test.ts — FEAT-026 T9
//
// Unit tests for `HarnessConfig.read()` and the file-change event.
// Validates R2 (empty / valid / malformed), R4 (warning + fallback).
// ============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROOT, mockWatchers, seedWorkspace } from '../test/vscodeMock.js';

vi.mock('vscode', async () => (await import('../test/vscodeMock.js')).createVscodeMock());

import * as vscode from 'vscode';
import { HarnessConfig, EMPTY_HARNESS_CONFIG } from './harnessConfig.js';

const rootUri = () => vscode.Uri.file(ROOT);

describe('HarnessConfig (R2, R4)', () => {
    beforeEach(() => {
        seedWorkspace({});
        mockWatchers.length = 0;
    });

    it('(R2) returns the empty config when the file does not exist', async () => {
        const config = new HarnessConfig(channel());
        const result = await config.read(rootUri());
        expect(result).toEqual(EMPTY_HARNESS_CONFIG);
    });

    it('(R2) returns the empty config when the file is an empty string', async () => {
        seedWorkspace({ '.harness-dashboard/config.json': '' });
        const config = new HarnessConfig(channel());
        const result = await config.read(rootUri());
        expect(result).toEqual(EMPTY_HARNESS_CONFIG);
    });

    it('(R2) returns the empty config when the file is just whitespace', async () => {
        seedWorkspace({ '.harness-dashboard/config.json': '   \n   \n' });
        const config = new HarnessConfig(channel());
        const result = await config.read(rootUri());
        expect(result).toEqual(EMPTY_HARNESS_CONFIG);
    });

    it('(R2) parses a valid file with overrides and extras', async () => {
        const json = JSON.stringify({
            adapters: {
                kiro: { hooksPath: 'custom-hooks', steeringPath: 'custom-steering' },
            },
            extraPaths: {
                kiro: {
                    hooks: ['a/hooks', 'b/hooks'],
                    steering: ['c/steering'],
                },
            },
        });
        seedWorkspace({ '.harness-dashboard/config.json': json });
        const config = new HarnessConfig(channel());
        const result = await config.read(rootUri());
        expect(result.adapters?.kiro?.hooksPath).toBe('custom-hooks');
        expect(result.adapters?.kiro?.steeringPath).toBe('custom-steering');
        expect(result.extraPaths?.kiro?.hooks).toEqual(['a/hooks', 'b/hooks']);
        expect(result.extraPaths?.kiro?.steering).toEqual(['c/steering']);
    });

    it('(R4) falls back to the empty config and logs a warning when JSON is malformed', async () => {
        const append = vi.fn();
        const log = { appendLine: append } as unknown as { appendLine: (msg: string) => void };
        seedWorkspace({ '.harness-dashboard/config.json': '{ adapters: this is not JSON' });
        const config = new HarnessConfig(log);
        const result = await config.read(rootUri());
        expect(result).toEqual(EMPTY_HARNESS_CONFIG);
        expect(append).toHaveBeenCalledTimes(1);
        const message = append.mock.calls[0][0] as string;
        expect(message).toContain('Failed to parse');
        expect(message).toContain('.harness-dashboard/config.json');
    });

    it('caches the value between calls', async () => {
        seedWorkspace({ '.harness-dashboard/config.json': '{"adapters":{}}' });
        const config = new HarnessConfig(channel());
        const first = await config.read(rootUri());
        const second = await config.read(rootUri());
        // Same reference (cached), not a freshly-parsed object
        expect(first).toBe(second);
    });

    it('invalidates the cache when the file watcher fires', async () => {
        seedWorkspace({ '.harness-dashboard/config.json': '{"adapters":{}}' });
        const config = new HarnessConfig(channel());
        const first = await config.read(rootUri());
        expect(first).toEqual({ adapters: {} });

        // Update the file in the mock and fire the change event.
        seedWorkspace({ '.harness-dashboard/config.json': '{"adapters":{"kiro":{"hooksPath":"new"}}}' });
        expect(mockWatchers.length).toBe(1);
        mockWatchers[0].fire('change');

        const second = await config.read(rootUri());
        expect(second).not.toBe(first);
        expect((second as any).adapters.kiro.hooksPath).toBe('new');
    });

    it('emits onDidChange events when the cache is invalidated', async () => {
        seedWorkspace({ '.harness-dashboard/config.json': '{}' });
        const config = new HarnessConfig(channel());
        await config.read(rootUri());
        const listener = vi.fn();
        config.onDidChange(listener);
        mockWatchers[0].fire('change');
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('dispose() makes subsequent reads return the empty config', async () => {
        seedWorkspace({ '.harness-dashboard/config.json': '{"adapters":{}}' });
        const config = new HarnessConfig(channel());
        await config.read(rootUri());
        config.dispose();
        const result = await config.read(rootUri());
        expect(result).toEqual(EMPTY_HARNESS_CONFIG);
    });
});

function channel(): { appendLine: (message: string) => void } {
    return { appendLine: vi.fn() } as unknown as { appendLine: (message: string) => void };
}
