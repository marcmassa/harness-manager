// FEAT-034 — Component Optimizer panel (T45–T51, R37–R44, R50)
//
// Visual language deliberately mirrors AdvisoryPanel.tsx: same header bar with a
// Re-scan button, same pill idiom for severity, same theme variables. The
// component list is a div grid rather than a <table> so the row-expansion
// animation matches the other panels.

import * as React from 'react';
import { AskHostButton } from './components/AskHostButton.js';
import type {
    ComponentScore,
    OptimizerDimension,
    OptimizerFinding,
    OptimizerReport,
    OptimizerSeverity,
    ScoreTier,
    OptimizableType,
} from '../optimizer/types.js';

const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px' };

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

const SEVERITY_PALETTE: Record<OptimizerSeverity, { bg: string; fg: string }> = {
    error:   { bg: 'rgba(209, 52, 56, 0.14)',  fg: '#d13438' },
    warning: { bg: 'rgba(212, 168, 74, 0.14)', fg: '#d4a84a' },
    info:    { bg: 'rgba(42, 161, 152, 0.14)', fg: '#2aa198' },
};

const ALL_TYPES: OptimizableType[] = ['agent', 'subagent', 'skill', 'steering', 'hook'];
const ALL_SEVERITIES: OptimizerSeverity[] = ['error', 'warning', 'info'];
const ALL_DIMENSIONS: OptimizerDimension[] = [
    'structure', 'clarity', 'budget', 'integration', 'hygiene', 'consistency',
];

function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString();
    } catch {
        return '—';
    }
}

const SeverityPill = ({ value }: { value: OptimizerSeverity }) => {
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

const TierBadge = ({ tier, score }: { tier: ScoreTier; score: number }) => (
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

const DIMENSION_LABEL: Record<OptimizerDimension, string> = {
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
    budget:      { question: 'What does it cost to load into context?', rules: 'OPT-B01, B02, B03' },
    integration: { question: 'How does it relate to the rest of the architecture?', rules: 'OPT-O01, O02, O03, D01, D02' },
    hygiene:     { question: 'Is it safe and portable — no machine paths, no secrets?', rules: 'OPT-H01, H02' },
    consistency: { question: 'Does it look like your other components of the same type?', rules: 'OPT-C01, C02' },
};

/** Axis order is fixed. Changing it would change the shape without changing the data. */
const RADAR_AXES: OptimizerDimension[] = [
    'structure', 'clarity', 'budget', 'integration', 'hygiene', 'consistency',
];

/** Same boundaries as scorer.tierFor — duplicated here to keep the panel vscode-free. */
export function tierOf(score: number): ScoreTier {
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
export function weakestDimension(dimensions: Record<OptimizerDimension, number>): string {
    let worst = RADAR_AXES[0];
    for (const d of RADAR_AXES) {
        if (dimensions[d] < dimensions[worst]) worst = d;
    }
    return DIMENSION_LABEL[worst];
}

function radarPoint(cx: number, cy: number, radius: number, index: number, count: number, value: number) {
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
    dimensions: Record<OptimizerDimension, number>;
    tier: ScoreTier;
    size?: number;
    title: string;
}) => {
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
    const accent = TIER_COLORS[tier];

    const points = RADAR_AXES.map((dim, i) =>
        radarPoint(cx, cy, radius, i, RADAR_AXES.length, dimensions[dim]));
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
        .map(d => `${DIMENSION_LABEL[d]} ${Math.round(dimensions[d])}`)
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
                        <tspan dx="4" opacity={0.85}>{Math.round(dimensions[dim])}</tspan>
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

/** Shared button geometry, so every role reads as the same control family. */
const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 12px',
    minHeight: '26px',
    fontSize: '0.88em',
    fontWeight: 600,
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
    lineHeight: 1,
};

/** Primary action — the quick fix. The only button that changes files. */
const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: '1px solid transparent',
    boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
};

/**
 * Secondary action. Filled rather than transparent: the previous version was a
 * hairline outline on the panel background and read as text, not as something
 * pressable.
 */
const btnSubtle: React.CSSProperties = {
    ...btnBase,
    fontWeight: 500,
    background: 'var(--vscode-button-secondaryBackground, color-mix(in srgb, var(--vscode-foreground) 12%, transparent))',
    color: 'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
    border: '1px solid color-mix(in srgb, var(--vscode-foreground) 18%, transparent)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
};

/** Square icon button — the Re-scan control. */
const btnIcon = (disabled: boolean): React.CSSProperties => ({
    width: '26px',
    height: '26px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95em',
    background: 'transparent',
    color: 'var(--vscode-foreground)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: 6,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
    padding: 0,
});

/** File reference — a link, not a box. It navigates; it does not act. */
const btnLink: React.CSSProperties = {
    padding: 0,
    fontSize: '0.9em',
    background: 'none',
    border: 'none',
    color: 'var(--vscode-textLink-foreground)',
    cursor: 'pointer',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    textDecoration: 'none',
    textAlign: 'left',
};

/** Small toggle-chip used by all three filter rows. */
const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            fontSize: '0.68em', padding: '2px 8px', borderRadius: '999px', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: active ? 700 : 500,
            background: active
                ? 'color-mix(in srgb, var(--vscode-focusBorder) 18%, transparent)'
                : 'transparent',
            color: active ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
            border: `1px solid ${active ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)'}`,
        }}
    >
        {label}
    </button>
);


