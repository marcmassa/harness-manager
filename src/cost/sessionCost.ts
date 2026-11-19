// FEAT-044 T2 — per-session context cost per provider (R4, R5, R6, R10).
// Pure: no vscode import. Token counts come from the existing local
// estimator (optimizer/tokenEstimator.ts); a calibration factor scales them
// only when the user configures one for the selected model family.

import type { LoadMode } from './loadMode.js';

export interface CostSource {
    owner: string;
    nodeId: string;
    label: string;
    sourceUri?: string;
    loadMode: LoadMode;
    /** Estimated tokens of the whole resource. */
    tokens: number;
    /** Estimated tokens of its description: what an on-trigger catalog shows. */
    descriptionTokens: number;
}

export interface SourceRef {
    nodeId: string;
    label: string;
    sourceUri?: string;
    tokens: number;
}

export interface SessionCost {
    owner: string;
    /** `always` resources: paid in every session. */
    baseline: number;
    /** Descriptions of `on-trigger` resources: paid in every session to make them findable. */
    catalog: number;
    /** Bodies paid only when used: on-trigger bodies, delegated contexts, manual invocations. */
    onDemand: Array<SourceRef & { mode: 'on-trigger' | 'delegated' | 'manual' }>;
    /** R5: listed with their estimate, never counted as zero. */
    unpriced: SourceRef[];
    /** R10: false when the provider declares no load mode at all. */
    evaluated: boolean;
    /** R10: why an unevaluated provider has no cost. */
    missingEvidence?: string;
}

export interface Calibration {
    family: string;
    factor: number;
}

export interface CostReport {
    owners: SessionCost[];
    /** Baseline + catalog over evaluated owners only. */
    sessionTotal: number;
    /** Resources and tokens left out of every total because their load mode is unknown. */
    unpricedCount: number;
    unpricedTokens: number;
    /** The factor applied, when the user configured one; absent means raw estimates. */
    calibration?: Calibration;
}

/** A configured factor for the selected family, if any (R6). */
export function calibrationFor(family: string | undefined, table: Readonly<Record<string, number>> | undefined): Calibration | undefined {
    if (!family || !table) return undefined;
    const factor = table[family];
    return typeof factor === 'number' && Number.isFinite(factor) && factor > 0 ? { family, factor } : undefined;
}

export function computeSessionCost(sources: readonly CostSource[], calibration?: Calibration): CostReport {
    const scale = (n: number) => (calibration ? Math.round(n * calibration.factor) : n);
    const ref = (s: CostSource): SourceRef => ({ nodeId: s.nodeId, label: s.label, sourceUri: s.sourceUri, tokens: scale(s.tokens) });
    const byOwner = new Map<string, CostSource[]>();
    for (const s of sources) (byOwner.get(s.owner) ?? byOwner.set(s.owner, []).get(s.owner)!).push(s);

    const owners: SessionCost[] = [...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([owner, list]) => {
        const cost: SessionCost = { owner, baseline: 0, catalog: 0, onDemand: [], unpriced: [], evaluated: false };
        for (const s of list) {
            switch (s.loadMode) {
                case 'always': cost.baseline += scale(s.tokens); break;
                case 'on-trigger':
                    cost.catalog += scale(s.descriptionTokens);
                    cost.onDemand.push({ ...ref(s), mode: 'on-trigger' });
                    break;
                case 'delegated': case 'manual': cost.onDemand.push({ ...ref(s), mode: s.loadMode }); break;
                case 'on-event': break; // a script, not model context
                default: cost.unpriced.push(ref(s));
            }
        }
        cost.evaluated = list.some(s => s.loadMode !== 'unknown');
        if (!cost.evaluated) {
            cost.missingEvidence = 'no resource of this provider declares when it is loaded';
            cost.baseline = 0;
            cost.catalog = 0;
        }
        return cost;
    });

    const evaluated = owners.filter(o => o.evaluated);
    const unpriced = owners.flatMap(o => o.unpriced);
    return {
        owners,
        sessionTotal: evaluated.reduce((sum, o) => sum + o.baseline + o.catalog, 0),
        unpricedCount: unpriced.length,
        unpricedTokens: unpriced.reduce((sum, r) => sum + r.tokens, 0),
        ...(calibration ? { calibration } : {}),
    };
}
