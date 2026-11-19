import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = new Map<string, boolean>();
let configThrows = false;

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: () => {
            if (configThrows) throw new Error('no configuration');
            return {
                get: <T>(key: string, fallback: T): T =>
                    (settings.has(key) ? settings.get(key) : fallback) as T,
            };
        },
    },
}));

import { BODY_PREVIEW_CHARS, bodyMetadata, discoveryFlags, rootAgentNode } from './adapterUtils.js';

const LABELS = { title: 'Claude Code', workspaceSuffix: 'Claude Code', description: 'Claude Code workspace' };
const ROOT = { fsPath: '/work/my-project' } as unknown as import('vscode').Uri;

describe('FEAT-048 R1/R4 adapter helpers', () => {
    beforeEach(() => {
        settings.clear();
        configThrows = false;
    });

    describe('R1 discoveryFlags', () => {
        it('defaults both flags to true', () => {
            expect(discoveryFlags('kiro')).toEqual({ adapter: true, root: true });
        });

        it.each([
            [false, true],
            [true, false],
            [false, false],
        ])('reads adapters.<key>.discovery=%s and discovery.root=%s', (adapter, root) => {
            settings.set('adapters.cursor.discovery', adapter);
            settings.set('discovery.root', root);
            expect(discoveryFlags('cursor')).toEqual({ adapter, root });
        });

        it('reads only the key of the adapter asked for', () => {
            settings.set('adapters.cursor.discovery', false);
            expect(discoveryFlags('windsurf')).toEqual({ adapter: true, root: true });
        });

        it('falls back to true when the configuration cannot be read', () => {
            configThrows = true;
            expect(discoveryFlags('copilot')).toEqual({ adapter: true, root: true });
        });
    });

    describe('R4 bodyMetadata', () => {
        it('keeps the first BODY_PREVIEW_CHARS characters as the preview', () => {
            const text = 'x'.repeat(BODY_PREVIEW_CHARS + 120);
            const meta = bodyMetadata(text);
            expect(BODY_PREVIEW_CHARS).toBe(500);
            expect(meta.body).toHaveLength(500);
            expect(meta._fullBody).toBe(text);
        });

        it('keeps a short body whole', () => {
            expect(bodyMetadata('short')).toEqual({ body: 'short', _fullBody: 'short' });
        });
    });

    describe('R4 rootAgentNode', () => {
        it('falls back to the workspace label and no source when the file is absent', () => {
            const node = rootAgentNode(ROOT, 'claude-code', 'Claude Code', null, 'CLAUDE.md', LABELS);
            expect(node.id).toBe('claude-code::root');
            expect(node.type).toBe('agent');
            expect(node.label).toBe('my-project Claude Code');
            expect(node.metadata?.description).toBe('Claude Code workspace');
            expect(node.metadata?.body).toBe('');
            expect(node.metadata?._fullBody).toBe('');
            expect(node.metadata?._filePath).toBeUndefined();
        });

        it('takes the markdown title, the first six lines and the file path when present', () => {
            const text = ['# Project rules', 'a', 'b', 'c', 'd', 'e', 'seventh'].join('\n');
            const node = rootAgentNode(ROOT, 'gemini-cli', 'Gemini CLI', text, 'GEMINI.md', LABELS);
            expect(node.label).toBe('Project rules');
            expect(node.metadata?.description).toBe('# Project rules a b c d e');
            expect(node.metadata?._fullBody).toBe(text);
            expect(node.metadata?._filePath).toBe('GEMINI.md');
            expect(node.metadata?._framework).toBe('gemini-cli');
        });

        it('uses the title fallback when the file has no heading', () => {
            const node = rootAgentNode(ROOT, 'claude-code', 'Claude Code', 'no heading', 'CLAUDE.md', LABELS);
            expect(node.label).toBe('Claude Code');
        });
    });

    describe('R1/R4 no adapter keeps its own copy', () => {
        const dir = __dirname;
        const adapters = readdirSync(dir).filter((f) => f.endsWith('Adapter.ts'));

        it.each(adapters)('%s has no private flag reading or inline preview slice', (file) => {
            const source = readFileSync(join(dir, file), 'utf8');
            expect(source).not.toContain('_isAdapterDiscoveryEnabled');
            expect(source).not.toContain('_getBool(');
            expect(source).not.toContain('slice(0, 500)');
        });
    });
});
