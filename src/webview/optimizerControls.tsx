// Optimizer panel controls: button styles, filter chips and the radar legend.
import * as React from 'react';
import type { OptimizerDimension } from '../optimizer/types.js';
import { BUTTON_BASE } from './styles.js';
import { SPACE, TIER_COLORS, DIMENSION_LABEL, DIMENSION_DETAIL, RADAR_AXES, tierOf } from './optimizerParts.js';

/** Shared button geometry, so every role reads as the same control family. */
export const btnBase: React.CSSProperties = BUTTON_BASE;

/** Primary action — the quick fix. The only button that changes files. */
export const btnPrimary: React.CSSProperties = {
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
export const btnSubtle: React.CSSProperties = {
    ...btnBase,
    fontWeight: 500,
    background: 'var(--vscode-button-secondaryBackground, color-mix(in srgb, var(--vscode-foreground) 12%, transparent))',
    color: 'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
    border: '1px solid color-mix(in srgb, var(--vscode-foreground) 18%, transparent)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
};

/** Square icon button — the Re-scan control. */
export const btnIcon = (disabled: boolean): React.CSSProperties => ({
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
export const btnLink: React.CSSProperties = {
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
export const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
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
export const RadarLegend = ({
    dimensions,
    countsByDimension,
    open,
    onToggle,
}: {
    dimensions: Record<OptimizerDimension, number | null>;
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
                    const value = dimensions[dim] === null ? 'n/a' : Math.round(dimensions[dim] as number);
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
                                style={{ color: typeof value === 'number' ? TIER_COLORS[tierOf(value)] : 'var(--vscode-descriptionForeground)', fontWeight: 700 }}
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
