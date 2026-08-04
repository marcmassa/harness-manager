// FEAT-034 — Component Optimizer — rule registry (design.md §D, R7, R30)
//
// Mirrors the `RULES: SuggestionRule[]` table pattern in
// src/agentic-detector/advisoryEngine.ts, so contributors meet one idiom.

import type { OptimizerRule } from '../types.js';
import { STRUCTURE_RULES } from './structure.js';
import { BUDGET_RULES } from './budget.js';
import { OVERLAP_RULES } from './overlap.js';
import { DRIFT_RULES } from './drift.js';
import { HYGIENE_RULES } from './hygiene.js';
import { CONSISTENCY_RULES } from './consistency.js';

export const ALL_RULES: readonly OptimizerRule[] = [
    ...STRUCTURE_RULES,
    ...BUDGET_RULES,
    ...OVERLAP_RULES,
    ...DRIFT_RULES,
    ...HYGIENE_RULES,
    ...CONSISTENCY_RULES,
];

// R7: stable rule identifiers, form OPT-<F><NN>, never reused for a
// different rule. Asserted at module load so a violation fails immediately
// (in tests, and at extension activation) rather than silently miscounting.
const RULE_ID_RE = /^OPT-[SBODHC]\d{2}$/;

(function assertRuleRegistryInvariants(): void {
    const seen = new Set<string>();
    for (const rule of ALL_RULES) {
        if (!RULE_ID_RE.test(rule.id)) {
            throw new Error(`Invalid OptimizerRule id "${rule.id}": must match ${RULE_ID_RE}`);
        }
        if (seen.has(rule.id)) {
            throw new Error(`Duplicate OptimizerRule id "${rule.id}"`);
        }
        seen.add(rule.id);
    }
})();

/** R30: rules whose id appears in `disabled` are skipped entirely. */
export function activeRules(disabled: readonly string[]): OptimizerRule[] {
    const disabledSet = new Set(disabled);
    return ALL_RULES.filter(rule => !disabledSet.has(rule.id));
}
