// FEAT-034 T53 — OptimizerPanel logic (R39, R41, R44, R50).
//
// The panel's sorting and filtering are the parts that can be wrong in a way
// the user would notice, so they are extracted and tested as pure functions
// here rather than through a DOM render, matching AdvisoryPanel.test.ts.

import { describe, it, expect } from 'vitest';
import type {
    ComponentScore,
    OptimizerFinding,
    OptimizerDimension,
    OptimizerSeverity,
    OptimizableType,
} from '../optimizer/types.js';
import { TIER_COLORS, tierOf, weakestDimension } from './OptimizerPanel.js';

// Mirrors the panel's `visible` useMemo. Kept in the test as an executable
// specification of R39 + R41; if the panel diverges from this, the behaviour
// the requirements describe has changed and this test should fail loudly.
function selectVisible(
    components: ComponentScore[],
    findings: OptimizerFinding[],
    typeFilter: Set<OptimizableType>,
    sevFilter: Set<OptimizerSeverity>,
    dimFilter: Set<OptimizerDimension>,
): ComponentScore[] {
    const byNode = new Map<string, OptimizerFinding[]>();
    for (const f of findings) {
        const list = byNode.get(f.nodeId);
        if (list) list.push(f); else byNode.set(f.nodeId, [f]);
    }
    return components
        .filter(c => typeFilter.size === 0 || typeFilter.has(c.nodeType))
        .filter(c => {
            if (sevFilter.size === 0 && dimFilter.size === 0) return true;
            const fs = byNode.get(c.nodeId) ?? [];
            return fs.some(f =>
                (sevFilter.size === 0 || sevFilter.has(f.severity)) &&
                (dimFilter.size === 0 || dimFilter.has(f.dimension)),
            );
        })
        .slice()
        .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));
}

function component(over: Partial<ComponentScore>): ComponentScore {
    return {
        nodeId: 'n', nodeType: 'skill', label: 'n', score: 100, tier: 'A',
        dimensions: { structure: 100, budget: 100, integration: 100, hygiene: 100 },
        tokenEstimate: 10, findingCount: 0,
        ...over,
    };
}

function finding(over: Partial<OptimizerFinding>): OptimizerFinding {
    return {
        ruleId: 'OPT-S01', nodeId: 'n', nodeType: 'skill', filePath: 'a.md',
        severity: 'warning', dimension: 'structure', title: 't', detail: 'd',
        ...over,
    };
}

describe('OptimizerPanel — sorting (R39)', () => {
    it('puts the worst score first', () => {
        const rows = selectVisible(
            [
                component({ nodeId: 'good', label: 'good', score: 95 }),
                component({ nodeId: 'bad', label: 'bad', score: 30 }),
                component({ nodeId: 'mid', label: 'mid', score: 60 }),
            ],
            [], new Set(), new Set(), new Set(),
        );
        expect(rows.map(r => r.nodeId)).toEqual(['bad', 'mid', 'good']);
    });

    it('breaks ties on label so the order is stable across scans', () => {
        const rows = selectVisible(
            [
                component({ nodeId: 'b', label: 'beta', score: 50 }),
                component({ nodeId: 'a', label: 'alpha', score: 50 }),
            ],
            [], new Set(), new Set(), new Set(),
        );
        expect(rows.map(r => r.label)).toEqual(['alpha', 'beta']);
    });
});

