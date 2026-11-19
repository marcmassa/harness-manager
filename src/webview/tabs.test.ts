// FEAT-047 R5 — the Specs Manager tab exists only with feature or spec data.
import { describe, expect, it } from 'vitest';
import { availableTabs, resolveTab } from './tabs.js';
import type { DashboardData } from '../types.js';

const data = (milestones: number, features = 0) => ({
    graph: { nodes: Array.from({ length: features }, (_, i) => ({ id: `f${i}`, type: 'feature', label: 'F', metadata: {} })), edges: [] },
    milestones: Array.from({ length: milestones }, (_, i) => ({ date: '—', featureId: `FEAT-${i}`, title: 't', status: 'PENDING', outcome: '' })),
}) as unknown as DashboardData;

describe('Dashboard tabs (FEAT-047 R5)', () => {
    it('hides the Specs Manager without milestones or feature nodes, from any provider', () => {
        expect(availableTabs(data(0))).toEqual(['whiteboard', 'advisory', 'optimizer']);
        expect(availableTabs(data(2))).toContain('timeline');
        expect(availableTabs(data(0, 1))).toContain('timeline');
    });

    it('falls back to the whiteboard for an unavailable restored or requested tab', () => {
        expect(resolveTab('timeline', data(0))).toBe('whiteboard');
        expect(resolveTab('timeline', data(1))).toBe('timeline');
        expect(resolveTab('advisory', data(0))).toBe('advisory');
        expect(resolveTab('nonsense', data(1))).toBe('whiteboard');
    });

    it('keeps a restored tab until the first data arrives', () => {
        expect(resolveTab('timeline', null)).toBe('timeline');
    });
});
