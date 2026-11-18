// FEAT-034 — Component Optimizer — scoring (design.md §E, R10–R12)

import type {
    ComponentCoverage,
    ComponentScore,
    ComponentSource,
    OptimizerDimension,
    OptimizerFinding,
    OptimizerSeverity,
    RuleConfidence,
    ScoreTier,
} from './types.js';

export const SEVERITY_WEIGHT: Record<OptimizerSeverity, number> = {
    error: 25,
    warning: 10,
    info: 3,
} as const;

const SEVERITY_RANK: Record<OptimizerSeverity, number> = { info: 0, warning: 1, error: 2 };
const RANK_TO_SEVERITY: OptimizerSeverity[] = ['info', 'warning', 'error'];

/**
 * Calibration guard: the highest severity each epistemic tier may reach.
 *
 * A rule that verifies a fact may escalate to `error`. A rule whose mechanism is
 * real but whose detection approximates is capped at `warning`. A rule firing on
 * an unvalidated threshold is capped at `info` — it earns the right to be seen,
 * not the right to dominate the score.
 *
 * Without this, an invented constant (the old fixed 500-token skill budget) could
 * deduct 25 points as an `error` while a genuinely broken frontmatter deducted the
 * same, making the two indistinguishable to the user.
 */
export const SEVERITY_CEILING: Record<RuleConfidence, OptimizerSeverity> = {
    fact: 'error',
    heuristic: 'warning',
    opinion: 'info',
};

/**
 * Clamp a finding's severity to its rule's epistemic ceiling. Applied by the
 * engine after rules emit, so no rule can bypass it.
 */
export function applySeverityCeiling(
    severity: OptimizerSeverity,
    confidence: RuleConfidence,
): OptimizerSeverity {
    const ceiling = SEVERITY_CEILING[confidence];
    return SEVERITY_RANK[severity] > SEVERITY_RANK[ceiling]
        ? RANK_TO_SEVERITY[SEVERITY_RANK[ceiling]]
        : severity;
}

export const DIMENSIONS: readonly OptimizerDimension[] = [
    'structure', 'clarity', 'budget', 'integration', 'hygiene', 'consistency',
];

/** R11: score tier boundaries — A 90-100, B 75-89, C 60-74, D 40-59, F 0-39. */
export function tierFor(score: number): ScoreTier {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
}

/**
 * Deduction model (R10): each dimension starts at 100 and loses
 * `SEVERITY_WEIGHT[severity]` per finding in that dimension, clamped at 0.
 * The component score is the arithmetic mean of the dimension scores, rounded
 * to the nearest integer.
 */
export function scoreComponent(
    source: ComponentSource,
    findings: OptimizerFinding[],
    // FEAT-043 R2: default keeps every dimension evaluated (pre-FEAT-043 callers and tests).
    coverage: ComponentCoverage = { evaluated: [...DIMENSIONS], skipped: [] },
): ComponentScore {
    // Derived from DIMENSIONS rather than written out: a hand-maintained literal
    // silently produced NaN when the dimension set grew from four to six.
    const evaluated = new Set(coverage.evaluated);
    const dimensions = Object.fromEntries(
        DIMENSIONS.map(d => [d, evaluated.has(d) ? 100 : null]),
    ) as Record<OptimizerDimension, number | null>;

    for (const f of findings) {
        const current = dimensions[f.dimension] ?? 100; // a finding proves its dimension was evaluated
        dimensions[f.dimension] = Math.max(0, current - SEVERITY_WEIGHT[f.severity]);
    }

    // A skipped dimension contributes neither a penalty nor a perfect score.
    const scored = DIMENSIONS.filter(d => dimensions[d] !== null);
    const score = scored.length === 0
        ? null
        : Math.round(scored.reduce((sum, d) => sum + (dimensions[d] as number), 0) / scored.length);

    return {
        source: source.source,
        nodeId: source.nodeId,
        nodeType: source.nodeType,
        label: source.label,
        score,
        tier: score === null ? null : tierFor(score),
        dimensions,
        tokenEstimate: source.tokenEstimate,
        findingCount: findings.length,
        coverage: { evaluated: scored, skipped: coverage.skipped },
    };
}

/**
 * R12: architecture rollup — mean of the scored components. FEAT-043 R2: an
 * unscored component changes nothing; null when no component was scored.
 */
export function rollup(components: ComponentScore[]): number | null {
    const scored = components.filter((c): c is ComponentScore & { score: number } => c.score !== null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((acc, c) => acc + c.score, 0) / scored.length);
}
