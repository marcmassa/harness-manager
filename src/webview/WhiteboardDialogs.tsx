// Whiteboard modal dialogs: skill suggestions (FEAT-010 R6) and idoneous
// skills (FEAT-011 R7) — FEAT-048 split; moved verbatim from WhiteboardCanvas.tsx.
import * as React from 'react';
import type { Edge } from '@xyflow/react';

export type SuggestionDialogState = { subagentId: string; suggestions: { skillId: string; score: number; idoneity?: number }[] };
export type IdoneityDialogState = { subagentId: string; skills: { skillId: string; score: number }[] };

interface SuggestionProps {
    suggestionDialog: SuggestionDialogState;
    setSuggestionDialog: React.Dispatch<React.SetStateAction<SuggestionDialogState | null>>;
    edges: Edge[];
    handleDismissSuggestion: (source: string, target: string) => void;
    handleAcceptSuggestion: (edge: Edge) => void;
}

export function SuggestionDialog({ suggestionDialog, setSuggestionDialog, edges, handleDismissSuggestion, handleAcceptSuggestion }: SuggestionProps) {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
        }} onClick={() => setSuggestionDialog(null)}>
            <div style={{
                background: 'var(--vscode-editor-background)',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: '12px',
                padding: '20px 24px',
                minWidth: '320px',
                maxHeight: '60vh',
                overflow: 'auto',
                boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
            }} onClick={(e) => e.stopPropagation()}>
                <div style={{
                    fontSize: '1.1em',
                    fontWeight: 700,
                    marginBottom: '12px',
                }}>
                    💡 Skill Suggestions for "{suggestionDialog.subagentId}"
                </div>
                <div style={{
                    fontSize: '0.75em',
                    opacity: 0.5,
                    marginBottom: '16px',
                }}>
                    Based on semantic similarity (TF-IDF + idoneity). Click <strong>Accept</strong> to create a uses relationship, or <strong>Dismiss</strong> to remove the suggestion.
                </div>
                {suggestionDialog.suggestions.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', opacity: 0.5, fontSize: '0.85em' }}>
                            All suggestions dismissed. Close this dialog to continue.
                        </div>
                    )}
                    {suggestionDialog.suggestions.map(s => {
                    const idoneityColor = s.idoneity && s.idoneity >= 0.7 ? '#2aa198' : s.idoneity && s.idoneity >= 0.4 ? '#d4a84a' : undefined;
                    return (
                    <div key={s.skillId} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        marginBottom: '8px',
                        background: 'var(--vscode-dropdown-background)',
                        borderRadius: '8px',
                        border: '1px solid var(--vscode-dropdown-border)',
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{s.skillId}</div>
                            <div style={{ fontSize: '0.75em', display: 'flex', gap: '12px', marginTop: '2px' }}>
                                <span style={{ opacity: 0.6 }}>TF-IDF: {s.score.toFixed(2)}</span>
                                {s.idoneity !== undefined && (
                                    <span style={{ opacity: 0.8, color: idoneityColor }}>
                                        Idoneity: {s.idoneity.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button style={{
                                background: 'transparent',
                                color: 'var(--vscode-errorForeground, #e86f4a)',
                                border: '1px solid var(--vscode-errorForeground, #e86f4a)',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                cursor: 'pointer',
                                fontSize: '0.75em',
                                fontWeight: 500,
                            }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDismissSuggestion(suggestionDialog.subagentId, s.skillId);
                                    // Remove from dialog state — auto-close if last suggestion dismissed
                                    const remaining = suggestionDialog.suggestions.filter(x => x.skillId !== s.skillId);
                                    if (remaining.length === 0) {
                                        setSuggestionDialog(null);
                                    } else {
                                        setSuggestionDialog(prev => {
                                            if (!prev) return null;
                                            return { ...prev, suggestions: remaining };
                                        });
                                    }
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vscode-errorForeground)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--vscode-errorForeground, #e86f4a)'; }}
                            >
                                ✕ Dismiss
                            </button>
                            <button style={{
                                background: '#2aa198',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '5px 14px',
                                cursor: 'pointer',
                                fontSize: '0.8em',
                                fontWeight: 600,
                            }}
                                onClick={() => {
                                    // T11 (R9): use originalLabel to find edge regardless of display label
                                    const edge = edges.find(
                                        e => e.source === suggestionDialog.subagentId &&
                                            e.target === s.skillId &&
                                            (e.data as any)?.originalLabel === 'suggested'
                                    );
                                    if (edge) handleAcceptSuggestion(edge);
                                    setSuggestionDialog(null);
                                }}
                            >
                                Accept
                            </button>
                        </div>
                    </div>
                    );
                })}
                <button style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '8px',
                    background: 'transparent',
                    border: '1px solid var(--vscode-panel-border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--vscode-dropdown-foreground)',
                    fontSize: '0.8em',
                }}
                    onClick={() => setSuggestionDialog(null)}
                >
                    Close
                </button>
            </div>
        </div>
    );
}

