// Advisory rule helpers. FEAT-042: every check reads shared, provider-
// attributed evidence (evidence.ts), never one framework's file layout.
import type { AgenticProfile, MaturityLevel, SignalCategory, Suggestion } from './types.js';
import { evidenceOwners, hasEvidence, hasGovernedLifecycle, sharedCategories } from './evidence.js';

/** FEAT-036: exported so the SC rule family reuses the exact table shape. */
export interface SuggestionRule {
  id: string;
  condition: (profile: AgenticProfile) => boolean;
  build: (profile: AgenticProfile) => Omit<Suggestion, 'id'>;
}

/** Evidence for `cat` from unclaimed files or from any provider's resources (R1). */
export const hasCategory = (profile: AgenticProfile, cat: SignalCategory) => hasEvidence(profile, cat);

/** Unclaimed matches plus provider resources in `cat`. */
export function countCategory(profile: AgenticProfile, cat: SignalCategory): number {
  const files = profile.layers['2'].categories.find(c => c.category === cat)?.count ?? 0;
  return files + (profile.evidence ?? []).filter(e => e.category === cat).length;
}

export const activeCategoryCount = (profile: AgenticProfile) => sharedCategories(profile).size;

export const hasCLI = (profile: AgenticProfile) => profile.layers['1'].cliInstalls.length > 0;

/** Harness SDD resources are present (provider-specific rules only). */
export function hasHarness(profile: AgenticProfile): boolean {
  if (evidenceOwners(profile, 'agent-methodologies').includes('harness-sdd')) return true;
  return profile.layers['2'].categories.some(c => c.matches.some(m => m.matchedPattern === 'harness-agentic-json'));
}

/** Feature or spec records in any layout. */
export const hasSDD = (profile: AgenticProfile) => hasGovernedLifecycle(profile);

/** Rules kept in one tool's format: `.cursorrules`-style files or a single-tool provider's rules. */
export function hasToolSpecificRules(profile: AgenticProfile): boolean {
  const files = profile.layers['2'].categories.some(c => c.matches.some(m => m.matchedPattern === 'dot-rules-files'));
  return files || evidenceOwners(profile, 'rules').some(id => id === 'cursor' || id === 'windsurf');
}

const LEVELS: MaturityLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
export const currentLevel = (profile: AgenticProfile) => profile.maturity.level;
export const isAtOrBelow = (p: AgenticProfile, max: MaturityLevel) => LEVELS.indexOf(currentLevel(p)) <= LEVELS.indexOf(max);
export const isAtOrAbove = (p: AgenticProfile, min: MaturityLevel) => LEVELS.indexOf(currentLevel(p)) >= LEVELS.indexOf(min);
export function isBetween(p: AgenticProfile, min: MaturityLevel, max: MaturityLevel): boolean {
  return isAtOrAbove(p, min) && isAtOrBelow(p, max);
}
