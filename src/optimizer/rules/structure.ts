// FEAT-034 — Component Optimizer — structure rule pack (design.md §D, R13–R18)
// OPT-S01 .. OPT-S06

import type { OptimizerFinding, OptimizerRule, RuleContext } from '../types.js';
import { readAppliesTo } from './ruleUtils.js';

const TRIGGER_MARKERS = [
    'use when', 'use this when', 'when the user', 'for when',
    'invoke when', 'triggers on', 'apply when',
];

function finding(
    ruleId: string,
    ctx: RuleContext,
    partial: Omit<OptimizerFinding, 'ruleId' | 'nodeId' | 'nodeType' | 'filePath'>,
): OptimizerFinding {
    return {
        ruleId,
        nodeId: ctx.source.nodeId,
        nodeType: ctx.source.nodeType,
        filePath: ctx.source.filePath,
        ...partial,
    };
}

function directoryNameOf(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
    // .../<dir>/SUBAGENT.md or .../<dir>/SKILL.md → <dir>
    return parts.length >= 2 ? parts[parts.length - 2] : '';
}

// ─── OPT-S01 — missing or invalid frontmatter (R13) ────────────────────────

export const optS01: OptimizerRule = {
    id: 'OPT-S01',
    appliesTo: ['agent', 'subagent', 'skill', 'steering'],
    dimension: 'structure',
    defaultSeverity: 'error',
    /** Frontmatter either parses or it does not. */
    confidence: 'fact',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source } = ctx;
        if (!source.exists) return []; // OPT-D01 owns file-existence drift
        if (Object.keys(source.frontmatter).length > 0) return [];
        return [
            finding('OPT-S01', ctx, {
                severity: 'error',
                dimension: 'structure',
                title: 'Missing or invalid frontmatter',
                detail: `${source.filePath || source.nodeId} has no YAML frontmatter block, or the block failed to parse.`,
            }),
        ];
    },
};

// ─── OPT-S02 — name / directory mismatch (R14) ─────────────────────────────

export const optS02: OptimizerRule = {
    id: 'OPT-S02',
    appliesTo: ['subagent', 'skill'],
    dimension: 'structure',
    defaultSeverity: 'warning',
    /** The directory name is a fact on disk. */
    confidence: 'fact',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source } = ctx;
        if (!source.exists) return [];
        const name = source.frontmatter.name;
        if (typeof name !== 'string' || name.length === 0) return [];
        const dir = directoryNameOf(source.filePath);
        if (!dir || dir === name) return [];
        return [
            finding('OPT-S02', ctx, {
                severity: 'warning',
                dimension: 'structure',
                title: 'Frontmatter name does not match its directory',
                detail: `frontmatter.name is "${name}" but the containing directory is "${dir}".`,
                fix: {
                    type: 'set-frontmatter-field',
                    label: `Set name to "${dir}"`,
                    payload: { field: 'name', value: dir },
                },
            }),
        ];
    },
};

// ─── OPT-S03 — description length bounds (R15) ─────────────────────────────

const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 1024;

export const optS03: OptimizerRule = {
    id: 'OPT-S03',
    appliesTo: ['agent', 'subagent', 'skill'],
    dimension: 'structure',
    defaultSeverity: 'error',
    /** Absence is a fact; the 20/1024 char bounds are not. */
    confidence: 'heuristic',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source } = ctx;
        if (!source.exists) return [];
        const description = source.frontmatter.description;
        const text = typeof description === 'string' ? description : '';

        if (text.length < DESCRIPTION_MIN) {
            return [
                finding('OPT-S03', ctx, {
                    severity: 'error',
                    dimension: 'structure',
                    title: 'Description missing or too short',
                    detail: `frontmatter.description is ${text.length} characters; a description needs at least ${DESCRIPTION_MIN}.`,
                }),
            ];
        }
        if (text.length > DESCRIPTION_MAX) {
            return [
                finding('OPT-S03', ctx, {
                    severity: 'warning',
                    dimension: 'structure',
                    title: 'Description too long',
                    detail: `frontmatter.description is ${text.length} characters, exceeding the ${DESCRIPTION_MAX}-character bound.`,
                }),
            ];
        }
        return [];
    },
};

// ─── OPT-S04 — skill description states no trigger condition (R16) ────────

