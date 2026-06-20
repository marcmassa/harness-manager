import * as React from 'react';
import type { AgenticProfile, Suggestion, PatternMatch, SignalCategoryResult } from '../agentic-detector/types.js';

// ===== Design tokens (local, matching webview convention) =====

const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px' };

// ===== Shared badge / label colors =====

const IMPACT_PALETTE = {
    high:  { bg: 'rgba(232, 111, 74, 0.14)', fg: '#e86f4a' },
    medium:{ bg: 'rgba(212, 168, 74, 0.14)', fg: '#d4a84a' },
    low:   { bg: 'rgba(42, 161, 152, 0.14)', fg: '#2aa198' },
} as const;

// ===== Inline SVG icon for the dismiss button (mirrors IconClose in index.tsx) =====

const IconXSmall = () => (
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

function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString();
    } catch {
        return '—';
    }
}

function confidenceLabel(value: number): string {
    if (value >= 0.9) return '≥90%';
    if (value >= 0.7) return '≥70%';
    if (value >= 0.5) return '≥50%';
    return '<50%';
}

/** Pill badge for impact or effort. */
const EffortImpactBadge = ({
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
const CategoryTag = ({ label }: { label: string }) => (
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
const CATEGORY_COLORS: Record<string, string> = {
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
const SignalBar = ({
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

// ===== Card sub-component =====

const SuggestionCard = ({
    suggestion,
    onDismiss,
}: {
    suggestion: Suggestion;
    onDismiss: (id: string) => void;
}) => (
    <div
        className="harness-suggestion-card"
        style={{
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '8px',
            padding: SPACE.md,
            background: 'var(--vscode-sideBar-background)',
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.sm,
            transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
        }}
    >
        {/* Title row with dismiss button */}
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: SPACE.sm,
            }}
        >
            <span style={{ fontWeight: 700, fontSize: '0.88em', lineHeight: 1.35 }}>
                {suggestion.title}
            </span>
            <button
                type="button"
                title="Dismiss suggestion"
                aria-label="Dismiss suggestion"
                onClick={() => onDismiss(suggestion.id)}
                style={{
                    flexShrink: 0,
                    width: '22px',
                    height: '22px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--vscode-descriptionForeground)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'background 0.12s ease, color 0.12s ease',
                    marginTop: '-1px',
                    marginRight: '-4px',
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                        'var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--vscode-sideBar-background) 80%, var(--vscode-editor-background)))';
                    (e.currentTarget as HTMLButtonElement).style.color =
                        'var(--vscode-foreground)';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color =
                        'var(--vscode-descriptionForeground)';
                }}
            >
                <IconXSmall />
            </button>
        </div>

        {/* Description */}
        <div
            style={{
                fontSize: '0.78em',
                opacity: 0.72,
                lineHeight: 1.5,
            }}
        >
            {suggestion.description}
        </div>

        {/* Badge row */}
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: SPACE.xs,
                alignItems: 'center',
                marginTop: '2px',
            }}
        >
            <EffortImpactBadge value={suggestion.impact} kind="impact" />
            <EffortImpactBadge value={suggestion.effort} kind="effort" />
            <CategoryTag label={suggestion.category} />
        </div>
    </div>
);

// ===== Panel component =====

interface AdvisoryPanelProps {
    profile: AgenticProfile | null;
    onDismissSuggestion: (suggestionId: string) => void;
    /** Called when the user clicks "Apply Harness+SDD" (T34). */
    onApplyHarnessSDD?: () => void;
}

export const AdvisoryPanel = ({ profile, onDismissSuggestion, onApplyHarnessSDD }: AdvisoryPanelProps) => {
    // Optimistic local dismissal tracker
    const [dismissedLocally, setDismissedLocally] = React.useState<Set<string>>(new Set());

    // Reset local state when a new profile arrives (fresh scan)
    React.useEffect(() => {
        setDismissedLocally(new Set());
    }, [profile]);

    const handleDismiss = (id: string) => {
        setDismissedLocally((prev) => new Set(prev).add(id));
        onDismissSuggestion(id);
    };

    // ===== Empty / loading state =====

    if (profile === null) {
        return (
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: SPACE.md,
                    padding: SPACE.lg,
                    color: 'var(--vscode-descriptionForeground)',
                }}
            >
                <vscode-progress-ring />
                <span style={{ fontSize: '0.85em', opacity: 0.7, textAlign: 'center', maxWidth: '280px' }}>
                    Run a scan to detect agentic architecture in this workspace.
                </span>
            </div>
        );
    }

    // ===== Derived data =====

    const cliInstalls = profile.layers['1'].cliInstalls ?? [];
    const patterns = profile.patterns ?? [];
    const suggestions = profile.suggestions.filter(
        (s) => !dismissedLocally.has(s.id) && !profile.dismissedSuggestionIds.includes(s.id),
    );

    // T33: signal categories from Layer 2
    const categories = profile.layers?.['2']?.categories ?? [];
    const maxCount = Math.max(...categories.map((c) => c.count), 1);

    const nextLevel = profile.maturity.nextLevel;
    const maturityColor = profile.maturity.color || '#888';

    // ===== Section header factory =====

    const sectionHeader = (label: string) => (
        <div
            style={{
                fontSize: '0.7em',
                fontWeight: 700,
                opacity: 0.48,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginTop: SPACE.lg,
                marginBottom: SPACE.sm,
            }}
        >
            {label}
        </div>
    );

    return (
        <div
            style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                padding: `0 ${SPACE.md} ${SPACE.lg} ${SPACE.md}`,
            }}
        >
            {/* ===== 1. Header ===== */}
            <div
                style={{
                    padding: `${SPACE.md} 0`,
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                }}
            >
                <h3 style={{ margin: 0, fontSize: '1em', fontWeight: 600 }}>
                    Agentic Architecture
                </h3>
                <span
                    style={{
                        fontSize: '0.7em',
                        opacity: 0.45,
                        whiteSpace: 'nowrap',
                    }}
                    title={`Last scanned: ${new Date(profile.scanTimestamp).toLocaleString()}`}
                >
                    scanned {formatTime(profile.scanTimestamp)}
                </span>
            </div>

            {/* ===== 2. Maturity badge ===== */}
            <div
                style={{
                    marginTop: SPACE.md,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.sm,
                    padding: SPACE.md,
                    borderRadius: '10px',
                    background: `color-mix(in srgb, ${maturityColor} 10%, var(--vscode-sideBar-background))`,
                    border: `1px solid color-mix(in srgb, ${maturityColor} 35%, var(--vscode-panel-border))`,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.3em',
                            fontWeight: 800,
                            letterSpacing: '0.5px',
                            padding: '2px 16px',
                            borderRadius: '999px',
                            background: maturityColor,
                            color: '#fff',
                            minWidth: '48px',
                        }}
                    >
                        {profile.maturity.level}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.95em' }}>
                        {profile.maturity.label}
                    </span>
                </div>
                <div style={{ fontSize: '0.78em', opacity: 0.72, lineHeight: 1.45 }}>
                    {profile.maturity.description}
                </div>
                {nextLevel && (
                    <div
                        style={{
                            fontSize: '0.72em',
                            opacity: 0.65,
                            lineHeight: 1.4,
                            padding: `${SPACE.xs} ${SPACE.sm}`,
                            borderRadius: '6px',
                            background: 'color-mix(in srgb, var(--vscode-editor-background) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--vscode-panel-border) 50%, transparent)',
                        }}
                    >
                        <span style={{ fontWeight: 600 }}>Next: {nextLevel.level}</span>
                        &nbsp;&mdash;&nbsp;{nextLevel.whatIsNeeded}
                    </div>
                )}

                {/* T34: "Apply Harness+SDD" scaffold action — shown when SDD is not yet active */}
                {onApplyHarnessSDD && profile.maturity.level !== 'L5' && (
                    <div style={{ marginTop: SPACE.xs }}>
                        <vscode-button onClick={onApplyHarnessSDD}>
                            Apply Harness+SDD
                        </vscode-button>
                    </div>
                )}
            </div>

            {/* ===== 3. CLI installs ===== */}
            {cliInstalls.length > 0 && (
                <>
                    {sectionHeader('CLI Installations')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                        {cliInstalls.map((cli: any) => (
                            <div
                                key={cli.cliId}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '3px',
                                    padding: SPACE.sm,
                                    borderRadius: '6px',
                                    border: '1px solid var(--vscode-panel-border)',
                                    background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: SPACE.xs,
                                    }}
                                >
                                    <span style={{ fontWeight: 600, fontSize: '0.85em' }}>
                                        {cli.cliName}
                                    </span>
                                    {cli.isActive && (
                                        <vscode-badge style={{ fontSize: '0.6em' }}>active</vscode-badge>
                                    )}
                                </div>
                                {cli.configFiles && cli.configFiles.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                        {cli.configFiles.map((fp: string) => (
                                            <code
                                                key={fp}
                                                style={{
                                                    fontSize: '0.68em',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    background: 'color-mix(in srgb, var(--vscode-panel-border) 20%, transparent)',
                                                    color: 'var(--vscode-descriptionForeground)',
                                                }}
                                            >
                                                {fp}
                                            </code>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ===== 4. Architecture patterns ===== */}
            {patterns.length > 0 && (
                <>
                    {sectionHeader('Architecture Patterns')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                        {patterns.map((pat: PatternMatch) => (
                            <div
                                key={pat.pattern}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: SPACE.sm,
                                    padding: `${SPACE.xs} ${SPACE.sm}`,
                                    borderRadius: '6px',
                                    border: '1px solid var(--vscode-panel-border)',
                                    background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
                                }}
                            >
                                {/* Confidence bar */}
                                <div
                                    style={{
                                        width: '4px',
                                        height: '24px',
                                        borderRadius: '2px',
                                        flexShrink: 0,
                                        background: `color-mix(in srgb, var(--vscode-focusBorder) ${
                                            Math.round(pat.confidence * 100)
                                        }%, var(--vscode-panel-border))`,
                                        opacity: 0.75,
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            fontSize: '0.82em',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {pat.label}
                                    </div>
                                    {pat.evidence.length > 0 && (
                                        <div
                                            style={{
                                                fontSize: '0.68em',
                                                opacity: 0.55,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {pat.evidence[0]}
                                            {pat.evidence.length > 1 && ` +${pat.evidence.length - 1} more`}
                                        </div>
                                    )}
                                </div>
                                <span
                                    style={{
                                        fontSize: '0.65em',
                                        fontWeight: 700,
                                        opacity: 0.6,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}
                                >
                                    {confidenceLabel(pat.confidence)}
                                </span>
                                <vscode-badge
                                    style={{
                                        fontSize: '0.6em',
                                        flexShrink: 0,
                                        background:
                                            pat.status === 'detected'
                                                ? 'color-mix(in srgb, var(--vscode-testing-iconPassed) 25%, transparent)'
                                                : 'color-mix(in srgb, var(--vscode-testing-iconQueued) 25%, transparent)',
                                    }}
                                >
                                    {pat.status}
                                </vscode-badge>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ===== 5. Signal strength (T33) ===== */}
            {categories.length > 0 && (
                <>
                    {sectionHeader('Signal Strength')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {categories.map((cat) => (
                            <SignalBar
                                key={cat.category}
                                category={cat}
                                maxCount={maxCount}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* ===== 6. Suggestions ===== */}
            {suggestions.length > 0 && (
                <>
                    {sectionHeader('Suggestions')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                        {suggestions.map((s) => (
                            <SuggestionCard key={s.id} suggestion={s} onDismiss={handleDismiss} />
                        ))}
                    </div>
                </>
            )}

            {/* ===== Hover style for suggestion cards ===== */}
            <style>{`
                .harness-suggestion-card:hover {
                    border-color: var(--vscode-focusBorder) !important;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.12);
                }
            `}</style>
        </div>
    );
};
