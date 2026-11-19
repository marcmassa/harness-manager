// FEAT-044 T3 — the cost section and read-only actions in the panel (R5, R7, R9, R10).
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CostSection } from './CostSection.js';
import { ComponentExpansion } from './ComponentExpansion.js';
import type { CostSection as Cost } from '../cost/costSection.js';

const strip = (html: string) => html.replace(/<!-- -->/g, '');

describe('CostSection', () => {
    const cost: Cost = {
        sessionTotal: 1020, unpricedCount: 1, unpricedTokens: 500,
        owners: [
            { owner: 'claude-code', baseline: 1000, catalog: 20, onDemand: [{ nodeId: 'lint', label: 'lint', tokens: 600, mode: 'on-trigger' }], unpriced: [], evaluated: true },
            { owner: 'team-guides', baseline: 0, catalog: 0, onDemand: [], unpriced: [{ nodeId: 'g', label: 'g', tokens: 500 }], evaluated: false, missingEvidence: 'no resource of this provider declares when it is loaded' },
        ],
        money: [{ model: 'm', priceDate: '2026-11-01', factor: 1, calibrated: false, sessionTokens: 1020, perSession: 0.00306 }],
    };

    it('shows per-owner cost, unevaluated owners, unpriced resources and labelled money', () => {
        const html = strip(renderToString(React.createElement(CostSection, { cost })));
        expect(html).toContain('Context cost per session: ~1,020 tok (estimate)');
        expect(html).toContain('Claude Code: always ~1,000 tok · catalog ~20 tok · on demand 1 item (~600 tok)');
        expect(html).toContain('team-guides: not evaluated — no resource of this provider declares when it is loaded');
        expect(html).toContain('unpriced 1 (~500 tok, load mode unknown)');
        expect(html).toContain('prices as of 2026-11-01; calibration ×1, none configured');
    });
});

describe('read-only findings (R9)', () => {
    it('offers no edit action on a resource the host would not let you edit', () => {
        const render = (canEdit: boolean) => strip(renderToString(React.createElement(ComponentExpansion, {
            canEdit: () => canEdit, onApplyFix: vi.fn(), onDismissFinding: vi.fn(), onOpenFile: vi.fn(), chatHostName: 'Chat', assistStates: {},
            onAiRefine: vi.fn(), onDelegate: vi.fn(), onHandoffToChat: vi.fn(), showRefine: true, showDelegate: true, showHandoff: true,
            component: { nodeId: 'g', nodeType: 'agent', label: 'g', score: 90, tier: 'A', tokenEstimate: 1, findingCount: 1,
                dimensions: { structure: null, clarity: null, budget: 90, integration: null, hygiene: null, consistency: null }, coverage: { evaluated: ['budget'], skipped: [] } },
            findings: [{ ruleId: 'OPT-K01', nodeId: 'g', nodeType: 'agent', filePath: 'AGENTS.md', severity: 'warning', dimension: 'budget', title: 'Dup', detail: 'd',
                fix: { type: 'set-frontmatter-field', label: 'Fix', payload: {} } }],
        } as never)));
        const ro = render(false);
        expect(ro).toContain('Read-only for its owner');
        expect(ro).not.toContain('AI refine');
        expect(ro).not.toContain('Delegate…');
        expect(ro).not.toContain('Fix…');
        expect(render(true)).toContain('AI refine');
    });
});
