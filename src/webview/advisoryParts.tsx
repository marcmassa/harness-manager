// Shared Advisory panel pieces: tokens, badges, signal bar, action button.
import * as React from 'react';
import type { SignalCategoryResult, SuggestionAction } from '../agentic-detector/types.js';

// ===== Design tokens (local, matching webview convention) =====

export const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px' };

// ===== Shared badge / label colors =====

export const IMPACT_PALETTE = {
    high:  { bg: 'rgba(232, 111, 74, 0.14)', fg: '#e86f4a' },
    medium:{ bg: 'rgba(212, 168, 74, 0.14)', fg: '#d4a84a' },
    low:   { bg: 'rgba(42, 161, 152, 0.14)', fg: '#2aa198' },
} as const;

// ===== Inline SVG refresh icon for the re-scan button =====

export const IconRefresh = () => (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" />
        <polyline points="13.5 2.5 13.5 5.5 10.5 5.5" />
    </svg>
);

// ===== Inline SVG icon for the dismiss button (mirrors IconClose in index.tsx) =====

export const IconXSmall = () => (
    <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M4 4l8 8" />
        <path d="M12 4L4 12" />
    </svg>
);

// ===== Helpers =====

export function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString();
    } catch {
        return '—';
    }
}

export function confidenceLabel(value: number): string {
    if (value >= 0.9) return '≥90%';
    if (value >= 0.7) return '≥70%';
    if (value >= 0.5) return '≥50%';
    return '<50%';
}

/** Pill badge for impact or effort. */
export const EffortImpactBadge = ({
    value,
    kind,
}: {
    value: 'high' | 'medium' | 'low';
    kind: 'impact' | 'effort';
}) => {
    const c = IMPACT_PALETTE[value];
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '0.65em',
                fontWeight: 700,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                padding: '1px 7px',
                borderRadius: '999px',
                background: c.bg,
                color: c.fg,
                border: `1px solid color-mix(in srgb, ${c.fg} 40%, transparent)`,
                whiteSpace: 'nowrap',
            }}
        >
            {kind === 'impact' ? 'impact: ' : 'effort: '}{value}
        </span>
    );
};

/** Category tag pill. */
export const CategoryTag = ({ label }: { label: string }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '0.65em',
            fontWeight: 600,
            padding: '1px 7px',
            borderRadius: '999px',
            background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
            border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))',
            color: 'var(--vscode-descriptionForeground)',
            whiteSpace: 'nowrap',
        }}
    >
        {label}
    </span>
);

/**
 * Colour palette for the 9 signal categories (T33).
 */
export const CATEGORY_COLORS: Record<string, string> = {
    prompts: '#88cc33',
    rules: '#3399ff',
    mcp: '#aa66ff',
    'agent-methodologies': '#22bb66',
    tools: '#e86f4a',
    skills: '#2aa198',
    'agent-scripts': '#d4a017',
    memory: '#6c6c8a',
    'context-identity': '#4a7dff',
};

/**
 * A single horizontal signal-strength bar (pure SVG, no external deps).
 *
 * Renders a row containing:
 *   - Category label (left)
 *   - SVG bar with background track + filled proportion (middle)
 *   - Count (right)
 *
 * Categories with 0 matches render as empty/grey bars.
 */
export const SignalBar = ({
    category,
    maxCount,
}: {
    category: SignalCategoryResult;
    maxCount: number;
}) => {
    const pct = maxCount > 0 ? (category.count / maxCount) * 100 : 0;
    const color = CATEGORY_COLORS[category.category] || '#888';
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '22px',
            }}
        >
            {/* Label */}
            <span
                style={{
                    width: '120px',
                    fontSize: '0.72em',
                    textAlign: 'right',
                    paddingRight: '8px',
                    opacity: 0.8,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
                title={category.label}
            >
                {category.label}
            </span>

            {/* SVG bar */}
            <div style={{ flex: 1, height: '14px', position: 'relative' }}>
                <svg width="100%" height="14" style={{ display: 'block' }}>
                    {/* Background track */}
                    <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="14"
                        rx="3"
                        fill="var(--vscode-panel-border)"
                        opacity="0.25"
                    />
                    {/* Filled proportion */}
                    {pct > 0 && (
                        <rect
                            x="0"
                            y="0"
                            width={`${pct}%`}
                            height="14"
                            rx="3"
                            fill={color}
                            opacity="0.85"
                        />
                    )}
                </svg>
            </div>

            {/* Count */}
            <span
                style={{
                    width: '28px',
                    fontSize: '0.72em',
                    fontWeight: 700,
                    textAlign: 'right',
                    flexShrink: 0,
                    color,
                }}
            >
                {category.count}
            </span>
        </div>
    );
};

// ===== Action button state type =====

export type ActionButtonState = 'idle' | 'running' | 'success' | 'error';

// ===== ActionButton component (FEAT-032 R9–R14) =====

export const ActionButton = ({
    action,
    onExecute,
    state,
}: {
    action: SuggestionAction;
    onExecute: (actionId: string) => void;
    state: ActionButtonState;
}) => {
    const label =
        state === 'running' ? '…' :
        state === 'success' ? '✓ Done' :
        state === 'error'   ? '✗ Error' : action.label;

    return (
        <button
            type="button"
            onClick={() => state === 'idle' && onExecute(action.id)}
            disabled={state !== 'idle'}
            style={{
                fontSize: '0.72em',
                padding: '3px 10px',
                borderRadius: '6px',
                border: '1px solid var(--vscode-button-secondaryBorder, var(--vscode-panel-border))',
                background: state === 'success' ? 'color-mix(in srgb, #4caf50 12%, transparent)' :
                            state === 'error'   ? 'color-mix(in srgb, #f44336 12%, transparent)' :
                            'transparent',
                color: state === 'success' ? '#4caf50' :
                       state === 'error'   ? '#f44336' :
                       'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
                cursor: state === 'idle' ? 'pointer' : 'default',
                opacity: state === 'running' ? 0.6 : 1,
                transition: 'all 0.15s ease',
            }}
        >
            {label}
        </button>
    );
};

// ===== Card sub-component =====
