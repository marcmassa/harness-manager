// FEAT-034 — Component Optimizer — overlap rule pack (design.md §D/§F, R22–R24)
// OPT-O01 .. OPT-O03
//
// Reuses existing maths rather than reimplementing it:
//  - OPT-O01 builds its corpus with tokenize/computeIdf/buildTfidfVectors and
//    scores pairs with cosineSimilarity, all from src/semanticMatcher.ts.
//  - OPT-O03 calls computeIdoneityMatrix()/detectMismatches() from
//    src/idoneity.ts and maps each MismatchInfo to one finding.

import { tokenize, computeIdf, buildTfidfVectors, cosineSimilarity } from '../../semanticMatcher.js';
import { computeIdoneityMatrix, detectMismatches } from '../../idoneity.js';
import type { OptimizerFinding, OptimizerRule, RuleContext } from '../types.js';
import { matchesAnyGlob, readAppliesTo, toEntityInput } from './ruleUtils.js';

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

function descriptionText(source: RuleContext['source']): string {
    return typeof source.frontmatter.description === 'string' ? source.frontmatter.description : '';
}

// ─── OPT-O01 — semantic overlap between components (R22) ──────────────────

export const optO01: OptimizerRule = {
    id: 'OPT-O01',
    appliesTo: ['agent', 'subagent', 'skill', 'steering', 'hook'],
    dimension: 'integration',
    defaultSeverity: 'warning',
    /** The 0.8 cosine cutoff is an invented constant. */
    confidence: 'opinion',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, all, config } = ctx;
        const sameTyped = all.filter(s => s.nodeType === source.nodeType && s.exists);
        if (sameTyped.length < 2) return [];

        const corpus = new Map<string, string[]>(
            sameTyped.map(s => [s.nodeId, tokenize(descriptionText(s))]),
        );
        const idf = computeIdf(corpus);
        const vectors = buildTfidfVectors(corpus, idf);

        const selfVec = vectors.get(source.nodeId);
        if (!selfVec) return [];

        const findings: OptimizerFinding[] = [];
        for (const other of sameTyped) {
            if (other.nodeId === source.nodeId) continue;
            const otherVec = vectors.get(other.nodeId);
            if (!otherVec) continue;
            const similarity = cosineSimilarity(selfVec, otherVec);
            if (similarity >= config.overlapThreshold) {
                findings.push(
                    finding('OPT-O01', ctx, {
                        severity: 'warning',
                        dimension: 'integration',
                        title: 'Semantic overlap with another component',
                        detail: `${Math.round(similarity * 100)}% description similarity with "${other.nodeId}" (threshold ${Math.round(config.overlapThreshold * 100)}%).`,
                        relatedNodeIds: [other.nodeId],
                    }),
                );
            }
        }
        return findings;
    },
};

// ─── OPT-O02 — orphan and under-connected components (R23) ────────────────
//
// NOTE: R23 frames the steering clause as "its appliesTo glob matches no
// file in the workspace". Today's `.agents/agentic.json` schema (see
// parserLogic.ts's `governs`-edge construction) populates steering's
// appliesTo with subagent target IDs (or the literal '*' meaning "all
// subagents"), not file globs — so for manifest-declared steering entries
// this check may read as "matches no known subagent id" in practice. It is
// implemented literally against R23's wording (glob-matched against
// ctx.existingPaths, with '*' special-cased to always match, matching the
// wildcard's existing meaning elsewhere in the codebase) since a
// self-authored steering file could plausibly declare real file globs in
// its own frontmatter. Flagging this as a spec ambiguity worth resolving
// in a follow-up rather than silently picking one reading.

