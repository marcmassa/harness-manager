// FEAT-034 — Component Optimizer — budget rule pack (design.md §D, R19–R21)
// OPT-B01 .. OPT-B03

import type { ComponentSource, OptimizableType, OptimizerFinding, OptimizerRule, RuleContext } from '../types.js';
import { resolveBudget } from '../corpusStats.js';

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

/** Budget lookup for the four types that carry one (hooks have none). */
function budgetFor(nodeType: OptimizableType, config: RuleContext['config']): number | undefined {
    switch (nodeType) {
        case 'agent': return config.tokenBudget.agent;
        case 'subagent': return config.tokenBudget.subagent;
        case 'skill': return config.tokenBudget.skill;
        case 'steering': return config.tokenBudget.steering;
        default: return undefined;
    }
}

// ─── OPT-B01 — component over token budget (R19) ───────────────────────────

export const optB01: OptimizerRule = {
    id: 'OPT-B01',
    appliesTo: ['agent', 'subagent', 'skill', 'steering'],
    dimension: 'budget',
    defaultSeverity: 'info',
    // The threshold is a heuristic even when self-calibrated: a large component
    // is a reason to look, never proof of a defect.
    confidence: 'opinion',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, config, corpus } = ctx;
        if (!source.exists) return [];
        const absolute = budgetFor(source.nodeType, config);
        if (absolute === undefined || absolute <= 0) return [];

        const resolved = resolveBudget(source.nodeType, absolute, corpus, config.budgetMedianMultiple);
        if (resolved.threshold <= 0 || source.tokenEstimate <= resolved.threshold) return [];

        const basis = resolved.basis === 'relative'
            ? `${config.budgetMedianMultiple}× the median ${source.nodeType} in this workspace (${resolved.median} tokens, n=${resolved.sampleSize})`
            : `the configured budget of ${absolute} tokens (corpus too small to calibrate: n=${resolved.sampleSize})`;

        return [
            finding('OPT-B01', ctx, {
                severity: 'info',
                dimension: 'budget',
                title: 'Component is unusually large for this workspace',
                detail: `Estimated ${source.tokenEstimate} tokens, over ${resolved.threshold} — ${basis}.`,
            }),
        ];
    },
};

// ─── OPT-B02 — extractable reference content (R20) ─────────────────────────

const H2_RE = /^##\s+(.+)$/gm;

export const optB02: OptimizerRule = {
    id: 'OPT-B02',
    appliesTo: ['agent', 'subagent', 'skill', 'steering'],
    dimension: 'budget',
    defaultSeverity: 'info',
    confidence: 'opinion',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, config, corpus } = ctx;
        if (!source.exists) return [];
        const absolute = budgetFor(source.nodeType, config);
        if (absolute === undefined || absolute <= 0) return [];
        const resolved = resolveBudget(source.nodeType, absolute, corpus, config.budgetMedianMultiple);
        if (resolved.threshold <= 0 || source.tokenEstimate <= resolved.threshold) return [];

        const sections: string[] = [];
        let match: RegExpExecArray | null;
        H2_RE.lastIndex = 0;
        while ((match = H2_RE.exec(source.body)) !== null) {
            sections.push(match[1].trim());
        }
        if (sections.length < 3) return [];

        const candidates = sections.slice(2);
        return [
            finding('OPT-B02', ctx, {
                severity: 'info',
                dimension: 'budget',
                title: 'Extractable reference content',
                detail: `Sections after the second (${candidates.join(', ')}) are candidates for extraction into references/.`,
                fix: {
                    type: 'extract-to-references',
                    label: 'Extract to references/',
                    payload: { sections: candidates.join(',') },
                },
            }),
        ];
    },
};

// ─── OPT-B03 — agent context rollup (R21) ──────────────────────────────────

/**
 * Components reachable from `nodeId` via outgoing `uses` edges or incoming
 * `governs` edges (steering governs an agent/subagent, it does not "use" it —
 * see parserLogic.ts's `governs` edges: source=steering, target=subagent).
 */
function rollupContributors(ctx: RuleContext): ComponentSource[] {
    const visited = new Set<string>([ctx.source.nodeId]);
    const queue: string[] = [ctx.source.nodeId];
    const contributors: ComponentSource[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const edge of ctx.edges) {
            let neighbor: string | undefined;
            if (edge.source === current && edge.label === 'uses') neighbor = edge.target;
            else if (edge.target === current && edge.label === 'governs') neighbor = edge.source;
            if (!neighbor || visited.has(neighbor)) continue;
            visited.add(neighbor);
            const comp = ctx.sourcesById.get(neighbor);
            if (comp) {
                contributors.push(comp);
                queue.push(neighbor);
            }
        }
    }
    return contributors;
}

export const optB03: OptimizerRule = {
    id: 'OPT-B03',
    appliesTo: ['agent', 'subagent'],
    dimension: 'budget',
    defaultSeverity: 'info',
    confidence: 'opinion',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, config } = ctx;
        const threshold = config.tokenBudget.agentRollup;
        if (!threshold || threshold <= 0) return [];

        const contributors = rollupContributors(ctx);
        const rollupEstimate = source.tokenEstimate + contributors.reduce((sum, c) => sum + c.tokenEstimate, 0);
        if (rollupEstimate <= threshold) return [];

        const ranked = [...contributors].sort((a, b) => b.tokenEstimate - a.tokenEstimate).slice(0, 3);
        const top3 = ranked.map(c => `${c.nodeId} (${c.tokenEstimate})`);

        return [
            finding('OPT-B03', ctx, {
                severity: 'info',
                dimension: 'budget',
                title: 'Agent context rollup is large',
                detail: `Rollup estimate is ${rollupEstimate} tokens against a budget of ${threshold}. Largest contributors: ${top3.join(', ') || 'none'}.`,
                relatedNodeIds: ranked.map(c => c.nodeId),
            }),
        ];
    },
};

export const BUDGET_RULES: readonly OptimizerRule[] = [optB01, optB02, optB03];
