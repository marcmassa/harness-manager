// ============================================================================
// hooksAndSteering.test.ts — FEAT-026 T10, T11
//
// Unit tests for `discover()`. Validates R5–R17:
//   - R5:  default scan under <adapter-path>/{hooks,steering}/
//   - R6:  per-adapter overrides via local config
//   - R7:  per-adapter extra paths via local config
//   - R8:  project-root discovery (toggleable)
//   - R9:  per-adapter kill switch
//   - R10: global kill switch for project-root
//   - R11: filename-based event inference for hooks
//   - R12: H1-based description fallback for steering
//   - R13: deduplication when a file appears in two glob sources
//   - R14: hook → root agent edge
//   - R15: steering → subagent edge(s) with applies_to inference
//   - R16: _filePath metadata for the Edit button
//   - R17: resolved globs returned for watchGlobs wiring
// ============================================================================

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
    // Expand brace lists to sentinels, then escape everything else,
    // then replace the sentinels with regex alternations. This way
    // brace groups become real alternations and other characters
    // are still safely escaped.
    const expanded = expandBraces(glob);
    const pattern = '^' + expanded
        // escape regex specials first
        .replace(/[.+^$()|[\]\\]/g, '\\$&')
        // restore the sentinels as real regex alternations
        .replace(/@@OPEN@@/g, '(')
        .replace(/@@PIPE@@/g, '|')
        .replace(/@@CLOSE@@/g, ')')
        .replace(/@@STAR@@/g, '[^/]*')
        .replace(/@@DSTAR_SLASH@@/g, '(?:.*/)?')
        .replace(/@@DSTAR@@/g, '.*')
        .replace(/@@QMARK@@/g, '.')
        + '$';
    return new RegExp(pattern);
}

function expandBraces(glob: string): string {
    // First, expand `**/`, `**`, `*`, `?` to sentinels so they aren't
    // touched by brace expansion. Then expand `{a,b,c}` to sentinels.
    let result = '';
    for (let i = 0; i < glob.length; i += 1) {
        const current = glob[i];
        const next = glob[i + 1];
        const nextAfter = glob[i + 2];
        if (current === '*' && next === '*') {
            if (nextAfter === '/') {
                result += '@@DSTAR_SLASH@@';
                i += 2;
                continue;
            }
            result += '@@DSTAR@@';
            i += 1;
            continue;
        }
        if (current === '*') {
            result += '@@STAR@@';
            continue;
        }
        if (current === '?') {
            result += '@@QMARK@@';
            continue;
        }
        result += current;
    }
    // Recursively expand brace groups.
    const match = result.match(/\{([^{}]+)\}/);
    if (!match) return result;
    const [whole, body] = match;
    const alternatives = body.split(',');
    return expandBraces(result.replace(whole, '@@OPEN@@' + alternatives.join('@@PIPE@@') + '@@CLOSE@@'));
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

    return {
        Uri,
        RelativePattern,
        workspace,
    };
});

import * as vscode from 'vscode';
import { discover } from './hooksAndSteering.js';
import { ConfigurationRegistry } from '../adapters/ConfigurationRegistry.js';
import type { HarnessDashboardConfig } from '../config/harnessConfig.js';

const rootUri = () => vscode.Uri.file(ROOT);
const ADAPTER_ID = 'kiro';
const ROOT_AGENT_ID = `${ADAPTER_ID}::root`;

function emptyConfig(): HarnessDashboardConfig {
    return {};
}

beforeEach(() => {
    seedWorkspace({});
    configurationStore.clear();
    ConfigurationRegistry.resetInstance();
    // Eagerly resolve the registry so the default '.kiro' path is cached.
    ConfigurationRegistry.getInstance();
});

