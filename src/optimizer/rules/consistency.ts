// FEAT-034 — Component Optimizer — consistency rule pack
// OPT-C01 .. OPT-C02
//
// WHY THIS DIMENSION EXISTS
// Every other rule family judges a component against an external idea of what a
// component should be. This one judges it against the author's OWN corpus: does
// this skill look like your other skills?
//
// That question is worth its own axis because it is genuinely independent. A
// component can have valid frontmatter (structure), sit inside budget, be well
// connected (integration) and carry no secrets (hygiene), and still be the one
// file that does everything differently — which is exactly the file a reader or
// a model stumbles over.
//
// Both rules derive the convention rather than prescribing it, so there is no
// invented constant to defend. They stay silent on a corpus too small for a
// majority to mean anything.

import type { OptimizerFinding, OptimizerRule, RuleContext } from '../types.js';
import { headingsOf } from '../corpusStats.js';

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

const ALL_OPTIMIZABLE = ['agent', 'subagent', 'skill', 'steering', 'hook'] as const;

// ─── OPT-C01 — missing a frontmatter key the rest of the corpus uses ────────

export const optC01: OptimizerRule = {
    id: 'OPT-C01',
    appliesTo: ALL_OPTIMIZABLE,
    dimension: 'consistency',
    defaultSeverity: 'info',
    /** The convention is derived from the corpus, but "most files do X" is not proof X is required. */
    confidence: 'heuristic',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, corpus } = ctx;
        if (!source.exists) return [];

        const common = corpus.commonFrontmatterKeysByType.get(source.nodeType) ?? [];
        if (common.length === 0) return [];

        const own = new Set(Object.keys(source.frontmatter));
        const missing = common.filter(k => !own.has(k));
        if (missing.length === 0) return [];

        return [
            finding('OPT-C01', ctx, {
                severity: 'warning',
                dimension: 'consistency',
                title: 'Missing frontmatter keys the rest of your corpus uses',
                detail: `Most other ${source.nodeType} components declare ${missing.map(k => `\`${k}\``).join(', ')}. This one does not.`,
                fix: missing.length === 1
                    ? {
                        type: 'set-frontmatter-field',
                        label: `Add ${missing[0]}`,
                        payload: { field: missing[0], value: '' },
                    }
                    : undefined,
            }),
        ];
    },
};

// ─── OPT-C02 — missing a section heading the rest of the corpus uses ────────

export const optC02: OptimizerRule = {
    id: 'OPT-C02',
    appliesTo: ALL_OPTIMIZABLE,
    dimension: 'consistency',
    defaultSeverity: 'info',
    /** Section conventions are real signal but a component may legitimately differ. */
    confidence: 'heuristic',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, corpus } = ctx;
        if (!source.exists || !source.body) return [];

        const common = corpus.commonHeadingsByType.get(source.nodeType) ?? [];
        if (common.length === 0) return [];

        const own = new Set(headingsOf(source.body));
        const missing = common.filter(h => !own.has(h));
        if (missing.length === 0) return [];

        return [
            finding('OPT-C02', ctx, {
                severity: 'info',
                dimension: 'consistency',
                title: 'Missing sections the rest of your corpus uses',
                detail: `Most other ${source.nodeType} components have a "${missing.join('", "')}" section.`,
                fix: {
                    type: 'append-section-stubs',
                    label: 'Add missing sections',
                    payload: { sections: missing.join(',') },
                },
            }),
        ];
    },
};

export const CONSISTENCY_RULES: readonly OptimizerRule[] = [optC01, optC02];
