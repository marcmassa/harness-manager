// FEAT-043 T2 — score coverage: only evaluated dimensions and components count (R1–R3).
import { describe, expect, it } from 'vitest';
import { rollup, scoreComponent, DIMENSIONS } from './scorer.js';
import { scan } from './optimizerEngine.js';
import { activeRules } from './rules/index.js';
import { DEFAULT_OPTIMIZER_CONFIG, type ComponentSource, type OptimizerFinding } from './types.js';

const src = (over: Partial<ComponentSource> = {}): ComponentSource => ({
    nodeId: 'n', nodeType: 'skill', label: 'n', filePath: 'n.md', raw: 'Body.', frontmatter: {}, body: 'Body.',
    exists: true, pathKind: 'file', tokenEstimate: 10, ...over,
});
const finding = (over: Partial<OptimizerFinding>): OptimizerFinding => ({
    ruleId: 'OPT-H01', nodeId: 'n', nodeType: 'skill', filePath: 'n.md', severity: 'warning',
    dimension: 'hygiene', title: 't', detail: 'd', ...over,
});

describe('scoreComponent coverage (R2, R3)', () => {
    it('leaves a component with no evaluated dimension unscored, with the missing evidence', () => {
        const skipped = [{ ruleId: 'OPT-S01', reason: 'cursor does not document the "frontmatter" convention for skill components' }];
        const score = scoreComponent(src(), [], { evaluated: [], skipped });
        expect(score).toMatchObject({ score: null, tier: null, coverage: { evaluated: [], skipped } });
        expect(Object.values(score.dimensions).every(v => v === null)).toBe(true);
    });

    it('averages only evaluated dimensions: a skipped one is neither a penalty nor a perfect score', () => {
        const partial = scoreComponent(src(), [finding({ dimension: 'hygiene', severity: 'warning' })], { evaluated: ['hygiene', 'budget'], skipped: [] });
        expect(partial.dimensions).toMatchObject({ hygiene: 90, budget: 100, structure: null, clarity: null });
        expect(partial.score).toBe(95);
        expect(partial.coverage.evaluated).toEqual(['budget', 'hygiene']);
    });

    it('gives a clean, fully evaluated component its ordinary score', () => {
        const clean = scoreComponent(src(), [], { evaluated: [...DIMENSIONS], skipped: [] });
        expect(clean).toMatchObject({ score: 100, tier: 'A' });
    });
});

describe('architecture aggregate (R2)', () => {
    it('is unchanged when an unscored component is added', () => {
        const scored = [scoreComponent(src({ nodeId: 'a' }), [finding({ nodeId: 'a', severity: 'error' })])];
        const unscored = scoreComponent(src({ nodeId: 'b' }), [], { evaluated: [], skipped: [] });
        expect(rollup([...scored, unscored])).toBe(rollup(scored));
    });

    it('reports skipped convention rules and keeps shared ones in an end-to-end scan', () => {
        const cursorRule = src({ nodeId: 'cursor::r', nodeType: 'subagent', source: { workspaceUri: 'w', providerId: 'cursor', nativeId: 'r' } });
        const report = scan([cursorRule], [], new Set(['cursor::r']), new Set(['n.md']), DEFAULT_OPTIMIZER_CONFIG);
        const component = report.components[0];
        expect(component.coverage.skipped.map(s => s.ruleId)).toEqual(expect.arrayContaining(['OPT-S01', 'OPT-S02', 'OPT-S05']));
        expect(component.coverage.evaluated).toContain('hygiene');
        expect(component.score).not.toBeNull();
        expect(report.scoredComponents).toBe(1);
    });

    it('scores nothing, and says so, when only inapplicable rules are registered', () => {
        const conventions = activeRules([]).filter(r => r.id.startsWith('OPT-S'));
        const report = scan([src({ source: { workspaceUri: 'w', providerId: 'copilot', nativeId: 'n' } })], [], new Set(['n']), new Set(['n.md']), DEFAULT_OPTIMIZER_CONFIG, new Set(), conventions);
        expect(report.architectureScore).toBeNull();
        expect(report.scoredComponents).toBe(0);
        expect(report.components[0].score).toBeNull();
    });
});

describe('corpus cohorts (T2)', () => {
    it('never calibrates one format against another format\'s components', () => {
        const owned = (providerId: string, i: number, tokens: number) => src({
            nodeId: `${providerId}::s${i}`, filePath: `${providerId}/s${i}.md`, tokenEstimate: tokens,
            source: { workspaceUri: 'w', providerId, nativeId: `s${i}` },
        });
        // Five small Harness SDD skills would make 2.5× their median (100) the threshold for every skill.
        const sources = [0, 1, 2, 3, 4].map(i => owned('harness-sdd', i, 100)).concat(owned('claude-code', 9, 600));
        const report = scan(sources, [], new Set(sources.map(s => s.nodeId)), new Set(sources.map(s => s.filePath)), DEFAULT_OPTIMIZER_CONFIG);
        // The Claude skill is judged against its own (too small) cohort: the absolute budget, not 250 tokens.
        expect(report.findings.filter(f => f.ruleId === 'OPT-B01' && f.nodeId === 'claude-code::s9')).toEqual([]);
        const big = owned('harness-sdd', 5, 600);
        const sdd = scan([...sources, big], [], new Set([...sources, big].map(s => s.nodeId)), new Set([...sources, big].map(s => s.filePath)), DEFAULT_OPTIMIZER_CONFIG);
        expect(sdd.findings.find(f => f.ruleId === 'OPT-B01' && f.nodeId === big.nodeId)?.detail).toContain('the median harness-sdd skill');
    });
});
