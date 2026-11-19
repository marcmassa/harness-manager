import * as React from 'react';
import { Badge } from './controls.js';
import { MDViewer } from './components/MDViewer.js';
import { SourceOwnershipSection, canPerform } from './components/SourceOwnershipSection.js';
import { SPACE } from './styles.js';
import { IconChevronLeft, IconChevronRight, IconEdit, IconTrash, IconClose, PanelActionButton } from './panelChrome.js';
import { vscode } from './vscodeApi.js';
import { NodeDescriptionTab } from './NodeDescriptionTab.js';
import type { DashboardContext } from './useDashboardActions.js';

export const NodeDetailPanel = ({ ctx }: { ctx: DashboardContext }) => {
    const { selectedNode, setSelectedNode, ownership, mdContent, mdLoading, detailTab, setDetailTab, isDetailPanelCollapsed, setIsDetailPanelCollapsed } = ctx;
    return (
                <aside style={{ 
                    width: isDetailPanelCollapsed ? '56px' : '380px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--vscode-sideBar-background)', 
                    borderLeft: '1px solid var(--vscode-panel-border)',
                    boxShadow: '-6px 0 24px rgba(0,0,0,0.35)',
                    zIndex: 30,
                    animation: 'slideInRight 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}>
                    {/* Panel header */}
                    <div style={{ 
                        padding: isDetailPanelCollapsed ? `${SPACE.sm} ${SPACE.xs}` : `${SPACE.sm} ${SPACE.md}`,
                        borderBottom: '1px solid var(--vscode-panel-border)',
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        gap: SPACE.sm,
                        flexShrink: 0,
                        background: 'color-mix(in srgb, var(--vscode-sideBar-background) 70%, var(--vscode-editor-background))',
                    }}>
                        {!isDetailPanelCollapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0, flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1em', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedNode.data.label}
                                </h3>
                                <Badge style={{ flexShrink: 0 }}>{selectedNode.type.toUpperCase()}</Badge>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'center', justifyContent: isDetailPanelCollapsed ? 'center' : 'flex-end', flex: isDetailPanelCollapsed ? 1 : undefined }}>
                            {/* R1, R2 (FEAT-014): Edit File button — visible text, only for skill/subagent */}
                            {!isDetailPanelCollapsed && (selectedNode.type === 'skill' || selectedNode.type === 'subagent' || selectedNode.type === 'steering' || selectedNode.type === 'hook') && (
                                <PanelActionButton
                                    title="Open in VS Code editor for editing"
                                    onClick={() => {
                                        vscode.postMessage({
                                            type: 'openMarkdownFile',
                                            nodeId: selectedNode.id,
                                            nodeType: selectedNode.type,
                                            filePath: selectedNode.data?.metadata?._filePath,
                                        });
                                        setDetailTab('markdown'); // R4: switch to markdown tab
                                    }}
                                >
                                    <IconEdit />
                                </PanelActionButton>
                            )}
                            {!isDetailPanelCollapsed && (
                                <PanelActionButton
                                    title={canPerform(ownership[selectedNode.id], 'editing.deleteEntity') ? 'Delete' : 'Delete is not available for this resource'}
                                    danger
                                    disabled={!canPerform(ownership[selectedNode.id], 'editing.deleteEntity')}
                                    onClick={() => {
                                        vscode.postMessage({ type: 'deleteNode', id: selectedNode.id, nodeType: selectedNode.type });
                                        setSelectedNode(null);
                                    }}
                                >
                                    <IconTrash />
                                </PanelActionButton>
                            )}
                            <PanelActionButton
                                title={isDetailPanelCollapsed ? 'Expand details panel' : 'Collapse details panel'}
                                onClick={() => setIsDetailPanelCollapsed((collapsed) => !collapsed)}
                            >
                                {isDetailPanelCollapsed ? <IconChevronLeft /> : <IconChevronRight />}
                            </PanelActionButton>
                            <PanelActionButton
                                title="Close"
                                onClick={() => setSelectedNode(null)}
                            >
                                <IconClose />
                            </PanelActionButton>
                        </div>
                    </div>
                    {!isDetailPanelCollapsed && (
                        <>
                    {/* Tab bar: Description | Markdown File */}
                    <div style={{ 
                        display: 'flex', 
                        borderBottom: '1px solid var(--vscode-panel-border)',
                        flexShrink: 0,
                        padding: `0 ${SPACE.md}`,
                        gap: 0,
                    }}>
                        <div 
                            onClick={() => setDetailTab('description')}
                            style={{ 
                                padding: `${SPACE.sm} ${SPACE.md}`, 
                                cursor: 'pointer', 
                                fontSize: '0.75em', 
                                textTransform: 'uppercase', 
                                letterSpacing: '1px',
                                fontWeight: detailTab === 'description' ? 700 : 500,
                                opacity: 1,
                                // BLOCKER-2 fix: tab-activeForeground for active tab text (AAA)
                                color: detailTab === 'description'
                                    ? 'var(--vscode-tab-activeForeground)'
                                    : 'var(--vscode-tab-inactiveForeground, var(--vscode-descriptionForeground))',
                                borderBottom: detailTab === 'description' 
                                    ? '2px solid var(--vscode-focusBorder)' 
                                    : '2px solid transparent',
                                transition: 'color 0.2s ease, opacity 0.2s ease, border-color 0.2s ease',
                                userSelect: 'none',
                            }}
                        >
                            📋 Description
                        </div>
                        <div 
                            onClick={() => setDetailTab('markdown')}
                            style={{ 
                                padding: `${SPACE.sm} ${SPACE.md}`, 
                                cursor: 'pointer', 
                                fontSize: '0.75em', 
                                textTransform: 'uppercase', 
                                letterSpacing: '1px',
                                fontWeight: detailTab === 'markdown' ? 700 : 500,
                                opacity: 1,
                                // BLOCKER-2 fix: tab-activeForeground for active tab text (AAA)
                                color: detailTab === 'markdown'
                                    ? 'var(--vscode-tab-activeForeground)'
                                    : 'var(--vscode-tab-inactiveForeground, var(--vscode-descriptionForeground))',
                                borderBottom: detailTab === 'markdown' 
                                    ? '2px solid var(--vscode-focusBorder)' 
                                    : '2px solid transparent',
                                transition: 'color 0.2s ease, opacity 0.2s ease, border-color 0.2s ease',
                                userSelect: 'none',
                            }}
                        >
                            📄 Markdown File
                        </div>
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                        {detailTab === 'description' && <NodeDescriptionTab ctx={ctx} />}
                        {detailTab === 'markdown' && (
                            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                                {/* Header: file path label only (open button is in panel header) */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: `${SPACE.sm} ${SPACE.md}`,
                                    borderBottom: '1px solid var(--vscode-panel-border)',
                                    flexShrink: 0,
                                }}>
                                    <div style={{
                                        fontSize: '0.8em',
                                        fontWeight: 600,
                                        opacity: 0.7,
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                    }}>
                                        {mdContent?.filePath || 'Markdown File'}
                                    </div>
                                </div>
                                <div style={{ flex: 1, overflow: 'auto' }}>
                                    <MDViewer 
                                        content={mdContent} 
                                        isLoading={mdLoading} 
                                        nodeMetadata={selectedNode?.data?.metadata}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                        </>
                    )}
                </aside>
    );
};
