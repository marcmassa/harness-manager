import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = '/workspace';
const mockFiles = new Map<string, string>();

const normalize = (input: string) => input.replace(/\\/g, '/').replace(/\/+/g, '/');
const toUri = (path: string) => {
    const normalized = normalize(path);
    return { fsPath: normalized, path: normalized };
};

function globToRegExp(glob: string): RegExp {
    let pattern = '^';

    for (let i = 0; i < glob.length; i += 1) {
        const current = glob[i];
        const next = glob[i + 1];
        const nextAfter = glob[i + 2];

        if (current === '*' && next === '*') {
            if (nextAfter === '/') {
                pattern += '(?:.*/)?';
                i += 2;
                continue;
            }
            pattern += '.*';
            i += 1;
            continue;
        }

        if (current === '*') {
            pattern += '[^/]*';
            continue;
        }

        if (current === '?') {
            pattern += '.';
            continue;
        }

        pattern += current.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }

    pattern += '$';
    return new RegExp(pattern);
}

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

    const workspace = {
        fs: {
            readFile: vi.fn(async (uri: { fsPath?: string; path?: string }) => {
                const key = normalize(uri.fsPath ?? uri.path ?? '');
                const value = mockFiles.get(key);
                if (value === undefined) throw new Error(`ENOENT: ${key}`);
                return Buffer.from(value, 'utf8');
            }),
            stat: vi.fn(async (uri: { fsPath?: string; path?: string }) => {
                const key = normalize(uri.fsPath ?? uri.path ?? '');
                if (!mockFiles.has(key)) throw new Error(`ENOENT: ${key}`);
                return { type: 1 };
            }),
        },
        findFiles: vi.fn(async (pattern: RelativePattern | string) => {
            const base = typeof pattern === 'string'
                ? ROOT
                : normalize(pattern.baseUri.fsPath ?? pattern.baseUri.path ?? ROOT);
            const glob = typeof pattern === 'string' ? pattern : pattern.pattern;
            const regexp = globToRegExp(glob);
            const matches: Array<{ fsPath: string; path: string }> = [];

            for (const filePath of mockFiles.keys()) {
                if (!filePath.startsWith(`${base}/`)) continue;
                const relativePath = filePath.slice(base.length + 1);
                if (regexp.test(relativePath)) {
                    matches.push(toUri(filePath));
                }
            }

            return matches;
        }),
        asRelativePath: vi.fn((file: { fsPath?: string; path?: string } | string) => {
            const full = normalize(typeof file === 'string' ? file : (file.fsPath ?? file.path ?? ''));
            if (full.startsWith(`${ROOT}/`)) return full.slice(ROOT.length + 1);
            return full;
        }),
        onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
        getConfiguration: vi.fn(() => ({ get: (_key: string, fallback: unknown) => fallback })),
    };

    const Uri = {
        file: (path: string) => toUri(path),
        joinPath: (base: { fsPath?: string; path?: string }, ...parts: string[]) => {
            const basePath = normalize(base.fsPath ?? base.path ?? '');
            const joined = normalize([basePath, ...parts].join('/'));
            return toUri(joined);
        },
    };

    // Mirror VS Code's `FileType` enum so that
    // `ConfigurationRegistry.isValidPath` works in tests.
    const FileType = {
        Unknown: 0,
        File: 1,
        Directory: 2,
        SymbolicLink: 64,
    };

    return {
        Uri,
        RelativePattern,
        FileType,
        workspace,
    };
});

import * as vscode from 'vscode';
import { AdapterRegistry } from './AdapterRegistry.js';
import {
    ClaudeCodeAdapter,
    ConfigurationRegistry,
    CopilotAdapter,
    CursorAdapter,
    GeminiCliAdapter,
    HarnessSddAdapter,
    OpenCodeAdapter,
    WindsurfAdapter,
} from './index.js';
import { IAgentAdapter } from './IAgentAdapter.js';

