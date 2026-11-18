import type { AgenticProfile, Suggestion, MaturityLevel } from './types.js';
// FEAT-036: supply-chain rule family (same table shape, merged below).
import { SC_RULES, expandStaleOverrideRules } from './supplyChainRules.js';
import type { SuggestionRule } from './ruleHelpers.js';
import { CORE_RULES } from './advisoryRules.js';
import { METHODOLOGY_RULES } from './methodologyRules.js';

export type { SuggestionRule } from './ruleHelpers.js';

const RULES: SuggestionRule[] = [...CORE_RULES, ...METHODOLOGY_RULES];

// ─── Priority comparator ────────────────────────────────────────────────────

const IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const EFFORT_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };
const LEVEL_ORDER: Record<MaturityLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };

function suggestionPriority(s: Suggestion): number[] {
  const impactRank = IMPACT_ORDER[s.impact] ?? 99;
  const effortRank = EFFORT_ORDER[s.effort] ?? 99;
  // Lower maturity first (help lower levels first) — but only as tiebreaker
  const minTriggerLevel = Math.min(...s.maturityTrigger.map(l => LEVEL_ORDER[l] ?? 99));
  return [impactRank, effortRank, minTriggerLevel];
}

function byPriority(a: Suggestion, b: Suggestion): number {
  const pa = suggestionPriority(a);
  const pb = suggestionPriority(b);
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate improvement suggestions for an AgenticProfile.
 *
 * @param profile       The scanned agentic profile
 * @param dismissedIds  Set of suggestion IDs that the user has dismissed (optional)
 * @returns             Sorted, deduped, maturity-gated Suggestion[]
 */
export function generate(
  profile: AgenticProfile,
  dismissedIds?: Set<string>,
): Suggestion[] {
  const dismissed = dismissedIds ?? new Set<string>();

  const suggestions: Suggestion[] = [];

  // FEAT-036: RULES ⊕ SC_RULES. The stale-override rules are expanded per
  // profile because their ids are stable per package (dismissal support);
  // the rest of the table is static like RULES.
  const allRules: SuggestionRule[] = [...RULES, ...SC_RULES, ...expandStaleOverrideRules(profile)];

  for (const rule of allRules) {
    if (dismissed.has(rule.id)) continue;

    try {
      if (rule.condition(profile)) {
        const base = rule.build(profile);
        suggestions.push({ id: rule.id, ...base });
      }
    } catch {
      // If a rule errors, skip it gracefully
    }
  }

  // Dedup by id (should never happen, but be safe)
  const seen = new Set<string>();
  const unique = suggestions.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  return unique.sort(byPriority);
}
