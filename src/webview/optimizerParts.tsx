// Optimizer panel pieces: tokens, pills, tier badge, dimension labels and radar.
import * as React from 'react';
import type { OptimizerDimension, OptimizerSeverity, ScoreTier, OptimizableType } from '../optimizer/types.js';

export const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px' };

/**
 * Tier palette — validated status steps.
 *
 * The original five hand-picked hues failed validation: `#22bb66` (A) and
 * `#88cc33` (B) measured ΔE 10.2 in NORMAL vision (floor is 15) and ΔE 3.4 under
 * deuteranopia, i.e. two adjacent tiers were effectively the same colour. Five
 * bands was one too many to keep separable.
 *
 * A tier is an ordered health scale, not an identity set, so it takes the fixed
 * four-role status palette. The letter carries the five-way distinction; the
 * colour carries the four-way health signal, and A/B share "good" because both
 * genuinely are. Status colour never travels alone here — the score number and
 * the tier letter are always adjacent.
 */
export const TIER_COLORS: Record<ScoreTier, string> = {
    A: '#0ca30c', // good
    B: '#0ca30c', // good
    C: '#fab219', // warning
    D: '#ec835a', // serious
    F: '#d03b3b', // critical
};

export const SEVERITY_PALETTE: Record<OptimizerSeverity, { bg: string; fg: string }> = {
    error:   { bg: 'rgba(209, 52, 56, 0.14)',  fg: '#d13438' },
    warning: { bg: 'rgba(212, 168, 74, 0.14)', fg: '#d4a84a' },
    info:    { bg: 'rgba(42, 161, 152, 0.14)', fg: '#2aa198' },
};

export const ALL_TYPES: OptimizableType[] = ['agent', 'subagent', 'skill', 'steering', 'hook'];
export const ALL_SEVERITIES: OptimizerSeverity[] = ['error', 'warning', 'info'];
export const ALL_DIMENSIONS: OptimizerDimension[] = [
    'structure', 'clarity', 'budget', 'integration', 'hygiene', 'consistency',
];

export function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString();
    } catch {
        return '—';
    }
}

export const SeverityPill = ({ value }: { value: OptimizerSeverity }) => {
    const c = SEVERITY_PALETTE[value];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', fontSize: '0.65em', fontWeight: 700,
            letterSpacing: '0.4px', textTransform: 'uppercase', padding: '1px 7px',
            borderRadius: '999px', background: c.bg, color: c.fg,
            border: `1px solid color-mix(in srgb, ${c.fg} 40%, transparent)`, whiteSpace: 'nowrap',
        }}>
            {value}
        </span>
    );
};

/** FEAT-043 R3: a component with no evaluable dimension is unscored, not 0 or 100. */
export const TierBadge = ({ tier, score }: { tier: ScoreTier | null; score: number | null }) => (
    tier === null || score === null ? (
        <span title="No dimension could be evaluated for this component" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '46px', padding: '1px 7px',
            borderRadius: '999px', fontSize: '0.7em', fontWeight: 700, color: 'var(--vscode-descriptionForeground)',
            border: '1px dashed var(--vscode-panel-border)',
        }}>Unscored</span>
    ) :
    <span
        title={`Score ${score} / 100 — tier ${tier}`}
        style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            minWidth: '46px', padding: '1px 7px', borderRadius: '999px', fontSize: '0.7em',
            fontWeight: 700, background: `color-mix(in srgb, ${TIER_COLORS[tier]} 16%, transparent)`,
            color: TIER_COLORS[tier],
            border: `1px solid color-mix(in srgb, ${TIER_COLORS[tier]} 45%, transparent)`,
        }}
    >
        {score} {tier}
    </span>
);

// ===== Dimension radar =====
//
// FORM CHOICE. A radar is the wrong default for most data — area grows with the
// square of the value, and axis order invents shape. It is defensible here on
// three counts that rarely hold together: the six axes are FIXED and never
// reordered, they share one unit (a 0–100 score, so they are commensurable), and
// the question being asked is literally about shape — "is this balanced, or does
// it have one hole?". A component at 100/100/40/100 and one at 85/85/85/85 score
// the same on average and mean opposite things; the single number cannot show
// that and the polygon shows it instantly.
//
// The known weakness — imprecise reading — is mitigated on four fronts: every
// axis is direct-labelled with its value, the radial scale is numbered at 0 / 25
// / 50 / 75 / 100, alternating faint bands separate those ranges, and every ring
// vertex is marked so each axis can be counted, not just the labelled one. The
// grid stays hairline throughout — readability comes from banding and labels,
// never from heavier strokes that would compete with the data.
//
// Inline SVG, no charting library: the webview runs under a strict CSP and the
// project forbids adding a dependency where an in-set option exists.

export const DIMENSION_LABEL: Record<OptimizerDimension, string> = {
    structure: 'Structure',
    clarity: 'Clarity',
    budget: 'Budget',
    integration: 'Integration',
    hygiene: 'Hygiene',
    consistency: 'Consistency',
};

