import * as React from 'react';
import { Button, SyncedTextArea } from './controls.js';
import { SourceOwnershipSection, canPerform } from './components/SourceOwnershipSection.js';
import { SPACE } from './styles.js';
import { vscode } from './vscodeApi.js';
import type { DashboardContext } from './useDashboardActions.js';

export const NodeDescriptionTab = ({ ctx }: { ctx: DashboardContext }) => {
    const { selectedNode, ownership } = ctx;
    // Rendered only once the host has sent data (App returns a skeleton before).
    const data = ctx.data!;
    return (
                            <div style={{ flex: 1, overflow: 'auto', padding: SPACE.md, display: 'flex', flexDirection: 'column' }}>
                                <SourceOwnershipSection ownership={ownership[selectedNode.id]} />
                                {/* Section title */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: SPACE.sm,
                                    flexShrink: 0,
                                }}>
                                    <div style={{
                                        fontSize: '0.8em',
                                        fontWeight: 600,
                                        opacity: 0.7,
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                    }}>
                                        Mission / Prompt
                                    </div>
                                </div>
                                <SyncedTextArea
                                    key={selectedNode.id}
                                    className="hd-description"
                                    aria-label="Mission / Prompt"
                                    rows={4}
                                    readOnly={!canPerform(ownership[selectedNode.id], 'editing.updateMetadata')}
                                    value={selectedNode.data.metadata.description || selectedNode.data.metadata.body || ''}
                                    style={{ width: '100%', flex: 1 }}
                                    onChange={(e) => {
                                        if (!canPerform(ownership[selectedNode.id], 'editing.updateMetadata')) return;
                                        vscode.postMessage({ 
                                            type: 'updateMetadata', 
                                            id: selectedNode.id, 
                                            nodeType: selectedNode.type, 
                                            metadata: { description: e.target.value } 
                                        });
                                    }}
                                />
                                
                                {/* FEAT-012 R7: Activate button for orphan entities */}
                                {(selectedNode.data.metadata?._orphan === true || selectedNode.data.metadata?._discovery === 'orphan') && (
                                    <div style={{
                                        marginTop: SPACE.md,
                                        padding: SPACE.sm,
                                        background: 'rgba(212, 168, 74, 0.08)',
                                        borderLeft: '3px solid #d4a84a',
                                        borderRadius: '0 4px 4px 0',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}>
                                        <div style={{ fontSize: '0.85em' }}>
                                            {selectedNode.data.metadata?._orphan
                                                ? '📍 This subagent exists on disk but is not registered in agentic.json'
                                                : '📡 This skill was discovered but not yet assigned to any subagent'}
                                        </div>
                                        <Button onClick={() => {
                                            if (selectedNode.type === 'subagent') {
                                                // Activate orphan subagent: create entry in agentic.json
                                                vscode.postMessage({
                                                    type: 'createNode',
                                                    nodeType: 'subagent',
                                                    name: selectedNode.id,
                                                    description: selectedNode.data.metadata?.description || '',
                                                });
                                            } else {
                                                // Activate orphan skill: accept suggestion to primary agent
                                                const primaryAgent = data.graph.nodes.find(n => n.type === 'agent');
                                                if (primaryAgent) {
                                                    vscode.postMessage({
                                                        type: 'acceptSuggestion',
                                                        subagentId: primaryAgent.id,
                                                        skillId: selectedNode.id,
                                                    });
                                                }
                                            }
                                        }}>
                                            Activate
                                        </Button>
                                    </div>
                                )}

                                {/* FEAT-024 R1, R2: Show steering/hook-specific metadata */}
                                {selectedNode.type === 'steering' && (
                                    <div style={{
                                        marginTop: SPACE.md,
                                        padding: SPACE.sm,
                                        background: 'rgba(212, 168, 74, 0.08)',
                                        borderLeft: '3px solid #d4a84a',
                                        borderRadius: '0 4px 4px 0',
                                    }}>
                                        <div style={{
                                            fontSize: '0.7em',
                                            fontWeight: 600,
                                            opacity: 0.5,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                            marginBottom: '4px',
                                        }}>
                                            Steering — Applies To
                                        </div>
                                        <div style={{ fontSize: '0.85em' }}>
                                            {Array.isArray(selectedNode.data.metadata?.applies_to)
                                                ? selectedNode.data.metadata.applies_to.join(', ')
                                                : 'All subagents'}
                                        </div>
                                        {selectedNode.data.metadata?._fileMissing && (
                                            <div style={{ color: '#e86f4a', fontSize: '0.8em', marginTop: '4px', fontWeight: 600 }}>
                                                ⚠️ Steering file missing
                                            </div>
                                        )}
                                    </div>
                                )}
                                {selectedNode.type === 'hook' && (
                                    <div style={{
                                        marginTop: SPACE.md,
                                        padding: SPACE.sm,
                                        background: 'rgba(108, 108, 138, 0.08)',
                                        borderLeft: '3px solid #6c6c8a',
                                        borderRadius: '0 4px 4px 0',
                                    }}>
                                        <div style={{
                                            fontSize: '0.7em',
                                            fontWeight: 600,
                                            opacity: 0.5,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                            marginBottom: '4px',
                                        }}>
                                            Hook — {selectedNode.data.metadata?.event || 'unknown'}
                                        </div>
                                        <div style={{ fontSize: '0.85em' }}>
                                            Script: <code>{selectedNode.data.metadata?.script || 'N/A'}</code>
                                        </div>
                                        {selectedNode.data.metadata?.on_failure && (
                                            <div style={{ fontSize: '0.8em', marginTop: '2px', opacity: 0.7 }}>
                                                On failure: {selectedNode.data.metadata.on_failure}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Show idoneity info for skill nodes (FEAT-011 R4) */}
                                {selectedNode.type === 'skill' && selectedNode.data.metadata?._bestOwner && (
                                    <div style={{
                                        marginTop: SPACE.md,
                                        padding: SPACE.sm,
                                        background: 'rgba(42, 161, 152, 0.08)',
                                        borderLeft: '3px solid #2aa198',
                                        borderRadius: '0 4px 4px 0',
                                    }}>
                                        <div style={{
                                            fontSize: '0.7em',
                                            fontWeight: 600,
                                            opacity: 0.5,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                            marginBottom: '4px',
                                        }}>
                                            Semantic Ownership
                                        </div>
                                        <div style={{ fontSize: '0.85em' }}>
                                            Best owner: <strong>{selectedNode.data.metadata._bestOwner}</strong>
                                            <span style={{ opacity: 0.5, marginLeft: SPACE.sm }}>
                                                (score: {selectedNode.data.metadata._bestOwnerScore?.toFixed(2)})
                                            </span>
                                        </div>
                                        {selectedNode.data.metadata._mismatch && (
                                            <div style={{ color: '#e86f4a', fontSize: '0.8em', marginTop: '4px', fontWeight: 600 }}>
                                                ⚠️ Mismatch — re-assign to {selectedNode.data.metadata._mismatchBestOwner}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
    );
};
