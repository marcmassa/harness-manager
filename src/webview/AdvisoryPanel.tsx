import * as React from 'react';
import type { AgenticProfile } from '../agentic-detector/types.js';
import { SPACE, formatTime, SignalBar, ActionButtonState, IconRefresh } from './advisoryParts.js';
import { SuggestionCard } from './SuggestionCard.js';
import { ArchitectureSections } from './AdvisorySections.js';

export type { ActionButtonState } from './advisoryParts.js';

interface AdvisoryPanelProps {
    profile: AgenticProfile | null;
    onDismissSuggestion: (suggestionId: string) => void;
    /** Called when the user clicks "Adopt Harness SDD (optional)" (T34, FEAT-042). */
    onApplyHarnessSDD?: () => void;
    /** Trigger an on-demand architecture re-scan (FEAT-031). */
    onRescan?: () => void;
    /** True while a scan is in progress (FEAT-031). */
    isScanning?: boolean;
    /** Called when the user clicks an action button on a suggestion card (FEAT-032). */
    onExecuteAction?: (suggestionId: string, actionId: string) => void;
    /** Per-action button states keyed by `"${suggestionId}::${actionId}"` (FEAT-032). */
    actionStates?: Record<string, ActionButtonState>;
}

const STALE_THRESHOLD_MS = 120_000;

export const AdvisoryPanel = ({ profile, onDismissSuggestion, onApplyHarnessSDD, onRescan, isScanning, onExecuteAction, actionStates }: AdvisoryPanelProps) => {
    // Optimistic local dismissal tracker
    const [dismissedLocally, setDismissedLocally] = React.useState<Set<string>>(new Set());
    // Stale scan notice (FEAT-031 T19)
    const [isStale, setIsStale] = React.useState(false);
    const [staleDismissed, setStaleDismissed] = React.useState(false);

    // Reset local state when a new profile arrives (fresh scan)
    React.useEffect(() => {
        setDismissedLocally(new Set());
        setIsStale(false);
        setStaleDismissed(false);
    }, [profile]);

    // Stale detection: set notice when tab re-renders and data is old
    React.useEffect(() => {
        if (!profile || staleDismissed || isScanning) return;
        const age = Date.now() - profile.scanTimestamp;
        if (age > STALE_THRESHOLD_MS) {
            setIsStale(true);
        }
    }, [profile, staleDismissed, isScanning]);

    const handleDismiss = (id: string) => {
        setDismissedLocally((prev) => new Set(prev).add(id));
        onDismissSuggestion(id);
    };

    // ===== Empty / loading state =====

    if (profile === null && !isScanning) {
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
                <button
                    type="button"
                    onClick={onRescan}
                    style={{
                        marginTop: SPACE.sm,
                        padding: `${SPACE.xs} ${SPACE.md}`,
                        borderRadius: '6px',
                        border: '1px solid var(--vscode-button-border, var(--vscode-focusBorder))',
                        background: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        cursor: 'pointer',
                        fontSize: '0.82em',
                        fontWeight: 600,
                    }}
                >
                    Scan now
                </button>
            </div>
        );
    }

    if (isScanning && profile === null) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SPACE.md, padding: SPACE.lg, color: 'var(--vscode-descriptionForeground)' }}>
                <vscode-progress-ring />
                <span style={{ fontSize: '0.85em', opacity: 0.7 }}>Scanning architecture…</span>
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
                    gap: SPACE.sm,
                }}
            >
                <h3 style={{ margin: 0, fontSize: '1em', fontWeight: 600 }}>
                    Agentic Architecture
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isScanning && <vscode-progress-ring style={{ width: '14px', height: '14px' }} />}
                    <span
                        style={{ fontSize: '0.7em', opacity: 0.45, whiteSpace: 'nowrap' }}
                        title={profile ? `Last scanned: ${new Date(profile.scanTimestamp).toLocaleString()}` : undefined}
                    >
                        {isScanning ? 'Scanning…' : `scanned ${formatTime(profile!.scanTimestamp)}`}
                    </span>
                    <button
                        type="button"
                        title="Re-scan architecture"
                        aria-label="Re-scan architecture"
                        disabled={isScanning}
                        onClick={onRescan}
                        style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '4px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--vscode-descriptionForeground)',
                            cursor: isScanning ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            opacity: isScanning ? 0.4 : 1,
                            transition: 'opacity 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (!isScanning) (e.currentTarget as HTMLButtonElement).style.background =
                                'var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--vscode-sideBar-background) 80%, var(--vscode-editor-background)))';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        }}
                    >
                        <IconRefresh />
                    </button>
                </div>
            </div>

            {/* ===== Stale scan notice (FEAT-031 T19) ===== */}
            {isStale && !staleDismissed && !isScanning && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.sm,
                    padding: `${SPACE.xs} ${SPACE.sm}`,
                    marginTop: SPACE.sm,
                    borderRadius: '6px',
                    background: 'color-mix(in srgb, #d4a017 12%, var(--vscode-sideBar-background))',
                    border: '1px solid color-mix(in srgb, #d4a017 35%, var(--vscode-panel-border))',
                    fontSize: '0.72em',
                    color: 'var(--vscode-foreground)',
                }}>
                    <span style={{ flex: 1, opacity: 0.8 }}>Results may be stale</span>
                    <button
                        type="button"
                        onClick={() => { onRescan(); setIsStale(false); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d4a017', fontWeight: 700, fontSize: '1em', padding: '0 4px' }}
                    >
                        re-scan
                    </button>
                    <button
                        type="button"
                        onClick={() => setStaleDismissed(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vscode-descriptionForeground)', fontSize: '1em', padding: '0 2px' }}
                        title="Dismiss"
                        aria-label="Dismiss stale notice"
                    >
                        ×
                    </button>
                </div>
            )}

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

                {/* FEAT-042 R4: what the assessment could not use */}
                {(profile.maturity.unavailableInputs?.length ?? 0) > 0 && (
                    <details style={{ fontSize: '0.72em', opacity: 0.75 }}>
                        <summary>{`Not assessed (${profile.maturity.unavailableInputs!.length})`}</summary>
                        <ul style={{ margin: `${SPACE.xs} 0 0`, paddingLeft: SPACE.md }}>
                            {profile.maturity.unavailableInputs!.map(input => <li key={input}>{input}</li>)}
                        </ul>
                    </details>
                )}

                {/* FEAT-042 R5: an explicit, optional adoption — never shown once Harness SDD is present */}
                {onApplyHarnessSDD && profile.maturity.level !== 'L5'
                    && !(profile.sources ?? []).some(s => s.providerId === 'harness-sdd') && (
                    <div style={{ marginTop: SPACE.xs }}>
                        <vscode-button appearance="secondary" onClick={onApplyHarnessSDD}>
                            Adopt Harness SDD (optional)
                        </vscode-button>
                    </div>
                )}
            </div>

            <ArchitectureSections cliInstalls={cliInstalls} patterns={patterns} sectionHeader={sectionHeader} />
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
                            <SuggestionCard
                                key={s.id}
                                suggestion={s}
                                onDismiss={handleDismiss}
                                onExecuteAction={onExecuteAction}
                                actionStates={actionStates}
                            />
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
