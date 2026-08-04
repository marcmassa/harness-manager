import { describe, it, expect } from 'vitest';
import { optB01, optB02, optB03 } from './budget.js';
import type { ComponentSource, OptimizerConfig, RuleContext } from '../types.js';
import { DEFAULT_OPTIMIZER_CONFIG } from '../types.js';
import { computeCorpusStats, MIN_SAMPLE_FOR_RELATIVE } from '../corpusStats.js';

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
        corpus: opts?.corpus ?? computeCorpusStats(all),
    };
}

const config: OptimizerConfig = {
    enabled: true,
    tokenBudget: { skill: 100, subagent: 200, agent: 300, steering: 100, agentRollup: 500 },
    budgetMedianMultiple: 2.5,
    overlapThreshold: 0.8,
    disabledRules: [],
};

/** Build a corpus of `n` skills all at `tokens`, so the median is exactly `tokens`. */
function uniformSkills(n: number, tokens: number): ComponentSource[] {
    return Array.from({ length: n }, (_, i) =>
        makeSource({ nodeId: `s${i}`, nodeType: 'skill', tokenEstimate: tokens }));
}

// ─── Absolute fallback: corpus too small to calibrate ───────────────────────

describe('OPT-B01 — absolute fallback below the sample floor', () => {
    it('does not flag a component at exactly the absolute budget', () => {
        const source = makeSource({ tokenEstimate: 100 });
        expect(optB01.evaluate(makeCtx(source, { config }))).toHaveLength(0);
    });

    it('flags a component just over the absolute budget', () => {
        const source = makeSource({ tokenEstimate: 101 });
        const out = optB01.evaluate(makeCtx(source, { config }));
        expect(out).toHaveLength(1);
        expect(out[0].detail).toContain('corpus too small to calibrate');
    });

    it('reports the absolute basis when the sample is one short of the floor', () => {
        const all = uniformSkills(MIN_SAMPLE_FOR_RELATIVE - 1, 1000);
        all[0] = { ...all[0], tokenEstimate: 5000 };
        const out = optB01.evaluate(makeCtx(all[0], { config, all }));
        expect(out).toHaveLength(1);
        expect(out[0].detail).toContain('corpus too small to calibrate');
    });
});

// ─── Relative threshold: the calibration fix ────────────────────────────────

describe('OPT-B01 — relative threshold once the corpus is large enough', () => {
    it('flags nobody when every component is the same size', () => {
        // The regression this whole change exists to prevent: a uniform corpus
        // must not be reported wholesale just because a constant was too low.
        const all = uniformSkills(6, 1000);
        for (const s of all) {
            expect(optB01.evaluate(makeCtx(s, { config, all }))).toHaveLength(0);
        }
    });

    it('flags only the genuine outlier', () => {
        const all = uniformSkills(5, 1000);
        const outlier = makeSource({ nodeId: 'big', tokenEstimate: 4000 });
        all.push(outlier);

        expect(optB01.evaluate(makeCtx(outlier, { config, all }))).toHaveLength(1);
        expect(optB01.evaluate(makeCtx(all[0], { config, all }))).toHaveLength(0);
    });

    it('names the median and the sample size in the detail', () => {
        const all = uniformSkills(5, 1000);
        const outlier = makeSource({ nodeId: 'big', tokenEstimate: 9000 });
        all.push(outlier);

        const out = optB01.evaluate(makeCtx(outlier, { config, all }));
        expect(out[0].detail).toContain('2.5×');
        expect(out[0].detail).toContain('1000 tokens');
        expect(out[0].detail).toContain('n=6');
    });

    it('does not fire at exactly the multiple, only above it', () => {
        const all = uniformSkills(5, 1000);
        const atThreshold = makeSource({ nodeId: 'at', tokenEstimate: 2500 });
        all.push(atThreshold);
        expect(optB01.evaluate(makeCtx(atThreshold, { config, all }))).toHaveLength(0);
    });

    it('adapts when the whole corpus is large — a big-but-typical component is clean', () => {
        // Same absolute size that the old fixed 500-token budget flagged.
        const all = uniformSkills(6, 1991);
        expect(optB01.evaluate(makeCtx(all[0], { config, all }))).toHaveLength(0);
    });
});

