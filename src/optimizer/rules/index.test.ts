import { describe, it, expect } from 'vitest';
import { ALL_RULES, activeRules } from './index.js';

describe('rule registry (R7, R30)', () => {
    it('every rule id matches OPT-<F><NN> and is unique', () => {
        const ids = ALL_RULES.map(r => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
            expect(id).toMatch(/^OPT-[SBODHC]\d{2}$/);
        }
    });

    it('includes all nineteen shipped rules', () => {
        expect(ALL_RULES.map(r => r.id).sort()).toEqual([
            'OPT-B01',
            'OPT-B02',
            'OPT-B03',
            'OPT-C01',
            'OPT-C02',
            'OPT-D01',
            'OPT-D02',
            'OPT-H01',
            'OPT-H02',
            'OPT-H03',
            'OPT-O01',
            'OPT-O02',
            'OPT-O03',
            'OPT-S01',
            'OPT-S02',
            'OPT-S03',
            'OPT-S04',
            'OPT-S05',
            'OPT-S06',
        ]);
    });

    it('activeRules() filters out disabled rule ids', () => {
        const active = activeRules(['OPT-S01', 'OPT-H02']);
        expect(active.some(r => r.id === 'OPT-S01')).toBe(false);
        expect(active.some(r => r.id === 'OPT-H02')).toBe(false);
        expect(active.length).toBe(ALL_RULES.length - 2);
    });

    it('activeRules([]) returns every rule', () => {
        expect(activeRules([])).toHaveLength(ALL_RULES.length);
    });
});
