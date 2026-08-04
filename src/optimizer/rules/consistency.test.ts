import { describe, it, expect } from 'vitest';
import { optC01, optC02 } from './consistency.js';
import type { ComponentSource, RuleContext } from '../types.js';
import { DEFAULT_OPTIMIZER_CONFIG } from '../types.js';
import { computeCorpusStats, MIN_SAMPLE_FOR_CONVENTION } from '../corpusStats.js';

function src(over: Partial<ComponentSource>): ComponentSource {
    return {
        nodeId: 'n', nodeType: 'skill', label: 'n', filePath: 'skills/n/SKILL.md',
        raw: '', frontmatter: {}, body: '', exists: true, tokenEstimate: 100,
        ...over,
    };
}

function ctx(source: ComponentSource, all: ComponentSource[]): RuleContext {
    return {
        source, all,
        sourcesById: new Map(all.map(s => [s.nodeId, s])),
        edges: [], nodeIds: new Set(all.map(s => s.nodeId)), existingPaths: new Set(),
        config: DEFAULT_OPTIMIZER_CONFIG,
        corpus: computeCorpusStats(all),
    };
}

const conforming = (id: string) => src({
    nodeId: id,
    frontmatter: { name: id, description: 'd' },
    body: '## Usage\ntext\n\n## Examples\ntext\n',
});

describe('OPT-C01 — frontmatter conformance to the corpus', () => {
    it('stays silent below the convention sample floor', () => {
        // The floor counts the WHOLE same-typed group, the odd one included, so
        // the group must total fewer than MIN_SAMPLE_FOR_CONVENTION.
        const peers = Array.from(
            { length: MIN_SAMPLE_FOR_CONVENTION - 2 },
            (_, i) => conforming(`c${i}`),
        );
        const odd = src({ nodeId: 'odd', frontmatter: {} });
        const all = [...peers, odd];
        expect(all).toHaveLength(MIN_SAMPLE_FOR_CONVENTION - 1);
        // With too few peers, "everyone has it" is coincidence, not convention.
        expect(optC01.evaluate(ctx(odd, all))).toHaveLength(0);
    });

    it('starts inferring conventions exactly at the sample floor', () => {
        const peers = Array.from(
            { length: MIN_SAMPLE_FOR_CONVENTION - 1 },
            (_, i) => conforming(`c${i}`),
        );
        const odd = src({ nodeId: 'odd', frontmatter: {} });
        const all = [...peers, odd];
        expect(all).toHaveLength(MIN_SAMPLE_FOR_CONVENTION);
        expect(optC01.evaluate(ctx(odd, all)).length).toBeGreaterThan(0);
    });

    it('flags a component missing a key the majority declares', () => {
        const all = [conforming('a'), conforming('b'), conforming('c')];
        const odd = src({ nodeId: 'odd', frontmatter: { name: 'odd' }, body: '## Usage\nt\n\n## Examples\nt\n' });
        all.push(odd);
        const out = optC01.evaluate(ctx(odd, all));
        expect(out).toHaveLength(1);
        expect(out[0].detail).toContain('description');
        expect(out[0].dimension).toBe('consistency');
    });

    it('stays silent when the component matches the convention', () => {
        const all = [conforming('a'), conforming('b'), conforming('c'), conforming('d')];
        expect(optC01.evaluate(ctx(all[0], all))).toHaveLength(0);
    });

    it('offers a fix only when exactly one key is missing', () => {
        const all = [conforming('a'), conforming('b'), conforming('c')];
        const one = src({ nodeId: 'one', frontmatter: { name: 'one' } });
        const none = src({ nodeId: 'none', frontmatter: {} });
        all.push(one, none);
        expect(optC01.evaluate(ctx(one, all))[0].fix?.type).toBe('set-frontmatter-field');
        expect(optC01.evaluate(ctx(none, all))[0].fix).toBeUndefined();
    });

    it('judges each node type against its own peers only', () => {
        const skills = [conforming('s1'), conforming('s2'), conforming('s3')];
        const hook = src({ nodeId: 'h', nodeType: 'hook', frontmatter: {} });
        // The hook has no peers, so the skills' convention must not apply to it.
        expect(optC01.evaluate(ctx(hook, [...skills, hook]))).toHaveLength(0);
    });
});

describe('OPT-C02 — section conformance to the corpus', () => {
    it('flags a component missing a heading the majority has', () => {
        const all = [conforming('a'), conforming('b'), conforming('c')];
        const odd = src({
            nodeId: 'odd',
            frontmatter: { name: 'odd', description: 'd' },
            body: '## Usage\ntext\n',
        });
        all.push(odd);
        const out = optC02.evaluate(ctx(odd, all));
        expect(out).toHaveLength(1);
        expect(out[0].detail.toLowerCase()).toContain('examples');
        expect(out[0].fix?.type).toBe('append-section-stubs');
    });

    it('is case-insensitive about headings', () => {
        const all = [conforming('a'), conforming('b'), conforming('c')];
        const shouty = src({
            nodeId: 'shouty',
            frontmatter: { name: 'shouty', description: 'd' },
            body: '## USAGE\ntext\n\n## EXAMPLES\ntext\n',
        });
        all.push(shouty);
        expect(optC02.evaluate(ctx(shouty, all))).toHaveLength(0);
    });

    it('derives the convention instead of prescribing one', () => {
        // A corpus that consistently uses an unusual heading makes THAT the norm.
        const odd = (id: string) => src({
            nodeId: id,
            frontmatter: { name: id, description: 'd' },
            body: '## Ritual\ntext\n',
        });
        const all = [odd('a'), odd('b'), odd('c')];
        const conventional = src({
            nodeId: 'conv',
            frontmatter: { name: 'conv', description: 'd' },
            body: '## Usage\ntext\n',
        });
        all.push(conventional);
        const out = optC02.evaluate(ctx(conventional, all));
        expect(out).toHaveLength(1);
        expect(out[0].detail.toLowerCase()).toContain('ritual');
    });
});

describe('consistency rules — epistemic tier', () => {
    it('are heuristic: "most files do X" is not proof X is required', () => {
        expect(optC01.confidence).toBe('heuristic');
        expect(optC02.confidence).toBe('heuristic');
    });
});
