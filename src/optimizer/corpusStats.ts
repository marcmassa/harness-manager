// FEAT-034 calibration — corpus statistics for relative thresholds.
//
// WHY THIS EXISTS
// The original budget rules compared each component against a fixed constant
// (500 tokens for a skill, 1500 for a subagent). Measured against the five real
// skills in this repository, four of the five busted the 500-token budget and
// one exceeded it fourfold. A rule that flags 80% of a competent author's corpus
// is not measuring quality — it is measuring that the constant was invented.
//
// The fix is to judge a component against the author's own corpus: "this skill
// is 3× your median skill" is a claim that survives the author writing
// consistently large or consistently small components, and it can legitimately
// flag nobody when the corpus is uniform.
//
// A percentile was considered and rejected: a percentile ALWAYS flags a fixed
// fraction. If every skill is excellent, the worst 10% is still reported. A
// median multiple has no such floor.

import type { ComponentSource, CorpusStats, OptimizableType } from './types.js';

/**
 * Minimum components of a type before its median is trustworthy. Below this the
 * caller falls back to the configured absolute budget: with two skills, "the
 * median skill" is not a meaningful reference point.
 */
export const MIN_SAMPLE_FOR_RELATIVE = 5;

/** Median of a numeric list. Even-length lists average the two middle values. */
export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
}

/**
 * Compute per-type medians over the components that actually exist on disk.
 * Missing files are excluded: their `tokenEstimate` is 0 by construction and
 * would drag every median toward zero, making the corpus look smaller than it is
 * and over-reporting everything else.
 */
/** Fraction of same-typed components that must share a key/heading for it to count as a convention. */
export const CONVENTION_MAJORITY = 0.5;

/** Minimum same-typed components before conventions can be inferred at all. */
export const MIN_SAMPLE_FOR_CONVENTION = 3;

const H2_RE = /^##\s+(.+?)\s*$/gm;

/** Normalized `##` headings in a body, lowercased for comparison. */
export function headingsOf(body: string): string[] {
    const out: string[] = [];
    H2_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = H2_RE.exec(body)) !== null) out.push(m[1].toLowerCase());
    return out;
}

/**
 * Items present in at least `CONVENTION_MAJORITY` of the groups. Below
 * `MIN_SAMPLE_FOR_CONVENTION` groups nothing is a convention: with two
 * components, "both have it" is a coincidence, not a pattern.
 */
function majorityItems(groups: string[][]): string[] {
    if (groups.length < MIN_SAMPLE_FOR_CONVENTION) return [];
    const counts = new Map<string, number>();
    for (const g of groups) {
        for (const item of new Set(g)) counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    const needed = groups.length * CONVENTION_MAJORITY;
    return [...counts.entries()]
        .filter(([, n]) => n >= needed)
        .map(([item]) => item)
        .sort();
}

export function computeCorpusStats(sources: readonly ComponentSource[]): CorpusStats {
    const tokensByType = new Map<OptimizableType, number[]>();
    const fmKeysByType = new Map<OptimizableType, string[][]>();
    const headingsByType = new Map<OptimizableType, string[][]>();

    for (const s of sources) {
        if (!s.exists) continue;
        const t = s.nodeType;
        (tokensByType.get(t) ?? tokensByType.set(t, []).get(t)!).push(s.tokenEstimate);
        (fmKeysByType.get(t) ?? fmKeysByType.set(t, []).get(t)!).push(Object.keys(s.frontmatter));
        (headingsByType.get(t) ?? headingsByType.set(t, []).get(t)!).push(headingsOf(s.body));
    }

    const medianTokensByType = new Map<OptimizableType, number>();
    const sampleSizeByType = new Map<OptimizableType, number>();
    for (const [type, values] of tokensByType) {
        medianTokensByType.set(type, median(values));
        sampleSizeByType.set(type, values.length);
    }

    const commonFrontmatterKeysByType = new Map<OptimizableType, string[]>();
    for (const [type, groups] of fmKeysByType) {
        commonFrontmatterKeysByType.set(type, majorityItems(groups));
    }

    const commonHeadingsByType = new Map<OptimizableType, string[]>();
    for (const [type, groups] of headingsByType) {
        commonHeadingsByType.set(type, majorityItems(groups));
    }

    return {
        medianTokensByType,
        sampleSizeByType,
        commonFrontmatterKeysByType,
        commonHeadingsByType,
    };
}

export interface ResolvedBudget {
    /** The token count above which the rule fires. */
    threshold: number;
    /** How the threshold was derived, for the finding's `detail`. */
    basis: 'relative' | 'absolute';
    /** Median used when `basis` is 'relative'. */
    median?: number;
    sampleSize: number;
}

/**
 * Resolve the effective budget for one node type.
 *
 * Prefers `multiple × median` once the corpus is large enough to have a
 * meaningful median; otherwise falls back to the configured absolute budget so
 * small workspaces still get a signal.
 */
export function resolveBudget(
    nodeType: OptimizableType,
    absoluteBudget: number,
    corpus: CorpusStats,
    multiple: number,
): ResolvedBudget {
    const sampleSize = corpus.sampleSizeByType.get(nodeType) ?? 0;
    const med = corpus.medianTokensByType.get(nodeType) ?? 0;

    if (sampleSize >= MIN_SAMPLE_FOR_RELATIVE && med > 0) {
        return {
            threshold: Math.round(med * multiple),
            basis: 'relative',
            median: med,
            sampleSize,
        };
    }
    return { threshold: absoluteBudget, basis: 'absolute', sampleSize };
}
