import * as React from 'react';
import { frameworkLabel } from '../frameworks.js';
import type { Suggestion } from '../agentic-detector/types.js';
import { SPACE, IconXSmall, EffortImpactBadge, CategoryTag, ActionButtonState, ActionButton } from './advisoryParts.js';

export const SuggestionCard = ({
    suggestion,
    onDismiss,
    onExecuteAction,
    actionStates,
}: {
    suggestion: Suggestion;
    onDismiss: (id: string) => void;
    onExecuteAction?: (suggestionId: string, actionId: string) => void;
    actionStates?: Record<string, ActionButtonState>;
    errorMessage?: string;
}) => {
    // Track per-card inline error message (shown briefly on error)
    const [cardError, setCardError] = React.useState<string | null>(null);

    // When an action's state transitions to 'error', show inline error for 5s
    React.useEffect(() => {
        if (!actionStates || !suggestion.actions) return;
        const hasError = suggestion.actions.some(a => {
            const key = `${suggestion.id}::${a.id}`;
            return actionStates[key] === 'error';
        });
        if (hasError) {
            setCardError('Action failed. Check the Output channel for details.');
            const t = setTimeout(() => setCardError(null), 5000);
            return () => clearTimeout(t);
        }
    }, [actionStates, suggestion]);

    return (
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
                <FindingScope suggestion={suggestion} />
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

        {/* Action buttons row (FEAT-032 R9, R10, R14) */}
        {onExecuteAction && suggestion.actions && suggestion.actions.length > 0 && (
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: SPACE.xs,
                    alignItems: 'center',
                    marginTop: '2px',
                }}
            >
                {suggestion.actions.map(action => {
                    const key = `${suggestion.id}::${action.id}`;
                    const state: ActionButtonState = actionStates?.[key] ?? 'idle';
                    return (
                        <ActionButton
                            key={action.id}
                            action={action}
                            onExecute={(actionId) => onExecuteAction(suggestion.id, actionId)}
                            state={state}
                        />
                    );
                })}
            </div>
        )}

        {/* Inline error message (FEAT-032 R13) */}
        {cardError && (
            <div
                style={{
                    fontSize: '0.72em',
                    color: '#f44336',
                    padding: '2px 0',
                    lineHeight: 1.4,
                }}
            >
                {cardError}
            </div>
        )}

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
};

// ===== Rescan button =====

/** Trailing path segments of a source URI, enough to recognise the file. */
const shortPath = (uri?: string) => (uri ? decodeURIComponent(uri).split('/').slice(-2).join('/') : '');

/** FEAT-042 R2: whose finding this is, which sources support it, what was evaluated. */
export const FindingScope = ({ suggestion }: { suggestion: Suggestion }) => {
    const scope = suggestion.scope;
    if (!scope) return null;
    const owner = scope.kind === 'provider' ? frameworkLabel(scope.providerId) : 'Workspace-wide';
    const files = (suggestion.evidence ?? []).map(e => shortPath(e.sourceUri)).filter(Boolean);
    return (
        <span data-finding-scope={scope.kind} style={{ display: 'block', fontWeight: 400, fontSize: '0.86em', opacity: 0.7, marginTop: '2px' }}>
            {owner}
            {files.length > 0 && <> · {files.join(', ')}</>}
            {suggestion.reason && <span style={{ display: 'block' }}>{`Based on: ${suggestion.reason}`}</span>}
        </span>
    );
};
