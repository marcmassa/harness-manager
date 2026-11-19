// FEAT-044 T3 — context cost rules (R8). Deterministic; they read the
// owner-declared load mode on each component's source record.
// OPT-K01 duplicated always-loaded content across owners (fact),
// OPT-K02 one resource holds most of an owner's session baseline (opinion),
// OPT-K03 an always-loaded resource whose format offers an on-trigger form (opinion).

import type { ComponentSource, OptimizerFinding, OptimizerRule, RuleContext } from '../types.js';

function finding(id: string, ctx: RuleContext, partial: Omit<OptimizerFinding, 'ruleId' | 'nodeId' | 'nodeType' | 'filePath'>): OptimizerFinding {
    return { ruleId: id, nodeId: ctx.source.nodeId, nodeType: ctx.source.nodeType, filePath: ctx.source.filePath, ...partial };
}

const isAlways = (s: ComponentSource) => s.exists && s.source?.loadMode === 'always';
const owner = (s: ComponentSource) => s.source?.providerId ?? '';

/** Paragraphs long enough to matter, normalised so whitespace and case do not hide a copy. */
export function paragraphsOf(body: string): string[] {
    return body.split(/\n\s*\n/)
        .map(p => p.replace(/^#+\s.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase())
        .filter(p => p.length >= 80);
}

/** K01 minimum shared paragraphs before reporting. */
const MIN_SHARED = 1;
/** K02: share and baseline size above which one resource is worth a look (unvalidated thresholds). */
const SHARE = 0.6;
const MIN_BASELINE = 1500;

export const optK01: OptimizerRule = {
    id: 'OPT-K01',
    scored: false,
    appliesTo: ['agent', 'subagent', 'skill', 'steering'],
    dimension: 'budget',
    defaultSeverity: 'warning',
    /** Identical normalised paragraphs are a fact; that both load every session is the owners' own declaration. */
    confidence: 'fact',
    evaluate(ctx) {
        const { source, all } = ctx;
        if (!isAlways(source)) return [];
        const mine = new Set(paragraphsOf(source.body));
        if (mine.size === 0) return [];
        const others = all.filter(o => o.nodeId !== source.nodeId && isAlways(o) && owner(o) !== owner(source));
        const shared = others.map(o => ({ o, n: paragraphsOf(o.body).filter(p => mine.has(p)).length })).filter(x => x.n >= MIN_SHARED);
        if (shared.length === 0) return [];
        const names = shared.map(({ o, n }) => `${o.filePath || o.nodeId} (${owner(o)}, ${n} paragraph${n === 1 ? '' : 's'})`).join(', ');
        return [finding('OPT-K01', ctx, {
            severity: 'warning', dimension: 'budget',
            title: 'Always-loaded content duplicated across harnesses',
            detail: `Paragraphs of this file also appear in ${names}. Agents that read both pay for the same text twice in every session. Keep it in one file each agent reads.`,
            relatedNodeIds: shared.map(({ o }) => o.nodeId),
        })];
    },
};

export const optK02: OptimizerRule = {
    id: 'OPT-K02',
    scored: false,
    appliesTo: ['agent', 'subagent', 'skill', 'steering'],
    dimension: 'budget',
    defaultSeverity: 'info',
    confidence: 'opinion',
    evaluate(ctx) {
        const { source, all } = ctx;
        if (!isAlways(source)) return [];
        const baseline = all.filter(o => isAlways(o) && owner(o) === owner(source)).reduce((sum, o) => sum + o.tokenEstimate, 0);
        const share = baseline > 0 ? source.tokenEstimate / baseline : 0;
        if (baseline < MIN_BASELINE || share < SHARE) return [];
        return [finding('OPT-K02', ctx, {
            severity: 'info', dimension: 'budget',
            title: 'One file holds most of the session baseline',
            detail: `~${source.tokenEstimate} of ${baseline} always-loaded tokens for ${owner(source)} (${Math.round(share * 100)}%) come from this file, in every session.`,
        })];
    },
};

/** How each format lets an always-loaded resource load on demand instead. */
const ON_TRIGGER_FORM: Readonly<Record<string, string>> = {
    cursor: 'a .mdc rule with `globs` or a description loads only when it applies',
    copilot: 'an `applyTo` pattern loads the instructions only for matching files',
    kiro: '`inclusion: fileMatch` loads the steering only for matching files',
    'harness-sdd': '`applies_to` naming roles loads the steering only in those roles',
};

export const optK03: OptimizerRule = {
    id: 'OPT-K03',
    scored: false,
    appliesTo: ['agent', 'subagent', 'steering'],
    dimension: 'budget',
    defaultSeverity: 'info',
    confidence: 'opinion',
    evaluate(ctx) {
        const { source } = ctx;
        const form = ON_TRIGGER_FORM[owner(source)];
        if (!isAlways(source) || !form) return [];
        return [finding('OPT-K03', ctx, {
            severity: 'info', dimension: 'budget',
            title: 'Always loaded, though the format can load it on demand',
            detail: `~${source.tokenEstimate} tokens load in every session. In this format ${form}.`,
        })];
    },
};

export const COST_RULES: readonly OptimizerRule[] = [optK01, optK02, optK03];
