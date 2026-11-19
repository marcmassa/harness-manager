// FEAT-044 T2 — session cost per owner (R4, R5, R6, R10).
import { describe, expect, it } from 'vitest';
import { calibrationFor, computeSessionCost, type CostSource } from './sessionCost.js';

const s = (owner: string, nodeId: string, loadMode: CostSource['loadMode'], tokens: number, descriptionTokens = 0): CostSource =>
    ({ owner, nodeId, label: nodeId, loadMode, tokens, descriptionTokens });

describe('session cost (R4)', () => {
    it('sums baseline, catalog and on-demand per owner', () => {
        const report = computeSessionCost([
            s('claude-code', 'CLAUDE.md', 'always', 800),
            s('claude-code', 'lint', 'on-trigger', 600, 20),
            s('claude-code', 'reviewer', 'delegated', 900),
            s('harness-sdd', 'kiss', 'always', 300),
            s('harness-sdd', 'on-save', 'on-event', 50),
            s('copilot', 'review.prompt', 'manual', 120),
        ]);
        const claude = report.owners.find(o => o.owner === 'claude-code')!;
        expect(claude).toMatchObject({ baseline: 800, catalog: 20, evaluated: true });
        expect(claude.onDemand.map(r => [r.nodeId, r.mode, r.tokens])).toEqual([['lint', 'on-trigger', 600], ['reviewer', 'delegated', 900]]);
        expect(report.owners.find(o => o.owner === 'harness-sdd')).toMatchObject({ baseline: 300, catalog: 0, onDemand: [] });
        expect(report.owners.find(o => o.owner === 'copilot')!.onDemand[0]).toMatchObject({ mode: 'manual', tokens: 120 });
        expect(report.sessionTotal).toBe(800 + 20 + 300);
    });
});

describe('unknown is unpriced (R5)', () => {
    it('lists unknown resources with their estimate and keeps them out of every total', () => {
        const report = computeSessionCost([s('acme', 'a', 'always', 100), s('acme', 'b', 'unknown', 400)]);
        expect(report.owners[0].unpriced).toEqual([{ nodeId: 'b', label: 'b', sourceUri: undefined, tokens: 400 }]);
        expect(report.owners[0].baseline).toBe(100);
        expect(report.sessionTotal).toBe(100);
        expect(report).toMatchObject({ unpricedCount: 1, unpricedTokens: 400 });
    });
});

describe('cost coverage (R10)', () => {
    it('reports a provider with no declared mode as unevaluated and excludes it from totals', () => {
        const report = computeSessionCost([s('team-guides', 'x', 'unknown', 500), s('claude-code', 'CLAUDE.md', 'always', 200)]);
        const team = report.owners.find(o => o.owner === 'team-guides')!;
        expect(team).toMatchObject({ evaluated: false, baseline: 0, missingEvidence: expect.stringContaining('declares') });
        expect(report.sessionTotal).toBe(200);
    });
});

describe('calibration (R6)', () => {
    it('applies a factor only when one is configured for the selected family', () => {
        const sources = [s('claude-code', 'CLAUDE.md', 'always', 1000)];
        expect(computeSessionCost(sources).sessionTotal).toBe(1000);
        expect(computeSessionCost(sources).calibration).toBeUndefined();
        const cal = calibrationFor('claude', { claude: 1.15 });
        expect(computeSessionCost(sources, cal)).toMatchObject({ sessionTotal: 1150, calibration: { family: 'claude', factor: 1.15 } });
        expect(calibrationFor('gpt', { claude: 1.15 })).toBeUndefined();
        expect(calibrationFor('claude', { claude: 0 })).toBeUndefined();
        expect(calibrationFor(undefined, { claude: 1.1 })).toBeUndefined();
    });
});

describe('cost inputs from loaded components', () => {
    it('keeps readable, owned components and estimates their descriptions', async () => {
        const { costSourcesFrom } = await import('./costSources.js');
        const base = { nodeType: 'skill' as const, label: 'lint', filePath: 'a.md', raw: '', body: '', pathKind: 'file' as const, tokenEstimate: 300 };
        const sources = costSourcesFrom([
            { ...base, nodeId: 'a', exists: true, frontmatter: { description: 'Use when code changes.' }, source: { workspaceUri: 'w', providerId: 'claude-code', nativeId: 'a', loadMode: 'on-trigger' } },
            { ...base, nodeId: 'b', exists: false, frontmatter: {}, source: { workspaceUri: 'w', providerId: 'claude-code', nativeId: 'b' } },
            { ...base, nodeId: 'c', exists: true, frontmatter: {} },
        ]);
        expect(sources).toEqual([expect.objectContaining({ nodeId: 'a', owner: 'claude-code', loadMode: 'on-trigger', tokens: 300, descriptionTokens: 6 })]);
    });
});
