import { describe, it, expect } from 'vitest';
import { computeFix } from './quickFix.js';
import matter from '../frontmatter.js';
import type { ComponentSource, QuickFix } from './types.js';

function makeSource(overrides: Partial<ComponentSource>): ComponentSource {
    const raw = overrides.raw ?? '---\nname: my-skill\ndescription: Use when testing things.\n---\n## Usage\n\nDo the thing.\n';
    const { data, content } = matter(raw);
    return {
        nodeId: 'my-skill',
        nodeType: 'skill',
        label: 'my-skill',
        filePath: 'skills/my-skill/SKILL.md',
        raw,
        frontmatter: data,
        body: content,
        exists: true,
        pathKind: 'file' as const,
        tokenEstimate: 20,
        ...overrides,
    };
}

describe('computeFix — insert-frontmatter (R31)', () => {
    it('prepends a frontmatter stub that re-parses to a valid block', () => {
        const source = makeSource({ raw: 'Just a plain body, no frontmatter at all.', frontmatter: {}, body: 'Just a plain body, no frontmatter at all.' });
        const fix: QuickFix = { type: 'insert-frontmatter', label: 'Insert frontmatter', payload: {} };
        const result = computeFix(source, fix);
        expect(result.ok).toBe(true);
        if (result.ok) {
            const { data, content } = matter(result.content);
            expect(typeof data.name).toBe('string');
            expect(content).toContain('Just a plain body');
        }
    });
});

describe('computeFix — set-frontmatter-field (R31)', () => {
    it('re-serializes frontmatter with the field set, still parseable', () => {
        const source = makeSource({});
        const fix: QuickFix = { type: 'set-frontmatter-field', label: 'Set name', payload: { field: 'name', value: 'my-skill' } };
        const result = computeFix(source, fix);
        expect(result.ok).toBe(true);
        if (result.ok) {
            const { data, content } = matter(result.content);
            expect(data.name).toBe('my-skill');
            expect(content).toContain('Do the thing.');
        }
    });
});

describe('computeFix — append-section-stubs (R31)', () => {
    it('appends the missing section headings', () => {
        const source = makeSource({});
        const fix: QuickFix = { type: 'append-section-stubs', label: 'Append stubs', payload: { sections: 'Usage,Examples' } };
        const result = computeFix(source, fix);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.content).toContain('## Usage');
            expect(result.content).toContain('## Examples');
            const { content } = matter(result.content);
            expect(content).toContain('## Examples');
        }
    });
});

describe('computeFix — extract-to-references (R31, R36)', () => {
    const bigSource = makeSource({
        raw: '---\nname: my-skill\ndescription: Use when testing things at length.\n---\n## Overview\n\nIntro text.\n\n## Usage\n\nHow to use it.\n\n## Advanced\n\nAdvanced details go here.\n\n## Troubleshooting\n\nCommon issues.\n',
        frontmatter: { name: 'my-skill', description: 'Use when testing things at length.' },
        body: '## Overview\n\nIntro text.\n\n## Usage\n\nHow to use it.\n\n## Advanced\n\nAdvanced details go here.\n\n## Troubleshooting\n\nCommon issues.\n',
    });

    it('extracts the requested sections into a references file and links to it', () => {
        const fix: QuickFix = {
            type: 'extract-to-references',
            label: 'Extract',
            payload: { sections: 'Advanced,Troubleshooting' },
        };
        const result = computeFix(bigSource, fix, new Set());
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.content).not.toContain('Advanced details go here.');
            expect(result.content).toContain('references/advanced.md');
            expect(result.extraFile).toBeDefined();
            expect(result.extraFile?.content).toContain('Advanced details go here.');
            expect(result.extraFile?.content).toContain('Common issues.');
            expect(result.extraFile?.relPath).toBe('skills/my-skill/references/advanced.md');

            // The rewritten original still round-trips to valid frontmatter.
            const { data } = matter(result.content);
            expect(data.name).toBe('my-skill');
        }
    });

    it('refuses when the target references file already exists (R36)', () => {
        const fix: QuickFix = {
            type: 'extract-to-references',
            label: 'Extract',
            payload: { sections: 'Advanced,Troubleshooting' },
        };
        const existingPaths = new Set(['skills/my-skill/references/advanced.md']);
        const result = computeFix(bigSource, fix, existingPaths);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toMatch(/already exists/i);
        }
    });
});

describe('computeFix — relativize-path (R31)', () => {
    it('replaces the absolute prefix on the specified line with a relative path', () => {
        const raw = 'line one\nSee /Users/marc/project/src/index.ts for details.\nline three';
        const source = makeSource({ raw, frontmatter: {}, body: raw });
        const fix: QuickFix = {
            type: 'relativize-path',
            label: 'Relativize',
            payload: { line: '2', absolutePath: '/Users/marc/project/src/index.ts', relativePath: 'src/index.ts' },
        };
        const result = computeFix(source, fix);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.content).toContain('./src/index.ts');
            expect(result.content).not.toContain('/Users/marc/project');
        }
    });

    it('leaves a path outside the workspace root untouched', () => {
        const raw = 'See /Users/marc/somewhere-else/notes.txt for details.';
        const source = makeSource({ raw, frontmatter: {}, body: raw });
        const fix: QuickFix = {
            type: 'relativize-path',
            label: 'Relativize',
            payload: { line: '1', absolutePath: '/Users/marc/somewhere-else/notes.txt' }, // no relativePath resolved
        };
        const result = computeFix(source, fix);
        expect(result.ok).toBe(false);
    });
});

describe('computeFix — unknown fix type', () => {
    it('reports a reason rather than throwing', () => {
        const source = makeSource({});
        const result = computeFix(source, { type: 'not-a-real-type' as QuickFix['type'], label: '', payload: {} });
        expect(result.ok).toBe(false);
    });
});
