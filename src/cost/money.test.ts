// FEAT-044 T3 — money estimates (R7).
import { describe, expect, it } from 'vitest';
import { moneyEstimates } from './money.js';
import type { CostReport } from './sessionCost.js';

const cost: CostReport = { owners: [], sessionTotal: 10_000, unpricedCount: 0, unpricedTokens: 0 };

describe('money estimates (R7)', () => {
    it('shows nothing without a price table: no defaults ship', () => {
        expect(moneyEstimates(cost, undefined)).toEqual([]);
        expect(moneyEstimates(cost, { models: { m: { inputPerMTok: 3 } } })).toEqual([]); // no date
    });

    it('labels each estimate with its price date and calibration factor', () => {
        const prices = { date: '2026-11-01', models: { 'model-a': { inputPerMTok: 3, family: 'a' }, 'model-b': { inputPerMTok: 1 } } };
        expect(moneyEstimates(cost, prices, { a: 1.2 })).toEqual([
            { model: 'model-a', priceDate: '2026-11-01', factor: 1.2, calibrated: true, sessionTokens: 12_000, perSession: 0.036 },
            { model: 'model-b', priceDate: '2026-11-01', factor: 1, calibrated: false, sessionTokens: 10_000, perSession: 0.01 },
        ]);
    });

    it('never fetches anything: the module is pure', async () => {
        const src = (await import('node:fs')).readFileSync(new URL('./money.ts', import.meta.url), 'utf8');
        expect(src).not.toMatch(/fetch\(|https?:\/\/|require\(|from 'vscode'/);
    });
});
