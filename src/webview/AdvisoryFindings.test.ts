// FEAT-042 T2 (R2, R4) — Advisory shows whose finding it is, its evidence,
// what was evaluated, and which maturity inputs were not assessed.
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdvisoryPanel } from './AdvisoryPanel.js';
import { makeProfile } from '../agentic-detector/testUtils.js';
import type { AgenticProfile, Suggestion } from '../agentic-detector/types.js';

const render = (profile: AgenticProfile) => renderToString(React.createElement(AdvisoryPanel, {
    profile, onDismissSuggestion: vi.fn(), onApplyHarnessSDD: vi.fn(),
}));

const suggestion = (over: Partial<Suggestion>): Suggestion => ({
    id: 'x', title: 'A finding', description: 'Why it matters.', impact: 'medium', effort: 'low',
    layer: 2, category: 'rules', maturityTrigger: ['L2'], ...over,
});

describe('Advisory findings (R2)', () => {
    it('names the provider and the source files of a provider finding', () => {
        const profile = makeProfile();
        profile.suggestions = [suggestion({
            id: 'migrate-to-steering@cursor', ruleId: 'migrate-to-steering',
            scope: { kind: 'provider', providerId: 'cursor' },
            evidence: [{ providerId: 'cursor', nodeId: 'cursor::rule', sourceUri: 'file:///w/.cursor/rules/style.mdc' }],
            reason: 'rules in a single-tool format',
        })];
        const html = render(profile);
        expect(html).toContain('data-finding-scope="provider"');
        expect(html).toContain('Cursor');
        expect(html).toContain('rules/style.mdc');
        expect(html).toContain('Based on: rules in a single-tool format');
    });

    it('labels a finding without provider evidence as workspace-wide', () => {
        const profile = makeProfile();
        profile.suggestions = [suggestion({ id: 'use-skill-files', scope: { kind: 'workspace' }, evidence: [] })];
        expect(render(profile)).toContain('Workspace-wide');
    });
});

describe('Maturity inputs (R4)', () => {
    it('lists the inputs the assessment could not use', () => {
        const profile = makeProfile();
        profile.maturity = { ...profile.maturity, unavailableInputs: ['Skills: no file or provider evidence found', 'Agent CLI: no configuration found'] };
        const html = render(profile);
        expect(html).toContain('Not assessed (2)');
        expect(html).toContain('Skills: no file or provider evidence found');
    });
});
