import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = '/workspace';
const mockFiles = new Map<string, string>();
const configurationStore = new Map<string, string>();

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

/**
 * In VS Code's API, `FileType.File === 1` and
 * `FileType.Directory === 2`. The mock returns `2` for
 * directory paths (paths that have at least one child in the
 * mockFiles map) and `1` for leaf files.
 */
function statType(uri: { fsPath?: string; path?: string }): number {
    const key = normalize(uri.fsPath ?? uri.path ?? '');
    if (!mockFiles.has(key)) throw new Error(`ENOENT: ${key}`);
    for (const filePath of mockFiles.keys()) {
        if (filePath !== key && filePath.startsWith(`${key}/`)) {
            return 2; // has at least one child → directory
        }
    }
    return 1; // leaf → file
}

const appendLine = vi.fn();
const log = { appendLine } as unknown as { appendLine: (message: string) => void };

vi.mock('vscode', () => {
    class RelativePattern {
        constructor(
            public readonly baseUri: { fsPath: string; path: string },
            public readonly pattern: string
        ) {}
    }

    const workspace = {
        fs: {
            readFile: vi.fn(async (uri: { fsPath?: string; path?: string }) => {
                const key = normalize(uri.fsPath ?? uri.path ?? '');
                const value = mockFiles.get(key);
                if (value === undefined) throw new Error(`ENOENT: ${key}`);
                return Buffer.from(value, 'utf8');
            }),
            stat: vi.fn(async (uri: { fsPath?: string; path?: string }) => ({
                type: statType(uri),
            })),
        },
        findFiles: vi.fn(async () => []),
        asRelativePath: vi.fn(() => ''),
        onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
        getConfiguration: vi.fn((_section: string) => ({
            get: (key: string, fallback: unknown) => {
                return configurationStore.has(key) ? configurationStore.get(key) : fallback;
            },
        })),
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
        workspace,
    };
});

import * as vscode from 'vscode';
import { ConfigurationRegistry, initConfigurationRegistry } from './ConfigurationRegistry.js';

const rootUri = () => vscode.Uri.file(ROOT);

describe('ConfigurationRegistry (R8)', () => {
    beforeEach(() => {
        seedWorkspace({});
        configurationStore.clear();
        appendLine.mockClear();
        ConfigurationRegistry.resetInstance();
    });

    it('(a) reads the setting for an adapter that opts in (isPathConfigurable() === true)', () => {
        // Default: no setting, returns the framework default.
        const registry = initConfigurationRegistry();
        expect(registry.isPathConfigurable('kiro')).toBe(true);
        expect(registry.getPathFor('kiro')).toBe('.kiro');

        // Override the setting in a fresh registry so the cache is empty.
        configurationStore.set('adapters.kiro.path', '.custom-kiro');
        ConfigurationRegistry.resetInstance();

        const registry2 = initConfigurationRegistry();
        expect(registry2.getPathFor('kiro')).toBe('.custom-kiro');
    });

    it('(b) does NOT read a setting for an adapter that opts out (isPathConfigurable() === false)', () => {
        const registry = initConfigurationRegistry();
        expect(registry.isPathConfigurable('harness-sdd')).toBe(false);

        // Even if a setting is "present", the registry ignores it
        // because the adapter opted out — no surface registered.
        configurationStore.set('adapters.harness-sdd.path', '.custom-agents');
        expect(registry.getPathFor('harness-sdd')).toBe(''); // FALLBACK sentinel
    });

    it('(c) falls back to the default when the setting is an empty string', () => {
        configurationStore.set('adapters.kiro.path', '');
        const registry = initConfigurationRegistry();
        expect(registry.getPathFor('kiro')).toBe('.kiro');
    });

    it('(d) emits a warning and falls back to the default when the configured path does not exist', async () => {
        configurationStore.set('adapters.kiro.path', '.nonexistent-kiro');
        const registry = initConfigurationRegistry(log);
        const resolved = await registry.resolvePath('kiro', rootUri());

        expect(resolved).toBe('.kiro'); // fell back to default
        expect(appendLine).toHaveBeenCalledTimes(1);
        const message = appendLine.mock.calls[0][0] as string;
        expect(message).toContain("Configured path '.nonexistent-kiro'");
        expect(message).toContain("adapter 'kiro'");
        expect(message).toContain('using default detection');
    });

    it('(e) emits a warning and falls back to the default when the configured path is not a directory', async () => {
        // `.kiro-as-file` is a file (not a directory). Configure
        // the registry to use it. The resolver must reject it as
        // a non-directory and fall back to the default.
        seedWorkspace({ '.kiro-as-file': 'this is a file, not a directory' });
        configurationStore.set('adapters.kiro.path', '.kiro-as-file');
        const registry = initConfigurationRegistry(log);
        const resolved = await registry.resolvePath('kiro', rootUri());

        expect(resolved).toBe('.kiro'); // fell back to default
        expect(appendLine).toHaveBeenCalledTimes(1);
        const message = appendLine.mock.calls[0][0] as string;
        expect(message).toContain("Configured path '.kiro-as-file'");
        expect(message).toContain("adapter 'kiro'");
        expect(message).toContain('using default detection');
    });
});
