import { describe, it, expect } from 'vitest';
import { median, computeCorpusStats, resolveBudget, MIN_SAMPLE_FOR_RELATIVE } from './corpusStats.js';
import type { ComponentSource, OptimizableType } from './types.js';

function src(over: Partial<ComponentSource>): ComponentSource {
    return {
        nodeId: 'n', nodeType: 'skill', label: 'n', filePath: 'a.md',
        raw: '', frontmatter: {}, body: '', exists: true, tokenEstimate: 0,
        ...over,
    };
}

describe('median', () => {
    it('returns 0 for an empty list', () => {
        expect(median([])).toBe(0);
    });

    it('returns the middle value for odd lengths', () => {
        expect(median([5, 1, 3])).toBe(3);
    });

    it('averages the two middle values for even lengths', () => {
        expect(median([1, 2, 3, 4])).toBe(3); // (2+3)/2 = 2.5 → rounds to 3
    });

    it('does not mutate its input', () => {
        const input = [3, 1, 2];
        median(input);
        expect(input).toEqual([3, 1, 2]);
    });
});

describe('computeCorpusStats', () => {
    it('computes a median and sample size per node type independently', () => {
        const stats = computeCorpusStats([
            src({ nodeId: 'a', nodeType: 'skill', tokenEstimate: 100 }),
            src({ nodeId: 'b', nodeType: 'skill', tokenEstimate: 300 }),
            src({ nodeId: 'c', nodeType: 'skill', tokenEstimate: 200 }),
            src({ nodeId: 'd', nodeType: 'subagent', tokenEstimate: 900 }),
        ]);
        expect(stats.medianTokensByType.get('skill')).toBe(200);
        expect(stats.sampleSizeByType.get('skill')).toBe(3);
        expect(stats.medianTokensByType.get('subagent')).toBe(900);
        expect(stats.sampleSizeByType.get('subagent')).toBe(1);
    });

    it('excludes missing files so they do not drag the median toward zero', () => {
        const stats = computeCorpusStats([
            src({ nodeId: 'a', tokenEstimate: 1000 }),
            src({ nodeId: 'b', tokenEstimate: 1000 }),
            src({ nodeId: 'gone', tokenEstimate: 0, exists: false }),
        ]);
        expect(stats.medianTokensByType.get('skill')).toBe(1000);
        expect(stats.sampleSizeByType.get('skill')).toBe(2);
    });

    it('reports nothing for a type that has no components', () => {
        const stats = computeCorpusStats([src({ nodeType: 'skill', tokenEstimate: 10 })]);
        expect(stats.medianTokensByType.get('hook' as OptimizableType)).toBeUndefined();
    });
});

describe('resolveBudget', () => {
    const many = (n: number, tokens: number) =>
        computeCorpusStats(Array.from({ length: n }, (_, i) =>
            src({ nodeId: `s${i}`, tokenEstimate: tokens })));

    it('falls back to the absolute budget below the sample floor', () => {
        const resolved = resolveBudget('skill', 777, many(MIN_SAMPLE_FOR_RELATIVE - 1, 1000), 2.5);
        expect(resolved.basis).toBe('absolute');
        expect(resolved.threshold).toBe(777);
    });

    it('switches to the relative threshold at exactly the sample floor', () => {
        const resolved = resolveBudget('skill', 777, many(MIN_SAMPLE_FOR_RELATIVE, 1000), 2.5);
        expect(resolved.basis).toBe('relative');
        expect(resolved.threshold).toBe(2500);
        expect(resolved.median).toBe(1000);
        expect(resolved.sampleSize).toBe(MIN_SAMPLE_FOR_RELATIVE);
    });

    it('scales with the corpus, so a uniformly large workspace is not penalised', () => {
        const small = resolveBudget('skill', 777, many(6, 500), 2.5);
        const large = resolveBudget('skill', 777, many(6, 5000), 2.5);
        expect(small.threshold).toBe(1250);
        expect(large.threshold).toBe(12500);
    });

    it('falls back to absolute when the median is zero', () => {
        const resolved = resolveBudget('skill', 777, many(10, 0), 2.5);
        expect(resolved.basis).toBe('absolute');
    });

    it('has no fixed flagging floor — unlike a percentile, it can flag nobody', () => {
        // With a uniform corpus the threshold sits above every member, so no
        // component is reported. A percentile would always report the worst X%.
        const stats = many(10, 1000);
        const resolved = resolveBudget('skill', 777, stats, 2.5);
        expect(resolved.threshold).toBeGreaterThan(1000);
    });
});
