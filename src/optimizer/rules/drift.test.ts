import { describe, it, expect } from 'vitest';
import { optD01, optD02 } from './drift.js';
import type { ComponentSource, RuleContext } from '../types.js';
import { DEFAULT_OPTIMIZER_CONFIG } from '../types.js';

function makeSource(overrides: Partial<ComponentSource>): ComponentSource {
    return {
        nodeId: 'x',
        nodeType: 'skill',
        label: 'x',
        filePath: 'skills/x/SKILL.md',
        raw: '',
        frontmatter: {},
        body: '',
        exists: true,
        pathKind: 'file' as const,
        tokenEstimate: 10,
        ...overrides,
    };
}

function makeCtx(source: ComponentSource, opts?: Partial<RuleContext>): RuleContext {
    const all = opts?.all ?? [source];
    return {
        source,
        all,
        sourcesById: new Map(all.map(s => [s.nodeId, s])),
        edges: opts?.edges ?? [],
        nodeIds: opts?.nodeIds ?? new Set(all.map(s => s.nodeId)),
        existingPaths: opts?.existingPaths ?? new Set(),
        config: opts?.config ?? DEFAULT_OPTIMIZER_CONFIG,
    };
}

describe('OPT-D01 — directory- and path-less components are not drift', () => {
    // Regression from smoke testing: KiroAdapter roots its synthetic workspace
    // node at the `.kiro` DIRECTORY. Collapsing "directory" into "missing" made
    // this fact-tier rule report a fully populated `.kiro/` as gone, at `error`
    // severity — a false claim from the one tier that must never make one.
    it('does not flag a component whose path is a directory', () => {
        const source = makeSource({ nodeId: 'kiro::root', filePath: '.kiro', exists: false, pathKind: 'directory' });
        const findings = optD01.evaluate(makeCtx(source));
        expect(findings.some(f => /missing on disk/i.test(f.title))).toBe(false);
    });

    it('does not flag a component that never declared a path', () => {
        const source = makeSource({ nodeId: 'synthetic', filePath: '', exists: false, pathKind: 'unresolved' });
        const findings = optD01.evaluate(makeCtx(source));
        expect(findings.some(f => /missing on disk/i.test(f.title))).toBe(false);
    });

    it('still flags a genuinely absent declared file', () => {
        const source = makeSource({ nodeId: 'gone', filePath: 'skills/gone/SKILL.md', exists: false, pathKind: 'missing' });
        const findings = optD01.evaluate(makeCtx(source));
        expect(findings.some(f => /missing on disk/i.test(f.title))).toBe(true);
    });
});

describe('OPT-D01 — manifest / filesystem drift (R25)', () => {
    it('flags a component declared but missing on disk', () => {
        const source = makeSource({ nodeId: 'skillA', exists: false, pathKind: 'missing' });
        const findings = optD01.evaluate(makeCtx(source));
        expect(findings.some(f => /missing on disk/i.test(f.title))).toBe(true);
        expect(findings.find(f => /missing on disk/i.test(f.title))?.severity).toBe('error');
    });

    it('does not flag a component that exists', () => {
        const source = makeSource({ nodeId: 'skillA', exists: true, frontmatter: { name: 'unique-a' } });
        expect(optD01.evaluate(makeCtx(source))).toHaveLength(0);
    });

    it('flags a duplicate frontmatter.name on both components', () => {
        const a = makeSource({ nodeId: 'skillA', nodeType: 'skill', frontmatter: { name: 'dup' } });
        const b = makeSource({ nodeId: 'skillB', nodeType: 'skill', frontmatter: { name: 'dup' } });
        const all = [a, b];

        const findingsA = optD01.evaluate(makeCtx(a, { all }));
        const findingsB = optD01.evaluate(makeCtx(b, { all }));

        expect(findingsA.some(f => f.relatedNodeIds?.includes('skillB'))).toBe(true);
        expect(findingsB.some(f => f.relatedNodeIds?.includes('skillA'))).toBe(true);
    });

    it('does not flag components of different types sharing a name', () => {
        const a = makeSource({ nodeId: 'skillA', nodeType: 'skill', frontmatter: { name: 'dup' } });
        const b = makeSource({ nodeId: 'subagentB', nodeType: 'subagent', frontmatter: { name: 'dup' } });
        const findings = optD01.evaluate(makeCtx(a, { all: [a, b] }));
        expect(findings).toHaveLength(0);
    });
});

describe('OPT-D02 — broken cross-references (R26)', () => {
    it('does not flag a markdown link resolving to a known node id', () => {
        const source = makeSource({
            nodeId: 'skillA',
            body: 'See [the other skill](../other-skill/SKILL.md) for details.',
        });
        const nodeIds = new Set(['skillA', 'other-skill']);
        const findings = optD02.evaluate(makeCtx(source, { nodeIds }));
        expect(findings).toHaveLength(0);
    });

    it('does not flag a markdown link resolving to an existing file', () => {
        const source = makeSource({
            nodeId: 'skillA',
            filePath: 'skills/skillA/SKILL.md',
            body: 'See [notes](./NOTES.md) for details.',
        });
        const existingPaths = new Set(['skills/skillA/NOTES.md']);
        const findings = optD02.evaluate(makeCtx(source, { existingPaths }));
        expect(findings).toHaveLength(0);
    });

    it('flags a markdown link that resolves to neither a node id nor an existing file', () => {
        const source = makeSource({
            nodeId: 'skillA',
            filePath: 'skills/skillA/SKILL.md',
            body: 'See [ghost](./does-not-exist/GHOST.md) for details.',
        });
        const findings = optD02.evaluate(makeCtx(source));
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe('warning');
        expect(findings[0].line).toBeGreaterThan(0);
    });

    it('flags a broken wiki link', () => {
        const source = makeSource({ nodeId: 'skillA', body: 'Related: [[nonexistent-thing]]' });
        const findings = optD02.evaluate(makeCtx(source));
        expect(findings).toHaveLength(1);
    });

    it('ignores external URLs', () => {
        const source = makeSource({ nodeId: 'skillA', body: 'See [docs](https://example.com/docs) for details.' });
        expect(optD02.evaluate(makeCtx(source))).toHaveLength(0);
    });
});
