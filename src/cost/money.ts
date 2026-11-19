// FEAT-044 T3 — money estimates from a user-supplied price table (R7).
// Pure, and offline: no price ships with the extension and nothing is
// fetched. Each figure carries the price date and any calibration factor.

import type { CostReport } from './sessionCost.js';

export interface PriceTable {
    /** When the user took these prices (shown beside every figure). */
    date: string;
    models: Record<string, { inputPerMTok: number; outputPerMTok?: number; family?: string }>;
}

export interface MoneyEstimate {
    model: string;
    priceDate: string;
    /** Calibration factor applied for the model's family; 1 when none is configured. */
    factor: number;
    calibrated: boolean;
    sessionTokens: number;
    /** Estimated input cost of one session's baseline and catalog, in the table's currency. */
    perSession: number;
}

export function isPriceTable(value: unknown): value is PriceTable {
    if (!value || typeof value !== 'object') return false;
    const t = value as Partial<PriceTable>;
    return typeof t.date === 'string' && t.date.trim() !== '' && !!t.models && typeof t.models === 'object'
        && Object.values(t.models).every(m => m && typeof m.inputPerMTok === 'number' && m.inputPerMTok >= 0);
}

export function moneyEstimates(cost: CostReport, prices: unknown, calibration: Readonly<Record<string, number>> = {}): MoneyEstimate[] {
    if (!isPriceTable(prices)) return [];
    return Object.entries(prices.models).sort(([a], [b]) => a.localeCompare(b)).map(([model, price]) => {
        const configured = calibration[price.family ?? model];
        const calibrated = typeof configured === 'number' && configured > 0;
        const factor = calibrated ? configured : 1;
        const sessionTokens = Math.round(cost.sessionTotal * factor);
        return { model, priceDate: prices.date, factor, calibrated, sessionTokens, perSession: (sessionTokens * price.inputPerMTok) / 1_000_000 };
    });
}
