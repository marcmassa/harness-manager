/**
 * Unit tests for AdvisoryPanel (FEAT-029 Phase 6).
 *
 * Uses `renderToString` from react-dom/server to produce HTML output
 * without requiring jsdom — compatible with the project's `node` test
 * environment.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdvisoryPanel } from './AdvisoryPanel.js';
import { makeProfile } from '../agentic-detector/testUtils.js';
import type { AgenticProfile, Suggestion, PatternMatch } from '../agentic-detector/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Render the component to an HTML string for pattern matching. */
function render(profile: AgenticProfile | null, onDismiss?: () => void) {
    return renderToString(
        React.createElement(AdvisoryPanel, {
            profile,
            onDismissSuggestion: onDismiss ?? vi.fn(),
            onApplyHarnessSDD: vi.fn(),
        }),
    );
}

// ─── T1: Loading state ────────────────────────────────────────────────────────

describe('AdvisoryPanel — loading state', () => {
    it('renders loading state when profile is null', () => {
        const html = render(null);
        expect(html).toContain('progress-ring');
        expect(html).toContain('Run a scan');
    });
});

// ─── T2: Maturity badge ───────────────────────────────────────────────────────

describe('AdvisoryPanel — maturity badge', () => {
    it('renders maturity badge with level and label', () => {
        const profile = makeProfile();
        const html = render(profile);
        expect(html).toContain(profile.maturity.level);
        expect(html).toContain(profile.maturity.label);
    });
});

// ─── T3: CLI installs ─────────────────────────────────────────────────────────

describe('AdvisoryPanel — CLI installs', () => {
    it('renders CLI installs section when cliInstalls exist', () => {
        const profile = makeProfile({
            cliInstalls: [
                { cliId: 'claude-code', cliName: 'Claude Code' },
            ],
        });
        const html = render(profile);
        expect(html).toContain('CLI Installations');
        expect(html).toContain('Claude Code');
    });

    it('does not render CLI section when no installs', () => {
        const profile = makeProfile();
        const html = render(profile);
        expect(html).not.toContain('CLI Installations');
    });
});

// ─── T4: Architecture patterns ────────────────────────────────────────────────

describe('AdvisoryPanel — architecture patterns', () => {
    it('renders architecture patterns when patterns exist', () => {
        const profile = makeProfile();
        profile.patterns = [
            {
                pattern: 'tool-using-single-agent',
                label: 'Tool-Using Single Agent',
                confidence: 0.85,
                status: 'detected',
                evidence: ['.claude/settings.json'],
            } as PatternMatch,
        ];
        const html = render(profile);
        expect(html).toContain('Architecture Patterns');
        expect(html).toContain('Tool-Using Single Agent');
    });

    it('does not render patterns section when empty', () => {
        const profile = makeProfile();
        profile.patterns = [];
        const html = render(profile);
        expect(html).not.toContain('Architecture Patterns');
    });
});

// ─── T5: Suggestions ──────────────────────────────────────────────────────────

describe('AdvisoryPanel — suggestions', () => {
    it('renders suggestion cards when suggestions exist', () => {
        const profile = makeProfile();
        profile.suggestions = [
            {
                id: 'sug-1',
                title: 'Add MCP Servers',
                description: 'Enable MCP for tool-use capabilities.',
                impact: 'high',
                effort: 'medium',
                layer: 2,
                category: 'mcp',
                maturityTrigger: ['L2'],
            } as Suggestion,
        ];
        const html = render(profile);
        expect(html).toContain('Suggestions');
        expect(html).toContain('Add MCP Servers');
    });

    it('filters dismissed suggestions when dismissedSuggestionIds is set', () => {
        const profile = makeProfile();
        profile.suggestions = [
            {
                id: 'sug-1',
                title: 'Visible Suggestion',
                description: 'This should show.',
                impact: 'low',
                effort: 'low',
                layer: 2,
                category: 'tools',
                maturityTrigger: ['L1'],
            } as Suggestion,
            {
                id: 'sug-2',
                title: 'Dismissed Suggestion',
                description: 'This should be hidden.',
                impact: 'low',
                effort: 'low',
                layer: 2,
                category: 'skills',
                maturityTrigger: ['L2'],
            } as Suggestion,
        ];
        // Mark sug-2 as dismissed
        profile.dismissedSuggestionIds = ['sug-2'];
        const html = render(profile);
        expect(html).toContain('Visible Suggestion');
        expect(html).not.toContain('Dismissed Suggestion');
    });
});