export const optS04: OptimizerRule = {
    id: 'OPT-S04',
    appliesTo: ['skill'],
    dimension: 'clarity',
    defaultSeverity: 'warning',
    /** Progressive disclosure really does select on the description alone, but matching seven stock phrases will misfire both ways. */
    confidence: 'heuristic',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source } = ctx;
        if (!source.exists) return [];
        const description = source.frontmatter.description;
        const text = typeof description === 'string' ? description : '';
        if (text.length < DESCRIPTION_MIN) return []; // OPT-S03 already covers this
        const lower = text.toLowerCase();
        const hasTrigger = TRIGGER_MARKERS.some(marker => lower.includes(marker));
        if (hasTrigger) return [];
        return [
            finding('OPT-S04', ctx, {
                severity: 'warning',
                dimension: 'clarity',
                title: 'Description states no trigger condition',
                detail: 'Progressive disclosure selects a skill from its description alone, so a description without a trigger condition (e.g. "use when...", "invoke when...") is unlikely to ever be loaded.',
            }),
        ];
    },
};

// ─── OPT-S05 — missing required sections (R17) ─────────────────────────────

const SKILL_SECTION_RE = /^#{1,3}\s*(usage|how to use|examples?)/im;
const SUBAGENT_SECTION_RE = /^#{1,3}\s*(role|responsibilit)/im;

export const optS05: OptimizerRule = {
    id: 'OPT-S05',
    appliesTo: ['skill', 'subagent'],
    dimension: 'structure',
    defaultSeverity: 'warning',
    /** Section conventions are real but not universal. */
    confidence: 'heuristic',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source } = ctx;
        if (!source.exists) return [];

        if (source.nodeType === 'skill') {
            if (SKILL_SECTION_RE.test(source.body)) return [];
            return [
                finding('OPT-S05', ctx, {
                    severity: 'warning',
                    dimension: 'structure',
                    title: 'Missing a usage/examples section',
                    detail: 'No heading matching "Usage", "How to Use" or "Examples" was found in the body.',
                    fix: {
                        type: 'append-section-stubs',
                        label: 'Append Usage / Examples stubs',
                        payload: { sections: 'Usage,Examples' },
                    },
                }),
            ];
        }

        if (source.nodeType === 'subagent') {
            if (SUBAGENT_SECTION_RE.test(source.body)) return [];
            return [
                finding('OPT-S05', ctx, {
                    severity: 'warning',
                    dimension: 'structure',
                    title: 'Missing a role/responsibilities section',
                    detail: 'No heading matching "Role" or "Responsibilities" was found in the body.',
                    fix: {
                        type: 'append-section-stubs',
                        label: 'Append Role / Responsibilities stubs',
                        payload: { sections: 'Role,Responsibilities' },
                    },
                }),
            ];
        }

        return [];
    },
};

// ─── OPT-S06 — hook and steering contract (R18) ────────────────────────────

export const optS06: OptimizerRule = {
    id: 'OPT-S06',
    appliesTo: ['hook', 'steering'],
    dimension: 'structure',
    defaultSeverity: 'error',
    /** The hook script exists or it does not. */
    confidence: 'fact',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source } = ctx;
        const out: OptimizerFinding[] = [];

        if (source.nodeType === 'hook') {
            const event = source.frontmatter.event;
            if (typeof event !== 'string' || event.length === 0) {
                out.push(
                    finding('OPT-S06', ctx, {
                        severity: 'error',
                        dimension: 'structure',
                        title: 'Hook has no event',
                        detail: 'metadata.event is absent or empty; a hook must declare the event that triggers it.',
                    }),
                );
            }
            // metadata.script names a path that does not exist in the workspace.
            // For hook nodes, _filePath IS the script path (see parserLogic.ts
            // parseAgenticJson), so componentLoader's `exists` flag already
            // reflects whether the script resolves on disk.
            if (!source.exists) {
                out.push(
                    finding('OPT-S06', ctx, {
                        severity: 'error',
                        dimension: 'structure',
                        title: 'Hook script does not exist',
                        detail: `metadata.script "${source.filePath}" does not exist in the workspace.`,
                    }),
                );
            }
            return out;
        }

        if (source.nodeType === 'steering') {
            const appliesTo = readAppliesTo(source);
            if (appliesTo.length === 0) {
                out.push(
                    finding('OPT-S06', ctx, {
                        severity: 'warning',
                        dimension: 'structure',
                        title: 'Steering file has no appliesTo',
                        detail: 'frontmatter.appliesTo (or applies_to) is absent; this steering file will not be scoped to anything.',
                    }),
                );
            }
            return out;
        }

        return out;
    },
};

export const STRUCTURE_RULES: readonly OptimizerRule[] = [optS01, optS02, optS03, optS04, optS05, optS06];
