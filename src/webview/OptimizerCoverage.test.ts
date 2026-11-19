// FEAT-043 T2 (R2–R4) — the panel shows coverage beside the score.
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OptimizerPanel } from './OptimizerPanel.js';
import { CoverageNote } from './ComponentExpansion.js';
import { averageDimensions } from './optimizerCoverage.js';
import type { ComponentScore, OptimizerReport } from '../optimizer/types.js';

const strip = (html: string) => html.replace(/<!-- -->/g, '');
const component = (over: Partial<ComponentScore>): ComponentScore => ({
    nodeId: 'n', nodeType: 'skill', label: 'lint', score: 90, tier: 'A', tokenEstimate: 10, findingCount: 0,
    dimensions: { structure: 90, clarity: null, budget: 90, integration: null, hygiene: 90, consistency: null },
    coverage: { evaluated: ['structure', 'budget', 'hygiene'], skipped: [] }, ...over,
});
const report = (components: ComponentScore[], architectureScore: number | null): OptimizerReport => ({
    ok: true, scanTimestamp: 1, architectureScore, scoredComponents: components.filter(c => c.score !== null).length,
    totalComponents: components.length, truncated: false, components, findings: [], dismissedCount: 0,
    findingCounts: { bySeverity: { error: 0, warning: 0, info: 0 }, byDimension: { structure: 0, clarity: 0, budget: 0, integration: 0, hygiene: 0, consistency: 0 } },
});
const render = (r: OptimizerReport) => strip(renderToString(React.createElement(OptimizerPanel, {
    report: r, isScanning: false, enabled: true, onOpenSettings: vi.fn(), onRescan: vi.fn(), onApplyFix: vi.fn(), onDismissFinding: vi.fn(), onRestoreFindings: vi.fn(), onOpenFile: vi.fn(),
} as never)));

describe('Optimizer coverage (R2, R3)', () => {
    it('shows an unscored component and an unscored architecture as such, not as 0', () => {
        const unscored = component({ nodeId: 'u', label: 'rule', score: null, tier: null, coverage: { evaluated: [], skipped: [] },
            dimensions: { structure: null, clarity: null, budget: null, integration: null, hygiene: null, consistency: null } });
        const html = render(report([unscored], null));
        expect(html).toContain('Unscored');
        expect(html).toContain('—');
        expect(html).toContain('0/6');
    });

    it('shows how many dimensions a scored component evaluated', () => {
        expect(render(report([component({})], 90))).toContain('3/6');
    });

    it('lists the rules that were not evaluated and why', () => {
        const html = strip(renderToString(React.createElement(CoverageNote, { component: component({
            coverage: { evaluated: ['hygiene'], skipped: [{ ruleId: 'OPT-S02', reason: 'claude-code does not document the "nameMatchesDirectory" convention for subagent components' }] },
        }) })));
        expect(html).toContain('Evaluated 1 of 6 dimensions (hygiene)');
        expect(html).toContain('Not evaluated: 1 rule');
        expect(html).toContain('OPT-S02');
        expect(html).toContain('nameMatchesDirectory');
    });

    it('averages each radar axis over the components that evaluated it', () => {
        const a = component({ dimensions: { structure: 80, clarity: null, budget: 100, integration: null, hygiene: 60, consistency: null } });
        const b = component({ dimensions: { structure: 100, clarity: null, budget: null, integration: null, hygiene: 100, consistency: null } });
        expect(averageDimensions([a, b])).toEqual({ structure: 90, clarity: null, budget: 100, integration: null, hygiene: 80, consistency: null });
    });
});

describe('unscored architecture (FEAT-043 review)', () => {
    it('names no weakest dimension when nothing was evaluated', async () => {
        const { weakestDimension } = await import('./optimizerParts.js');
        expect(weakestDimension({ structure: null, clarity: null, budget: null, integration: null, hygiene: null, consistency: null })).toBe('—');
        expect(weakestDimension({ structure: 50, clarity: null, budget: 90, integration: null, hygiene: null, consistency: null })).toBe('Structure');
    });
});