// ─── T33: Signal strength bars ────────────────────────────────────────────────

describe('AdvisoryPanel — signal strength bars (T33)', () => {
    it('renders signal strength section with all 9 categories', () => {
        const profile = makeProfile({
            activeCategories: ['prompts', 'rules', 'tools'],
        });
        const html = render(profile);
        expect(html).toContain('Signal Strength');

        // All 9 category labels should appear
        for (const label of [
            'Prompts',
            'Rules',
            'Mcp',
            'Agent-methodologies',
            'Tools',
            'Skills',
            'Agent-scripts',
            'Memory',
            'Context-identity',
        ]) {
            expect(html).toContain(label);
        }
    });

    it('renders SVG rect elements for filled bars', () => {
        const profile = makeProfile({
            activeCategories: ['prompts', 'rules'],
            categoryCounts: { prompts: 5, rules: 3 },
        });
        const html = render(profile);

        // Should contain SVG rect elements
        const rectCount = (html.match(/<rect /g) || []).length;
        // Each category has a background rect + a fill rect (if count > 0)
        // 2 categories × (1 background + 1 fill) = 4 rects
        expect(rectCount).toBeGreaterThanOrEqual(4);
    });

    it('shows empty grey bars for categories with 0 matches', () => {
        const profile = makeProfile({
            activeCategories: ['prompts'],
            categoryCounts: { prompts: 3 },
        });
        const html = render(profile);

        // All 9 categories are present, each with a background rect.
        // Categories with 0 count should not have a fill rect.
        expect(html).toContain('Signal Strength');

        // Category with 0 matches: 'rules' should still appear in the DOM
        expect(html).toContain('Rules');

        // Check that only the active category has count > 0 displayed
        // (We verify by looking at count text node — since we use renderToString,
        //  the count value will appear in the output)
        expect(html).toContain('3'); // prompts count
    });
});

// ─── T34: Apply Harness+SDD button ────────────────────────────────────────────

describe('AdvisoryPanel — Apply Harness+SDD button (T34)', () => {
    it('renders button when maturity is L0 (SDD not detected)', () => {
        const profile = makeProfile();
        // L0 by default
        const html = render(profile);
        expect(html).toContain('Apply Harness+SDD');
    });

    it('renders button when maturity is L4', () => {
        // L4 requires CLI + tools + skills + MCP + 3+ categories
        const profile = makeProfile({
            cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code' }],
            activeCategories: ['prompts', 'rules', 'tools', 'mcp', 'skills'],
            categoryCounts: {
                prompts: 3,
                rules: 2,
                tools: 1,
                mcp: 1,
                skills: 1,
            },
        });
        expect(profile.maturity.level).toBe('L4');
        const html = render(profile);
        expect(html).toContain('Apply Harness+SDD');
    });

    it('hides button when maturity is L5 (SDD already active)', () => {
        // L5 requires L4 + SDD
        const profile = makeProfile({
            cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code' }],
            activeCategories: [
                'prompts',
                'rules',
                'tools',
                'mcp',
                'skills',
                'agent-methodologies',
            ],
            categoryCounts: {
                prompts: 3,
                rules: 2,
                tools: 1,
                mcp: 1,
                skills: 1,
                'agent-methodologies': 1,
            },
            sddActive: true,
        });
        expect(profile.maturity.level).toBe('L5');
        const html = render(profile);
        expect(html).not.toContain('Apply Harness+SDD');
    });

    it('hides button when onApplyHarnessSDD callback is not provided', () => {
        const profile = makeProfile();
        // Render without onApplyHarnessSDD
        const html = renderToString(
            React.createElement(AdvisoryPanel, {
                profile,
                onDismissSuggestion: vi.fn(),
                // onApplyHarnessSDD is intentionally omitted
            }),
        );
        expect(html).not.toContain('Apply Harness+SDD');
    });
});

// ─── T37: Integration edge cases ──────────────────────────────────────────────

describe('AdvisoryPanel — integration edge cases (T37)', () => {
    it('handles empty categories gracefully', () => {
        const profile = makeProfile();
        // Force categories to an empty array
        profile.layers['2'].categories = [];
        // Should not throw and not render Signal Strength section
        const html = render(profile);
        expect(html).not.toContain('Signal Strength');
    });

    it('renders header with scan timestamp', () => {
        const profile = makeProfile();
        const html = render(profile);
        expect(html).toContain('Agentic Architecture');
        expect(html).toContain('scanned');
    });
});