const rootUri = () => vscode.Uri.file(ROOT);

// Reset the ConfigurationRegistry singleton between tests so
// the cache doesn't leak across test cases.
beforeEach(() => {
    ConfigurationRegistry.resetInstance();
});

describe('Adapter framework parsing', () => {
    beforeEach(() => {
        seedWorkspace({});
    });

    it('parses Harness SDD via HarnessSddAdapter and preserves framework metadata', async () => {
        seedWorkspace({
            '.agents/agentic.json': JSON.stringify({
                default_agent: 'harness',
                description: 'Main',
                subagents: [{ name: 'implementer', description: 'Does work', skills: ['linting'] }],
            }),
            '.agents/skills/linting/SKILL.md': `---\nname: linting\ndescription: lint tooling\n---\nLint skill body`,
            '.agents/subagents/implementer/SUBAGENT.md': `---\nname: implementer\ndescription: Does work\n---\n## Skills\n- linting`,
            'feature_list.json': JSON.stringify({ features: [] }),
            'progress/progress.md': '# Progress',
        });

        const adapter = new HarnessSddAdapter();
        expect(await adapter.detect(rootUri())).toBe(true);

        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];
        const edges = parsed.graph?.edges ?? [];

        expect(nodes.some((node) => node.id === 'harness' && node.metadata._framework === 'harness-sdd')).toBe(true);
        expect(nodes.some((node) => node.id === 'implementer')).toBe(true);
        expect(edges.some((edge) => edge.source === 'implementer' && edge.target === 'linting' && edge.label === 'uses')).toBe(true);
    });

    it('parses Claude Code agents and creates manages edges', async () => {
        seedWorkspace({
            'CLAUDE.md': '# Claude Workspace\nProject instructions',
            '.claude/agents/impl.md': `---\nname: implementer\ndescription: Implements tasks\ntools:\n  - edit\n---\nBody`,
        });

        const adapter = new ClaudeCodeAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];
        const edges = parsed.graph?.edges ?? [];

        expect(nodes.some((node) => node.id === 'claude-code::root' && node.type === 'agent')).toBe(true);
        expect(nodes.some((node) => node.id === 'claude-code::implementer' && node.type === 'subagent')).toBe(true);
        expect(edges.some((edge) => edge.source === 'claude-code::root' && edge.target === 'claude-code::implementer' && edge.label === 'manages')).toBe(true);
    });

    it('parses Gemini CLI root and TOML commands into skill nodes', async () => {
        seedWorkspace({
            'GEMINI.md': '# Gemini Root',
            '.gemini/commands/status.toml': 'name = "status"\ndescription = "Show status"',
        });

        const adapter = new GeminiCliAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];
        const edges = parsed.graph?.edges ?? [];

        expect(nodes.some((node) => node.id === 'gemini-cli::root' && node.type === 'agent')).toBe(true);
        expect(nodes.some((node) => node.id === 'gemini-cli::status' && node.type === 'skill')).toBe(true);
        expect(edges.some((edge) => edge.source === 'gemini-cli::root' && edge.target === 'gemini-cli::status' && edge.label === 'uses')).toBe(true);
    });

    it('classifies Cursor rules into agent/subagent based on alwaysApply and globs', async () => {
        seedWorkspace({
            '.cursor/rules/global.mdc': `---\nname: global\nalwaysApply: true\n---\nGlobal`,
            '.cursor/rules/typescript.mdc': `---\nname: ts\nglobs: "**/*.ts"\n---\nTS rule`,
        });

        const adapter = new CursorAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];

        expect(nodes.some((node) => node.id === 'cursor::global' && node.type === 'agent')).toBe(true);
        expect(nodes.some((node) => node.id === 'cursor::ts' && node.type === 'subagent')).toBe(true);
    });

    it('parses Copilot instructions and prompts', async () => {
        seedWorkspace({
            '.github/copilot-instructions.md': '# Copilot Root',
            '.github/instructions/code.instructions.md': `---\nname: codebase\napplyTo: "**/*.ts"\n---\nRule body`,
            '.vscode/prompts/refactor.prompt.md': `---\nname: refactor\ndescription: Refactor helper\n---\nPrompt`,
        });

        const adapter = new CopilotAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];

        expect(nodes.some((node) => node.id === 'copilot::root' && node.type === 'agent')).toBe(true);
        expect(nodes.some((node) => node.id === 'copilot::codebase' && node.type === 'subagent')).toBe(true);
        expect(nodes.some((node) => node.id === 'copilot::refactor' && node.type === 'skill')).toBe(true);
    });

    it('parses OpenCode and Windsurf adapters', async () => {
        seedWorkspace({
            'opencode.jsonc': `{
                // comment
                "name": "sample-project",
                "subagents": [{"name": "builder"}]
            }`,
            '.windsurf/rules/security.md': `---\nname: security\n---\nSecurity rule`,
        });

        const opencode = new OpenCodeAdapter();
        const windsurf = new WindsurfAdapter();

        const opencodeParsed = await opencode.parse(rootUri());
        const windsurfParsed = await windsurf.parse(rootUri());

        expect(opencodeParsed.graph?.nodes.some((node) => node.id === 'opencode::builder')).toBe(true);
        expect(windsurfParsed.graph?.nodes.some((node) => node.id === 'windsurf::security')).toBe(true);
    });
});

