import { describe, it, expect } from 'vitest';
import { optS01, optS02, optS03, optS04, optS05, optS06 } from './structure.js';
import type { ComponentSource, OptimizableType, RuleContext } from '../types.js';
import { DEFAULT_OPTIMIZER_CONFIG } from '../types.js';

function makeSource(overrides: Partial<ComponentSource> & { nodeType: OptimizableType }): ComponentSource {
    return {
        nodeId: 'x',
        label: 'x',
        filePath: 'x/FILE.md',
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

describe('OPT-S01 — missing or invalid frontmatter (R13)', () => {
    const types: OptimizableType[] = ['agent', 'subagent', 'skill', 'steering'];
    for (const nodeType of types) {
        it(`flags ${nodeType} with no frontmatter`, () => {
            const source = makeSource({ nodeType, frontmatter: {} });
            const findings = optS01.evaluate(makeCtx(source));
            expect(findings).toHaveLength(1);
            expect(findings[0].severity).toBe('error');
            expect(findings[0].ruleId).toBe('OPT-S01');
        });

        it(`does not flag ${nodeType} with valid frontmatter`, () => {
            const source = makeSource({ nodeType, frontmatter: { name: 'x', description: 'A valid description here.' } });
            expect(optS01.evaluate(makeCtx(source))).toHaveLength(0);
        });
    }

    it('does not flag a missing file (owned by OPT-D01 instead)', () => {
        const source = makeSource({ nodeType: 'skill', exists: false, frontmatter: {} });
        expect(optS01.evaluate(makeCtx(source))).toHaveLength(0);
    });
});

describe('OPT-S02 — name / directory mismatch (R14)', () => {
    const types: OptimizableType[] = ['subagent', 'skill'];
    for (const nodeType of types) {
        it(`flags ${nodeType} whose frontmatter.name differs from its directory`, () => {
            const source = makeSource({
                nodeType,
                filePath: `${nodeType}s/right-dir/FILE.md`,
                frontmatter: { name: 'wrong-name' },
            });
            const findings = optS02.evaluate(makeCtx(source));
            expect(findings).toHaveLength(1);
            expect(findings[0].severity).toBe('warning');
            expect(findings[0].fix?.type).toBe('set-frontmatter-field');
            expect(findings[0].fix?.payload.value).toBe('right-dir');
        });

        it(`does not flag ${nodeType} whose frontmatter.name matches its directory`, () => {
            const source = makeSource({
                nodeType,
                filePath: `${nodeType}s/matching-dir/FILE.md`,
                frontmatter: { name: 'matching-dir' },
            });
            expect(optS02.evaluate(makeCtx(source))).toHaveLength(0);
        });
    }
});

describe('OPT-S03 — description length bounds (R15)', () => {
    const types: OptimizableType[] = ['agent', 'subagent', 'skill'];
    for (const nodeType of types) {
        it(`flags ${nodeType} with a missing/short description as error`, () => {
            const source = makeSource({ nodeType, frontmatter: { description: 'too short' } });
            const findings = optS03.evaluate(makeCtx(source));
            expect(findings).toHaveLength(1);
            expect(findings[0].severity).toBe('error');
        });

        it(`flags ${nodeType} with an overlong description as warning`, () => {
            const source = makeSource({ nodeType, frontmatter: { description: 'x'.repeat(1025) } });
            const findings = optS03.evaluate(makeCtx(source));
            expect(findings).toHaveLength(1);
            expect(findings[0].severity).toBe('warning');
        });

        it(`does not flag ${nodeType} with a well-sized description`, () => {
            const source = makeSource({ nodeType, frontmatter: { description: 'A' + 'x'.repeat(30) } });
            expect(optS03.evaluate(makeCtx(source))).toHaveLength(0);
        });
    }
});

describe('OPT-S04 — description states no trigger condition (R16)', () => {
    it('flags a skill description with no trigger marker', () => {
        const source = makeSource({
            nodeType: 'skill',
            frontmatter: { description: 'A skill that does something useful for the project.' },
        });
        const findings = optS04.evaluate(makeCtx(source));
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe('warning');
        expect(findings[0].detail).toMatch(/progressive disclosure/i);
    });

    it('does not flag a skill description containing a trigger marker', () => {
        const source = makeSource({
            nodeType: 'skill',
            frontmatter: { description: 'Use when the user asks to deploy the app to production.' },
        });
        expect(optS04.evaluate(makeCtx(source))).toHaveLength(0);
    });
});

describe('OPT-S05 — missing required sections (R17)', () => {
    it('flags a skill with no usage/examples heading', () => {
        const source = makeSource({ nodeType: 'skill', body: '# Overview\n\nJust prose, no usage section.' });
        const findings = optS05.evaluate(makeCtx(source));
        expect(findings).toHaveLength(1);
        expect(findings[0].fix?.type).toBe('append-section-stubs');
    });

    it('does not flag a skill that has a Usage heading', () => {
        const source = makeSource({ nodeType: 'skill', body: '# Overview\n\n## Usage\n\nDo the thing.' });
        expect(optS05.evaluate(makeCtx(source))).toHaveLength(0);
    });

    it('flags a subagent with no role/responsibilities heading', () => {
        const source = makeSource({ nodeType: 'subagent', body: '# Overview\n\nJust prose.' });
        const findings = optS05.evaluate(makeCtx(source));
        expect(findings).toHaveLength(1);
    });

    it('does not flag a subagent that has a Responsibilities heading', () => {
        const source = makeSource({ nodeType: 'subagent', body: '## Responsibilities\n\nDoes things.' });
        expect(optS05.evaluate(makeCtx(source))).toHaveLength(0);
    });
});

describe('OPT-S06 — hook and steering contract (R18)', () => {
    it('flags a hook with no event', () => {
        const source = makeSource({ nodeType: 'hook', frontmatter: { script: 'hooks/x.sh' } });
        const findings = optS06.evaluate(makeCtx(source));
        expect(findings.some(f => /no event/i.test(f.title))).toBe(true);
    });

    it('flags a hook whose script does not exist', () => {
        const source = makeSource({ nodeType: 'hook', exists: false, frontmatter: { event: 'pre-commit' } });
        const findings = optS06.evaluate(makeCtx(source));
        expect(findings.some(f => /script does not exist/i.test(f.title))).toBe(true);
    });

    it('does not flag a well-formed hook', () => {
        const source = makeSource({ nodeType: 'hook', exists: true, frontmatter: { event: 'pre-commit' } });
        expect(optS06.evaluate(makeCtx(source))).toHaveLength(0);
    });

    it('flags steering with no appliesTo', () => {
        const source = makeSource({ nodeType: 'steering', frontmatter: {} });
        const findings = optS06.evaluate(makeCtx(source));
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe('warning');
    });

    it('does not flag steering with appliesTo present', () => {
        const source = makeSource({ nodeType: 'steering', frontmatter: { appliesTo: ['*'] } });
        expect(optS06.evaluate(makeCtx(source))).toHaveLength(0);
    });
});