/**
 * Legend — what each axis means, which rules feed it, and where this
 * architecture currently stands on it. Without this the radar is a pretty
 * shape: "Budget 72" is opaque until you know which rules produced it.
 */
const RadarLegend = ({
    dimensions,
    countsByDimension,
    open,
    onToggle,
}: {
    dimensions: Record<OptimizerDimension, number>;
    countsByDimension?: Record<OptimizerDimension, number>;
    open: boolean;
    onToggle: () => void;
}) => (
    <div style={{ borderTop: '1px solid var(--vscode-panel-border)' }}>
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            style={{
                ...btnSubtle,
                border: 'none',
                width: '100%',
                textAlign: 'left',
                padding: `${SPACE.xs} ${SPACE.md}`,
                fontSize: '0.72em',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
            }}
        >
            {open ? '▾' : '▸'} What the axes measure
        </button>

        {open && (
            <div style={{ padding: `0 ${SPACE.md} ${SPACE.sm}` }}>
                {RADAR_AXES.map(dim => {
                    const value = Math.round(dimensions[dim]);
                    const count = countsByDimension?.[dim];
                    return (
                        <div
                            key={dim}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '108px 42px 1fr',
                                gap: SPACE.sm,
                                alignItems: 'baseline',
                                padding: '3px 0',
                                fontSize: '0.76em',
                                borderBottom: '1px solid color-mix(in srgb, var(--vscode-panel-border) 45%, transparent)',
                            }}
                        >
                            <strong>{DIMENSION_LABEL[dim]}</strong>
                            <span
                                title={`${value} / 100`}
                                style={{ color: TIER_COLORS[tierOf(value)], fontWeight: 700 }}
                            >
                                {value}
                            </span>
                            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                                {DIMENSION_DETAIL[dim].question}
                                <br />
                                <code style={{ fontSize: '0.9em', opacity: 0.75 }}>
                                    {DIMENSION_DETAIL[dim].rules}
                                </code>
                                {typeof count === 'number' && (
                                    <span style={{ marginLeft: SPACE.sm, opacity: 0.75 }}>
                                        · {count} finding{count === 1 ? '' : 's'}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
                <p style={{
                    margin: `${SPACE.sm} 0 0`,
                    fontSize: '0.72em',
                    color: 'var(--vscode-descriptionForeground)',
                    lineHeight: 1.5,
                }}>
                    Each axis starts at 100 and loses points per finding
                    (error −25, warning −10, info −3). A rule can only reach the
                    severity its evidence supports: rules that verify a fact may
                    escalate to error, approximate detections cap at warning, and
                    rules firing on an unvalidated threshold cap at info.
                </p>
            </div>
        )}
    </div>
);

export type AssistState = 'idle' | 'pending' | 'ok' | 'error';

export interface OptimizerPanelProps {
    report: OptimizerReport | null;
    isScanning: boolean;
    enabled: boolean;
    // FEAT-035
    assistedEnabled?: boolean;
    assistedMode?: 'both' | 'ai-only' | 'delegate-only';
    hasTerminalAgent?: boolean;
    /** What this host can actually do — probed by the extension. */
    aiCapabilities?: { hasEditorModel: boolean; chatHostName?: string; hasApiKey: boolean };
    /** Name of the host's own chat agent, when this editor exposes one. */
    chatHostName?: string;
    onHandoffToChat?: (finding: OptimizerFinding) => void;
    aiModels?: string[];
    selectedAiModel?: string;
    assistStates?: Record<string, { state: AssistState; reason?: string }>;
    onAiRefine?: (finding: OptimizerFinding) => void;
    onDelegate?: (scope: { kind: 'finding' | 'component' | 'rule'; nodeId?: string; ruleId?: string }) => void;
    onSelectAiModel?: (model: string) => void;
    onRescan: () => void;
    onApplyFix: (finding: OptimizerFinding) => void;
    onDismissFinding: (finding: OptimizerFinding) => void;
    onRestoreFindings: () => void;
    onOpenFile: (finding: OptimizerFinding) => void;
    onOpenSettings: () => void;
}

export const OptimizerPanel: React.FC<OptimizerPanelProps> = ({
    report, isScanning, enabled, onRescan, onApplyFix,
    onDismissFinding, onRestoreFindings, onOpenFile, onOpenSettings,
    assistedEnabled = false, assistedMode = 'both', hasTerminalAgent = false, chatHostName,
    aiCapabilities,
    aiModels = [], selectedAiModel = '', assistStates = {},
    onAiRefine, onDelegate, onSelectAiModel, onHandoffToChat,
}) => {
    // R26 / R14 — an action that cannot work is hidden, never shown disabled.
    // A model from the host, or a configured API key — without either, AI Refine
    // can only fail, so it is not offered. Mirrors the SDD panel's behaviour.
    const canRefine = aiCapabilities
        ? aiCapabilities.hasEditorModel || aiCapabilities.hasApiKey
        : true;
    const showRefine = assistedEnabled && assistedMode !== 'delegate-only'
        && Boolean(onAiRefine) && canRefine;
    const showDelegate = assistedEnabled && assistedMode !== 'ai-only' && hasTerminalAgent && Boolean(onDelegate);
    // Handoff needs no credentials at all, so it is offered wherever the host
    // exposes a chat command — including editors where AI Refine cannot work.
    const showHandoff = assistedEnabled && assistedMode !== 'delegate-only'
        && Boolean(chatHostName) && Boolean(onHandoffToChat);
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
    const [typeFilter, setTypeFilter] = React.useState<Set<OptimizableType>>(new Set());
    const [sevFilter, setSevFilter] = React.useState<Set<OptimizerSeverity>>(new Set());
    const [dimFilter, setDimFilter] = React.useState<Set<OptimizerDimension>>(new Set());
    const [legendOpen, setLegendOpen] = React.useState(false);

    function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void): void {
        const next = new Set(set);
        if (next.has(value)) next.delete(value); else next.add(value);
        setter(next);
    }

    const findingsByNode = React.useMemo(() => {
        const map = new Map<string, OptimizerFinding[]>();
        for (const f of report?.findings ?? []) {
            const list = map.get(f.nodeId);
            if (list) list.push(f); else map.set(f.nodeId, [f]);
        }
        return map;
    }, [report]);

    // R41: the three filters compose with AND semantics. An empty filter set
    // means "no constraint", not "match nothing".
    const visible = React.useMemo(() => {
        const components = report?.components ?? [];
        return components
            .filter(c => typeFilter.size === 0 || typeFilter.has(c.nodeType))
            .filter(c => {
                if (sevFilter.size === 0 && dimFilter.size === 0) return true;
                const findings = findingsByNode.get(c.nodeId) ?? [];
                return findings.some(f =>
                    (sevFilter.size === 0 || sevFilter.has(f.severity)) &&
                    (dimFilter.size === 0 || dimFilter.has(f.dimension)),
                );
            })
            .slice()
            .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label)); // R39: worst first
    }, [report, typeFilter, sevFilter, dimFilter, findingsByNode]);

    // R50 — disabled state naming the setting.
    if (!enabled) {
        return (
            <div style={{ padding: SPACE.lg, color: 'var(--vscode-descriptionForeground)', fontSize: '0.85em' }}>
                <p style={{ marginTop: 0 }}>The Component Optimizer is switched off.</p>
                <p>
                    Enable <code>harness-dashboard.optimizer.enabled</code> to score your agents,
                    subagents, skills, steering files and hooks.
                </p>
                <button type="button" onClick={onOpenSettings} style={btnPrimary}>
                    Open settings
                </button>
            </div>
        );
    }

    const counts = report?.findingCounts.bySeverity;

    // Architecture-level dimension means. This is the "balance" view: four
    // averages hide which components are weak, but reveal WHICH DIMENSION the
    // architecture as a whole is weakest in — a different question than the
    // per-component table answers.
    const architectureDimensions = React.useMemo(() => {
        const comps = report?.components ?? [];
        const out = {} as Record<OptimizerDimension, number>;
        for (const d of ALL_DIMENSIONS) {
            out[d] = comps.length === 0
                ? 100
                : comps.reduce((sum, c) => sum + c.dimensions[d], 0) / comps.length;
        }
        return out;
    }, [report]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {/* ── Header (R38) ───────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: SPACE.md, padding: `${SPACE.sm} ${SPACE.md}`,
                borderBottom: '1px solid var(--vscode-panel-border)', flexWrap: 'wrap',
            }}>
                {report && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                        <DimensionRadar
                            dimensions={architectureDimensions}
                            tier={tierOf(report.architectureScore)}
                            size={150}
                            title="Architecture balance across the four scoring dimensions"
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '1.9em', fontWeight: 700, lineHeight: 1 }}>
                                {report.architectureScore}
                            </span>
                            <span style={{ fontSize: '0.68em', color: 'var(--vscode-descriptionForeground)' }}>
                                / 100 architecture score
                            </span>
                            <span style={{ fontSize: '0.68em', color: 'var(--vscode-descriptionForeground)' }}>
                                weakest: <strong>{weakestDimension(architectureDimensions)}</strong>
                            </span>
                        </div>
                    </div>
                )}

                <span style={{ fontSize: '0.75em', color: 'var(--vscode-descriptionForeground)' }}>
                    {report ? `${report.totalComponents} component${report.totalComponents === 1 ? '' : 's'}` : '—'}
                    {report?.truncated && ' (truncated at 500)'}
                </span>

                {counts && (
                    <span style={{ display: 'inline-flex', gap: SPACE.xs }}>
                        {ALL_SEVERITIES.filter(s => counts[s] > 0).map(s => (
                            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72em' }}>
                                <SeverityPill value={s} />
                                <strong>{counts[s]}</strong>
                            </span>
                        ))}
                    </span>
                )}

                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: SPACE.sm }}>
                    {showRefine && (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE.xs, fontSize: '0.7em', color: 'var(--vscode-descriptionForeground)' }}>
                            model
                            <select
                                value={selectedAiModel}
                                onChange={e => onSelectAiModel?.(e.target.value)}
                                title="Model used by AI refine. Auto uses the editor's own provider first, then any configured API."
                                style={{
                                    fontSize: '1em', fontFamily: 'inherit', padding: '1px 4px', borderRadius: 5,
                                    background: 'var(--vscode-dropdown-background)',
                                    color: 'var(--vscode-dropdown-foreground)',
                                    border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
                                }}
                            >
                                <option value="">Auto</option>
                                {aiModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </label>
                    )}
                    {(report?.dismissedCount ?? 0) > 0 && (
                        <button
                            type="button"
                            onClick={onRestoreFindings}
                            title="Restore all dismissed findings"
                            style={{ ...btnSubtle, fontSize: '0.72em' }}
                        >
                            ⟲ {report?.dismissedCount} dismissed
                        </button>
                    )}
                    <span style={{ fontSize: '0.7em', color: 'var(--vscode-descriptionForeground)' }}>
                        {isScanning ? 'Scanning…' : report ? formatTime(report.scanTimestamp) : ''}
                    </span>
                    <button
                        type="button"
                        onClick={onRescan}
                        disabled={isScanning}
                        title="Re-scan components"
                        aria-label="Re-scan components"
                        style={btnIcon(isScanning)}
                    >
                        <span style={{
                            display: 'inline-block',
                            animation: isScanning ? 'harnessSpin 0.9s linear infinite' : 'none',
                        }}>↻</span>
                    </button>
                </span>
            </div>

            {report && (
                <RadarLegend
                    dimensions={architectureDimensions}
                    countsByDimension={report.findingCounts.byDimension}
                    open={legendOpen}
                    onToggle={() => setLegendOpen(v => !v)}
                />
            )}

            {/* ── Filters (R41) ──────────────────────────────────────────── */}
            <div style={{
                display: 'flex', gap: SPACE.md, padding: `${SPACE.xs} ${SPACE.md}`, flexWrap: 'wrap',
                borderBottom: '1px solid var(--vscode-panel-border)',
            }}>
                <span style={{ display: 'inline-flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
                    {ALL_TYPES.map(t => (
                        <FilterChip key={t} label={t} active={typeFilter.has(t)}
                            onClick={() => toggle(typeFilter, t, setTypeFilter)} />
                    ))}
                </span>
                <span style={{ display: 'inline-flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
                    {ALL_SEVERITIES.map(s => (
                        <FilterChip key={s} label={s} active={sevFilter.has(s)}
                            onClick={() => toggle(sevFilter, s, setSevFilter)} />
                    ))}
                </span>
                <span style={{ display: 'inline-flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
                    {ALL_DIMENSIONS.map(d => (
                        <FilterChip key={d} label={d} active={dimFilter.has(d)}
                            onClick={() => toggle(dimFilter, d, setDimFilter)} />
                    ))}
                </span>
            </div>

            {/* ── Per-rule batch delegation (R23) ────────────────────────── */}
            {showDelegate && report?.ok && report.findings.length > 0 && (() => {
                // Grouped by rule because that is the shape a batch actually has:
                // one kind of defect across many components, fixable with one
                // consistent instruction.
                const byRule = new Map<string, number>();
                for (const f of report.findings) byRule.set(f.ruleId, (byRule.get(f.ruleId) ?? 0) + 1);
                const batches = [...byRule.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
                if (batches.length === 0) return null;
                return (
                    <div style={{
                        display: 'flex', gap: SPACE.xs, alignItems: 'center', flexWrap: 'wrap',
                        padding: `${SPACE.xs} ${SPACE.md}`,
                        borderBottom: '1px solid var(--vscode-panel-border)',
                    }}>
                        <span style={{ fontSize: '0.7em', color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            batch
                        </span>
                        {batches.map(([ruleId, count]) => (
                            <button
                                key={ruleId}
                                type="button"
                                onClick={() => onDelegate?.({ kind: 'rule', ruleId })}
                                style={{ ...btnSubtle, fontSize: '0.8em' }}
                                title={`Delegate all ${count} ${ruleId} findings to a terminal agent. The agent edits files directly — no diff preview.`}
                            >
                                {ruleId} · {count}
                            </button>
                        ))}
                    </div>
                );
            })()}

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {report && !report.ok && (
                    <div style={{ padding: SPACE.md, color: SEVERITY_PALETTE.error.fg, fontSize: '0.8em' }}>
                        Scan failed: {report.error ?? 'unknown error'}
                    </div>
                )}

                {/* R44 — empty state, not an empty table. */}
                {report && report.ok && report.totalComponents === 0 && (
                    <div style={{ padding: SPACE.lg, color: 'var(--vscode-descriptionForeground)', fontSize: '0.85em' }}>
                        <p style={{ marginTop: 0 }}>No optimizable components found.</p>
                        <p>
                            The optimizer scores agents, subagents, skills, steering files and hooks.
                            Add one from the whiteboard and re-scan.
                        </p>
                    </div>
                )}

                {report && report.ok && report.totalComponents > 0 && visible.length === 0 && (
                    <div style={{ padding: SPACE.lg, color: 'var(--vscode-descriptionForeground)', fontSize: '0.85em' }}>
                        No component matches the active filters.
                    </div>
                )}

                {visible.map(component => {
                    const findings = (findingsByNode.get(component.nodeId) ?? []).filter(f =>
                        (sevFilter.size === 0 || sevFilter.has(f.severity)) &&
                        (dimFilter.size === 0 || dimFilter.has(f.dimension)),
                    );
                    const isOpen = expanded.has(component.nodeId);
                    return (
                        <div key={component.nodeId} style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                            {/* Row (R39, R40) */}
                            <div
                                onClick={() => toggle(expanded, component.nodeId, setExpanded)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: SPACE.sm, cursor: 'pointer',
                                    padding: `${SPACE.sm} ${SPACE.md}`, fontSize: '0.82em', userSelect: 'none',
                                }}
                            >
                                <span style={{ opacity: 0.6, width: '10px' }}>{isOpen ? '▾' : '▸'}</span>
                                <TierBadge tier={component.tier} score={component.score} />
                                <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {component.label}
                                </strong>
                                <span style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)' }}>
                                    {component.nodeType}
                                </span>
                                <span
                                    title="Estimated tokens"
                                    style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)', minWidth: '64px', textAlign: 'right' }}
                                >
                                    ~{component.tokenEstimate} tok
                                </span>
                                <span style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)', minWidth: '58px', textAlign: 'right' }}>
                                    {component.findingCount} finding{component.findingCount === 1 ? '' : 's'}
                                </span>
                                {showDelegate && component.findingCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); onDelegate?.({ kind: 'component', nodeId: component.nodeId }); }}
                                        style={{ ...btnSubtle, fontSize: '0.8em' }}
                                        title={`Delegate all ${component.findingCount} findings on this component to a terminal agent`}
                                    >
                                        Delegate all
                                    </button>
                                )}
                            </div>

                            {/* Expansion (R40) */}
                            {isOpen && (
                                <div style={{ padding: `0 ${SPACE.md} ${SPACE.sm} ${SPACE.lg}`, display: 'flex', gap: SPACE.md, alignItems: 'flex-start' }}>
                                    <div style={{ flexShrink: 0, paddingTop: SPACE.sm }}>
                                        <DimensionRadar
                                            dimensions={component.dimensions}
                                            tier={component.tier}
                                            size={150}
                                            title={`${component.label} dimension balance`}
                                        />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                    {findings.length === 0 && (
                                        <div style={{ fontSize: '0.78em', color: 'var(--vscode-descriptionForeground)', padding: SPACE.sm }}>
                                            No findings — this component is clean.
                                        </div>
                                    )}
                                    {findings.map((f, i) => (
                                        <div
                                            key={`${f.ruleId}-${i}`}
                                            style={{
                                                display: 'flex', flexDirection: 'column', gap: SPACE.xs,
                                                padding: SPACE.sm, marginBottom: SPACE.xs, fontSize: '0.8em',
                                                border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))',
                                                borderRadius: '4px',
                                                background: 'var(--vscode-editorWidget-background, transparent)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
                                                <SeverityPill value={f.severity} />
                                                <code style={{ fontSize: '0.9em', opacity: 0.75 }}>{f.ruleId}</code>
                                                <strong style={{ flex: 1 }}>{f.title}</strong>
                                            </div>
                                            <div style={{ color: 'var(--vscode-descriptionForeground)' }}>{f.detail}</div>
                                            <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                                                {f.filePath && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenFile(f)}
                                                        style={btnLink}
                                                        title={f.line ? `Open at line ${f.line}` : 'Open file'}
                                                    >
                                                        {f.filePath}{f.line ? `:${f.line}` : ''}
                                                    </button>
                                                )}
                                                {f.fix && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onApplyFix(f)}
                                                        style={btnPrimary}
                                                        title="Preview this fix in a diff before applying — nothing is written until you confirm"
                                                    >
                                                        {f.fix.label}…
                                                    </button>
                                                )}
                                                {showRefine && (() => {
                                                    const key = `${f.ruleId}::${f.nodeId}`;
                                                    const st = assistStates[key];
                                                    const pending = st?.state === 'pending';
                                                    // R2: promoted only where there is no mechanical fix AND
                                                    // the rule involves judgement. A `fact` finding with no fix
                                                    // is a gap in our rules, not a question for a model.
                                                    const primary = !f.fix && f.confidence !== 'fact';
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => onAiRefine?.(f)}
                                                            disabled={pending}
                                                            style={{
                                                                ...(primary ? btnPrimary : btnSubtle),
                                                                opacity: pending ? 0.6 : 1,
                                                                cursor: pending ? 'default' : 'pointer',
                                                            }}
                                                            title="Ask the editor's model for a rewrite. You review it in a diff before anything is written."
                                                        >
                                                            {pending ? 'Refining…' : 'AI refine…'}
                                                        </button>
                                                    );
                                                })()}
                                                {showHandoff && (
                                                    <AskHostButton
                                                        hostName={chatHostName}
                                                        onClick={() => onHandoffToChat?.(f)}
                                                        primary={!showRefine && !f.fix}
                                                        subject={`the fix prompt for ${f.ruleId}`}
                                                    />
                                                )}
                                                {showDelegate && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelegate?.({ kind: 'finding', nodeId: f.nodeId, ruleId: f.ruleId })}
                                                        style={btnSubtle}
                                                        title="Hand this to a terminal agent. It edits files directly — there is no diff preview."
                                                    >
                                                        Delegate…
                                                    </button>
                                                )}
                                                {(() => {
                                                    const st = assistStates[`${f.ruleId}::${f.nodeId}`];
                                                    if (!st || st.state === 'idle' || st.state === 'pending') return null;
                                                    const good = st.state === 'ok';
                                                    return (
                                                        <span style={{
                                                            fontSize: '0.85em',
                                                            color: good ? TIER_COLORS.A : SEVERITY_PALETTE.error.fg,
                                                        }}>
                                                            {good ? '✓ applied' : `✕ ${st.reason ?? 'failed'}`}
                                                        </span>
                                                    );
                                                })()}
                                                <button
                                                    type="button"
                                                    onClick={() => onDismissFinding(f)}
                                                    style={{ ...btnSubtle, marginLeft: 'auto' }}
                                                    title="Hide this finding and exclude it from the score"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OptimizerPanel;