export const optO02: OptimizerRule = {
    id: 'OPT-O02',
    appliesTo: ['skill', 'subagent', 'steering'],
    dimension: 'integration',
    defaultSeverity: 'warning',
    /**
     * DERIVED state, not filesystem state. This asks whether the in-memory graph
     * holds a `uses` edge — and that graph is built by eight adapters from
     * heterogeneous sources (`agentic.json` arrays, `## Skills` sections,
     * per-framework conventions). `DESIGN.md` principle 5 is explicit that the
     * graph is derived and never the source of truth, so a rule reading it is
     * only as reliable as the derivation.
     *
     * Originally tagged `fact`, which was wrong: smoke testing surfaced a skill
     * listed in `skills[]` for three subagents in `agentic.json` and linked from
     * two `SUBAGENT.md` files, still reported as an orphan. Whether that is an
     * adapter gap or something narrower, the rule cannot claim verified fact
     * about a model it did not build.
     */
    confidence: 'heuristic',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, edges, existingPaths } = ctx;
        if (!source.exists) return [];

        if (source.nodeType === 'skill') {
            const hasUses = edges.some(e => e.target === source.nodeId && e.label === 'uses');
            if (hasUses) return [];
            return [
                finding('OPT-O02', ctx, {
                    severity: 'warning',
                    dimension: 'integration',
                    title: 'Orphan skill',
                    detail: 'No subagent or agent in the parsed graph declares a "uses" link to this skill, so progressive disclosure is unlikely to surface it. This reads the derived graph, not the files directly — if a consumer does declare it (a `skills[]` entry in `agentic.json`, or a `## Skills` section in its SUBAGENT.md), the gap is in how that link is parsed, not in this skill.',
                }),
            ];
        }

        if (source.nodeType === 'subagent') {
            const ownsUses = edges.some(e => e.source === source.nodeId && e.label === 'uses');
            const targetOfGoverns = edges.some(e => e.target === source.nodeId && e.label === 'governs');
            if (ownsUses || targetOfGoverns) return [];
            return [
                finding('OPT-O02', ctx, {
                    severity: 'info',
                    dimension: 'integration',
                    title: 'Under-connected subagent',
                    detail: 'This subagent owns no "uses" edge and is governed by no steering file.',
                }),
            ];
        }

        if (source.nodeType === 'steering') {
            const appliesTo = readAppliesTo(source);
            if (appliesTo.length === 0) return []; // OPT-S06 already covers absence
            if (appliesTo.includes('*')) return [];
            if (matchesAnyGlob(appliesTo, existingPaths)) return [];
            return [
                finding('OPT-O02', ctx, {
                    severity: 'warning',
                    dimension: 'integration',
                    title: 'Steering appliesTo matches nothing',
                    detail: `None of [${appliesTo.join(', ')}] match a file in the workspace.`,
                }),
            ];
        }

        return [];
    },
};

// ─── OPT-O03 — ownership mismatch (R24) ────────────────────────────────────

export const optO03: OptimizerRule = {
    id: 'OPT-O03',
    appliesTo: ['skill'],
    dimension: 'integration',
    defaultSeverity: 'info',
    /** Reuses idoneity, whose MISMATCH_GAP_THRESHOLD is itself a tuned constant. */
    confidence: 'heuristic',
    evaluate(ctx: RuleContext): OptimizerFinding[] {
        const { source, all, edges } = ctx;
        const subagents = all.filter(s => s.nodeType === 'subagent' && s.exists).map(toEntityInput);
        const skills = all.filter(s => s.nodeType === 'skill' && s.exists).map(toEntityInput);
        if (subagents.length === 0 || skills.length === 0) return [];

        const matrix = computeIdoneityMatrix(subagents, skills);
        const usesEdges = edges.filter(e => e.label === 'uses');
        const mismatches = detectMismatches(matrix, usesEdges);
        const mine = mismatches.filter(m => m.skillId === source.nodeId);

        return mine.map(m =>
            finding('OPT-O03', ctx, {
                severity: 'info',
                dimension: 'integration',
                title: 'Ownership mismatch',
                detail: `Currently owned by "${m.currentOwner}" (idoneity ${m.currentScore}); "${m.bestOwner}" scores higher (${m.bestScore}, gap ${m.gap}).`,
                relatedNodeIds: [m.bestOwner],
            }),
        );
    },
};

export const OVERLAP_RULES: readonly OptimizerRule[] = [optO01, optO02, optO03];