describe('FEAT-026 — discover() — R5/R11/R12/R14/R15/R16', () => {
    it('(R5, R11, R14) creates a hook node per file in <adapter-path>/hooks/ and links it to the root agent', async () => {
        seedWorkspace({
            '.kiro/agents/typescript-implementer.md': '---\nname: typescript-implementer\n---',
            '.kiro/hooks/on-spec-created_validate.sh': '#!/bin/bash\necho "validating spec"',
            '.kiro/hooks/on-feature-done_notify.sh': '#!/bin/bash\necho "notifying"',
        });
        const subagentIds = ['kiro::typescript-implementer'];
        const result = await discover(ADAPTER_ID, rootUri(), emptyConfig(), true, true, ROOT_AGENT_ID, subagentIds);

        // R5: two hook files discovered
        expect(result.nodes.filter((n) => n.type === 'hook')).toHaveLength(2);
        // R11: events derived from filenames (hyphens → underscores)
        const onSpec = result.nodes.find((n) => n.metadata.event === 'on_spec_created_validate');
        const onFeature = result.nodes.find((n) => n.metadata.event === 'on_feature_done_notify');
        expect(onSpec).toBeDefined();
        expect(onFeature).toBeDefined();
        // R14: triggers edge to the root agent
        const triggersEdges = result.edges.filter((e) => e.label === 'triggers');
        expect(triggersEdges).toHaveLength(2);
        expect(triggersEdges.every((e) => e.target === ROOT_AGENT_ID)).toBe(true);
        // R16: _filePath is set so the Edit button works
        expect(onSpec?.metadata._filePath).toBe('.kiro/hooks/on-spec-created_validate.sh');
        // Content preview
        expect(onSpec?.metadata._preview).toContain('echo "validating spec"');
    });

    it('(R5, R12, R15) creates a steering node per file and links it via governs to all subagents (wildcard)', async () => {
        seedWorkspace({
            '.kiro/steering/kiss-principle.md': '# KISS Principle\nKeep it simple',
            '.kiro/steering/dry-principle.md': '# DRY Principle\nDo not repeat',
            '.kiro/agents/typescript-implementer.md': '---\nname: typescript-implementer\n---',
        });
        const subagentIds = ['kiro::typescript-implementer', 'kiro::another'];
        const result = await discover(ADAPTER_ID, rootUri(), emptyConfig(), true, true, ROOT_AGENT_ID, subagentIds);

        // R5: two steering files discovered
        const steering = result.nodes.filter((n) => n.type === 'steering');
        expect(steering).toHaveLength(2);
        // R12: description from H1 (no frontmatter in our seed)
        const kiss = steering.find((n) => n.metadata.name === 'kiss-principle');
        expect(kiss?.metadata.description).toBe('KISS Principle');
        // R15: wildcard → governs edges to every subagent
        const governsEdges = result.edges.filter((e) => e.label === 'governs');
        expect(governsEdges).toHaveLength(2 * subagentIds.length);
        // R16: _filePath
        expect(kiss?.metadata._filePath).toBe('.kiro/steering/kiss-principle.md');
        // Body is stored
        expect(kiss?.metadata._body).toContain('Keep it simple');
    });

    it('(R15) filename matches a subagent id → applies_to = [that id] (no wildcard)', async () => {
        seedWorkspace({
            '.kiro/steering/typescript-implementer.md': '# TS Implementer\nSome guidance',
            '.kiro/agents/typescript-implementer.md': '---\nname: typescript-implementer\n---',
        });
        const subagentIds = ['kiro::typescript-implementer', 'kiro::other'];
        const result = await discover(ADAPTER_ID, rootUri(), emptyConfig(), true, true, ROOT_AGENT_ID, subagentIds);

        const steering = result.nodes.find((n) => n.id === `steering-${ADAPTER_ID}-typescript-implementer`);
        expect(steering?.metadata.applies_to).toEqual(['kiro::typescript-implementer']);

        const governsEdges = result.edges.filter((e) => e.label === 'governs');
        expect(governsEdges).toHaveLength(1);
        expect(governsEdges[0].target).toBe('kiro::typescript-implementer');
    });

    it('(R11) frontmatter `event` overrides the filename inference', async () => {
        seedWorkspace({
            '.kiro/hooks/some-script.sh': '---\nevent: custom_event_name\n---\n#!/bin/bash\n',
        });
        const result = await discover(ADAPTER_ID, rootUri(), emptyConfig(), true, true, ROOT_AGENT_ID, []);
        const hook = result.nodes.find((n) => n.type === 'hook');
        expect(hook?.metadata.event).toBe('custom_event_name');
    });

    it('(R12) frontmatter `description` overrides the H1 fallback', async () => {
        seedWorkspace({
            '.kiro/steering/principles.md': '---\ndescription: Custom description here\n---\n# Some H1\n',
        });
        const result = await discover(ADAPTER_ID, rootUri(), emptyConfig(), true, true, ROOT_AGENT_ID, []);
        const steering = result.nodes.find((n) => n.type === 'steering');
        expect(steering?.metadata.description).toBe('Custom description here');
    });
});