/** What each axis actually asks, and which rules answer it. Shown in the legend. */
export const DIMENSION_DETAIL: Record<OptimizerDimension, { question: string; rules: string }> = {
    structure:   { question: 'Does it parse, is it named right, are the required parts present?', rules: 'OPT-S01, S02, S03, S05, S06' },
    clarity:     { question: 'Can a model act on the prose — does the description say when to use it?', rules: 'OPT-S04, H03' },
    budget:      { question: 'What does it cost to load into context?', rules: 'OPT-B01, B02, B03, K01, K02, K03' },
    integration: { question: 'How does it relate to the rest of the architecture?', rules: 'OPT-O01, O02, O03, D01, D02' },
    hygiene:     { question: 'Is it safe and portable — no machine paths, no secrets?', rules: 'OPT-H01, H02' },
    consistency: { question: 'Does it look like your other components of the same type?', rules: 'OPT-C01, C02' },
};

/** Axis order is fixed. Changing it would change the shape without changing the data. */
export const RADAR_AXES: OptimizerDimension[] = [
    'structure', 'clarity', 'budget', 'integration', 'hygiene', 'consistency',
];

/** Same boundaries as scorer.tierFor — duplicated here to keep the panel vscode-free. */
export function tierOf(score: number): ScoreTier;
export function tierOf(score: number | null): ScoreTier | null;
export function tierOf(score: number | null): ScoreTier | null {
    if (score === null) return null;
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
}

/**
 * The lowest-scoring dimension — the headline the radar makes visible. Ties break
 * on the fixed axis order so the answer is stable between renders.
 */
export function weakestDimension(dimensions: Record<OptimizerDimension, number | null>): string {
    // FEAT-043 R2: an unevaluated dimension is not the weakest one.
    const evaluated = RADAR_AXES.filter(d => dimensions[d] !== null);
    if (evaluated.length === 0) return '—'; // FEAT-043 R3: nothing evaluated, nothing is weakest
    let worst = evaluated[0];
    for (const d of evaluated) {
        if ((dimensions[d] as number) < (dimensions[worst] as number)) worst = d;
    }
    return DIMENSION_LABEL[worst];
}

