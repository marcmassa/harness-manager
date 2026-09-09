// FEAT-036 T10 — the SC supply-chain rule family.
// Same table shape as FEAT-029's RULES (design.md §"Rule family (SC)"):
// pure conditions over `profile.supplyChain`, deterministic builds, no
// vscode import, no LLM, no I/O. (R3, R9, R10, R14)

import type { SuggestionAction, MaturityLevel } from './types.js';
import type { SuggestionRule } from './advisoryEngine.js';
import type { AgenticProfile } from './types.js';
import type { SupplyChainReport } from '../supply-chain/types.js';
import {
  DEPENDABOT_TEMPLATE,
  DEPENDABOT_TEMPLATE_REL_PATH,
} from '../supply-chain/dependabotTemplate.js';

/** SC rules are workspace-level: they apply at any maturity. */
const ALL_LEVELS: MaturityLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

/** Stable per-package id for stale-override suggestions (dismissal-compatible). */
export function staleOverrideSuggestionId(name: string): string {
  return `sc-stale-override:${name}`;
}

/** SC-01 + SC-03: static table entries (ids independent of profile data). */
export const SC_RULES: SuggestionRule[] = [
  // SC-01 — no dependency-update bot configured in a Node workspace. (R3)
  {
    id: 'sc-add-update-bot',
    condition: p => {
      const sc = p.supplyChain;
      return !!sc && sc.hasPackageJson && !sc.botConfig.dependabotNpm && !sc.botConfig.renovate;
    },
    build: () => ({
      title: 'Add a dependency-update bot (Dependabot)',
      description:
        'This Node workspace has no Dependabot or Renovate configuration, so vulnerable ' +
        'dependencies never get automatic update PRs. Scaffold a vetted .github/dependabot.yml ' +
        '(npm + github-actions, weekly, grouped minor/patch, prod + dev).',
      impact: 'medium' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'supply-chain' as const,
      maturityTrigger: ALL_LEVELS,
      actions: [
        {
          id: 'create-dependabot-yml',
          label: 'Create .github/dependabot.yml',
          type: 'create-file',
          payload: {
            relPath: DEPENDABOT_TEMPLATE_REL_PATH,
            template: DEPENDABOT_TEMPLATE,
          },
        },
      ] satisfies SuggestionAction[],
    }),
  },

  // SC-03 — captured audit reports findings (low impact; nudges toward fixing).
  {
    id: 'sc-audit-findings',
    condition: p => {
      const audit = p.supplyChain?.audit;
      return !!audit && audit.state === 'captured' && audit.prodCount + audit.devCount > 0;
    },
    build: p => {
      const audit = (p.supplyChain as SupplyChainReport).audit;
      return {
        title: `npm audit reports ${audit.prodCount} production / ${audit.devCount} development findings`,
        description:
          'The last user-triggered npm audit found vulnerable dependencies. ' +
          'Run `npm audit fix` to apply non-breaking patches.',
        impact: 'low' as const,
        effort: 'low' as const,
        layer: 2 as const,
        category: 'supply-chain' as const,
        maturityTrigger: ALL_LEVELS,
        actions: [
          {
            id: 'run-audit-fix',
            label: 'Run npm audit fix',
            type: 'run-command',
            payload: { command: 'npm audit fix' },
          },
        ] satisfies SuggestionAction[],
      };
    },
  },
];

/**
 * SC-02 — one rule per stale security override (R9). The ids are stable
 * per package (`sc-stale-override:undici`) so dismissal works with the
 * existing dismissedSuggestionIds persistence. Deterministically ordered
 * by package name. (R14)
 */
export function expandStaleOverrideRules(profile: AgenticProfile): SuggestionRule[] {
  const audit = profile.supplyChain?.audit;
  if (!audit || audit.state !== 'captured') return [];

  return audit.staleOverrides.map(pin => ({
    id: staleOverrideSuggestionId(pin.name),
    condition: (p: AgenticProfile): boolean =>
      (p.supplyChain?.audit.staleOverrides ?? []).some(s => s.name === pin.name),
    build: () => ({
      title: `Stale security override: ${pin.name} pinned to ${pin.pinned}, patched in ${pin.patched}`,
      description:
        `package.json#overrides pins ${pin.name} at ${pin.pinned}, but the audit reports ` +
        `the vulnerability fixed in ${pin.patched}. Raise the override, then run ` +
        '`npm audit fix` (or check drift with `npm outdated`).',
      impact: 'high' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'supply-chain' as const,
      maturityTrigger: ALL_LEVELS,
      actions: [
        {
          id: 'run-audit-fix',
          label: 'Run npm audit fix',
          type: 'run-command',
          payload: { command: 'npm audit fix' },
        },
        {
          id: 'run-outdated',
          label: 'Run npm outdated',
          type: 'run-command',
          payload: { command: 'npm outdated' },
        },
      ] satisfies SuggestionAction[],
    }),
  }));
}
