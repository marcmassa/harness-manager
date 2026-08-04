import { describe, it, expect } from 'vitest';
import { scoreComponent, tierFor, rollup, SEVERITY_WEIGHT, applySeverityCeiling } from './scorer.js';
import type { ComponentScore, ComponentSource, OptimizerFinding } from './types.js';

function makeSource(overrides: Partial<ComponentSource> = {}): ComponentSource {
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

function finding(overrides: Partial<OptimizerFinding> = {}): OptimizerFinding {
    return {
        ruleId: 'OPT-S01',
        nodeId: 'x',
        nodeType: 'skill',
        filePath: 'skills/x/SKILL.md',
        severity: 'warning',
        dimension: 'structure',
        title: 't',
        detail: 'd',
        ...overrides,
    };
}

describe('SEVERITY_WEIGHT', () => {
    it('matches R10 exactly', () => {
        expect(SEVERITY_WEIGHT).toEqual({ error: 25, warning: 10, info: 3 });
    });
});

describe('scoreComponent (R10)', () => {
    it('scores a component with no findings at 100', () => {
        const score = scoreComponent(makeSource(), []);
        expect(score.score).toBe(100);
        expect(score.dimensions).toEqual({
            structure: 100, clarity: 100, budget: 100,
            integration: 100, hygiene: 100, consistency: 100,
        });
    });

    it('deducts weight arithmetic per dimension', () => {
        const findings = [
            finding({ dimension: 'structure', severity: 'error' }),   // -25
            finding({ dimension: 'budget', severity: 'warning' }),    // -10
            finding({ dimension: 'hygiene', severity: 'info' }),      // -3
        ];
        const score = scoreComponent(makeSource(), findings);
        expect(score.dimensions.structure).toBe(75);
        expect(score.dimensions.budget).toBe(90);
        expect(score.dimensions.integration).toBe(100);
        expect(score.dimensions.hygiene).toBe(97);
        // The untouched dimensions stay at 100 and are part of the mean:
        // [structure 75, clarity 100, budget 90, integration 100, hygiene 97,
        // consistency 100] → 93.67 → 94.
        expect(score.dimensions.clarity).toBe(100);
        expect(score.dimensions.consistency).toBe(100);
        expect(score.score).toBe(Math.round((75 + 100 + 90 + 100 + 97 + 100) / 6));
    });

    it('clamps a dimension at 0 with five errors', () => {
        const findings = Array.from({ length: 5 }, () => finding({ dimension: 'structure', severity: 'error' }));
        const score = scoreComponent(makeSource(), findings);
        expect(score.dimensions.structure).toBe(0);
    });

    it('carries through nodeId, nodeType, label, tokenEstimate and findingCount', () => {
        const source = makeSource({ nodeId: 'n1', nodeType: 'subagent', label: 'N1', tokenEstimate: 42 });
        const findings = [finding({ nodeId: 'n1' }), finding({ nodeId: 'n1', dimension: 'hygiene' })];
        const score: ComponentScore = scoreComponent(source, findings);
        expect(score.nodeId).toBe('n1');
        expect(score.nodeType).toBe('subagent');
        expect(score.label).toBe('N1');
        expect(score.tokenEstimate).toBe(42);
        expect(score.findingCount).toBe(2);
    });
});

describe('tierFor (R11) — all eight boundaries', () => {
    it('39 is F, 40 is D', () => {
        expect(tierFor(39)).toBe('F');
        expect(tierFor(40)).toBe('D');
    });
    it('59 is D, 60 is C', () => {
        expect(tierFor(59)).toBe('D');
        expect(tierFor(60)).toBe('C');
    });
    it('74 is C, 75 is B', () => {
        expect(tierFor(74)).toBe('C');
        expect(tierFor(75)).toBe('B');
    });
    it('89 is B, 90 is A', () => {
        expect(tierFor(89)).toBe('B');
        expect(tierFor(90)).toBe('A');
    });
    it('boundary extremes', () => {
        expect(tierFor(0)).toBe('F');
        expect(tierFor(100)).toBe('A');
    });
});

describe('rollup (R12)', () => {
    it('returns 0 for an empty component list', () => {
        expect(rollup([])).toBe(0);
    });

    it('returns the rounded arithmetic mean of component scores', () => {
        const components: ComponentScore[] = [
            { nodeId: 'a', nodeType: 'skill', label: 'a', score: 90, tier: 'A', dimensions: { structure: 90, budget: 90, integration: 90, hygiene: 90 }, tokenEstimate: 1, findingCount: 0 },
            { nodeId: 'b', nodeType: 'skill', label: 'b', score: 70, tier: 'C', dimensions: { structure: 70, budget: 70, integration: 70, hygiene: 70 }, tokenEstimate: 1, findingCount: 0 },
            { nodeId: 'c', nodeType: 'skill', label: 'c', score: 81, tier: 'B', dimensions: { structure: 81, budget: 81, integration: 81, hygiene: 81 }, tokenEstimate: 1, findingCount: 0 },
        ];
        // mean = (90+70+81)/3 = 80.33... → 80
        expect(rollup(components)).toBe(80);
    });
});

// ─── Calibration: epistemic severity ceiling ────────────────────────────────

describe('applySeverityCeiling — calibration guard', () => {
    it('lets a fact-tier rule keep error', () => {
        expect(applySeverityCeiling('error', 'fact')).toBe('error');
        expect(applySeverityCeiling('warning', 'fact')).toBe('warning');
    });

    it('caps a heuristic-tier rule at warning', () => {
        expect(applySeverityCeiling('error', 'heuristic')).toBe('warning');
        expect(applySeverityCeiling('warning', 'heuristic')).toBe('warning');
    });

    it('caps an opinion-tier rule at info', () => {
        expect(applySeverityCeiling('error', 'opinion')).toBe('info');
        expect(applySeverityCeiling('warning', 'opinion')).toBe('info');
        expect(applySeverityCeiling('info', 'opinion')).toBe('info');
    });

    it('never raises a severity, only lowers it', () => {
        expect(applySeverityCeiling('info', 'fact')).toBe('info');
        expect(applySeverityCeiling('warning', 'fact')).toBe('warning');
    });

    it('makes an unvalidated threshold cost less than a verifiable defect', () => {
        // The point of the whole guard: an invented constant must not deduct the
        // same 25 points as a genuinely broken frontmatter.
        const opinionCost = SEVERITY_WEIGHT[applySeverityCeiling('error', 'opinion')];
        const factCost = SEVERITY_WEIGHT[applySeverityCeiling('error', 'fact')];
        expect(opinionCost).toBeLessThan(factCost);
    });
});