export function radarPoint(cx: number, cy: number, radius: number, index: number, count: number, value: number) {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2; // start at 12 o'clock
    const r = radius * Math.max(0, Math.min(100, value)) / 100;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export const DimensionRadar = ({
    dimensions,
    tier,
    size = 168,
    title,
}: {
    dimensions: Record<OptimizerDimension, number | null>;
    tier: ScoreTier | null;
    size?: number;
    title: string;
}) => {
    // FEAT-043 R2: unevaluated axes draw at the centre and read "n/a".
    const value = (d: OptimizerDimension) => dimensions[d] ?? 0;
    const axisText = (d: OptimizerDimension) => (dimensions[d] === null ? 'n/a' : String(Math.round(dimensions[d] as number)));
    // The left/right axis labels are anchored outward and run horizontally, so
    // they need more room than the plot square provides. Widening the viewBox
    // (rather than relying on overflow) keeps them inside the element's own box
    // so they cannot overlap whatever sits beside the chart in the flex row.
    // 66 is the measured minimum that keeps the longest label ("Consistency",
    // end-anchored on the upper-left axis) inside the box; 58 overflowed by 3.5px.
    const sideRoom = 66;
    const boxW = size + sideRoom * 2;
    // The top and bottom labels are vertically centred on their anchor point, so
    // half the glyph height falls outside the plot square. Without this the top
    // label was clipped by the viewBox — visible only once rendered, not in the
    // numbers.
    const vRoom = 12;
    const boxH = size + vRoom * 2;
    const pad = 22;
    const cx = boxW / 2;
    const cy = boxH / 2;
    const radius = size / 2 - pad;
    const accent = tier === null ? 'var(--vscode-descriptionForeground)' : TIER_COLORS[tier];

    const points = RADAR_AXES.map((dim, i) =>
        radarPoint(cx, cy, radius, i, RADAR_AXES.length, value(dim)));
    const polygon = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Reference rings. Solid, never dashed — dashing reads as noise.
    const rings = [25, 50, 75, 100];

    /**
     * Alternating bands between rings. This is what makes the ranges readable:
     * the alternative — thickening the ring strokes — would make the grid
     * compete with the data, and a grid must stay recessive. A 4%-alpha fill
     * separates 0–25 / 25–50 / 50–75 / 75–100 without adding a single pixel of
     * line weight.
     *
     * Drawn as one path per band with fill-rule="evenodd": an outer ring and an
     * inner ring wound the same way punch a hole, giving a true annulus.
     */
    const bandPath = (outer: number, inner: number): string => {
        const ringOf = (v: number) => RADAR_AXES
            .map((_, i) => radarPoint(cx, cy, radius, i, RADAR_AXES.length, v))
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(' ') + ' Z';
        return `${ringOf(outer)} ${ringOf(inner)}`;
    };
    const bands = [{ outer: 100, inner: 75 }, { outer: 50, inner: 25 }];

    /**
     * Scale numbers sit centred ON the vertical axis, which means they can land
     * on a spoke, a ring or a data vertex. A surface-coloured stroke painted
     * behind the glyphs keeps them legible over any of those without needing to
     * move them off-axis.
     */
    const scaleHalo: React.CSSProperties = {
        paintOrder: 'stroke',
        stroke: 'var(--vscode-editor-background)',
        strokeWidth: 3,
        strokeLinejoin: 'round',
    };

    const summary = RADAR_AXES
        .map(d => `${DIMENSION_LABEL[d]} ${axisText(d)}`)
        .join(', ');

    return (
        <svg
            width={boxW}
            height={boxH}
            viewBox={`0 0 ${boxW} ${boxH}`}
            role="img"
            aria-label={`${title}. ${summary}.`}
            style={{ display: 'block', flexShrink: 0 }}
        >
            {/* Banded ranges, painted before the rings so the strokes sit on top. */}
            {bands.map(b => (
                <path
                    key={`band-${b.outer}`}
                    d={bandPath(b.outer, b.inner)}
                    fillRule="evenodd"
                    fill="var(--vscode-foreground)"
                    fillOpacity={0.04}
                />
            ))}

            {rings.map(r => {
                const ringPts = RADAR_AXES
                    .map((_, i) => radarPoint(cx, cy, radius, i, RADAR_AXES.length, r))
                    .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                    .join(' ');
                return (
                    <polygon
                        key={r}
                        points={ringPts}
                        fill="none"
                        stroke="var(--vscode-panel-border)"
                        // The 100 ring is the ceiling of the scale, so it reads as
                        // a boundary; the inner rings stay hairline references.
                        strokeWidth={r === 100 ? 1.25 : 0.75}
                        opacity={r === 100 ? 1 : 0.75}
                    />
                );
            })}

            {/* Vertices of every ring: makes each axis countable, not just the
                labelled vertical one, without drawing 24 tick marks. */}
            {rings.slice(0, -1).map(r =>
                RADAR_AXES.map((_, i) => {
                    const p = radarPoint(cx, cy, radius, i, RADAR_AXES.length, r);
                    return (
                        <circle
                            key={`v-${r}-${i}`}
                            cx={p.x}
                            cy={p.y}
                            r={1}
                            fill="var(--vscode-panel-border)"
                            opacity={0.8}
                        />
                    );
                }),
            )}

            {RADAR_AXES.map((_, i) => {
                const end = radarPoint(cx, cy, radius, i, RADAR_AXES.length, 100);
                return (
                    <line
                        key={i}
                        x1={cx} y1={cy} x2={end.x} y2={end.y}
                        stroke="var(--vscode-panel-border)"
                        strokeWidth={0.5}
                        opacity={0.5}
                    />
                );
            })}

            <polygon
                points={polygon}
                fill={accent}
                fillOpacity={0.22}
                stroke={accent}
                strokeWidth={2}
                strokeLinejoin="round"
            />

            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={accent} />
            ))}

            {/* Radial scale: 0 at the centre, 100 at the outer ring. */}
            <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--vscode-descriptionForeground)"
                opacity={0.7}
                style={{ fontSize: '8px', fontFamily: 'inherit', ...scaleHalo }}
            >0</text>
            {rings.map(r => (
                <text
                    key={`scale-${r}`}
                    x={cx}
                    y={cy - (radius * r) / 100}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--vscode-descriptionForeground)"
                    // The ceiling reads a touch stronger than the intermediate steps.
                    opacity={r === 100 ? 0.85 : 0.6}
                    style={{ fontSize: '8px', fontFamily: 'inherit', ...scaleHalo }}
                >{r}</text>
            ))}

            {RADAR_AXES.map((dim, i) => {
                const label = radarPoint(cx, cy, radius + 18, i, RADAR_AXES.length, 100);
                // Anchor derived from the axis angle, so this stays correct for
                // any axis count rather than hard-coding index positions.
                const dx = label.x - cx;
                const anchor = Math.abs(dx) < 1 ? 'middle' : dx > 0 ? 'start' : 'end';
                return (
                    <text
                        key={dim}
                        x={label.x}
                        y={label.y}
                        textAnchor={anchor}
                        dominantBaseline="middle"
                        // Text wears text tokens, never the series colour.
                        fill="var(--vscode-descriptionForeground)"
                        style={{ fontSize: '9px', fontFamily: 'inherit' }}
                    >
                        <tspan fontWeight={600}>{DIMENSION_LABEL[dim]}</tspan>
                        <tspan dx="4" opacity={0.85}>{axisText(dim)}</tspan>
                    </text>
                );
            })}
        </svg>
    );
};

// ===== Button styles =====
// The panel previously used bare <button> elements, which render as raw VS Code
// default buttons and read as unstyled next to the rest of the dashboard. These
// three roles mirror `harnessActionBtnStyle` in index.tsx so the Optimizer looks
// like the same product as the header and the whiteboard toolbar.
