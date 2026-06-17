// ============================================================================
// harnessConfig.test.ts — FEAT-026 T9
//
// Unit tests for `HarnessConfig.read()` and the file-change event.
// Validates R2 (empty / valid / malformed), R4 (warning + fallback).
// ============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = '/workspace';
const mockFiles = new Map<string, string>();
const mockWatchers: Array<{
    pattern: { baseUri: { fsPath: string; path: string }; pattern: string };
    onDidChange: (cb: () => void) => void;
    onDidCreate: (cb: () => void) => void;
    onDidDelete: (cb: () => void) => void;
    fire: (event: 'change' | 'create' | 'delete') => void;
}> = [];

const normalize = (input: string) => input.replace(/\\/g, '/').replace(/\/+/g, '/');
const toUri = (path: string) => {
    const normalized = normalize(path);
    return { fsPath: normalized, path: normalized };
};

function seedWorkspace(files: Record<string, string>): void {
    mockFiles.clear();
    for (const [filePath, content] of Object.entries(files)) {
        const absolute = filePath.startsWith('/') ? filePath : `${ROOT}/${filePath}`;
        mockFiles.set(normalize(absolute), content);
    }
}

vi.mock('vscode', () => {
    class RelativePattern {
        constructor(
            public readonly baseUri: { fsPath: string; path: string },
            public readonly pattern: string
        ) {}
    }

    class Disposable {
        constructor(private readonly _callOnDispose: () => void) {}
        public dispose(): void { this._callOnDispose(); }
    }

    const workspace = {
        fs: {
            readFile: vi.fn(async (uri: { fsPath?: string; path?: string }) => {
                const key = normalize(uri.fsPath ?? uri.path ?? '');
                const value = mockFiles.get(key);
                if (value === undefined) throw new Error(`ENOENT: ${key}`);
                return Buffer.from(value, 'utf8');
            }),
        },
        createFileSystemWatcher: vi.fn((pattern: { baseUri: { fsPath: string; path: string }; pattern: string }) => {
            const watcher = {
                pattern,
                onDidChange: (cb: () => void) => { watcher._changeCb = cb; },
                onDidCreate: (cb: () => void) => { watcher._createCb = cb; },
                onDidDelete: (cb: () => void) => { watcher._deleteCb = cb; },
                fire: (event: 'change' | 'create' | 'delete') => {
                    if (event === 'change') watcher._changeCb?.();
                    if (event === 'create') watcher._createCb?.();
                    if (event === 'delete') watcher._deleteCb?.();
                },
                _changeCb: undefined as (() => void) | undefined,
                _createCb: undefined as (() => void) | undefined,
                _deleteCb: undefined as (() => void) | undefined,
                dispose: vi.fn(),
            };
            mockWatchers.push(watcher);
            return watcher;
        }),
    };

    const Uri = {
        file: (path: string) => toUri(path),
        joinPath: (base: { fsPath?: string; path?: string }, ...parts: string[]) => {
            const basePath = normalize(base.fsPath ?? base.path ?? '');
            const joined = normalize([basePath, ...parts].join('/'));
            return toUri(joined);
        },
    };

    return {
        Uri,
        RelativePattern,
        Disposable,
        workspace,
    };
});

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