describe('FEAT-026 — discover() — R6/R7/R8/R9/R10/R13', () => {
    it('(R6) per-adapter override replaces the default hooks path', async () => {
        seedWorkspace({
            '.kiro/hooks/default.sh': '#!/bin/bash\n',
            'custom-hooks/override.sh': '#!/bin/bash\n',
        });
        const config: HarnessDashboardConfig = {
            adapters: { kiro: { hooksPath: 'custom-hooks' } },
        };
        const result = await discover(ADAPTER_ID, rootUri(), config, true, false, ROOT_AGENT_ID, []);
        // Only the override is scanned; the default .kiro/hooks is NOT
        const events = result.nodes.filter((n) => n.type === 'hook').map((n) => n.metadata.event);
        expect(events).toEqual(['override']);
    });

    it('(R6) per-adapter override replaces the default steering path', async () => {
        seedWorkspace({
            '.kiro/steering/default.md': '# Default',
            'custom-steering/override.md': '# Override',
        });
        const config: HarnessDashboardConfig = {
            adapters: { kiro: { steeringPath: 'custom-steering' } },
        };
        const result = await discover(ADAPTER_ID, rootUri(), config, true, false, ROOT_AGENT_ID, []);
        const names = result.nodes.filter((n) => n.type === 'steering').map((n) => n.metadata.name);
        expect(names).toEqual(['override']);
    });

    it('(R7) extra paths are scanned in addition to the default', async () => {
        seedWorkspace({
            '.kiro/hooks/default.sh': '#!/bin/bash\n',
            'extra-hooks/extra.sh': '#!/bin/bash\n',
        });
        const config: HarnessDashboardConfig = {
            extraPaths: { kiro: { hooks: ['extra-hooks'] } },
        };
        const result = await discover(ADAPTER_ID, rootUri(), config, true, false, ROOT_AGENT_ID, []);
        const events = result.nodes.filter((n) => n.type === 'hook').map((n) => n.metadata.event);
        expect(events.sort()).toEqual(['default', 'extra']);
    });

    it('(R8) project-root scan is enabled by default', async () => {
        seedWorkspace({
            'hooks/root-hook.sh': '#!/bin/bash\n',
            'steering/root-steering.md': '# Root Steering',
        });
        const result = await discover(ADAPTER_ID, rootUri(), emptyConfig(), true, true, ROOT_AGENT_ID, []);
        expect(result.nodes.some((n) => n.metadata.event === 'root_hook')).toBe(true);
        expect(result.nodes.some((n) => n.metadata.name === 'root-steering')).toBe(true);
    });

    it('(R10) project-root scan can be disabled via the rootDiscoveryEnabled flag', async () => {
        seedWorkspace({
            'hooks/root-hook.sh': '#!/bin/bash\n',
            'steering/root-steering.md': '# Root Steering',
            '.kiro/hooks/framework-hook.sh': '#!/bin/bash\n',
        });
        const result = await discover(ADAPTER_ID, rootUri(), emptyConfig(), true, false, ROOT_AGENT_ID, []);
        // Framework hook still discovered
        expect(result.nodes.some((n) => n.metadata.event === 'framework_hook')).toBe(true);
        // Project-root hook NOT discovered
        expect(result.nodes.some((n) => n.metadata.event === 'root_hook')).toBe(false);
        expect(result.nodes.some((n) => n.metadata.name === 'root-steering')).toBe(false);
    });

    it('(R9) per-adapter kill switch skips discovery entirely', async () => {
        seedWorkspace({
            '.kiro/hooks/on-spec.sh': '#!/bin/bash\n',
            '.kiro/steering/principles.md': '# Principles',
        });
        const result = await discover(ADAPTER_ID, rootUri(), emptyConfig(), false, true, ROOT_AGENT_ID, []);
        expect(result.nodes.filter((n) => n.type === 'hook' || n.type === 'steering')).toHaveLength(0);
        expect(result.edges).toHaveLength(0);
        expect(result.resolvedGlobs).toEqual({ hooks: [], steering: [] });
    });

    it('(R13) a file present in two sources is created only once (framework wins)', async () => {
        // Only one physical file, but the local config lists the
        // framework's hooks dir AGAIN as an extra path. The same
        // absolute path is therefore returned by findFiles twice.
        seedWorkspace({
            '.kiro/hooks/shared.sh': '#!/bin/bash\n',
        });
        const config: HarnessDashboardConfig = {
            extraPaths: { kiro: { hooks: ['.kiro/hooks'] } },
        };
        const result = await discover(ADAPTER_ID, rootUri(), config, true, true, ROOT_AGENT_ID, []);
        // Only one node is created (the duplicate is dropped by the `seen` set)
        const sharedHooks = result.nodes.filter((n) => n.type === 'hook' && n.metadata.event === 'shared');
        expect(sharedHooks).toHaveLength(1);
        // The triggers edge is also created only once
        const triggersToShared = result.edges.filter(
            (e) => e.label === 'triggers' && e.source === `hook-${ADAPTER_ID}-shared`
        );
        expect(triggersToShared).toHaveLength(1);
    });

    it('(R17) returns the resolved globs in the result for watchGlobs wiring', async () => {
        seedWorkspace({});
        const config: HarnessDashboardConfig = {
            adapters: { kiro: { hooksPath: 'my-hooks' } },
            extraPaths: { kiro: { hooks: ['extra-hooks'], steering: ['extra-steering'] } },
        };
        const result = await discover(ADAPTER_ID, rootUri(), config, true, true, ROOT_AGENT_ID, []);
        expect(result.resolvedGlobs.hooks).toContain('my-hooks');
        expect(result.resolvedGlobs.hooks).toContain('extra-hooks');
        expect(result.resolvedGlobs.hooks).toContain('hooks');
        expect(result.resolvedGlobs.steering).toContain('.kiro/steering');
        expect(result.resolvedGlobs.steering).toContain('extra-steering');
        expect(result.resolvedGlobs.steering).toContain('steering');
    });
});
