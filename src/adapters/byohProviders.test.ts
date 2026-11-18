// FEAT-041 T2 — profile v1 and companion registration contracts (R1, R5, R6, R7).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = '/workspace';
const files = new Map<string, string>();
const sizes = new Map<string, number>();
const links = new Map<string, string>();

const normalize = (input: string) => input.replace(/\\/g, '/').replace(/\/+/g, '/');
const toUri = (path: string) => {
    const normalized = normalize(path);
    return { fsPath: normalized, path: normalized, scheme: 'file', toString: () => 'file://' + normalized };
};
const globToRegExp = (glob: string) => new RegExp('^' + glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?') + '$');

vi.mock('vscode', () => {
    class RelativePattern {
        constructor(public readonly baseUri: { path: string }, public readonly pattern: string) {}
    }
    const key = (uri: { path?: string; fsPath?: string }) => normalize(uri.path ?? uri.fsPath ?? '');
    return {
        RelativePattern,
        FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
        Uri: {
            file: (p: string) => toUri(p),
            joinPath: (base: { path: string }, ...parts: string[]) => toUri([base.path, ...parts].join('/')),
        },
        workspace: {
            fs: {
                stat: vi.fn(async (uri: { path: string }) => {
                    if (!files.has(key(uri))) throw new Error('ENOENT');
                    return { type: 1, size: sizes.get(key(uri)) ?? files.get(key(uri))!.length };
                }),
                readFile: vi.fn(async (uri: { path: string }) => {
                    const value = files.get(key(uri));
                    if (value === undefined) throw new Error('ENOENT');
                    return Buffer.from(value, 'utf8');
                }),
            },
            findFiles: vi.fn(async (pattern: RelativePattern) => {
                const base = normalize(pattern.baseUri.path);
                const re = globToRegExp(pattern.pattern);
                return [...files.keys()]
                    .filter(p => p.startsWith(base + '/') && re.test(p.slice(base.length + 1)))
                    .map(toUri);
            }),
            asRelativePath: vi.fn((uri: { path: string }) => key(uri).slice(ROOT.length + 1)),
            getConfiguration: vi.fn(() => ({ get: (_k: string, fallback: unknown) => fallback })),
            onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
        },
    };
});

import * as vscode from 'vscode';
import { AdapterRegistry } from './AdapterRegistry.js';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js';
import type { IAgentAdapter } from './IAgentAdapter.js';
import { createCompanionApi, type CompanionAdapterV1 } from './companionApi.js';
import { DISCOVERY_ONLY } from './capabilities.js';
import { isContainedPattern, validateProfiles } from './profileV1.js';
import { MAX_PROFILE_FILE_BYTES } from './ProfileAdapter.js';

const root = vscode.Uri.file(ROOT);
const realPath = async (uri: vscode.Uri) => links.get(uri.path) ?? uri.path;

function seed(entries: Record<string, string>): void {
    files.clear(); sizes.clear(); links.clear();
    for (const [p, c] of Object.entries(entries)) files.set(normalize(`${ROOT}/${p}`), c);
}

const teamProfile = (overrides: Record<string, unknown> = {}) => ({
    version: 1, id: 'team-guides', label: 'Team guides',
    markers: ['team/agents/index.md'],
    entities: [
        { glob: 'team/agents/*.md', type: 'agent', idField: 'id', labelField: 'title' },
        { glob: 'team/skills/*.md', type: 'skill', idField: 'id', labelField: 'title' },
    ],
    relationships: [{ fromType: 'agent', field: 'skills', toType: 'skill', label: 'uses' }],
    ...overrides,
});

const TEAM_FILES = {
    'team/agents/index.md': '# Team agents',
    'team/agents/reviewer.md': '---\nid: reviewer\ntitle: Reviewer\nskills: [lint]\n---\nReview changes.',
    'team/skills/lint.md': '---\nid: lint\ntitle: Lint\ndescription: Use when code changes.\n---\nRun the linter.',
};

function companion(overrides: Partial<CompanionAdapterV1> = {}): CompanionAdapterV1 {
    return {
        id: 'acme', label: 'ACME', capabilities: { ...DISCOVERY_ONLY },
        detect: () => true,
        parse: () => ({ graph: { nodes: [{ id: 'acme::bot', type: 'agent', label: 'Bot', metadata: {} }], edges: [] } }),
        watchGlobs: () => ['acme/**'],
        ...overrides,
    };
}

describe('profile v1 validation (R7)', () => {
    it('skips unknown versions, reserved and duplicate IDs, escaping paths — keeps the rest', () => {
        const { profiles, diagnostics } = validateProfiles([
            teamProfile({ version: 2 }),
            teamProfile({ id: 'claude-code' }),
            teamProfile(),
            teamProfile(),
            teamProfile({ id: 'escape', markers: ['/etc/passwd'] }),
            teamProfile({ id: 'dotdot', entities: [{ glob: '../other/*.md', type: 'agent' }] }),
        ], new Set(['claude-code']));
        expect(profiles.map(p => p.id)).toEqual(['team-guides']);
        expect(diagnostics.map(d => d.message)).toEqual([
            expect.stringContaining('unknown schema version 2'),
            expect.stringContaining('"claude-code" collides'),
            expect.stringContaining('"team-guides" collides'),
            expect.stringContaining('escapes the workspace root'),
            expect.stringContaining('escapes the workspace root'),
            expect.stringContaining('no valid entity'),
        ]);
        expect(diagnostics.every(d => d.file === '.harness-dashboard/config.json')).toBe(true);
    });

    it('rejects absolute, home, drive, scheme and parent patterns', () => {
        for (const bad of ['/a.md', '~/a.md', 'C:/a.md', 'file:///a.md', 'a/../../b.md', '']) {
            expect(isContainedPattern(bad)).toBe(false);
        }
        expect(isContainedPattern('team/**/*.md')).toBe(true);
    });

    it('treats a missing profiles key as no profiles and a non-array as one diagnostic', () => {
        expect(validateProfiles(undefined, new Set())).toEqual({ profiles: [], diagnostics: [] });
        expect(validateProfiles({}, new Set()).diagnostics).toHaveLength(1);
    });
});

describe('profile discovery (R1, R5)', () => {
    beforeEach(() => seed(TEAM_FILES));

    it('discovers declared entities and relationships with source identity', async () => {
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        const result = await registry.parse(root);
        expect(result.graph.nodes.map(n => [n.id, n.type, n.label])).toEqual([
            ['team-guides::index', 'agent', 'index'],
            ['team-guides::reviewer', 'agent', 'Reviewer'],
            ['team-guides::lint', 'skill', 'Lint'],
        ]);
        expect(result.graph.nodes[1].source).toEqual({
            workspaceUri: 'file:///workspace', providerId: 'team-guides', nativeId: 'reviewer',
            sourceUri: 'file:///workspace/team/agents/reviewer.md',
        });
        expect(result.graph.nodes[1].metadata._filePath).toBe('team/agents/reviewer.md');
        expect(result.graph.edges).toEqual([expect.objectContaining({ source: 'team-guides::reviewer', target: 'team-guides::lint', label: 'uses' })]);
        expect(result.detectedFrameworks).toEqual(['Team guides']);
        expect(result.errors).toEqual([]);
    });

    it('is not detected without a marker and reads nothing', async () => {
        files.delete(normalize(`${ROOT}/team/agents/index.md`));
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        expect((await registry.parse(root)).graph.nodes).toEqual([]);
    });

    it('reports unresolved references and duplicate native IDs, keeping valid entities', async () => {
        files.set(normalize(`${ROOT}/team/agents/writer.md`), '---\nid: reviewer\n---\nDuplicate.');
        files.set(normalize(`${ROOT}/team/agents/zed.md`), '---\nid: zed\nskills: [missing]\n---\n');
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        const result = await registry.parse(root);
        expect(result.graph.nodes.map(n => n.id)).toContain('team-guides::zed');
        expect(result.graph.nodes.filter(n => n.id === 'team-guides::reviewer')).toHaveLength(1);
        const messages = result.errors.map(e => e.message);
        expect(messages).toContainEqual(expect.stringContaining('duplicate native ID "reviewer"'));
        expect(messages).toContainEqual(expect.stringContaining('unresolved skill reference "missing"'));
        expect(result.errors.find(e => e.message.includes('missing'))?.file).toBe('file:///workspace/team/agents/zed.md');
        expect(result.graph.edges).toHaveLength(1);
    });

    it('skips a file whose symlink target escapes the root', async () => {
        files.set(normalize(`${ROOT}/team/skills/secret.md`), '---\nid: secret\n---\n');
        links.set(`${ROOT}/team/skills/secret.md`, '/etc/secret.md');
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        const result = await registry.parse(root);
        expect(result.graph.nodes.map(n => n.id)).not.toContain('team-guides::secret');
        expect(result.errors).toContainEqual(expect.objectContaining({
            file: 'file:///workspace/team/skills/secret.md',
            message: expect.stringContaining('outside the workspace root'),
        }));
    });

    it('skips oversized files without reading them', async () => {
        sizes.set(normalize(`${ROOT}/team/skills/lint.md`), MAX_PROFILE_FILE_BYTES + 1);
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        const result = await registry.parse(root);
        expect(result.graph.nodes.map(n => n.id)).not.toContain('team-guides::lint');
        expect(result.errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining('larger than') }));
    });

    it('stops reading when the scan is cancelled', async () => {
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        const result = await registry.parse(root, { isCancellationRequested: true } as vscode.CancellationToken);
        expect(result.graph.nodes).toEqual([]);
    });

    it('names SKILL.md-style entities after their folder unless an idField says otherwise', async () => {
        seed({ 'kit/marker.md': '#', 'kit/skills/lint/SKILL.md': '---\ntitle: Lint\n---\n', 'kit/skills/format/SKILL.md': '---\ntitle: Format\n---\n' });
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([{ version: 1, id: 'kit', markers: ['kit/marker.md'], entities: [{ glob: 'kit/skills/*/SKILL.md', type: 'skill' }] }]);
        const result = await registry.parse(root);
        expect(result.graph.nodes.map(n => n.id).sort()).toEqual(['kit::format', 'kit::lint']);
        expect(result.errors).toEqual([]);
    });

    it('reports detected providers even when they own no node', async () => {
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([{ ...teamProfile(), entities: [{ glob: 'nothing/*.md', type: 'agent' }] }]);
        const result = await registry.parse(root);
        expect(result.graph.nodes).toEqual([]);
        expect(result.detectedProviders).toEqual(['team-guides']);
    });

    it('exposes profile watch globs and discovery-only capabilities', () => {
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        expect(registry.watchGlobs()).toEqual(['team/agents/index.md', 'team/agents/*.md', 'team/skills/*.md']);
        expect(registry.getAdapters()[0].capabilities?.()).toEqual(DISCOVERY_ONLY);
    });
});