describe('AdapterRegistry behavior', () => {
    it('deduplicates node ids on merge with first adapter winning', async () => {
        const first: IAgentAdapter = {
            id: () => 'first',
            label: () => 'First',
            detect: async () => true,
            parse: async () => ({
                graph: {
                    nodes: [{ id: 'agent', type: 'agent', label: 'First Agent', metadata: {} }],
                    edges: [],
                },
                milestones: [],
                errors: [],
            }),
            watchGlobs: () => [],
            isPathConfigurable: () => false,
            setHarnessConfig: () => { /* no-op for the test stub */ },
        };
        const second: IAgentAdapter = {
            id: () => 'second',
            label: () => 'Second',
            detect: async () => true,
            parse: async () => ({
                graph: {
                    nodes: [{ id: 'agent', type: 'agent', label: 'Second Agent', metadata: {} }],
                    edges: [],
                },
                milestones: [],
                errors: [],
            }),
            watchGlobs: () => [],
            isPathConfigurable: () => false,
            setHarnessConfig: () => { /* no-op for the test stub */ },
        };

        const registry = new AdapterRegistry([first, second]);
        const parsed = await registry.parse(rootUri());

        expect(parsed.graph.nodes).toHaveLength(1);
        expect(parsed.graph.nodes[0].label).toBe('First Agent');
        expect(parsed.detectedFrameworks).toEqual(['First', 'Second']);
    });

    it('continues parsing when one adapter throws and excludes failing adapter from detected frameworks', async () => {
        const warn = vi.fn();
        const failing: IAgentAdapter = {
            id: () => 'broken',
            label: () => 'Broken',
            detect: async () => true,
            parse: async () => {
                throw new Error('boom');
            },
            watchGlobs: () => ['broken.json'],
            isPathConfigurable: () => false,
            setHarnessConfig: () => { /* no-op for the test stub */ },
        };
        const healthy: IAgentAdapter = {
            id: () => 'ok',
            label: () => 'Healthy',
            detect: async () => true,
            parse: async () => ({
                graph: {
                    nodes: [{ id: 'ok::root', type: 'agent', label: 'Healthy', metadata: {} }],
                    edges: [],
                },
                milestones: [],
                errors: [],
            }),
            watchGlobs: () => ['ok.json'],
            isPathConfigurable: () => false,
            setHarnessConfig: () => { /* no-op for the test stub */ },
        };

        const registry = new AdapterRegistry([failing, healthy], { warn });
        const parsed = await registry.parse(rootUri());

        expect(warn).toHaveBeenCalled();
        expect(parsed.graph.nodes.some((node) => node.id === 'ok::root')).toBe(true);
        expect(parsed.detectedFrameworks).toEqual(['Healthy']);
    });
});

