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

/**
 * Treat the path as a directory iff it has at least one child
 * in the mockFiles map OR is an ancestor of a file in the map.
 * Otherwise it's a file. Returns `FileType.Directory` (2) or
 * `FileType.File` (1) to match VS Code's `FileType` enum used
 * by `ConfigurationRegistry.isValidPath`.
 */
function statType(uri: { fsPath?: string; path?: string }): number {
    const key = normalize(uri.fsPath ?? uri.path ?? '');
    if (mockFiles.has(key)) {
        for (const filePath of mockFiles.keys()) {
            if (filePath !== key && filePath.startsWith(`${key}/`)) {
                return 2; // exact match with children → directory
            }
        }
        return 1; // exact match, no children → file
    }
    for (const filePath of mockFiles.keys()) {
        if (filePath.startsWith(`${key}/`)) {
            return 2; // ancestor of some file → directory
        }
    }
    throw new Error(`ENOENT: ${key}`);
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

    // Mirror VS Code's `FileType` enum so that
    // `ConfigurationRegistry.isValidPath` (which checks
    // `stat.type === vscode.FileType.Directory`) works in tests.
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
import { ConfigurationRegistry } from './ConfigurationRegistry.js';
import { KiroAdapter } from './KiroAdapter.js';

const rootUri = () => vscode.Uri.file(ROOT);

describe('KiroAdapter (R15)', () => {
    beforeEach(() => {
        seedWorkspace({});
        configurationStore.clear();
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
        configurationStore.set('adapters.kiro.path', '.custom-kiro');
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
        configurationStore.set('adapters.kiro.path', '.custom-kiro');
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
