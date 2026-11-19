// FEAT-044 T3 — the Optimizer report's cost section (R4–R7, R10).
// Pure apart from the settings reader it is handed; nothing leaves the machine.
import type { ComponentSource } from '../optimizer/types.js';
import { costSourcesFrom } from './costSources.js';
import { computeSessionCost, type CostReport } from './sessionCost.js';
import { moneyEstimates, type MoneyEstimate } from './money.js';

export interface CostSection extends CostReport {
    money: MoneyEstimate[];
    /** FEAT-044 R11: the Dashboard's own model usage in this workspace. */
    inference?: import('./inferenceLedger.js').InferenceSummary;
}

interface SettingsReader {
    get<T>(section: string, defaultValue: T): T;
}

/**
 * Token figures stay uncalibrated estimates. Calibration applies only inside
 * a money estimate whose model family has a configured factor (R6), and every
 * estimate names that factor and the price date (R7).
 */
export function buildCostSection(sources: readonly ComponentSource[], settings: SettingsReader): CostSection {
    const cost = computeSessionCost(costSourcesFrom(sources));
    const calibration = settings.get<Record<string, number>>('cost.calibration', {});
    const prices = settings.get<unknown>('cost.prices', undefined);
    return { ...cost, money: moneyEstimates(cost, prices, calibration) };
}
