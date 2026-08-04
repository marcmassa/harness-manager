import { describe, it, expect } from 'vitest';
import { loadComponents } from './componentLoader.js';
import type { HarnessNode } from '../types.js';

function makeReadFile(files: Record<string, string>) {
    return async (rel: string): Promise<string | null> => {
        return Object.prototype.hasOwnProperty.call(files, rel) ? files[rel] : null;
    };
}

describe('loadComponents (R1, R2, R3)', () => {
    it('filters to exactly the five optimizable node types', async () => {
        const nodes: HarnessNode[] = [
            { id: 'a1', type: 'agent', label: 'a1', metadata: { _filePath: 'a1.md' } },
            { id: 'sa1', type: 'subagent', label: 'sa1', metadata: { _filePath: 'sa1.md' } },
            { id: 'sk1', type: 'skill', label: 'sk1', metadata: { _filePath: 'sk1.md' } },
            { id: 'st1', type: 'steering', label: 'st1', metadata: { _filePath: 'st1.md' } },
            { id: 'h1', type: 'hook', label: 'h1', metadata: { _filePath: 'h1.sh' } },
            { id: 'f1', type: 'feature', label: 'f1', metadata: {} },
            { id: 'd1', type: 'discovered-agent', label: 'd1', metadata: {} },
            { id: 'd2', type: 'discovered-skill', label: 'd2', metadata: {} },
            { id: 'd3', type: 'discovered-tool', label: 'd3', metadata: {} },
            { id: 'd4', type: 'discovered-resource', label: 'd4', metadata: {} },
            { id: 'd5', type: 'cli-install', label: 'd5', metadata: {} },
        ];
        const readFile = makeReadFile({
            'a1.md': '---\nname: a1\n---\nbody',
            'sa1.md': '---\nname: sa1\n---\nbody',
            'sk1.md': '---\nname: sk1\n---\nbody',
            'st1.md': '---\nappliesTo: ["*"]\n---\nbody',
            'h1.sh': '#!/bin/sh\necho hi',
        });

        const sources = await loadComponents(nodes, 'workspace-root', readFile);
        expect(sources.map(s => s.nodeId).sort()).toEqual(['a1', 'h1', 'sa1', 'sk1', 'st1']);
    });

    it('splits frontmatter and body correctly for a markdown component', async () => {
        const nodes: HarnessNode[] = [
            { id: 'sk1', type: 'skill', label: 'sk1', metadata: { _filePath: 'skills/sk1/SKILL.md' } },
        ];
        const readFile = makeReadFile({
            'skills/sk1/SKILL.md': '---\nname: sk1\ndescription: Use when doing X.\n---\n## Usage\n\nDo the thing.',
        });
        const [source] = await loadComponents(nodes, 'root', readFile);
        expect(source.exists).toBe(true);
        expect(source.frontmatter.name).toBe('sk1');
        expect(source.frontmatter.description).toBe('Use when doing X.');
        expect(source.body).toContain('## Usage');
        expect(source.body).not.toContain('---');
        expect(source.tokenEstimate).toBeGreaterThan(0);
    });

    it('handles a missing _filePath without throwing (R3)', async () => {
        const nodes: HarnessNode[] = [
            { id: 'sk1', type: 'skill', label: 'sk1', metadata: {} },
        ];
        const [source] = await loadComponents(nodes, 'root', async () => null);
        expect(source.exists).toBe(false);
        expect(source.raw).toBe('');
        expect(source.frontmatter).toEqual({});
        expect(source.body).toBe('');
        expect(source.tokenEstimate).toBe(0);
    });

    it('handles an empty _filePath without throwing (R3)', async () => {
        const nodes: HarnessNode[] = [
            { id: 'sk1', type: 'skill', label: 'sk1', metadata: { _filePath: '' } },
        ];
        const [source] = await loadComponents(nodes, 'root', async () => null);
        expect(source.exists).toBe(false);
    });

    it('handles an unreadable file without throwing (R3)', async () => {
        const nodes: HarnessNode[] = [
            { id: 'sk1', type: 'skill', label: 'sk1', metadata: { _filePath: 'missing.md' } },
        ];
        const [source] = await loadComponents(nodes, 'root', async () => null);
        expect(source.exists).toBe(false);
        expect(source.raw).toBe('');
    });

    it('never throws even when readFile itself throws', async () => {
        const nodes: HarnessNode[] = [
            { id: 'sk1', type: 'skill', label: 'sk1', metadata: { _filePath: 'boom.md' } },
        ];
        const readFile = async (): Promise<string | null> => { throw new Error('disk error'); };
        const sources = await loadComponents(nodes, 'root', readFile);
        expect(sources[0].exists).toBe(false);
    });

    it('does not consult metadata.body, _fullBody or _preview — disk is the sole authority (R2)', async () => {
        const nodes: HarnessNode[] = [
            {
                id: 'sk1',
                type: 'skill',
                label: 'sk1',
                metadata: {
                    _filePath: 'skills/sk1/SKILL.md',
                    body: 'STALE TRUNCATED PREVIEW',
                    _fullBody: 'STALE FULL BODY',
                    _preview: 'STALE PREVIEW',
                } as Record<string, unknown>,
            },
        ];
        const readFile = makeReadFile({
            'skills/sk1/SKILL.md': '---\nname: sk1\n---\nACTUAL CURRENT CONTENT',
        });
        const [source] = await loadComponents(nodes, 'root', readFile);
        expect(source.body).toBe('ACTUAL CURRENT CONTENT');
        expect(source.body).not.toContain('STALE');
        expect(source.raw).not.toContain('STALE');
    });
});
