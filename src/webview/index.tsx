import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { provideVSCodeDesignSystem, allComponents } from '@vscode/webview-ui-toolkit';
import { ReactFlowProvider } from 'reactflow';
import { WhiteboardCanvas } from './WhiteboardCanvas.js';
import { TimelineView } from './TimelineView.js';
import { EntitySidePanel } from './components/EntitySidePanel.js';
import { MDViewer } from './components/MDViewer.js';
import type { EntityFormData } from './components/EntitySidePanel.js';
import { DashboardData, MarkdownFileContent } from '../types.js';
import { SUPPORTED_FRAMEWORKS } from '../frameworks.js';

import 'reactflow/dist/style.css';

provideVSCodeDesignSystem().register(allComponents);

const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px' };

const PanelActionIcon = ({ children }: { children: React.ReactNode }) => (
    <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        {children}
    </svg>
);

const IconChevronLeft = () => (
    <PanelActionIcon>
        <path d="M10.5 3.5L6 8l4.5 4.5" />
    </PanelActionIcon>
);

const IconChevronRight = () => (
    <PanelActionIcon>
        <path d="M5.5 3.5L10 8l-4.5 4.5" />
    </PanelActionIcon>
);

const IconEdit = () => (
    <PanelActionIcon>
        <path d="M3 13l2.8-.7L12.6 5.5 10.5 3.4 3.7 10.2z" />
        <path d="M9.9 4l2.1 2.1" />
    </PanelActionIcon>
);

const IconTrash = () => (
    <PanelActionIcon>
        <path d="M2.8 4.5h10.4" />
        <path d="M6.2 4.5V3.2h3.6v1.3" />
        <path d="M4.5 4.5l.8 8.3h5.4l.8-8.3" />
        <path d="M6.7 7v4.2" />
        <path d="M9.3 7v4.2" />
    </PanelActionIcon>
);

const IconClose = () => (
    <PanelActionIcon>
        <path d="M4 4l8 8" />
        <path d="M12 4L4 12" />
    </PanelActionIcon>
);

const PanelActionButton = ({
    title,
    onClick,
    children,
    danger = false,
}: {
    title: string;
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
}) => (
    <button
        type="button"
        className={`harness-panel-action-button${danger ? ' harness-panel-action-button--danger' : ''}`}
        title={title}
        aria-label={title}
        onClick={onClick}
    >
        {children}
    </button>
);

// ===== SINGLE VS Code API acquisition — shared globally =====
let _vscode: any = null;
try {
    _vscode = (window as any).acquireVsCodeApi?.() ?? (window as any).vscode ?? {};
} catch (e) {
    _vscode = {};
}
const vscode = _vscode;
(window as any).__harness_vscode_api = vscode;

const SkeletonLoading = () => (
    <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        background: 'var(--vscode-editor-background)',
    }}>
        <header style={{ 
            padding: SPACE.sm, 
            borderBottom: '1px solid var(--vscode-panel-border)' 
        }}>
            <div className="skeleton-shimmer" style={{ 
                width: '180px', 
                height: '14px', 
                borderRadius: '4px',
                background: 'var(--vscode-skeleton-background)',
                marginBottom: SPACE.sm,
                opacity: 0.5,
                animation: 'shimmer 1.8s ease-in-out infinite',
            }} />
            <div className="skeleton-shimmer" style={{ 
                width: '300px', 
                height: '24px', 
                borderRadius: '4px',
                background: 'var(--vscode-skeleton-background)',
                opacity: 0.3,
                animation: 'shimmer 1.8s ease-in-out infinite 0.3s',
            }} />
        </header>
        <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
        }}>
            <vscode-progress-ring />
        </div>
    </div>
);
const FRAMEWORK_SIGNATURES: Array<{ label: string; signatures: string }> = SUPPORTED_FRAMEWORKS.map((framework) => ({
    label: framework.label,
    signatures: framework.signatures.join(', '),
}));

const FrameworkBadge = ({ frameworks }: { frameworks: string[] }) => {
    if (frameworks.length === 0) return null;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.xs,
                maxWidth: '460px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                padding: '2px',
            }}
            title={`Detected frameworks: ${frameworks.join(' · ')}`}
        >
            {frameworks.map((framework) => (
                <span
                    key={framework}
                    style={{
                        fontSize: '0.68em',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))',
                        background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
                        color: 'var(--vscode-editorWidget-foreground, var(--vscode-foreground))',
                        fontWeight: 600,
                        letterSpacing: '0.2px',
                        flexShrink: 0,
                    }}
                >
                    {framework}
                </span>
            ))}
        </div>
    );
};

