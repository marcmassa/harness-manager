// FEAT-034 — Component Optimizer — engine (design.md §D, R5, R12, R30, R43, R53)
//
// Orchestrates: build RuleContext per component → run activeRules() →
// filter dismissed findings before scoring → score → aggregate. Pure and
// synchronous — the only I/O in the module already happened in
// componentLoader.ts before `sources` reaches this function.
//
// Signature note: design.md's Testing Strategy / tasks.md T26 describe the
// engine informally as `scan(sources, edges, nodeIds, existingPaths, config,
// dismissed)` without pinning exact parameter types; the concrete signature
// below is this task's synthesis of that description plus RuleContext's
// shape from design.md §A.

import { activeRules } from './rules/index.js';
import { scoreComponent, rollup, applySeverityCeiling, DIMENSIONS as ALL_DIMENSIONS } from './scorer.js';
import { computeCorpusStats } from './corpusStats.js';
import type {
    ComponentSource,
    OptimizerConfig,
    OptimizerDimension,
    OptimizerFinding,
    OptimizerReport,
    OptimizerRule,
    OptimizerSeverity,
    RuleContext,
} from './types.js';

/** R5: scan scope cap. */
export const MAX_OPTIMIZABLE_COMPONENTS = 500;

export type GraphEdge = { source: string; target: string; label: string };

function emptyFindingCounts(): OptimizerReport['findingCounts'] {
    return {
        bySeverity: { error: 0, warning: 0, info: 0 },
        byDimension: Object.fromEntries(ALL_DIMENSIONS.map(d => [d, 0])) as Record<OptimizerDimension, number>,
    };
}

function failedReport(scanTimestamp: number, error: string): OptimizerReport {
    return {
        ok: false,
        error,
        scanTimestamp,
        architectureScore: 0,
        totalComponents: 0,
        truncated: false,
        components: [],
        findings: [],
        dismissedCount: 0,
        findingCounts: emptyFindingCounts(),
    };
}

/**
 * Run every active rule over every (capped) component and produce a full
 * OptimizerReport. Never throws (R53): a throwing rule is caught and simply
 * contributes no findings for that (rule, component) pair; a wholly
 * unexpected failure is caught at the top level and reported as
 * `{ ok: false, error }`.
 */
export function scan(
    sources: readonly ComponentSource[],
    edges: readonly GraphEdge[],
    nodeIds: ReadonlySet<string>,
    existingPaths: ReadonlySet<string>,
    config: OptimizerConfig,
    dismissed: ReadonlySet<string> = new Set(),
    /**
     * Test-only injection point (not part of design.md's parameter list):
     * lets tests exercise "a throwing rule must not abort the scan" (R53)
     * without needing a real rule to misbehave. Production callers omit
     * this and get the real, disablement-filtered registry (R30).
     */
    rulesOverride?: readonly OptimizerRule[],
): OptimizerReport {
    const scanTimestamp = Date.now();

    try {
        // R5: stable node order cap — `sources` arrives in the graph's own
        // stable order (componentLoader preserves node order).
        const totalComponents = sources.length;
        const truncated = totalComponents > MAX_OPTIMIZABLE_COMPONENTS;
        const analyzed = truncated ? sources.slice(0, MAX_OPTIMIZABLE_COMPONENTS) : sources;

        const analyzedList = analyzed as ComponentSource[];
        const sourcesById = new Map(analyzedList.map(s => [s.nodeId, s]));
        const rules = rulesOverride ?? activeRules(config.disabledRules); // R30
        // Calibration: relative thresholds are judged against the author's own
        // corpus, so a workspace of uniformly large components is not penalised
        // for a constant somebody invented.
        const corpus = computeCorpusStats(analyzedList);

        const rawFindings: OptimizerFinding[] = [];
        for (const source of analyzedList) {
            for (const rule of rules) {
                if (!rule.appliesTo.includes(source.nodeType)) continue;

                const ctx: RuleContext = {
                    source,
                    all: analyzedList,
                    sourcesById,
                    edges: edges as GraphEdge[],
                    nodeIds: nodeIds as Set<string>,
                    existingPaths: existingPaths as Set<string>,
                    config,
                    corpus,
                };

                try {
                    const found = rule.evaluate(ctx);
                    if (found && found.length > 0) {
                        // A rule cannot exceed its epistemic ceiling, whatever
                        // severity it emitted. Enforced here so no rule bypasses it.
                        for (const f of found) {
                            rawFindings.push({
                                ...f,
                                severity: applySeverityCeiling(f.severity, rule.confidence),
                                confidence: rule.confidence,
                            });
                        }
                    }
                } catch {
                    // R53: a throwing rule must not abort the scan or the other rules.
                }
            }
        }

        // R43: dismissed findings are excluded before scoring, so they do
        // not contribute to any score.
        let dismissedCount = 0;
        const findings = rawFindings.filter(f => {
            const key = `${f.ruleId}::${f.nodeId}`;
            if (dismissed.has(key)) {
                dismissedCount += 1;
                return false;
            }
            return true;
        });

        const findingsByNode = new Map<string, OptimizerFinding[]>();
        for (const f of findings) {
            const list = findingsByNode.get(f.nodeId);
            if (list) list.push(f);
            else findingsByNode.set(f.nodeId, [f]);
        }

        const components = analyzedList.map(source =>
            scoreComponent(source, findingsByNode.get(source.nodeId) ?? []),
        );
        const architectureScore = rollup(components);

        const bySeverity: Record<OptimizerSeverity, number> = { error: 0, warning: 0, info: 0 };
        // Derived from ALL_DIMENSIONS, not written out: the hand-maintained
        // literal silently left `clarity` and `consistency` undefined when the
        // dimension set grew, so `undefined + 1` reported them as null.
        const byDimension = Object.fromEntries(
            ALL_DIMENSIONS.map(d => [d, 0]),
        ) as Record<OptimizerDimension, number>;
        for (const f of findings) {
            bySeverity[f.severity] += 1;
            byDimension[f.dimension] += 1;
        }

        return {
            ok: true,
            scanTimestamp,
            architectureScore,
            totalComponents,
            truncated,
            components,
            findings,
            dismissedCount,
            findingCounts: { bySeverity, byDimension },
        };
    } catch (e) {
        return failedReport(scanTimestamp, e instanceof Error ? e.message : String(e));
    }
}