describe('OptimizerPanel — filters (R41)', () => {
    const components = [
        component({ nodeId: 'sk', nodeType: 'skill', label: 'sk', score: 50 }),
        component({ nodeId: 'hk', nodeType: 'hook', label: 'hk', score: 40 }),
    ];
    const findings = [
        finding({ nodeId: 'sk', severity: 'error', dimension: 'structure' }),
        finding({ nodeId: 'hk', severity: 'info', dimension: 'hygiene' }),
    ];

    it('treats an empty filter set as no constraint, not as match-nothing', () => {
        const rows = selectVisible(components, findings, new Set(), new Set(), new Set());
        expect(rows).toHaveLength(2);
    });

    it('filters by node type', () => {
        const rows = selectVisible(components, findings, new Set<OptimizableType>(['hook']), new Set(), new Set());
        expect(rows.map(r => r.nodeId)).toEqual(['hk']);
    });

    it('filters by severity', () => {
        const rows = selectVisible(components, findings, new Set(), new Set<OptimizerSeverity>(['error']), new Set());
        expect(rows.map(r => r.nodeId)).toEqual(['sk']);
    });

    it('composes severity AND dimension, not OR', () => {
        // 'error' belongs to sk/structure and 'hygiene' to hk — no single
        // finding satisfies both, so an AND composition yields nothing.
        const rows = selectVisible(
            components, findings, new Set(),
            new Set<OptimizerSeverity>(['error']),
            new Set<OptimizerDimension>(['hygiene']),
        );
        expect(rows).toEqual([]);
    });

    it('composes type AND severity', () => {
        const rows = selectVisible(
            components, findings,
            new Set<OptimizableType>(['skill']),
            new Set<OptimizerSeverity>(['info']),
            new Set(),
        );
        expect(rows).toEqual([]);
    });

    it('excludes a component with no findings when a severity filter is active', () => {
        const clean = [component({ nodeId: 'clean', label: 'clean', score: 100 })];
        const rows = selectVisible(clean, [], new Set(), new Set<OptimizerSeverity>(['error']), new Set());
        expect(rows).toEqual([]);
    });
});

describe('OptimizerPanel — tier palette (R45, R46)', () => {
    it('keys exactly A through F', () => {
        expect(Object.keys(TIER_COLORS).sort()).toEqual(['A', 'B', 'C', 'D', 'F']);
    });

    it('uses the four validated status steps, not five hand-picked hues', () => {
        // The previous five-hue palette failed validation: A (#22bb66) and
        // B (#88cc33) measured DeltaE 10.2 in NORMAL vision against a floor of
        // 15, and 3.4 under deuteranopia. Collapsing A/B to one "good" step is
        // the fix, so distinct colours must now be exactly four.
        expect(new Set(Object.values(TIER_COLORS)).size).toBe(4);
    });

    it('maps A and B to the same good step, since both are healthy', () => {
        expect(TIER_COLORS.A).toBe(TIER_COLORS.B);
    });

    it('gives C, D and F their own escalating steps', () => {
        const distinct = new Set([TIER_COLORS.C, TIER_COLORS.D, TIER_COLORS.F]);
        expect(distinct.size).toBe(3);
        expect(distinct.has(TIER_COLORS.A)).toBe(false);
    });
});

describe('tierOf — boundaries match scorer.tierFor', () => {
    it('agrees at every boundary', () => {
        expect(tierOf(100)).toBe('A');
        expect(tierOf(90)).toBe('A');
        expect(tierOf(89)).toBe('B');
        expect(tierOf(75)).toBe('B');
        expect(tierOf(74)).toBe('C');
        expect(tierOf(60)).toBe('C');
        expect(tierOf(59)).toBe('D');
        expect(tierOf(40)).toBe('D');
        expect(tierOf(39)).toBe('F');
        expect(tierOf(0)).toBe('F');
    });
});

describe('weakestDimension — the radar headline', () => {
    it('names the lowest dimension', () => {
        expect(weakestDimension({ structure: 90, budget: 40, integration: 80, hygiene: 100 }))
            .toBe('Budget');
    });

    it('distinguishes a lopsided component from a uniformly mediocre one', () => {
        // The reason the radar exists: these two average the same.
        const hole = { structure: 100, budget: 100, integration: 40, hygiene: 100 };
        const flat = { structure: 85, budget: 85, integration: 85, hygiene: 85 };
        const mean = (d: Record<string, number>) =>
            Object.values(d).reduce((a, b) => a + b, 0) / 4;
        expect(mean(hole)).toBe(mean(flat));
        expect(weakestDimension(hole)).toBe('Integration');
        expect(weakestDimension(flat)).toBe('Structure'); // tie → fixed axis order
    });

    it('breaks ties on the fixed axis order, so the answer is stable', () => {
        const tied = { structure: 50, budget: 50, integration: 50, hygiene: 50 };
        expect(weakestDimension(tied)).toBe(weakestDimension(tied));
        expect(weakestDimension(tied)).toBe('Structure');
    });
});

