import * as React from 'react';
import type { Edge } from 'reactflow';
import type { EdgeLabel } from '../../types.js';

interface EdgeContextMenuProps {
    edge: Edge | null;
    position: { x: number; y: number };
    onDelete: (edge: Edge) => void;
    onChangeLabel: (edge: Edge, newLabel: EdgeLabel) => void;
    onAcceptSuggestion?: (edge: Edge) => void;
    onDismissSuggestion?: (edge: Edge) => void;
    // T9 (R4, R6): toggle disable/enable for uses edges
    onToggleConnection?: (edge: Edge, disable: boolean) => void;
    onClose: () => void;
}

const EDGE_LABELS: EdgeLabel[] = ['manages', 'uses', 'executing'];

export const EdgeContextMenu = ({ edge, position, onDelete, onChangeLabel, onAcceptSuggestion, onDismissSuggestion, onToggleConnection, onClose }: EdgeContextMenuProps) => {
    const menuRef = React.useRef<HTMLDivElement>(null);

    // Clamp menu position to viewport bounds
    const clampedX = Math.min(position.x, window.innerWidth - 200);
    const clampedY = Math.min(position.y, window.innerHeight - 160);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        // Delay listener to avoid immediate close from the click that opened it
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handler);
            document.addEventListener('keydown', keyHandler);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', keyHandler);
        };
    }, [onClose]);

    if (!edge) return null;

    // T8 (R7): use originalLabel to correctly detect edge type, regardless of display label
    const originalLabel = (edge.data as any)?.originalLabel as string | undefined;
    const isSuggested = originalLabel === 'suggested';
    const isUses = originalLabel === 'uses';
    const isDisabled = isUses && edge.data?.metadata?.disabled === true;
    const isMismatchEdge = isUses && edge.data?.metadata?._mismatch === true && !isDisabled;

    const menuStyle: React.CSSProperties = {
        position: 'fixed',
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        background: 'var(--vscode-dropdown-background)',
        border: '1px solid var(--vscode-dropdown-border)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 9999,
        minWidth: '180px',
        padding: '4px 0',
        animation: 'pickerFadeIn 0.15s ease-out',
    };

    const itemStyle: React.CSSProperties = {
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: '0.85em',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background 0.12s ease',
        border: 'none',
        background: 'transparent',
        color: 'var(--vscode-dropdown-foreground)',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
    };

    const dividerStyle: React.CSSProperties = {
        height: '1px',
        background: 'var(--vscode-dropdown-border)',
        margin: '4px 0',
    };

    const labelColors: Record<string, string> = {
        manages: '#4a7dff',
        uses: '#2aa198',
        executing: '#e86f4a',
    };

    // Build list of other labels for the Change Label submenu (exclude current originalLabel)
    const otherLabels = EDGE_LABELS.filter(l => l !== originalLabel);


    return (
        <div ref={menuRef} style={menuStyle}>
            {/* Header */}
            <div style={{
                padding: '4px 16px 8px',
                fontSize: '0.65em',
                textTransform: 'uppercase',
                opacity: 0.5,
                letterSpacing: '1px',
                fontWeight: 700,
                borderBottom: '1px solid var(--vscode-dropdown-border)',
            }}>
                {isSuggested ? 'Suggested Relationship' : 'Edge Actions'}
            </div>

            {/* Show score if suggested (FEAT-010) */}
            {isSuggested && edge.data?.metadata?.score && (
                <div style={{
                    padding: '6px 16px',
                    fontSize: '0.75em',
                    opacity: 0.6,
                    borderBottom: '1px solid var(--vscode-dropdown-border)',
                }}>
                    Similarity: {edge.data.metadata.score} ({edge.data.metadata.method || 'tfidf'})
                </div>
            )}

            {/* Show idoneity score for uses edges (FEAT-011 R3) */}
            {isUses && edge.data?.metadata?.idoneity !== undefined && (
                <div style={{
                    padding: '6px 16px',
                    fontSize: '0.75em',
                    borderBottom: '1px solid var(--vscode-dropdown-border)',
                    lineHeight: 1.6,
                }}>
                    <div style={{ opacity: 0.5 }}>Idoneity: {edge.data.metadata.idoneity}</div>
                    {isMismatchEdge && (
                        <div style={{ color: '#e86f4a', fontWeight: 600, fontSize: '0.9em' }}>
                            ⚠️ Mismatch — better owner exists
                        </div>
                    )}
                </div>
            )}

            {/* Accept Suggestion — only for suggested edges (R5) */}
            {isSuggested && onAcceptSuggestion && (
                <button
                    style={{ ...itemStyle, color: '#2aa198', fontWeight: 700 }}
                    onClick={() => { onAcceptSuggestion(edge); onClose(); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <span style={{ fontSize: '1.1em' }}>✅</span>
                    Accept Suggestion → uses
                </button>
            )}

            {/* Change label submenu — hide for suggested edges (they can only be accepted or dismissed) */}
            {!isSuggested && otherLabels.length > 0 && (
                <>
                    <div style={{
                        padding: '6px 16px 2px',
                        fontSize: '0.7em',
                        opacity: 0.4,
                        letterSpacing: '0.5px',
                    }}>
                        Change Label
                    </div>
                    {otherLabels.map(label => (
                        <button
                            key={label}
                            style={itemStyle}
                            onClick={() => { onChangeLabel(edge, label); onClose(); }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <span style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: labelColors[label] || '#888',
                                display: 'inline-block',
                                flexShrink: 0,
                            }} />
                            <span style={{ textTransform: 'capitalize' }}>{label}</span>
                        </button>
                    ))}
                </>
            )}

            <div style={dividerStyle} />

            {/* T9 (R4, R6): Disable / Enable connection for uses edges */}
            {isUses && !isSuggested && onToggleConnection && (
                <button
                    style={itemStyle}
                    onClick={() => { onToggleConnection(edge, !isDisabled); onClose(); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <span style={{ fontSize: '1.1em' }}>{isDisabled ? '▶' : '⏸'}</span>
                    {isDisabled ? 'Enable Connection' : 'Disable Connection'}
                </button>
            )}

            {/* Show idoneity score for suggested edges too (now available) */}
            {isSuggested && edge.data?.metadata?.idoneity !== undefined && (
                <div style={{
                    padding: '6px 16px',
                    fontSize: '0.75em',
                    opacity: 0.6,
                    borderBottom: '1px solid var(--vscode-dropdown-border)',
                }}>
                    Idoneity: {edge.data.metadata.idoneity}
                </div>
            )}

            {/* Delete / Dismiss — for suggested edges, dismiss locally without extension */}
            <button
                style={{ ...itemStyle, color: 'var(--vscode-errorForeground, #e86f4a)' }}
                onClick={() => {
                    if (isSuggested && onDismissSuggestion) {
                        onDismissSuggestion(edge);
                    } else {
                        onDelete(edge);
                    }
                    onClose();
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
                <span style={{ fontSize: '1.1em' }}>🗑</span>
                {isSuggested ? 'Dismiss Suggestion' : 'Delete Relationship'}
            </button>
        </div>
    );
};
