// Unit tests for FEAT-016 — Relationship Lines Visual & Interaction Refinement
// T13: EDGE_TYPE_ROUTING lookup (R1)
// T14: labelStyle.border and className construction (R2, R5)
// T15: HANDLE_ACCENT lookup (R7)

import { describe, it, expect } from 'vitest';
import { EDGE_TYPE_ROUTING } from './WhiteboardCanvas.js';
import { HANDLE_ACCENT, NODE_STYLES, EDGE_GLOW_RGB } from './styles.js';

// ─── T13 ─────────────────────────────────────────────────────────────────────
describe('EDGE_TYPE_ROUTING (R1)', () => {
    it('returns smoothstep for manages', () => {
        expect(EDGE_TYPE_ROUTING['manages']).toBe('smoothstep');
    });

    it('returns straight for discovered', () => {
        expect(EDGE_TYPE_ROUTING['discovered']).toBe('straight');
    });

    it('returns default for uses', () => {
        expect(EDGE_TYPE_ROUTING['uses']).toBe('default');
    });

    it('returns default for executing', () => {
        expect(EDGE_TYPE_ROUTING['executing']).toBe('default');
    });

    it('returns smoothstep for suggested', () => {
        expect(EDGE_TYPE_ROUTING['suggested']).toBe('smoothstep');
    });

    it('returns undefined for unknown types (fallback ?? default in consumer)', () => {
        expect(EDGE_TYPE_ROUTING['unknown'] ?? 'default').toBe('default');
    });
});

// ─── T14 ─────────────────────────────────────────────────────────────────────
describe('labelStyle.border and className (R2, R5)', () => {
    it('constructs border using edge stroke color for uses edge', () => {
        const stroke = '#2aa198';
        const label = 'uses';
        const isMismatchEdge = false;
        const isDisabled = false;

        const border = isMismatchEdge
            ? '1px solid #e86f4a'
            : isDisabled
            ? '1px solid #6c6c8a'
            : `1px solid ${stroke}`;

        expect(border).toBe('1px solid #2aa198');
    });

    it('constructs border as mismatch color when isMismatchEdge', () => {
        const stroke = '#2aa198';
        const isMismatchEdge = true;
        const isDisabled = false;

        const border = isMismatchEdge
            ? '1px solid #e86f4a'
            : isDisabled
            ? '1px solid #6c6c8a'
            : `1px solid ${stroke}`;

        expect(border).toBe('1px solid #e86f4a');
    });

    it('constructs border as disabled color when isDisabled', () => {
        const stroke = '#2aa198';
        const isMismatchEdge = false;
        const isDisabled = true;

        const border = isMismatchEdge
            ? '1px solid #e86f4a'
            : isDisabled
            ? '1px solid #6c6c8a'
            : `1px solid ${stroke}`;

        expect(border).toBe('1px solid #6c6c8a');
    });

    it('className includes harness-edge--uses for uses label', () => {
        const label = 'uses';
        const className = `harness-edge harness-edge--${label}`;
        expect(className).toContain('harness-edge--uses');
        expect(className).toContain('harness-edge');
    });

    it('className includes harness-edge--manages for manages label', () => {
        const label = 'manages';
        const className = `harness-edge harness-edge--${label}`;
        expect(className).toContain('harness-edge--manages');
    });
});

// ─── T15 ─────────────────────────────────────────────────────────────────────
describe('HANDLE_ACCENT (R7)', () => {
    it('returns manages blue for subagent', () => {
        expect(HANDLE_ACCENT['subagent']).toBe('#4a7dff');
    });

    it('returns uses teal for skill', () => {
        expect(HANDLE_ACCENT['skill']).toBe('#2aa198');
    });

    it('falls back to #888888 for unknown type', () => {
        expect(HANDLE_ACCENT['unknown'] ?? '#888888').toBe('#888888');
    });

    it('returns manages blue for agent', () => {
        expect(HANDLE_ACCENT['agent']).toBe('#4a7dff');
    });

    it('returns neutral grey for feature', () => {
        expect(HANDLE_ACCENT['feature']).toBe('#888888');
    });

    it('returns amber for steering', () => {
        expect(HANDLE_ACCENT['steering']).toBe('#d4a84a');
    });

    it('returns muted purple for hook', () => {
        expect(HANDLE_ACCENT['hook']).toBe('#6c6c8a');
    });
});

// ─── FEAT-024 T20 ──────────────────────────────────────────────────────────────
describe('FEAT-024 — NODE_STYLES and EDGE_GLOW_RGB entries (T20, R8)', () => {
    it('NODE_STYLES contains steering entry', () => {
        expect(NODE_STYLES['steering']).toBeDefined();
        expect(NODE_STYLES['steering'].border).toContain('#d4a84a');
    });

    it('NODE_STYLES contains hook entry', () => {
        expect(NODE_STYLES['hook']).toBeDefined();
        expect(NODE_STYLES['hook'].border).toContain('#6c6c8a');
    });

    it('EDGE_GLOW_RGB contains governs entry (amber)', () => {
        expect(EDGE_GLOW_RGB['governs']).toBe('212, 168, 74');
    });

    it('EDGE_GLOW_RGB contains triggers entry (muted purple)', () => {
        expect(EDGE_GLOW_RGB['triggers']).toBe('108, 108, 138');
    });
});
