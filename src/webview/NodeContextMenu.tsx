// T14 (R12): node context menu — skill best-owner info / re-assignment and
// subagent suggestion + idoneity entries (FEAT-048 split; moved verbatim).
import * as React from 'react';
import type { HarnessGraph } from '../types.js';
import { CONTEXT_MENU } from './styles.js';
import type { WhiteboardIdoneityData } from './useWhiteboardGraphData.js';
import type { SuggestionDialogState, IdoneityDialogState } from './WhiteboardDialogs.js';

export type NodeContextMenuState = { node: any; position: { x: number; y: number } };

interface Props {
    nodeContextMenu: NodeContextMenuState;
    setNodeContextMenu: (state: NodeContextMenuState | null) => void;
    idoneityData: WhiteboardIdoneityData;
    graph: HarnessGraph;
    setSuggestionDialog: (state: SuggestionDialogState | null) => void;
    setIdoneityDialog: (state: IdoneityDialogState | null) => void;
}

export function NodeContextMenu({ nodeContextMenu, setNodeContextMenu, idoneityData, graph, setSuggestionDialog, setIdoneityDialog }: Props) {
    return (
        <>
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={() => setNodeContextMenu(null)}
            />
            <div style={{
                ...CONTEXT_MENU.menu,
                position: 'fixed',
                left: `${nodeContextMenu.position.x}px`,
                top: `${nodeContextMenu.position.y}px`,
                minWidth: '200px',
            }}>
            <div style={CONTEXT_MENU.header}>
                {nodeContextMenu.node.label} ({nodeContextMenu.node.type})
            </div>

            {(() => {
                const node = nodeContextMenu.node;
                const nodeId = node.id;
                const nodeType = node.type;

                if (nodeType === 'skill') {
                    // === SKILL NODE: Show best owner + mismatch info + re-assignment (R4, R8)
                    const skillInfo = idoneityData.bySkill[nodeId];
                    const hasBestOwner = skillInfo && skillInfo.bestOwner;
                    return (
                        <>
                            {hasBestOwner && (
                                <div style={{
                                    padding: '8px 16px',
                                    fontSize: '0.8em',
                                    borderBottom: '1px solid var(--vscode-dropdown-border)',
                                    lineHeight: 1.6,
                                }}>
                                    <div style={{ opacity: 0.6, fontSize: '0.75em' }}>Best semantic owner</div>
                                    <div style={{ fontWeight: 600, color: '#2aa198' }}>
                                        → {skillInfo.bestOwner} <span style={{ fontWeight: 400, opacity: 0.6 }}>({skillInfo.score})</span>
                                    </div>
                                    {skillInfo.mismatch && (
                                        <div style={{ color: '#e86f4a', fontSize: '0.85em', marginTop: '4px' }}>
                                            ⚠️ Currently owned by different subagent
                                        </div>
                                    )}
                                </div>
                            )}
                            {skillInfo?.mismatch && skillInfo.mismatchBestOwner && (
                                <button
                                    style={{ ...CONTEXT_MENU.item, color: '#e86f4a', fontWeight: 600 }}
                                    onClick={() => {
                                        // Trigger re-assignment: move uses edge to bestOwner
                                        const vscode = (window as any).__harness_vscode_api;
                                        if (vscode && vscode.postMessage) {
                                            vscode.postMessage({
                                                type: 'reassignSkill',
                                                skillId: nodeId,
                                                newOwner: skillInfo.mismatchBestOwner,
                                            });
                                        }
                                        setNodeContextMenu(null);
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <span>🔄</span>
                                    Suggest as subagent of {skillInfo.mismatchBestOwner}
                                </button>
                            )}
                            {!hasBestOwner && (
                                <div style={{ padding: '8px 16px', fontSize: '0.8em', opacity: 0.5 }}>
                                    No best owner (missing description)
                                </div>
                            )}
                        </>
                    );
                }

                // === SUBAGENT / AGENT NODE: Show suggestions + idoneous skills (R6, R7)
                const suggestedEdges = graph.edges.filter(
                    e => e.source === nodeId && e.label === 'suggested'
                );
                const idoneousSkills = idoneityData.bySubagent[nodeId] || [];
                const items: { label: string; icon: string; onClick: () => void }[] = [];

                // Suggestion option (FEAT-010)
                if (suggestedEdges.length > 0) {
                    items.push({
                        icon: '💡',
                        label: `Show skill suggestions (${suggestedEdges.length})`,
                        onClick: () => {
                            setSuggestionDialog({
                                subagentId: nodeId,
                                suggestions: suggestedEdges.map(e => ({
                                    skillId: e.target,
                                    score: (e.metadata?.score as number) || 0,
                                    idoneity: e.metadata?.idoneity as number | undefined,
                                })),
                            });
                            setNodeContextMenu(null);
                        },
                    });
                }

                // Idoneous skills option (FEAT-011 R7)
                if (idoneousSkills.length > 0) {
                    items.push({
                        icon: '🎯',
                        label: `Show idoneous skills (${idoneousSkills.length})`,
                        onClick: () => {
                            setIdoneityDialog({ subagentId: nodeId, skills: idoneousSkills });
                            setNodeContextMenu(null);
                        },
                    });
                }

                if (items.length === 0) {
                    return (
                        <div style={{ padding: '8px 16px', fontSize: '0.8em', opacity: 0.5 }}>
                            No suggestions available
                        </div>
                    );
                }

                return items.map((item, idx) => (
                    <button key={idx}
                        style={CONTEXT_MENU.item}
                        onClick={item.onClick}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        <span>{item.icon}</span>
                        {item.label}
                    </button>
                ));
            })()}
        </div>
        </>
    );
}
