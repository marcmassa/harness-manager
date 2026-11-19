// FEAT-042 T1 — classification of every Advisory rule (R2, R5).
// `shared`: the same finding for every layout, from shared evidence.
// `provider`: about one provider's own format; shown with that provider.
// `optional`: an integration outside harness structure.
// `evidence` names the inputs a rule needs, so a missing input reads as
// "unavailable" rather than as a defect of the workspace (R4).

import type { AgenticProfile } from './types.js';
import { evidenceOwners } from './evidence.js';

export type RuleScope = { kind: 'shared' } | { kind: 'optional' } | { kind: 'provider'; providerId: string };

export interface RuleClassification {
    scope: RuleScope;
    evidence: string;
    /**
     * Instantiate once per owning provider: each owner's finding is then
     * dismissed and acted on independently (R7). `workspace` adds a
     * workspace-wide instance for unclaimed files.
     */
    perOwner?: (profile: AgenticProfile) => { owners: string[]; workspace: boolean };
}

const shared = (evidence: string): RuleClassification => ({ scope: { kind: 'shared' }, evidence });
const provider = (providerId: string, evidence: string): RuleClassification => ({ scope: { kind: 'provider', providerId }, evidence });

export const RULE_CLASSIFICATION: Readonly<Record<string, RuleClassification>> = {
    'organize-prompts': shared('prompt files or provider prompts'),
    'organize-rules': shared('rule files or provider steering'),
    'cli-without-impl': shared('agent CLI configuration; no instructions or rules'),
    'impl-without-cli': shared('structured resources; no agent CLI configuration'),
    'add-mcp': shared('agent CLI, tool definitions, no MCP configuration'),
    'migrate-to-steering': {
        ...shared('rules in a single-tool format'),
        perOwner: p => ({
            owners: evidenceOwners(p, 'rules').filter(id => id === 'cursor' || id === 'windsurf'),
            workspace: p.layers['2'].categories.some(c => c.matches.some(m => m.matchedPattern === 'dot-rules-files')),
        }),
    },
    'mcp-without-agents': shared('MCP configuration, no agent scripts'),
    'tools-without-skills': shared('tool definitions, no skills'),
    'split-into-subagents': shared('tool definitions and agent scripts'),
    'extract-shared-prompts': shared('two or more agent scripts and prompts'),
    'add-memory-layer': shared('L4 maturity, no memory files'),
    'add-context-identity': shared('L3–L4 maturity, no project instructions'),
    'adopt-sdd': shared('no feature registry or spec documents'),
    'ready-for-sdd': shared('L4 maturity, no feature registry or spec documents'),
    'l5-incomplete': shared('L5 maturity with an inactive lifecycle'),
    'no-signals-detected': shared('no evidence at all'),
    'structure-scattered-files': shared('one or two evidence categories at L1'),
    'harness-without-sdd': provider('harness-sdd', 'Harness SDD resources, no lifecycle records'),
    'add-claude-md': provider('claude-code', 'Claude Code configuration without Claude Code instructions'),
    'add-agent-readme': shared('agent scripts, no project instructions'),
    'use-skill-files': shared('L1 maturity, no skills'),
    'agents-without-skills': shared('two or more agents on the whiteboard, no skills'),
    'sprint-complete': shared('a feature registry whose features are all done'),
};

/** An unclassified rule is treated as an optional integration. */
export function classifyRule(ruleId: string): RuleClassification {
    return RULE_CLASSIFICATION[ruleId] ?? { scope: { kind: 'optional' }, evidence: 'workspace files' };
}