interface IdoneityProps {
    idoneityDialog: IdoneityDialogState;
    setIdoneityDialog: (state: IdoneityDialogState | null) => void;
    edges: Edge[];
}

export function IdoneityDialog({ idoneityDialog, setIdoneityDialog, edges }: IdoneityProps) {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
        }} onClick={() => setIdoneityDialog(null)}>
            <div style={{
                background: 'var(--vscode-editor-background)',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: '12px',
                padding: '20px 24px',
                minWidth: '320px',
                maxHeight: '60vh',
                overflow: 'auto',
                boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
            }} onClick={(e) => e.stopPropagation()}>
                <div style={{
                    fontSize: '1.1em',
                    fontWeight: 700,
                    marginBottom: '12px',
                }}>
                    🎯 Idoneous Skills for "{idoneityDialog.subagentId}"
                </div>
                <div style={{
                    fontSize: '0.75em',
                    opacity: 0.5,
                    marginBottom: '16px',
                }}>
                    Skills ranked by composite idoneity score (bidirectional TF-IDF). Higher score = better semantic fit.
                </div>
                {idoneityDialog.skills.map(s => {
                    const barWidth = Math.round(s.score * 100);
                    const barColor = s.score >= 0.7 ? '#2aa198' : s.score >= 0.4 ? '#d4a84a' : '#6c6c8a';
                    // Check if a uses edge already exists (to disable Activate button)
                    const hasUsesEdge = edges.some(e =>
                        e.source === idoneityDialog.subagentId &&
                        e.target === s.skillId &&
                        e.label === 'uses'
                    );
                    return (
                        <div key={s.skillId} style={{
                            padding: '10px 12px',
                            marginBottom: '8px',
                            background: 'var(--vscode-dropdown-background)',
                            borderRadius: '8px',
                            border: '1px solid var(--vscode-dropdown-border)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{s.skillId}</div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.75em', opacity: 0.6, fontFamily: 'monospace' }}>{s.score.toFixed(2)}</div>
                                    {!hasUsesEdge && (
                                        <button style={{
                                            background: '#2aa198',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '4px 12px',
                                            cursor: 'pointer',
                                            fontSize: '0.7em',
                                            fontWeight: 600,
                                        }}
                                            onClick={() => {
                                                // Create uses edge from subagent to this skill
                                                const vscode = (window as any).__harness_vscode_api;
                                                if (vscode && vscode.postMessage) {
                                                    vscode.postMessage({
                                                        type: 'acceptSuggestion',
                                                        subagentId: idoneityDialog.subagentId,
                                                        skillId: s.skillId,
                                                    });
                                                }
                                                setIdoneityDialog(null);
                                            }}
                                        >
                                            + Activate
                                        </button>
                                    )}
                                    {hasUsesEdge && (
                                        <span style={{ fontSize: '0.7em', opacity: 0.4 }}>✓ linked</span>
                                    )}
                                </div>
                            </div>
                            <div style={{
                                height: '4px',
                                background: 'var(--vscode-dropdown-border)',
                                borderRadius: '2px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${barWidth}%`,
                                    height: '100%',
                                    background: barColor,
                                    borderRadius: '2px',
                                    transition: 'width 0.5s ease',
                                }} />
                            </div>
                        </div>
                    );
                })}
                <button style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '8px',
                    background: 'transparent',
                    border: '1px solid var(--vscode-panel-border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--vscode-dropdown-foreground)',
                    fontSize: '0.8em',
                }}
                    onClick={() => setIdoneityDialog(null)}
                >
                    Close
                </button>
            </div>
        </div>
    );
}
