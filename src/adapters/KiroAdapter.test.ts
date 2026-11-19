import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROOT, mockConfiguration, seedWorkspace } from '../test/vscodeMock.js';

const appendLine = vi.fn();
const log = { appendLine } as unknown as { appendLine: (message: string) => void };

vi.mock('vscode', async () => (await import('../test/vscodeMock.js')).createVscodeMock());

import * as vscode from 'vscode';
import { ConfigurationRegistry } from './ConfigurationRegistry.js';
import { KiroAdapter } from './KiroAdapter.js';

const rootUri = () => vscode.Uri.file(ROOT);

describe('KiroAdapter (R15)', () => {
    beforeEach(() => {
        seedWorkspace({});
        mockConfiguration.clear();
        appendLine.mockClear();
        ConfigurationRegistry.resetInstance();
    });

    it('(R9, R15) detects Kiro when the configured default .kiro/ directory exists', async () => {
        seedWorkspace({
            '.kiro/agents/demo-agent.md': '# Demo Agent\n',
            '.kiro/skills/demo-skill/SKILL.md': '---\nname: demo-skill\n---\n',
        });
        const adapter = new KiroAdapter();
        expect(await adapter.detect(rootUri())).toBe(true);
    });

    it('(R9, R15) detects Kiro when the configured custom path exists', async () => {
        // Configure a non-default path that has content.
        mockConfiguration.set('adapters.kiro.path', '.custom-kiro');
        seedWorkspace({
            '.custom-kiro/agents/custom-agent.md': '# Custom Agent\n',
        });
        const adapter = new KiroAdapter();
        // Resolve the registry so the configured path is read.
        ConfigurationRegistry.getInstance();
        expect(await adapter.detect(rootUri())).toBe(true);
    });

    it('(R9) returns false from detect() when the configured path does not exist', async () => {
        // No `.kiro/` directory seeded; default path is `.kiro`.
        const adapter = new KiroAdapter();
        ConfigurationRegistry.getInstance();
        expect(await adapter.detect(rootUri())).toBe(false);
    });

    it('(R10, R15) discovers subagents under the configured path', async () => {
        seedWorkspace({
            '.kiro/agents/demo-agent.md': `---\nname: demo-agent\ndescription: Demonstrates Kiro agent format\n---\n# Demo Agent\n`,
        });
        const adapter = new KiroAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];
        expect(nodes.some((n) => n.id === 'kiro::demo-agent' && n.type === 'subagent')).toBe(true);
    });

    it('(R11, R15) discovers skills under the configured path', async () => {
        seedWorkspace({
            '.kiro/skills/demo-skill/SKILL.md': `---\nname: demo-skill\ndescription: A canonical skill\n---\n# Demo Skill\n`,
        });
        const adapter = new KiroAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];
        expect(nodes.some((n) => n.id === 'kiro::demo-skill' && n.type === 'skill')).toBe(true);
    });

    it('(R12, R15) infers `uses` edges from a subagent\'s `## Skills` section', async () => {
        seedWorkspace({
            '.kiro/agents/demo-agent.md': `---\nname: demo-agent\n---\n# Demo Agent\n\n## Skills\n\n- demo-skill\n`,
            '.kiro/skills/demo-skill/SKILL.md': `---\nname: demo-skill\n---\n# Demo Skill\n`,
        });
        const adapter = new KiroAdapter();
        const parsed = await adapter.parse(rootUri());
        const edges = parsed.graph?.edges ?? [];
        expect(edges.some((e) =>
            e.source === 'kiro::demo-agent'
            && e.target === 'kiro::demo-skill'
            && e.label === 'uses'
        )).toBe(true);
    });

    it('(R15) custom-path wiring: registry override finds the seeded custom-path file (not the default)', async () => {
        // Configure a non-default path. Seed content at BOTH the
        // default and the custom path. Verify that parse() finds
        // the custom-path content, not the default.
        mockConfiguration.set('adapters.kiro.path', '.custom-kiro');
        seedWorkspace({
            '.kiro/agents/default-agent.md': `---\nname: default-agent\n---\n# Default\n`, // should NOT be picked up
            '.custom-kiro/agents/custom-agent.md': `---\nname: custom-agent\n---\n# Custom\n`,
        });
        const adapter = new KiroAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];
        expect(nodes.some((n) => n.id === 'kiro::custom-agent' && n.type === 'subagent')).toBe(true);
        expect(nodes.some((n) => n.id === 'kiro::default-agent')).toBe(false);
    });
});
