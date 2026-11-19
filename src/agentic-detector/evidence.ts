// FEAT-042 T1 — attributed evidence shared by Advisory rules and maturity.
// Pure: no vscode import. Adapter-claimed files are removed from Layer 2 to
// avoid duplicate graph nodes; their meaning survives here, attributed to
// the provider that owns them (R1, R2, R3).

import type { HarnessNode } from '../types.js';
import type { AgenticProfile, SignalCategory } from './types.js';

export interface EvidenceItem {
    category: SignalCategory;
    providerId: string;
    nodeId: string;
    sourceUri?: string;
}

/**
 * What a provider's resource counts as, by its declared type. Native paths
 * and formats do not matter: a Claude agent file and a Harness SDD subagent
 * are both role definitions.
 */
const CATEGORY_BY_TYPE: Partial<Record<HarnessNode['type'], SignalCategory>> = {
    agent: 'context-identity',       // project instructions (CLAUDE.md, AGENTS.md, a root rule, …)
    subagent: 'agent-methodologies', // role definitions
    skill: 'skills',
    steering: 'rules',
};

/** Single-tool rule formats are rules whatever node type their adapter uses (Cursor, Windsurf, Cline, Copilot). */
const RULE_FILE = /(?:^|\/)\.(?:cursorrules|windsurfrules|clinerules)$|\.mdc$|\.instructions\.md$|(?:^|\/)\.windsurf\/rules\//i;
/** A real instructions document; synthetic roots (a manifest, a config directory) are not. */
const INSTRUCTIONS_FILE = /\.md$/i;

/** The shared category of a resource, from its native file first, its declared type second (H1, H2). */
function categoryOf(node: HarnessNode): SignalCategory | undefined {
    const path = String(node.metadata._filePath ?? '');
    if (RULE_FILE.test(path)) return 'rules';
    if (node.type === 'agent') return INSTRUCTIONS_FILE.test(path) ? 'context-identity' : undefined;
    return CATEGORY_BY_TYPE[node.type];
}

export function evidenceFromGraph(nodes: readonly HarnessNode[]): EvidenceItem[] {
    return nodes.flatMap(node => {
        const category = categoryOf(node);
        const providerId = node.source?.providerId ?? (node.metadata._framework as string | undefined);
        return category && providerId
            ? [{ category, providerId, nodeId: node.id, sourceUri: node.source?.sourceUri }]
            : [];
    });
}

/**
 * The catalog files every `.agents/**` signal under `agent-methodologies`.
 * Read by meaning instead: an unclaimed `.agents/steering/x.md` is a rule
 * file like any other, and `agentic.json` itself only restates resources
 * that arrive as provider evidence. Counting it would give one layout a
 * category an equivalent native layout cannot have (R3).
 */
const SEMANTIC_CATEGORY: Record<string, SignalCategory | null> = {
    'harness-agentic-json': null,
    'harness-agents-md': 'context-identity',
    'harness-subagents': 'agent-methodologies',
    'harness-steering': 'rules',
    'harness-skills': 'skills',
    'harness-commands': 'prompts',
    'harness-hooks': null,
};

/** Categories with shared evidence, from unclaimed files and from providers. */
export function sharedCategories(profile: AgenticProfile): Set<SignalCategory> {
    const found = new Set<SignalCategory>();
    for (const cat of profile.layers['2'].categories) {
        for (const match of cat.matches) {
            const mapped = match.matchedPattern in SEMANTIC_CATEGORY ? SEMANTIC_CATEGORY[match.matchedPattern] : cat.category;
            if (mapped) found.add(mapped);
        }
    }
    for (const item of profile.evidence ?? []) found.add(item.category);
    return found;
}

export function hasEvidence(profile: AgenticProfile, category: SignalCategory): boolean {
    return sharedCategories(profile).has(category);
}

/** Providers whose resources supply evidence for `category`. */
export function evidenceOwners(profile: AgenticProfile, category: SignalCategory): string[] {
    return [...new Set((profile.evidence ?? []).filter(e => e.category === category).map(e => e.providerId))];
}

/** Feature or spec records from any layout (R3). A manifest alone is not a lifecycle. */
export function hasGovernedLifecycle(profile: AgenticProfile): boolean {
    return profile.layers['3'].methodology.isActive;
}

/** Inputs maturity could not assess, named for the user (R4). */
export function unavailableInputs(profile: AgenticProfile): string[] {
    const categories = sharedCategories(profile);
    const missing: string[] = [];
    const want: Array<[SignalCategory, string]> = [
        ['context-identity', 'Project instructions'],
        ['agent-methodologies', 'Role or agent definitions'],
        ['skills', 'Skills'],
        ['tools', 'Tool definitions'],
        ['mcp', 'MCP server configuration'],
    ];
    for (const [category, label] of want) if (!categories.has(category)) missing.push(`${label}: no file or provider evidence found`);
    if (profile.layers['1'].cliInstalls.length === 0) missing.push('Agent CLI: no configuration found');
    else missing.push('Agent CLI: detected from configuration files; the executable was not verified');
    if (!hasGovernedLifecycle(profile)) missing.push('Governed lifecycle: no feature registry or spec documents found');
    return missing;
}
