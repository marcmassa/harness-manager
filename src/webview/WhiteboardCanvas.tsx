import * as React from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Edge,
    useReactFlow,
    SelectionMode,
    NodeChange,
} from '@xyflow/react';
import { CustomNode } from './components/CustomNode.js';
import { DiscoveredNode } from './components/DiscoveredNode.js';
import type { HarnessFlowNode } from './nodeTypes.js';
import { EdgeContextMenu } from './components/EdgeContextMenu.js';
import { getLayoutedElementsByProvider, type ProviderGroup } from './layoutUtils.js';
import { HarnessGraph } from '../types.js';
import { ManualPositionMap, isValidNodePosition, mergeLayoutedNodesWithManualPositions } from './nodePositionUtils.js';
import { edgeConfigs, defaultEdgeCfg, toFlowEdge } from './whiteboardEdgeStyles.js';
import { useWhiteboardGraphData } from './useWhiteboardGraphData.js';
import { useLinkGestures } from './useLinkGestures.js';
import { useEdgeActions } from './useEdgeActions.js';
import { WhiteboardToolbar } from './WhiteboardToolbar.js';
import { ProviderAreaOverlay, WhiteboardLegendBar } from './ProviderOverlays.js';
import { NodeContextMenu, type NodeContextMenuState } from './NodeContextMenu.js';
import { SuggestionDialog, IdoneityDialog, type SuggestionDialogState, type IdoneityDialogState } from './WhiteboardDialogs.js';

// FEAT-037 T6: edgeConfigs / EDGE_TYPE_ROUTING live in whiteboardEdgeStyles.ts
// (FEAT-048 split) and stay re-exported here for existing importers.
export { edgeConfigs, EDGE_TYPE_ROUTING } from './whiteboardEdgeStyles.js';

const nodeTypes = {
    agent: CustomNode,
    subagent: CustomNode,
    skill: CustomNode,
    feature: CustomNode,
    steering: CustomNode,
    hook: CustomNode,
    'discovered-agent': DiscoveredNode,
    'discovered-skill': DiscoveredNode,
    'discovered-tool': DiscoveredNode,
    'discovered-resource': DiscoveredNode,
    'cli-install': DiscoveredNode,
};

interface Props {
    graph: HarnessGraph;
    onNodeSelect: (node: any) => void;
    selectedNodeId?: string | null;
    discoveredNodes?: { nodes: HarnessGraph['nodes']; edges: HarnessGraph['edges'] };
    // FEAT-033: Run Panel integration
    runningNodeIds?: Set<string>;
    lastRunByNodeId?: Record<string, number>;
    onRunNode?: (nodeId: string) => void;
    // FEAT-033 Phase 2: Architecture Studio toolbar
    onCreateNode?: () => void;
    onOpenTemplates?: () => void;
    // FEAT-034: per-node optimizer score chip (R45)
    scoresByNodeId?: Map<string, { score: number; tier: string; findingCount: number }>;
}

