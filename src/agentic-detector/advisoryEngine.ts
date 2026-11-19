import type { AgenticProfile, Suggestion, SuggestionAction, MaturityLevel } from './types.js';
import { requestForAction } from '../operations/operations.js';
// FEAT-036: supply-chain rule family (same table shape, merged below).
import { SC_RULES, expandStaleOverrideRules } from './supplyChainRules.js';
import type { SuggestionRule } from './ruleHelpers.js';
import { CORE_RULES } from './advisoryRules.js';
import { METHODOLOGY_RULES } from './methodologyRules.js';
import { classifyRule } from './ruleScopes.js';

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

type Instance = { id: string; scope: NonNullable<Suggestion['scope']> };

/** The owner-qualified instances of one rule (R2, R7). */
function instancesOf(ruleId: string, profile: AgenticProfile): Instance[] {
  const c = classifyRule(ruleId);
  const provider = (providerId: string): Instance => ({ id: `${ruleId}@${providerId}`, scope: { kind: 'provider', providerId } });
  if (c.scope.kind === 'provider') return [provider(c.scope.providerId)];
  if (c.perOwner) {
    const { owners, workspace } = c.perOwner(profile);
    const all = owners.map(provider);
    if (workspace || all.length === 0) all.unshift({ id: ruleId, scope: { kind: 'workspace' } });
    return all;
  }
  return [{ id: ruleId, scope: { kind: 'workspace' } }];
}

/** Provider resources behind a finding: its owner's, or every provider's in its category. */
function evidenceFor(profile: AgenticProfile, base: Omit<Suggestion, 'id'>, scope: Instance['scope']) {
  return (profile.evidence ?? [])
    .filter(e => (scope.kind === 'provider' ? e.providerId === scope.providerId : true) && e.category === base.category)
    .slice(0, 5)
    .map(({ providerId, nodeId, sourceUri }) => ({ providerId, nodeId, sourceUri }));
}

/** Providers present: what detection found (as the gate sees it), else attributed sources. */
function presentProviders(profile: AgenticProfile): Set<string> {
  if (profile.detectedProviders) return new Set(profile.detectedProviders);
  return new Set([...(profile.sources ?? []), ...(profile.evidence ?? [])].map(s => s.providerId));
}

/**
 * R5: offer only actions the present harness supports. Harness SDD scaffolds
 * are offered inside a Harness SDD harness or in a workspace with no harness
 * (an explicit adoption), never inside another provider's harness. A file
 * that is one provider's entry point is not offered once that provider exists.
 */
function offered(action: SuggestionAction, present: Set<string>): boolean {
  const request = requestForAction(action);
  if (request?.adoptFormat) return present.size === 0 || present.has(request.adoptFormat);
  return true;
}

/**
 * Generate maturity-gated, owner-qualified suggestions.
 *
 * A workspace-wide finding keeps its rule ID; a provider's finding is
 * `<ruleId>@<providerId>`. Dismissed IDs are matched exactly.
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
  const present = presentProviders(profile);

  for (const rule of allRules) {
    try {
      if (!rule.condition(profile)) continue;
      // Stored IDs are matched verbatim; pre-FEAT-042 bare IDs are migrated once (dismissals.ts).
      for (const { id, scope } of instancesOf(rule.id, profile)) {
        if (dismissed.has(id)) continue;
        const built = rule.build(profile);
        const actions = built.actions?.filter(a => offered(a, present));
        const base = { ...built, ...(built.actions ? { actions } : {}) };
        suggestions.push({
          id, ...base, ruleId: rule.id, scope,
          evidence: evidenceFor(profile, base, scope),
          reason: classifyRule(rule.id).evidence,
        });
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