// ─── Severity is capped by the rule's epistemic tier ────────────────────────

describe('OPT-B01/B03 — epistemic tier', () => {
    it('is tagged as opinion, so the scorer caps it at info', () => {
        expect(optB01.confidence).toBe('opinion');
        expect(optB02.confidence).toBe('opinion');
        expect(optB03.confidence).toBe('opinion');
    });

    it('never emits above info, however far over threshold', () => {
        const all = uniformSkills(5, 100);
        const huge = makeSource({ nodeId: 'huge', tokenEstimate: 100_000 });
        all.push(huge);
        const out = optB01.evaluate(makeCtx(huge, { config, all }));
        expect(out[0].severity).toBe('info');
    });
});

// ─── OPT-B02 ────────────────────────────────────────────────────────────────

const threeSections = '## One\ntext\n\n## Two\ntext\n\n## Three\ntext\n';

describe('OPT-B02 — extractable reference content (R20)', () => {
    it('flags an over-threshold component with 3+ top-level sections', () => {
        const source = makeSource({ tokenEstimate: 500, body: threeSections });
        const out = optB02.evaluate(makeCtx(source, { config }));
        expect(out).toHaveLength(1);
        expect(out[0].fix?.type).toBe('extract-to-references');
        expect(out[0].fix?.payload.sections).toBe('Three');
    });

    it('does not flag an over-threshold component with fewer than 3 sections', () => {
        const source = makeSource({ tokenEstimate: 500, body: '## One\ntext\n\n## Two\ntext\n' });
        expect(optB02.evaluate(makeCtx(source, { config }))).toHaveLength(0);
    });

    it('does not flag a component under threshold even with many sections', () => {
        const source = makeSource({ tokenEstimate: 10, body: threeSections });
        expect(optB02.evaluate(makeCtx(source, { config }))).toHaveLength(0);
    });

    it('respects the relative threshold, not just the absolute one', () => {
        const all = uniformSkills(6, 5000);
        const typical = makeSource({ nodeId: 's0', tokenEstimate: 5000, body: threeSections });
        all[0] = typical;
        // 5000 busts the absolute budget of 100 but is exactly the corpus median.
        expect(optB02.evaluate(makeCtx(typical, { config, all }))).toHaveLength(0);
    });
});

// ─── OPT-B03 ────────────────────────────────────────────────────────────────

describe('OPT-B03 — agent context rollup (R21)', () => {
    it('flags when the rollup exceeds agentRollup and lists the 3 largest contributors', () => {
        const agent = makeSource({ nodeId: 'a', nodeType: 'subagent', tokenEstimate: 100 });
        const skills = [
            makeSource({ nodeId: 'k1', tokenEstimate: 300 }),
            makeSource({ nodeId: 'k2', tokenEstimate: 200 }),
            makeSource({ nodeId: 'k3', tokenEstimate: 150 }),
            makeSource({ nodeId: 'k4', tokenEstimate: 50 }),
        ];
        const all = [agent, ...skills];
        const edges = skills.map(s => ({ source: 'a', target: s.nodeId, label: 'uses' }));

        const out = optB03.evaluate(makeCtx(agent, { config, all, edges }));
        expect(out).toHaveLength(1);
        expect(out[0].severity).toBe('info');
        expect(out[0].relatedNodeIds).toEqual(['k1', 'k2', 'k3']);
    });

    it('does not flag an agent with no outgoing edges', () => {
        const agent = makeSource({ nodeId: 'a', nodeType: 'subagent', tokenEstimate: 100 });
        expect(optB03.evaluate(makeCtx(agent, { config, all: [agent] }))).toHaveLength(0);
    });
});