describe('FEAT-026 — R18 / R19 — non-configurable adapters skip discovery', () => {
    it('(R18) HarnessSddAdapter is unaffected by .harness-dashboard/config.json (no hook/steering nodes from discovery)', async () => {
        // Seed BOTH a full Harness-SDD agentic.json AND a malicious
        // local config that would try to enable discovery. The SDD
        // adapter must continue to behave exactly as in FEAT-024 —
        // it does not consult the local config file, it does not
        // scan .harness/hooks/ or .harness/steering/, and it does
        // not create hook/steering nodes.
        seedWorkspace({
            '.agents/agentic.json': JSON.stringify({
                default_agent: 'harness',
                description: 'Main',
                subagents: [{ name: 'implementer', description: 'Does work', skills: ['linting'] }],
                steering: [{ name: 'kiss', file: '.agents/steering/kiss.md', applies_to: ['implementer'] }],
                hooks: [{ event: 'on_spec_created', script: 'hooks/on-spec-created_validate.sh' }],
            }),
            '.agents/steering/kiss.md': '# KISS\nKeep it simple',
            'hooks/on-spec-created_validate.sh': '#!/bin/bash\necho ok',
            '.agents/skills/linting/SKILL.md': `---\nname: linting\ndescription: lint tooling\n---`,
            '.agents/subagents/implementer/SUBAGENT.md': `---\nname: implementer\n---`,
            // The local config (must be ignored by HarnessSddAdapter)
            '.harness-dashboard/config.json': JSON.stringify({
                adapters: { 'harness-sdd': { hooksPath: 'malicious-hooks' } },
                extraPaths: { 'harness-sdd': { hooks: ['evil/hooks'], steering: ['evil/steering'] } },
            }),
            'malicious-hooks/should-not-appear.sh': '#!/bin/bash\necho malicious',
            'evil/hooks/should-not-appear.sh': '#!/bin/bash\necho evil',
        });
        const adapter = new HarnessSddAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];
        // No nodes from the malicious paths
        const eventNames = nodes.filter((n) => n.type === 'hook').map((n) => n.metadata.event);
        expect(eventNames).toEqual(['on_spec_created']); // only the FEAT-024 entry
        const steeringNames = nodes.filter((n) => n.type === 'steering').map((n) => n.metadata.name);
        expect(steeringNames).toEqual(['kiss']); // only the FEAT-024 entry
    });

    it('(R19) OpenCodeAdapter is unaffected by .harness-dashboard/config.json (no discovery at all)', async () => {
        seedWorkspace({
            'opencode.jsonc': JSON.stringify({ name: 'sample', subagents: [{ name: 'builder' }] }),
            // The local config (must be ignored by OpenCodeAdapter)
            '.harness-dashboard/config.json': JSON.stringify({
                adapters: { 'opencode': { hooksPath: 'malicious-hooks' } },
                extraPaths: { 'opencode': { hooks: ['evil/hooks'], steering: ['evil/steering'] } },
            }),
            'malicious-hooks/should-not-appear.sh': '#!/bin/bash\necho malicious',
            'evil/hooks/should-not-appear.sh': '#!/bin/bash\necho evil',
        });
        const adapter = new OpenCodeAdapter();
        const parsed = await adapter.parse(rootUri());
        const nodes = parsed.graph?.nodes ?? [];
        // No hook/steering nodes from the malicious paths
        expect(nodes.some((n) => n.type === 'hook')).toBe(false);
        expect(nodes.some((n) => n.type === 'steering')).toBe(false);
        // Existing FEAT-015 behaviour is preserved
        expect(nodes.some((n) => n.id === 'opencode::builder' && n.type === 'subagent')).toBe(true);
    });
});