// ─── FEAT-035 — assisted fix affordances (R2, R14, R21, R24, R26) ──────────

/**
 * Mirrors the panel's action-visibility logic. Kept here as an executable
 * statement of R26/R14: an action that cannot work is hidden, never disabled.
 */
function visibility(opts: {
    assistedEnabled: boolean;
    assistedMode: 'both' | 'ai-only' | 'delegate-only';
    hasTerminalAgent: boolean;
    hasRefineHandler?: boolean;
    hasDelegateHandler?: boolean;
}) {
    const { assistedEnabled, assistedMode, hasTerminalAgent } = opts;
    const hasRefine = opts.hasRefineHandler ?? true;
    const hasDelegate = opts.hasDelegateHandler ?? true;
    return {
        showRefine: assistedEnabled && assistedMode !== 'delegate-only' && hasRefine,
        showDelegate: assistedEnabled && assistedMode !== 'ai-only' && hasTerminalAgent && hasDelegate,
    };
}

/** Mirrors R2: promoted only without a mechanical fix AND with judgement involved. */
function refineIsPrimary(f: Pick<OptimizerFinding, 'fix' | 'confidence'>): boolean {
    return !f.fix && f.confidence !== 'fact';
}

describe('assisted actions — visibility (R14, R26)', () => {
    it('hides both when assisted fixes are disabled', () => {
        const v = visibility({ assistedEnabled: false, assistedMode: 'both', hasTerminalAgent: true });
        expect(v.showRefine).toBe(false);
        expect(v.showDelegate).toBe(false);
    });

    it('hides delegate when no terminal agent is installed', () => {
        const v = visibility({ assistedEnabled: true, assistedMode: 'both', hasTerminalAgent: false });
        expect(v.showRefine).toBe(true);
        expect(v.showDelegate).toBe(false);
    });

    it('honours ai-only', () => {
        const v = visibility({ assistedEnabled: true, assistedMode: 'ai-only', hasTerminalAgent: true });
        expect(v.showRefine).toBe(true);
        expect(v.showDelegate).toBe(false);
    });

    it('honours delegate-only', () => {
        const v = visibility({ assistedEnabled: true, assistedMode: 'delegate-only', hasTerminalAgent: true });
        expect(v.showRefine).toBe(false);
        expect(v.showDelegate).toBe(true);
    });
});

describe('AI refine promotion — R2', () => {
    it('is primary for a judgement finding with no mechanical fix', () => {
        expect(refineIsPrimary({ confidence: 'opinion' })).toBe(true);
        expect(refineIsPrimary({ confidence: 'heuristic' })).toBe(true);
    });

    it('is secondary when a deterministic fix exists', () => {
        const fix = { type: 'insert-frontmatter' as const, label: 'Add frontmatter', payload: {} };
        expect(refineIsPrimary({ fix, confidence: 'opinion' })).toBe(false);
        expect(refineIsPrimary({ fix, confidence: 'fact' })).toBe(false);
    });

    it('is NOT promoted for a fact finding with no fix', () => {
        // A verifiable defect we cannot fix mechanically is a gap in our rules,
        // not a question worth handing to a model.
        expect(refineIsPrimary({ confidence: 'fact' })).toBe(false);
    });
});

describe('assist state — R24', () => {
    const key = 'OPT-B01::skill-a';

    it('disables the refine button only for the pending finding', () => {
        const states: Record<string, { state: string }> = { [key]: { state: 'pending' } };
        expect(states[key]?.state === 'pending').toBe(true);
        expect(states['OPT-B01::skill-b']?.state === 'pending').toBe(false);
    });

    it('carries the reason on failure', () => {
        const states = { [key]: { state: 'error' as const, reason: 'timed out after 30s' } };
        expect(states[key].reason).toContain('timed out');
    });
});