export const WhiteboardCanvas = ({ graph, onNodeSelect, selectedNodeId, discoveredNodes, runningNodeIds, lastRunByNodeId, onRunNode, onCreateNode, onOpenTemplates, scoresByNodeId }: Props) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<HarnessFlowNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const manualPositionsRef = React.useRef<ManualPositionMap>({});
    const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);
    const previousNodeSignatureRef = React.useRef<string>('');
    const hasInitialFitRef = React.useRef(false);
    const { fitView } = useReactFlow();

    // Edge context menu state
    const [contextMenuEdge, setContextMenuEdge] = React.useState<Edge | null>(null);
    const [contextMenuPos, setContextMenuPos] = React.useState({ x: 0, y: 0 });
    const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);

    // Node context menu state (R6: "Show skill suggestions")
    const [nodeContextMenu, setNodeContextMenu] = React.useState<NodeContextMenuState | null>(null);
    const [suggestionDialog, setSuggestionDialog] = React.useState<SuggestionDialogState | null>(null);

    // FEAT-011: Idoneity dialog state (R7)
    const [idoneityDialog, setIdoneityDialog] = React.useState<IdoneityDialogState | null>(null);

    // Provider groups (layout by provider + area overlay + nav dropdown)
    const [providerGroups, setProviderGroups] = React.useState<ProviderGroup[]>([]);
    const [focusedProvider, setFocusedProvider] = React.useState<string | null>(null);
    const [viewport, setViewport] = React.useState({ x: 0, y: 0, zoom: 1 });

    const {
        connectedSkills, allSkills, allOwners, connectedOwners,
        getCanonicalEdgeForPair, isValidUsesLinkPair,
        idoneityData, suggestedCounts, mergedGraph,
    } = useWhiteboardGraphData(graph, discoveredNodes);

    const { handleDeleteEdge, handleChangeLabel, handleDismissSuggestion, handleAcceptSuggestion, handleToggleConnection } =
        useEdgeActions({ setEdges, setContextMenuEdge, setSelectedEdgeId });

    // Delete key listener for selected edges
    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdgeId) {
                const edgeToDelete = edges.find(ed => ed.id === selectedEdgeId);
                if (edgeToDelete) {
                    handleDeleteEdge(edgeToDelete);
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectedEdgeId, edges]);

    const {
        highlightEdgeId, pendingLinkSourceId, setPendingLinkSourceId,
        dragLinkSourceId, setDragLinkSourceId, dragLinkHoverTargetId, setDragLinkHoverTargetId,
        createUsesEdge, handleSourcePillClick, handleTargetPillClick,
        handleDragLinkHoverChange, handleDragLinkDropOnNode,
        onConnect, onConnectStart, onConnectEnd,
    } = useLinkGestures({ edges, setEdges, getCanonicalEdgeForPair, isValidUsesLinkPair });

    const handleNodesChange = React.useCallback((changes: NodeChange<HarnessFlowNode>[]) => {
        onNodesChange(changes);

        for (const change of changes) {
            if (change.type === 'remove') {
                delete manualPositionsRef.current[change.id];
                continue;
            }

            if (
                change.type === 'position' &&
                change.dragging !== true &&
                isValidNodePosition(change.position)
            ) {
                manualPositionsRef.current[change.id] = {
                    x: change.position.x,
                    y: change.position.y,
                };
            }
        }
    }, [onNodesChange]);

    const handleNodeDragStop = React.useCallback((_: any, node: any) => {
        if (!node?.id || !isValidNodePosition(node?.position)) return;
        manualPositionsRef.current[node.id] = {
            x: node.position.x,
            y: node.position.y,
        };
    }, []);

    React.useEffect(() => {
        if (!mergedGraph) return;

        const initialNodes = mergedGraph.nodes.map(n => {
            let nodeLinkTargets: { id: string; label: string; alreadyConnected: boolean }[] = [];
            if (n.type === 'subagent' || n.type === 'agent') {
                const connected = connectedSkills[n.id] || new Set();
                nodeLinkTargets = allSkills.map(skill => ({
                    id: skill.id,
                    label: skill.label,
                    alreadyConnected: connected.has(skill.id)
                }));
            }
            if (n.type === 'skill') {
                const connected = connectedOwners[n.id] || new Set();
                nodeLinkTargets = allOwners.map(owner => ({
                    id: owner.id,
                    label: owner.label,
                    alreadyConnected: connected.has(owner.id)
                }));
            }

            return {
                id: n.id,
                type: n.type,
                data: { 
                    label: n.label, 
                    metadata: n.metadata,
                    availableLinkTargets: nodeLinkTargets,
                    onCreateLink: (sourceId: string, targetId: string) => {
                        createUsesEdge(sourceId, targetId);
                    },
                    onSourcePillClick: handleSourcePillClick,
                    onTargetPillClick: handleTargetPillClick,
                    onLinkTargetHoverChange: handleDragLinkHoverChange,
                    onLinkDropOnNode: handleDragLinkDropOnNode,
                    canLinkThroughPills: n.type === 'agent' || n.type === 'subagent' || n.type === 'skill' || n.type === 'steering' || n.type === 'hook',
                    isLinkSourceArmed: false,
                    isLinkTargetActive: false,
                    isDragLinkHoverTarget: false,
                    suggestedCount: suggestedCounts[n.id] || 0,
                    isActive: n.id === selectedNodeId,
                    // FEAT-033: Run Panel integration (R8, R12, R15)
                    isRunning: runningNodeIds?.has(n.id) ?? false,
                    lastRunTimestamp: lastRunByNodeId?.[n.id],
                    onRunNode: (n.type === 'agent' || n.type === 'subagent') ? onRunNode : undefined,
                    onContextMenu: (event: React.MouseEvent) => {
                        event.preventDefault();
                        setNodeContextMenu({ node: n, position: { x: event.clientX, y: event.clientY } });
                    },
                },
                position: { x: 0, y: 0 }
            };
        });

        const initialEdges = graph.edges.map(e => toFlowEdge(e));

        const { nodes: layoutedNodes, edges: layoutedEdges, groups: providerGroups } = getLayoutedElementsByProvider(
            initialNodes,
            initialEdges
        );
        const { nodes: mergedNodes, manualPositions } = mergeLayoutedNodesWithManualPositions(
            layoutedNodes,
            manualPositionsRef.current
        );
        manualPositionsRef.current = manualPositions;

        setNodes([...mergedNodes]);
        setEdges([...layoutedEdges]);
        setProviderGroups(providerGroups);

        const nodeSignature = mergedNodes.map((node) => node.id).sort().join('|');
        const shouldFitView = !hasInitialFitRef.current || nodeSignature !== previousNodeSignatureRef.current;
        previousNodeSignatureRef.current = nodeSignature;

        if (shouldFitView) {
            window.requestAnimationFrame(() => fitView({ padding: 0.2, duration: 400 }));
            hasInitialFitRef.current = true;
        }
    }, [mergedGraph, fitView, allSkills, allOwners, connectedSkills, connectedOwners, createUsesEdge, handleSourcePillClick, handleTargetPillClick, handleDragLinkHoverChange, handleDragLinkDropOnNode, setEdges, suggestedCounts, selectedNodeId]);

    // Update isActive + className on nodes when selectedNodeId or runningNodeIds changes
    React.useEffect(() => {
        setNodes(nds => nds.map(n => {
            const isActive = n.id === selectedNodeId;
            const isRunning = runningNodeIds?.has(n.id) ?? false;
            const classes = [
                isActive ? 'harness-active-node' : '',
                isRunning ? 'harness-node--running' : '',
            ].filter(Boolean).join(' ');
            return {
                ...n,
                selected: isActive,
                className: classes,
                data: { ...n.data, isActive, isRunning, optimizerScore: scoresByNodeId?.get(n.id) },
            };
        }));
    }, [selectedNodeId, runningNodeIds, scoresByNodeId]);

    React.useEffect(() => {
        const linkSourceId = pendingLinkSourceId || dragLinkSourceId;
        setNodes(nds => nds.map(n => ({
            ...n,
            data: {
                ...n.data,
                isLinkSourceArmed: pendingLinkSourceId === n.id,
                isLinkTargetActive: Boolean(
                    linkSourceId &&
                    linkSourceId !== n.id &&
                    isValidUsesLinkPair(linkSourceId, n.id) &&
                    (pendingLinkSourceId ? true : dragLinkHoverTargetId === n.id)
                ),
                isDragLinkHoverTarget: Boolean(
                    dragLinkSourceId &&
                    dragLinkHoverTargetId === n.id &&
                    linkSourceId &&
                    linkSourceId !== n.id &&
                    isValidUsesLinkPair(linkSourceId, n.id)
                ),
            },
        })));
    }, [pendingLinkSourceId, dragLinkSourceId, dragLinkHoverTargetId, setNodes, isValidUsesLinkPair]);

    // Edge click handler — show context menu
    const onEdgeClick = React.useCallback((event: React.MouseEvent, edge: Edge) => {
        event.stopPropagation();
        setContextMenuEdge(edge);
        setContextMenuPos({ x: event.clientX, y: event.clientY });
        setSelectedEdgeId(edge.id);
    }, []);

    // T7 (R9): Hover z-index tracking
    const onEdgeMouseEnter = React.useCallback((_: React.MouseEvent, edge: Edge) => {
        setHoveredEdgeId(edge.id);
    }, []);

    const onEdgeMouseLeave = React.useCallback(() => {
        setHoveredEdgeId(null);
    }, []);

    // Apply highlight, hover z-index, and selected z-index in one pass (T8 R4, R8, R9)
    const edgesWithZIndex = React.useMemo(() => {
        return edges.map(e => {
            const isHighlight = e.id === highlightEdgeId;
            const isSelected = e.id === selectedEdgeId;
            const isHovered = e.id === hoveredEdgeId;

            let overrides: Partial<Edge> = {};

            if (isHighlight) {
                const edgeLabelKey = ((e.data as any)?.originalLabel || e.label || '') as string;
                const base = edgeConfigs[edgeLabelKey] || defaultEdgeCfg;
                overrides = {
                    style: {
                        ...base.style,
                        stroke: '#4ec9b0',
                        strokeWidth: (typeof base.style.strokeWidth === 'number' ? base.style.strokeWidth : 2) + 3,
                    },
                    animated: true,
                };
            }

            const zIndex = isSelected ? 1000 : isHovered ? 500 : 0;

            return { ...e, ...overrides, zIndex };
        });
    }, [edges, highlightEdgeId, selectedEdgeId, hoveredEdgeId]);

    return (
        <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--vscode-panel-border)', position: 'relative' }}>
            <ReactFlow
                nodes={nodes}
                edges={edgesWithZIndex}
                onNodesChange={handleNodesChange}
                onNodeDragStop={handleNodeDragStop}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onPaneClick={() => {
                    setPendingLinkSourceId(null);
                    setDragLinkSourceId(null);
                    setDragLinkHoverTargetId(null);
                }}
                onNodeClick={(_, node) => onNodeSelect(node)}
                onEdgeClick={onEdgeClick}
                onEdgeMouseEnter={onEdgeMouseEnter}
                onEdgeMouseLeave={onEdgeMouseLeave}
                onSelectionChange={({ edges: selectedEdges }) => {
                    if (selectedEdges?.length === 1) {
                        setSelectedEdgeId(selectedEdges[0].id);
                    } else if (selectedEdges?.length === 0) {
                        setSelectedEdgeId(null);
                    }
                }}
                nodeTypes={nodeTypes}
                // FEAT-037 R6 / design §4: adopt v12's threshold explicitly so a
                // press-release under 1 px stays a click and never persists a
                // jitter-nudge into manualPositionsRef (same rationale as the
                // explicit deleteKeyCode={null} below).
                nodeDragThreshold={1}
                fitView
                fitViewOptions={{ padding: 0.2, duration: 400 }}
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
                selectionMode={SelectionMode.Partial}
                connectionLineStyle={{ stroke: 'var(--vscode-focusBorder)', strokeWidth: 2.5, strokeDasharray: '6,4' }}
                isValidConnection={(connection) => {
                    const s = connection.source ?? '';
                    const t = connection.target ?? '';
                    return s !== t && getCanonicalEdgeForPair(s, t) !== null;
                }}
                defaultEdgeOptions={{
                    style: { transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' },
                }}
                deleteKeyCode={null} // We handle delete ourselves via keyboard listener
                onMove={(_, vp) => setViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })}
            >
                <Background 
                    gap={20} 
                    size={1}
                    style={{ background: 'var(--vscode-editor-background)' }}
                />
                <Controls />
            </ReactFlow>

            {/* Provider area overlay — SVG sibling of ReactFlow, transformed
                by the viewport. This avoids custom node types (which crashed
                React Flow 11.11.4, the pre-FEAT-037 runtime, and useStore
                (which also crashed). The overlay is flow-version-agnostic. */}
            {providerGroups.length > 0 && (
                <ProviderAreaOverlay providerGroups={providerGroups} viewport={viewport} focusedProvider={focusedProvider} />
            )}

            {/* FEAT-033 Phase 2 — Architecture Studio toolbar (top-left) */}
            <WhiteboardToolbar onCreateNode={onCreateNode} onOpenTemplates={onOpenTemplates} />

            {/* Phase 5 — Layer Legend + Provider navigation bar (top-right) */}
            <WhiteboardLegendBar
                providerGroups={providerGroups}
                focusedProvider={focusedProvider}
                setFocusedProvider={setFocusedProvider}
                nodes={nodes}
                fitView={fitView}
            />

            {/* Edge Context Menu (R1, R9, R5) */}
            {contextMenuEdge && (
                <EdgeContextMenu
                    edge={contextMenuEdge}
                    position={contextMenuPos}
                    onDelete={handleDeleteEdge}
                    onChangeLabel={handleChangeLabel}
                    onAcceptSuggestion={handleAcceptSuggestion}
                    onDismissSuggestion={(edge) => handleDismissSuggestion(edge.source, edge.target)}
                    onToggleConnection={handleToggleConnection}
                    onClose={() => setContextMenuEdge(null)}
                />
            )}

            {/* T14 (R12): Node context menu — click-outside overlay closes the menu */}
            {nodeContextMenu && (
                <NodeContextMenu
                    nodeContextMenu={nodeContextMenu}
                    setNodeContextMenu={setNodeContextMenu}
                    idoneityData={idoneityData}
                    graph={graph}
                    setSuggestionDialog={setSuggestionDialog}
                    setIdoneityDialog={setIdoneityDialog}
                />
            )}

            {/* Suggestion Dialog (R6) */}
            {suggestionDialog && (
                <SuggestionDialog
                    suggestionDialog={suggestionDialog}
                    setSuggestionDialog={setSuggestionDialog}
                    edges={edges}
                    handleDismissSuggestion={handleDismissSuggestion}
                    handleAcceptSuggestion={handleAcceptSuggestion}
                />
            )}

            {/* FEAT-011: Idoneity Dialog (R7) */}
            {idoneityDialog && (
                <IdoneityDialog idoneityDialog={idoneityDialog} setIdoneityDialog={setIdoneityDialog} edges={edges} />
            )}
        </div>
    );
};