describe('companion registration (R6, R7)', () => {
    beforeEach(() => seed({ 'CLAUDE.md': '# Team', ...TEAM_FILES }));

    it('adds and removes a provider, notifying listeners each time', async () => {
        const registry = new AdapterRegistry([new ClaudeCodeAdapter()], undefined, realPath);
        const api = createCompanionApi(registry);
        const changes = vi.fn();
        registry.onDidChange(changes);

        const registration = api.registerAdapter(companion());
        expect((await registry.parse(root)).graph.nodes.map(n => n.id)).toContain('acme::bot');
        expect(registry.watchGlobs()).toContain('acme/**');

        registration.dispose();
        registration.dispose();
        const after = await registry.parse(root);
        expect(after.graph.nodes.map(n => n.id)).not.toContain('acme::bot');
        expect(after.graph.nodes.map(n => n.id)).toContain('claude-code::root');
        expect(registry.watchGlobs()).not.toContain('acme/**');
        expect(changes).toHaveBeenCalledTimes(2);
    });

    it('does not call or keep a provider disposed while a scan is in flight', async () => {
        const registry = new AdapterRegistry([], undefined, realPath);
        const api = createCompanionApi(registry);
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const second = vi.fn(() => ({ graph: { nodes: [{ id: 'later::x', type: 'agent', label: 'X', metadata: {} }], edges: [] } }));
        api.registerAdapter(companion({ id: 'slow', detect: async () => { await gate; return true; } }));
        const later = api.registerAdapter(companion({ id: 'later', parse: second }));
        const scan = registry.parse(root);
        later.dispose();
        release();
        const result = await scan;
        expect(second).not.toHaveBeenCalled();
        expect(result.graph.nodes.map(n => n.id)).toEqual(['acme::bot']);
    });

    it('rejects ID collisions with built-in and registered providers', () => {
        const registry = new AdapterRegistry([new ClaudeCodeAdapter()], undefined, realPath);
        const api = createCompanionApi(registry);
        expect(() => api.registerAdapter(companion({ id: 'claude-code' }))).toThrow(/already registered/);
        api.registerAdapter(companion());
        expect(() => api.registerAdapter(companion())).toThrow(/already registered/);
    });

    it('displaces a workspace profile with the same ID and restores it on disposal', async () => {
        const registry = new AdapterRegistry([], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        const registration = createCompanionApi(registry).registerAdapter(companion({ id: 'team-guides' }));
        const during = await registry.parse(root);
        expect(during.errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining('"team-guides" collides') }));
        expect(during.graph.nodes.map(n => n.id)).toEqual(['acme::bot']);
        registration.dispose();
        expect((await registry.parse(root)).graph.nodes.map(n => n.id)).toContain('team-guides::reviewer');
    });

    it('validates the provider contract before registering', () => {
        const api = createCompanionApi(new AdapterRegistry([]));
        expect(() => api.registerAdapter(companion({ id: 'Bad ID' }))).toThrow(/id must match/);
        expect(() => api.registerAdapter(companion({ capabilities: { discovery: 'supported' } as never }))).toThrow(/seven capability levels/);
        expect(() => api.registerAdapter({ ...companion(), parse: undefined } as never)).toThrow(/parse\(\)/);
        expect(api.apiVersion).toBe(1);
    });

    it('keeps version 1 companions read-only and reports operations through the registry (T3)', () => {
        const registry = new AdapterRegistry([new ClaudeCodeAdapter()], undefined, realPath);
        registry.setProfiles([teamProfile()]);
        const api = createCompanionApi(registry);
        // A companion may not gain a write or run operation through the v1 contract.
        expect(() => api.registerAdapter(companion({ operations: ['editing.deleteEntity'] as never }))).toThrow(/read-only/);
        expect(() => api.registerAdapter(companion({ operations: 'all' as never }))).toThrow(/read-only/);
        api.registerAdapter(companion({ capabilities: { ...DISCOVERY_ONLY, editing: 'supported' }, operations: [] }));
        expect([...registry.providerOperations('acme')]).toEqual([]);
        expect(registry.providerCapabilities('acme').editing).toBe('supported');
        expect([...registry.providerOperations('claude-code')]).toEqual(['editing.reviewedTextEdit', 'agentRuns.launch']);
        expect([...registry.providerOperations('team-guides')]).toEqual([]);
        expect(registry.providerCapabilities('team-guides')).toEqual(DISCOVERY_ONLY);
        expect([...registry.providerOperations('not-registered')]).toEqual([]);
        expect(registry.providerLabel('team-guides')).toBe('Team guides');
    });

    it('accepts registration without a workspace as a no-op', () => {
        expect(() => createCompanionApi(undefined).registerAdapter(companion()).dispose()).not.toThrow();
    });

    it('isolates a failing provider and keeps the others usable', async () => {
        const throwing: IAgentAdapter = {
            id: () => 'broken', label: () => 'Broken', isPathConfigurable: () => false, setHarnessConfig: () => {},
            watchGlobs: () => { throw new Error('boom'); },
            detect: async () => { throw new Error('boom'); },
            parse: async () => ({}),
        };
        const registry = new AdapterRegistry([new ClaudeCodeAdapter()], { warn: vi.fn() }, realPath);
        registry.register(throwing);
        const api = createCompanionApi(registry);
        api.registerAdapter(companion({ id: 'crash', parse: () => { throw new Error('parse exploded'); } }));
        api.registerAdapter(companion({
            parse: () => ({ graph: { nodes: [{ id: 'acme::ok', type: 'agent', label: 'Ok', metadata: { _framework: 'claude-code' } }, { id: 7 } as never], edges: [{ id: 'e', source: 'acme::ok', target: 'nowhere' }] } }),
        }));
        expect(registry.watchGlobs()).toContain('acme/**');
        const result = await registry.parse(root);
        expect(result.graph.nodes.map(n => n.id)).toEqual(['claude-code::root', 'acme::ok']);
        expect(result.graph.nodes[1].metadata._framework).toBe('acme');
        expect(result.graph.edges.filter(e => e.source === 'acme::ok')).toEqual([]);
        expect(result.errors.map(e => e.message)).toEqual(expect.arrayContaining([
            expect.stringContaining('[crash] parse failed: parse exploded'),
            expect.stringContaining('[acme] dropped a malformed node'),
            expect.stringContaining('[acme] dropped an edge'),
        ]));
    });
});