const EmptyState = () => (
    <div
        style={{
            margin: SPACE.lg,
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '10px',
            padding: SPACE.lg,
            background: 'color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background))',
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
        }}
    >
        <div>
            <div style={{ fontSize: '1.05em', fontWeight: 700, marginBottom: SPACE.xs }}>
                No agent framework detected
            </div>
            <div style={{ opacity: 0.78, lineHeight: 1.45 }}>
                Add one of the supported framework files to this workspace and the graph will load automatically.
            </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
            {FRAMEWORK_SIGNATURES.map((framework) => (
                <div
                    key={framework.label}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr',
                        gap: SPACE.sm,
                        padding: `${SPACE.xs} 0`,
                        borderBottom: '1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent)',
                    }}
                >
                    <span style={{ fontWeight: 600 }}>{framework.label}</span>
                    <code style={{ opacity: 0.82 }}>{framework.signatures}</code>
                </div>
            ))}
        </div>
    </div>
);

const App = () => {
    const [data, setData] = React.useState<DashboardData | null>(null);
    const [selectedNode, setSelectedNode] = React.useState<any>(null);
    const [activeTab, setActiveTab] = React.useState('whiteboard');
    const [showSpecs, setShowSpecs] = React.useState(false);
    // T15 (R3): global suggestion edge visibility toggle (session-only)
    const [showSuggestions, setShowSuggestions] = React.useState(false);
    
    // Side panel state (replaces inline isCreating form)
    const [isSidePanelOpen, setIsSidePanelOpen] = React.useState(false);
    
    // MD viewer state
    const [mdContent, setMdContent] = React.useState<MarkdownFileContent | null>(null);
    const [mdLoading, setMdLoading] = React.useState(false);
    // Detail panel tab (FEAT-011 redesigned panel)
    const [detailTab, setDetailTab] = React.useState<'description' | 'markdown'>('description');
    const [isDetailPanelCollapsed, setIsDetailPanelCollapsed] = React.useState(false);

    // Listen for messages from extension
    React.useEffect(() => {
        console.log('Webview: Initializing...');
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            console.log('Webview: Received message', message.type);
            switch (message.type) {
                case 'init':
                    setData(message.data);
                    break;
                case 'markdownContent':
                    setMdContent(message.content);
                    setMdLoading(false);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ type: 'ready' });

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // When a node is selected, request its Markdown file content (R3) and reset detail tab
    React.useEffect(() => {
        if (selectedNode) {
            setIsDetailPanelCollapsed(false);
            setMdLoading(true);
            setMdContent(null);
            setDetailTab('description');
            vscode.postMessage({ 
                type: 'getMarkdownContent', 
                nodeId: selectedNode.id, 
                nodeType: selectedNode.type,
                filePath: selectedNode.data?.metadata?._filePath,
            });
        } else {
            setMdContent(null);
            setMdLoading(false);
        }
    }, [selectedNode]);

    const filteredGraph = React.useMemo(() => {
        if (!data) return null;
        const baseNodes = data.graph.nodes;
        const baseEdges = data.graph.edges;

        const nodes = showSpecs ? baseNodes : baseNodes.filter(n => n.type !== 'feature');
        const nodeIds = new Set(nodes.map(n => n.id));
        const edges = baseEdges.filter(e => {
            if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false;
            // T15 (R3): hide suggested edges when showSuggestions is false
            if (!showSuggestions && e.label === 'suggested') return false;
            return true;
        });

        return { nodes, edges };
    }, [data, showSpecs, showSuggestions]);

    const detectedFrameworks = React.useMemo(() => {
        if (!data) return [] as string[];
        if (Array.isArray(data.detectedFrameworks) && data.detectedFrameworks.length > 0) {
            return data.detectedFrameworks;
        }
        const frameworkSet = new Set<string>();
        for (const node of data.graph.nodes) {
            const label = node.metadata?._frameworkLabel || node.metadata?._framework;
            if (typeof label === 'string' && label.trim().length > 0) {
                frameworkSet.add(label.trim());
            }
        }
        if (frameworkSet.size === 0 && data.graph.nodes.length > 0) {
            frameworkSet.add('Harness SDD');
        }
        return Array.from(frameworkSet);
    }, [data]);
    const shouldShowEmptyState = Boolean(filteredGraph) && detectedFrameworks.length === 0 && filteredGraph.nodes.length === 0;

    // Handle entity creation from side panel
    const handleCreateEntity = React.useCallback((formData: EntityFormData) => {
        if (formData.entityType === 'subagent') {
            vscode.postMessage({ 
                type: 'createNode', 
                nodeType: 'subagent', 
                name: formData.name, 
                description: formData.description,
            });
        } else {
            vscode.postMessage({ 
                type: 'createNode', 
                nodeType: 'skill', 
                name: formData.name, 
                description: formData.description,
                license: formData.license,
                compatibility: formData.compatibility,
                author: formData.author,
                version: formData.version,
            });
        }
        setIsSidePanelOpen(false);
    }, []);

    if (!data || !filteredGraph) {
        return <SkeletonLoading />;
    }

    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            background: 'var(--vscode-editor-background)',
            animation: 'appear 0.3s ease-out',
        }}>
            <header style={{ 
                padding: SPACE.sm, 
                borderBottom: '1px solid var(--vscode-panel-border)', 
                zIndex: 10,
                animation: 'fadeInUp 0.35s ease-out',
            }}>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: SPACE.sm,
                    gap: SPACE.sm,
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: 'normal' }}>
                        Harness <span style={{ opacity: 0.6 }}>Manager</span>
                    </h2>
                    <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}>
                        <vscode-checkbox checked={showSpecs} onChange={(e: any) => setShowSpecs(e.target.checked)}>Specs</vscode-checkbox>
                        <vscode-checkbox checked={showSuggestions} onChange={(e: any) => setShowSuggestions(e.target.checked)}>Suggestions</vscode-checkbox>
                        <FrameworkBadge frameworks={detectedFrameworks} />
                        <vscode-button onClick={() => setIsSidePanelOpen(true)}>Add Entity</vscode-button>
                    </div>
                </div>
                
                <div style={{ display: 'flex', borderTop: '1px solid var(--vscode-panel-border)', marginTop: SPACE.xs }}>
                    {(['whiteboard', 'timeline'] as const).map(tab => (
                        <div
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: `${SPACE.sm} ${SPACE.md}`,
                                cursor: 'pointer',
                                fontSize: '0.75em',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                fontWeight: activeTab === tab ? 700 : 500,
                                opacity: 1,
                                // BLOCKER-2 fix: tab-activeForeground is the semantic token for
                                // tab text (Dark+ = #fff = 15.3:1 AAA; Light+ = #333 = AAA).
                                // focusBorder (#007fd4) is a focus-ring token, not a text token.
                                color: activeTab === tab
                                    ? 'var(--vscode-tab-activeForeground)'
                                    : 'var(--vscode-tab-inactiveForeground, var(--vscode-descriptionForeground))',
                                borderBottom: activeTab === tab
                                    ? '2px solid var(--vscode-focusBorder)'
                                    : '2px solid transparent',
                                transition: 'color 0.2s ease, opacity 0.2s ease, border-color 0.2s ease',
                                userSelect: 'none',
                            }}
                        >
                            {tab.toUpperCase()}
                        </div>
                    ))}
                </div>
            </header>

            {/* Side Panel for Entity Creation (R4, R5, R6, R7) — replaces inline isCreating section */}
            <EntitySidePanel
                isOpen={isSidePanelOpen}
                onClose={() => setIsSidePanelOpen(false)}
                onCreateEntity={handleCreateEntity}
            />
            
            {/* Row: canvas/timeline column + right detail panel */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

            {/* Left column */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <section style={{ 
                flex: 1, 
                position: 'relative', 
                display: activeTab === 'whiteboard' ? 'flex' : 'none', 
                flexDirection: 'column', 
                minHeight: 0,
                animation: activeTab === 'whiteboard' ? 'fadeIn 0.22s ease-out' : 'none',
            }}>
                {shouldShowEmptyState ? (
                    <EmptyState />
                ) : (
                    <ReactFlowProvider>
                        <WhiteboardCanvas graph={filteredGraph} onNodeSelect={setSelectedNode} selectedNodeId={selectedNode?.id} />
                    </ReactFlowProvider>
                )}
            </section>

            <section style={{ 
                flex: 1, 
                overflowY: 'auto', 
                display: activeTab === 'timeline' ? 'block' : 'none',
                animation: activeTab === 'timeline' ? 'fadeIn 0.22s ease-out' : 'none',
            }}>
                <TimelineView milestones={data.milestones} />
            </section>
            </div>{/* end left column */}

            {/* Right: detail panel — slides in from right when a node is selected */}
            {selectedNode && activeTab === 'whiteboard' && (
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
                                <vscode-badge style={{ flexShrink: 0 }}>{selectedNode.type.toUpperCase()}</vscode-badge>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'center', justifyContent: isDetailPanelCollapsed ? 'center' : 'flex-end', flex: isDetailPanelCollapsed ? 1 : undefined }}>
                            {/* R1, R2 (FEAT-014): Edit File button — visible text, only for skill/subagent */}
                            {!isDetailPanelCollapsed && (selectedNode.type === 'skill' || selectedNode.type === 'subagent') && (
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
                                    title="Delete"
                                    danger
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
                        {detailTab === 'description' && (
                            <div style={{ flex: 1, overflow: 'auto', padding: SPACE.md, display: 'flex', flexDirection: 'column' }}>
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
                                <vscode-text-area 
                                    rows={4}
                                    value={selectedNode.data.metadata.description || selectedNode.data.metadata.body || ''} 
                                    style={{ width: '100%', flex: 1 }}
                                    onInput={(e: any) => {
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
                                        <vscode-button onClick={() => {
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
                                        </vscode-button>
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
                        )}
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
            )}
            </div>{/* end row wrapper */}
            
            <style>{`
                :root {
                    --space-xs: 4px;
                    --space-sm: 8px;
                    --space-md: 16px;
                    --space-lg: 24px;
                    --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
                }
                .harness-panel-action-button {
                    width: 30px;
                    height: 30px;
                    border-radius: 6px;
                    border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
                    background: var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--vscode-sideBar-background) 80%, var(--vscode-editor-background)));
                    color: var(--vscode-foreground);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease, color 0.16s ease;
                    padding: 0;
                }
                .harness-panel-action-button:hover {
                    background: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-focusBorder);
                }
                .harness-panel-action-button:active {
                    transform: scale(0.96);
                }
                .harness-panel-action-button--danger {
                    background: color-mix(in srgb, var(--vscode-errorForeground, #e86f4a) 16%, transparent);
                    border-color: color-mix(in srgb, var(--vscode-errorForeground, #e86f4a) 42%, var(--vscode-panel-border));
                    color: color-mix(in srgb, var(--vscode-errorForeground, #e86f4a) 90%, var(--vscode-foreground));
                }
                .harness-panel-action-button--danger:hover {
                    background: color-mix(in srgb, var(--vscode-errorForeground, #e86f4a) 24%, transparent);
                    color: var(--vscode-errorForeground, #e86f4a);
                    border-color: var(--vscode-errorForeground, #e86f4a);
                }
                .harness-panel-action-button:focus-visible {
                    outline: 2px solid var(--vscode-focusBorder);
                    outline-offset: 1px;
                }

                /* ===== ANIMATIONS ===== */
                @keyframes appear { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }

                @keyframes pickerFadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes pickerItemFadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.6; }
                }
                @keyframes dotPulse {
                    0%, 100% { box-shadow: 0 0 0 2px var(--vscode-editorInfo-foreground); transform: scale(1); }
                    50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--vscode-editorInfo-foreground) 25%, transparent); transform: scale(1.2); }
                }
                @keyframes mismatchPulse {
                    0%, 100% { border-color: rgba(232, 111, 74, 0.4); }
                    50% { border-color: rgba(232, 111, 74, 1); }
                }

                /* ===== REACT FLOW OVERRIDES ===== */
                .react-flow__controls {
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    background: var(--vscode-editor-background);
                }
                .react-flow__controls-button {
                    transition: background 0.15s var(--ease-smooth);
                }
                .react-flow__controls-button:hover {
                    background: var(--vscode-list-hoverBackground);
                }

                .react-flow__node:hover { z-index: 10; }

                /* ===== ACTIVE NODE — panel open ===== */
                @keyframes activeNodePulse {
                    0%, 100% {
                        box-shadow:
                            0 0 0 3px var(--vscode-focusBorder),
                            0 0 0 7px rgba(0, 122, 204, 0.22),
                            0 0 24px 8px rgba(0, 122, 204, 0.15),
                            0 12px 40px rgba(0,0,0,0.5);
                    }
                    50% {
                        box-shadow:
                            0 0 0 3px var(--vscode-focusBorder),
                            0 0 0 11px rgba(0, 122, 204, 0.12),
                            0 0 36px 12px rgba(0, 122, 204, 0.28),
                            0 12px 40px rgba(0,0,0,0.5);
                    }
                }
                .react-flow__node.harness-active-node {
                    z-index: 20;
                }
                .react-flow__node.harness-active-node .harness-node {
                    border: 2px solid var(--vscode-focusBorder) !important;
                    box-shadow:
                        0 0 0 3px var(--vscode-focusBorder),
                        0 0 0 7px rgba(0, 122, 204, 0.22),
                        0 0 24px 8px rgba(0, 122, 204, 0.15),
                        0 12px 40px rgba(0,0,0,0.5) !important;
                    animation: activeNodePulse 2.4s ease-in-out infinite !important;
                }

                /* ===== DESCRIPTION TEXTAREA — fills right panel ===== */
                vscode-text-area {
                    display: flex !important;
                    flex-direction: column;
                    min-height: 0;
                }
                vscode-text-area::part(control) {
                    flex: 1;
                    min-height: 100px;
                    resize: vertical;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    line-height: 1.5;
                }

                /* ===== EDGE VISIBILITY ===== */
                .react-flow__edge-path {
                    transition: stroke 0.3s var(--ease-smooth), stroke-width 0.3s var(--ease-smooth);
                }

                @keyframes dash-scroll {
                    from { stroke-dashoffset: 24; }
                    to   { stroke-dashoffset: 0; }
                }

                /* manages (blue) */
                .harness-edge--manages .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(74, 125, 255, 0.30));
                }
                .harness-edge--manages:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(74, 125, 255, 0.50));
                    stroke-width: 5 !important;
                }
                .harness-edge--manages.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(74, 125, 255, 0.70));
                    stroke-width: 5 !important;
                }

                /* uses (teal) */
                .harness-edge--uses .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(42, 161, 152, 0.30));
                }
                .harness-edge--uses:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(42, 161, 152, 0.50));
                    stroke-width: 4.5 !important;
                }
                .harness-edge--uses.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(42, 161, 152, 0.70));
                    stroke-width: 4.5 !important;
                }

                /* executing (orange) */
                .harness-edge--executing .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(232, 111, 74, 0.30));
                }
                .harness-edge--executing:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(232, 111, 74, 0.50));
                    stroke-width: 5.5 !important;
                }
                .harness-edge--executing.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(232, 111, 74, 0.70));
                    stroke-width: 5.5 !important;
                }

                /* discovered (grey) */
                .harness-edge--discovered .react-flow__edge-path {
                    filter: drop-shadow(0 0 2px rgba(108, 108, 138, 0.20));
                }
                .harness-edge--discovered:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 5px rgba(108, 108, 138, 0.40));
                    stroke-width: 3.5 !important;
                }
                .harness-edge--discovered.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 8px rgba(108, 108, 138, 0.60));
                    stroke-width: 3.5 !important;
                }

                /* suggested (amber) — scroll animation */
                .harness-edge--suggested .react-flow__edge-path {
                    filter: drop-shadow(0 0 3px rgba(212, 168, 74, 0.25));
                    animation: dash-scroll 1.2s linear infinite;
                }
                .harness-edge--suggested:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 6px rgba(212, 168, 74, 0.50));
                    stroke-width: 4 !important;
                }
                .harness-edge--suggested.selected .react-flow__edge-path {
                    filter: drop-shadow(0 0 10px rgba(212, 168, 74, 0.70));
                    stroke-width: 4 !important;
                }

                /* fallback */
                .harness-edge .react-flow__edge-path {
                    filter: drop-shadow(0 0 2px rgba(136, 136, 136, 0.20));
                }
                .harness-edge:hover .react-flow__edge-path {
                    filter: drop-shadow(0 0 5px rgba(136, 136, 136, 0.40));
                    stroke-width: 4 !important;
                }
                .react-flow__edge-textbg {
                    fill: var(--vscode-editor-background) !important;
                    fill-opacity: 0.95 !important;
                }
                .react-flow__edge-text {
                    font-size: 11px !important;
                    font-weight: 600 !important;
                }

                .react-flow__handle-connecting {
                    background: var(--vscode-editorWarning-foreground) !important;
                }
                .react-flow__node.selected { outline: none; }

                vscode-panel-tab { transition: opacity 0.2s var(--ease-smooth); }
                vscode-panel-tab:hover { opacity: 0.8; }
                vscode-badge { transition: opacity 0.2s var(--ease-smooth); }
            `}</style>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
