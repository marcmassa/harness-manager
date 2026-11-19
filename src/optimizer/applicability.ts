// FEAT-043 T1 — which rules apply to which component (R1).
// Pure: no vscode import. One rule table, one input prerequisite per rule.
// A shared rule runs on any readable source; a convention rule runs only
// where the component's owning format documents that convention.

import type { ComponentSource, OptimizableType } from './types.js';

/** Conventions a native format may document for its components. */
export type ConventionKey =
    | 'frontmatter'          // the file must start with a YAML frontmatter block
    | 'nameMatchesDirectory' // `<name>/SKILL.md`: the folder is the component's name
    | 'description'          // a description is required, within the format's bounds
    | 'triggerMarkers'       // the description must say when to load the component
    | 'requiredSections'     // named `##` sections are required
    | 'hookContract'         // hooks declare an event and a script; steering declares its scope
    | 'explicitSkillLinks'   // skills, roles and steering connect only through declared links
    | 'onTriggerAlternative'; // FEAT-044: the format can load an always resource on demand

export type RuleRequirement = { kind: 'shared' } | { kind: 'convention'; convention: ConventionKey };

export const RULE_REQUIREMENTS: Readonly<Record<string, RuleRequirement>> = {
    'OPT-S01': { kind: 'convention', convention: 'frontmatter' },
    'OPT-S02': { kind: 'convention', convention: 'nameMatchesDirectory' },
    'OPT-S03': { kind: 'convention', convention: 'description' },
    'OPT-S04': { kind: 'convention', convention: 'triggerMarkers' },
    'OPT-S05': { kind: 'convention', convention: 'requiredSections' },
    'OPT-S06': { kind: 'convention', convention: 'hookContract' },
    'OPT-B01': { kind: 'shared' },
    'OPT-B02': { kind: 'shared' },
    'OPT-B03': { kind: 'shared' },
    'OPT-H01': { kind: 'shared' },
    'OPT-H02': { kind: 'shared' },
    'OPT-H03': { kind: 'shared' },
    'OPT-D01': { kind: 'shared' },
    'OPT-D02': { kind: 'shared' },
    'OPT-O01': { kind: 'shared' },
    'OPT-O02': { kind: 'convention', convention: 'explicitSkillLinks' },
    'OPT-O03': { kind: 'shared' },
    'OPT-C01': { kind: 'shared' },
    'OPT-C02': { kind: 'shared' },
    // FEAT-044: cost rules read owner-declared load modes, so they need no format convention,
    // except K03, which only formats that offer an on-trigger form can act on.
    'OPT-K01': { kind: 'shared' },
    'OPT-K02': { kind: 'shared' },
    'OPT-K03': { kind: 'convention', convention: 'onTriggerAlternative' },
};

type Conventions = Partial<Record<ConventionKey, readonly OptimizableType[]>>;

/**
 * Conventions each built-in format documents. A format absent here (Cursor,
 * Copilot, OpenCode, Windsurf, AGENTS.md, workspace profiles, companions)
 * declares none, so only shared rules run on its components.
 *
 * - Harness SDD: `SKILL.md`/`SUBAGENT.md` in a folder named after the
 *   component, frontmatter with name and description, usage and role
 *   sections, hooks with event and script, steering with `applies_to`, and
 *   skills linked to roles through `skills[]`.
 * - Claude Code: subagents and skills carry `name`/`description`
 *   frontmatter; skills live in `<name>/SKILL.md` and load by description.
 * - Kiro: skills follow the same `<name>/SKILL.md` contract.
 */
export const PROVIDER_CONVENTIONS: Readonly<Record<string, Conventions>> = {
    'harness-sdd': {
        // The primary agent is typed `agent` but is a SUBAGENT.md (see AGENT_FILE below).
        frontmatter: ['skill', 'subagent', 'steering', 'agent'],
        nameMatchesDirectory: ['skill', 'subagent'],
        description: ['skill', 'subagent', 'agent'],
        triggerMarkers: ['skill'],
        requiredSections: ['skill', 'subagent'],
        hookContract: ['hook', 'steering'],
        explicitSkillLinks: ['skill', 'subagent', 'steering'],
        onTriggerAlternative: ['steering'],
    },
    cursor: { onTriggerAlternative: ['agent', 'subagent'] },
    copilot: { onTriggerAlternative: ['agent', 'subagent'] },
    'claude-code': {
        frontmatter: ['subagent', 'skill'],
        nameMatchesDirectory: ['skill'],
        description: ['subagent', 'skill'],
        triggerMarkers: ['skill'],
    },
    kiro: {
        onTriggerAlternative: ['steering'],
        frontmatter: ['skill'],
        nameMatchesDirectory: ['skill'],
        description: ['skill'],
        triggerMarkers: ['skill'],
    },
};

/**
 * Where a format's `agent` node is a real component file. Harness SDD's
 * synthetic manifest root is not; its primary agent's SUBAGENT.md is.
 */
const AGENT_FILE: Readonly<Record<string, RegExp>> = { 'harness-sdd': /(?:^|\/)SUBAGENT\.md$/ };

export interface Applicability {
    applies: boolean;
    /** Why a rule was skipped, shown as missing evidence (R3). */
    reason?: string;
}

export function ownerOf(source: ComponentSource): string | undefined {
    return source.source?.providerId;
}

/** Whether `ruleId` applies to `source`, and why not when it does not. */
export function applicability(ruleId: string, source: ComponentSource): Applicability {
    const requirement = RULE_REQUIREMENTS[ruleId] ?? { kind: 'shared' };
    if (requirement.kind === 'shared') return { applies: true };
    const owner = ownerOf(source);
    const types = owner ? PROVIDER_CONVENTIONS[owner]?.[requirement.convention] : undefined;
    const fileOk = !(owner && AGENT_FILE[owner] && source.nodeType === 'agent') || AGENT_FILE[owner].test(source.filePath);
    if (types?.includes(source.nodeType) && fileOk) return { applies: true };
    return {
        applies: false,
        reason: `${owner ?? 'Unknown owner'} does not document the "${requirement.convention}" convention for ${source.nodeType} components`,
    };
}
