import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROOT, mockConfiguration, seedWorkspace } from '../test/vscodeMock.js';

const appendLine = vi.fn();
const log = { appendLine } as unknown as { appendLine: (message: string) => void };

vi.mock('vscode', async () => (await import('../test/vscodeMock.js')).createVscodeMock());

import * as vscode from 'vscode';
import { ConfigurationRegistry, initConfigurationRegistry } from './ConfigurationRegistry.js';

const rootUri = () => vscode.Uri.file(ROOT);

describe('ConfigurationRegistry (R8)', () => {
    beforeEach(() => {
        seedWorkspace({});
        mockConfiguration.clear();
        appendLine.mockClear();
        ConfigurationRegistry.resetInstance();
    });

    it('(a) reads the setting for an adapter that opts in (isPathConfigurable() === true)', () => {
        // Default: no setting, returns the framework default.
        const registry = initConfigurationRegistry();
        expect(registry.isPathConfigurable('kiro')).toBe(true);
        expect(registry.getPathFor('kiro')).toBe('.kiro');

        // Override the setting in a fresh registry so the cache is empty.
        mockConfiguration.set('adapters.kiro.path', '.custom-kiro');
        ConfigurationRegistry.resetInstance();

        const registry2 = initConfigurationRegistry();
        expect(registry2.getPathFor('kiro')).toBe('.custom-kiro');
    });

    it('(b) does NOT read a setting for an adapter that opts out (isPathConfigurable() === false)', () => {
        const registry = initConfigurationRegistry();
        expect(registry.isPathConfigurable('harness-sdd')).toBe(false);

        // Even if a setting is "present", the registry ignores it
        // because the adapter opted out — no surface registered.
        mockConfiguration.set('adapters.harness-sdd.path', '.custom-agents');
        expect(registry.getPathFor('harness-sdd')).toBe(''); // FALLBACK sentinel
    });

    it('(c) falls back to the default when the setting is an empty string', () => {
        mockConfiguration.set('adapters.kiro.path', '');
        const registry = initConfigurationRegistry();
        expect(registry.getPathFor('kiro')).toBe('.kiro');
    });

    it('(d) emits a warning and falls back to the default when the configured path does not exist', async () => {
        mockConfiguration.set('adapters.kiro.path', '.nonexistent-kiro');
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
        mockConfiguration.set('adapters.kiro.path', '.kiro-as-file');
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
