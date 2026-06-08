import * as React from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    useNodesState, 
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    useReactFlow,
    MarkerType,
    SelectionMode,
    NodeChange,
} from 'reactflow';
import { CustomNode } from './components/CustomNode.js';
import { EdgeContextMenu } from './components/EdgeContextMenu.js';
import { getLayoutedElements } from './layoutUtils.js';
import type { EdgeLabel } from '../types.js';
import { HarnessGraph } from '../types.js';
import { ManualPositionMap, isValidNodePosition, mergeLayoutedNodesWithManualPositions } from './nodePositionUtils.js';

const nodeTypes = {
    agent: CustomNode,
    subagent: CustomNode,
    skill: CustomNode,
    feature: CustomNode
};

// ===== EDGE VISUAL STYLES — maximum contrast & visibility =====
const edgeConfigs: Record<string, { style: React.CSSProperties; animated: boolean; markerEnd: any }> = {
    'manages': {
        style: { 
            stroke: '#4a7dff',
            strokeWidth: 3.5, 
            strokeLinecap: 'round',
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 22, height: 16, color: '#4a7dff' },
    },
    'uses': {
        style: { 
            stroke: '#2aa198',
            strokeWidth: 3, 
            strokeDasharray: '10,6',
            strokeLinecap: 'round',
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 14, color: '#2aa198' },
    },
    'executing': {
        style: { 
            stroke: '#e86f4a',
            strokeWidth: 4,
            strokeLinecap: 'round',
        },
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 24, height: 18, color: '#e86f4a' },
    },
    // Progressive Disclosure — Stage 1: skill scanned but NOT yet linked to any subagent
    // Muted dotted line represents "available for activation"
    'discovered': {
        style: { 
            stroke: '#6c6c8a',
            strokeWidth: 2,
            strokeDasharray: '4,4',
            strokeLinecap: 'round',
            opacity: 0.55,
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 10, color: '#6c6c8a' },
    },
    // FEAT-010: Semantic Skill Discovery — TF-IDF suggested relationship
    // Dashed amber/gold line indicates "description match found, not yet confirmed"
    'suggested': {
        style: { 
            stroke: '#d4a84a',
            strokeWidth: 2.5,
            strokeDasharray: '8,4',
            strokeLinecap: 'round',
            opacity: 0.7,
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 12, color: '#d4a84a' },
    },
};

const defaultEdgeCfg = {
    style: { stroke: '#888', strokeWidth: 2.5, strokeLinecap: 'round' as const },
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 10, color: '#888' },
};

export const EDGE_TYPE_ROUTING: Record<string, string> = {
    manages: 'smoothstep',
    uses: 'default',
    executing: 'default',
    discovered: 'straight',
    suggested: 'smoothstep',
};

interface Props {
    graph: HarnessGraph;
    onNodeSelect: (node: any) => void;
    selectedNodeId?: string | null;
}

export const WhiteboardCanvas = ({ graph, onNodeSelect, selectedNodeId }: Props) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const manualPositionsRef = React.useRef<ManualPositionMap>({});
    const [highlightEdgeId, setHighlightEdgeId] = React.useState<string | null>(null);
    const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);
    const [pendingLinkSourceId, setPendingLinkSourceId] = React.useState<string | null>(null);
    const [dragLinkSourceId, setDragLinkSourceId] = React.useState<string | null>(null);
    const [dragLinkHoverTargetId, setDragLinkHoverTargetId] = React.useState<string | null>(null);
    const previousNodeSignatureRef = React.useRef<string>('');
    const hasInitialFitRef = React.useRef(false);
    const edgesRef = React.useRef<Edge[]>([]);
    const dragLinkSourceRef = React.useRef<string | null>(null);
    const pendingEdgeCreationKeysRef = React.useRef<Set<string>>(new Set());
    const { fitView } = useReactFlow();

    // Edge context menu state
    const [contextMenuEdge, setContextMenuEdge] = React.useState<Edge | null>(null);
    const [contextMenuPos, setContextMenuPos] = React.useState({ x: 0, y: 0 });
    const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);

    // Node context menu state (R6: "Show skill suggestions")
    const [nodeContextMenu, setNodeContextMenu] = React.useState<{ node: any; position: { x: number; y: number } } | null>(null);
    const [suggestionDialog, setSuggestionDialog] = React.useState<{ subagentId: string; suggestions: { skillId: string; score: number; idoneity?: number }[] } | null>(null);

    // FEAT-011: Idoneity dialog state (R7)
    const [idoneityDialog, setIdoneityDialog] = React.useState<{ subagentId: string; skills: { skillId: string; score: number }[] } | null>(null);

    // Compute which skills are explicitly linked (uses) per node
    const connectedSkills = React.useMemo(() => {
        const map: Record<string, Set<string>> = {};
        for (const edge of graph.edges) {
            if (edge.label === 'uses' && edge.source) {
                if (!map[edge.source]) map[edge.source] = new Set();
                map[edge.source].add(edge.target);
            }
        }
        return map;
    }, [graph.edges]);

    const allSkills = React.useMemo(() => 
        graph.nodes.filter(n => n.type === 'skill'),
    [graph.nodes]);
    const allOwners = React.useMemo(
        () => graph.nodes.filter((n) => n.type === 'agent' || n.type === 'subagent'),
        [graph.nodes]
    );
    const nodeTypeById = React.useMemo(
        () => new Map(graph.nodes.map((node) => [node.id, node.type])),
        [graph.nodes]
    );
    const connectedOwners = React.useMemo(() => {
        const map: Record<string, Set<string>> = {};
        for (const edge of graph.edges) {
            if (edge.label !== 'uses') continue;
            const sourceType = nodeTypeById.get(edge.source);
            const targetType = nodeTypeById.get(edge.target);
            if ((sourceType === 'agent' || sourceType === 'subagent') && targetType === 'skill') {
                if (!map[edge.target]) map[edge.target] = new Set();
                map[edge.target].add(edge.source);
            }
        }
        return map;
    }, [graph.edges, nodeTypeById]);
    const getCanonicalUsesLinkPair = React.useCallback((sourceId: string, targetId: string): { sourceId: string; targetId: string } | null => {
        if (!sourceId || !targetId || sourceId === targetId) return null;
        const sourceType = nodeTypeById.get(sourceId);
        const targetType = nodeTypeById.get(targetId);
        if (!sourceType || !targetType) return null;

        const sourceIsOwner = sourceType === 'subagent' || sourceType === 'agent';
        const targetIsOwner = targetType === 'subagent' || targetType === 'agent';

        if (sourceIsOwner && targetType === 'skill') {
            return { sourceId, targetId };
        }
        if (targetIsOwner && sourceType === 'skill') {
            return { sourceId: targetId, targetId: sourceId };
        }
        return null;
    }, [nodeTypeById]);

    const isValidUsesLinkPair = React.useCallback((sourceId: string, targetId: string): boolean => {
        return getCanonicalUsesLinkPair(sourceId, targetId) !== null;
    }, [getCanonicalUsesLinkPair]);

    // FEAT-011: Idoneity score → edge style thresholds (R5)
    const IDONEITY_STYLES = {
        high: { strokeWidth: 4, opacity: 1.0, threshold: 0.7 },
        medium: { strokeWidth: 3, opacity: 0.75, threshold: 0.4 },
        low: { strokeWidth: 2, opacity: 0.5, threshold: 0 },
    };

    /** Apply idoneity-modulated styling to a uses edge config (R5) */
    function applyIdoneityStyle(cfg: { style: React.CSSProperties; animated: boolean; markerEnd: any }, idoneity: number): { style: React.CSSProperties; animated: boolean; markerEnd: any } {
        if (idoneity <= 0) return cfg;
        const level = idoneity >= IDONEITY_STYLES.high.threshold ? IDONEITY_STYLES.high
            : idoneity >= IDONEITY_STYLES.medium.threshold ? IDONEITY_STYLES.medium
            : IDONEITY_STYLES.low;
        return {
            ...cfg,
            style: {
                ...cfg.style,
                strokeWidth: level.strokeWidth,
                opacity: level.opacity,
            },
        };
    }

    // FEAT-011: Pre-compute idoneity data for rendering (R7)
    const idoneityData = React.useMemo(() => {
        const bySubagent: Record<string, { skillId: string; score: number }[]> = {};
        const bySkill: Record<string, { bestOwner: string; score: number; mismatch: boolean; mismatchBestOwner?: string }> = {};
        for (const node of graph.nodes) {
            if (node.type === 'subagent') {
                // Skills with idoneity score ≥ 0.1 are collected from uses edges metadata
                const skills: { skillId: string; score: number }[] = [];
                for (const edge of graph.edges) {
                    if (edge.source === node.id && edge.label === 'uses' && edge.metadata?.idoneity && edge.metadata.idoneity >= 0.1) {
                        skills.push({ skillId: edge.target, score: edge.metadata.idoneity as number });
                    }
                }
                skills.sort((a, b) => b.score - a.score);
                bySubagent[node.id] = skills;
            }
            if (node.type === 'skill') {
                bySkill[node.id] = {
                    bestOwner: node.metadata?._bestOwner || '',
                    score: node.metadata?._bestOwnerScore || 0,
                    mismatch: node.metadata?._mismatch === true,
                    mismatchBestOwner: node.metadata?._mismatchBestOwner || undefined,
                };
            }
        }
        return { bySubagent, bySkill };
    }, [graph.nodes, graph.edges]);

    // FEAT-010: Count suggested edges per node (for 💡 badge)
    const suggestedCounts = React.useMemo(() => {
        const counts: Record<string, number> = {};
        for (const edge of graph.edges) {
            if (edge.label === 'suggested' && edge.source) {
                counts[edge.source] = (counts[edge.source] || 0) + 1;
            }
        }
        return counts;
    }, [graph.edges]);

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

    React.useEffect(() => {
        edgesRef.current = edges;
    }, [edges]);
    React.useEffect(() => {
        dragLinkSourceRef.current = dragLinkSourceId;
    }, [dragLinkSourceId]);

    const triggerEdgeCreationFeedback = React.useCallback((edgeId: string) => {
        setHighlightEdgeId(edgeId);
        window.setTimeout(() => {
            setHighlightEdgeId((current) => current === edgeId ? null : current);
        }, 1200);
    }, []);

    const createUsesEdge = React.useCallback((sourceId?: string | null, targetId?: string | null) => {
        if (!sourceId || !targetId || sourceId === targetId) return;
        const canonicalPair = getCanonicalUsesLinkPair(sourceId, targetId);
        if (!canonicalPair) return;

        const canonicalSourceId = canonicalPair.sourceId;
        const canonicalTargetId = canonicalPair.targetId;
        const edgeKey = `${canonicalSourceId}::${canonicalTargetId}::uses`;

        if (pendingEdgeCreationKeysRef.current.has(edgeKey)) return;

        const alreadyExists = edgesRef.current.some((edge) => {
            const edgeKind = String((edge.data as any)?.originalLabel || edge.label || '').toLowerCase();
            return edge.source === canonicalSourceId && edge.target === canonicalTargetId && edgeKind.startsWith('uses');
        });
        if (alreadyExists) return;
        pendingEdgeCreationKeysRef.current.add(edgeKey);
        window.setTimeout(() => pendingEdgeCreationKeysRef.current.delete(edgeKey), 400);

        const cfg = edgeConfigs['uses'] || defaultEdgeCfg;
        const edgeId = `edge-${canonicalSourceId}-${canonicalTargetId}-${Date.now()}`;
        const newEdge: Edge = {
            id: edgeId,
            source: canonicalSourceId,
            target: canonicalTargetId,
            label: 'uses',
            type: EDGE_TYPE_ROUTING['uses'],
            className: 'harness-edge harness-edge--uses',
            style: cfg.style,
            animated: cfg.animated,
            markerEnd: cfg.markerEnd,
            data: { originalLabel: 'uses' },
            labelStyle: {
                fontSize: '11px',
                fontWeight: 600,
                color: cfg.style.stroke as string,
                background: 'var(--vscode-editor-background)',
                padding: '3px 8px',
                borderRadius: '4px',
                border: `1px solid ${cfg.style.stroke as string}`,
            },
            labelBgPadding: [10, 5] as [number, number],
            labelBgBorderRadius: 4,
            labelBgStyle: { fill: 'var(--vscode-editor-background)', fillOpacity: 0.95 },
        };
        setEdges((eds) => {
            const existsInState = eds.some((edge) => {
                const edgeKind = String((edge.data as any)?.originalLabel || edge.label || '').toLowerCase();
                return edge.source === canonicalSourceId && edge.target === canonicalTargetId && edgeKind.startsWith('uses');
            });
            return existsInState ? eds : addEdge(newEdge, eds);
        });
        triggerEdgeCreationFeedback(edgeId);

        const vscode = (window as any).__harness_vscode_api;
        if (vscode?.postMessage) {
            vscode.postMessage({ type: 'createEdge', source: canonicalSourceId, target: canonicalTargetId });
        }
    }, [setEdges, triggerEdgeCreationFeedback, getCanonicalUsesLinkPair]);

    const handleSourcePillClick = React.useCallback((sourceId: string) => {
        setPendingLinkSourceId((current) => current === sourceId ? null : sourceId);
    }, []);

    const handleTargetPillClick = React.useCallback((targetId: string) => {
        setPendingLinkSourceId((sourceId) => {
            if (!sourceId || sourceId === targetId) return sourceId;
            createUsesEdge(sourceId, targetId);
            return null;
        });
    }, [createUsesEdge]);

    const handleDragLinkHoverChange = React.useCallback((targetId: string, isHovering: boolean) => {
        const sourceId = dragLinkSourceRef.current;
        if (!sourceId) {
            if (!isHovering) setDragLinkHoverTargetId((current) => current === targetId ? null : current);
            return;
        }
        if (sourceId === targetId || !isValidUsesLinkPair(sourceId, targetId)) {
            setDragLinkHoverTargetId((current) => current === targetId ? null : current);
            return;
        }
        setDragLinkHoverTargetId((current) => {
            if (isHovering) return targetId;
            return current === targetId ? null : current;
        });
    }, [isValidUsesLinkPair]);

    const handleDragLinkDropOnNode = React.useCallback((targetId: string) => {
        const sourceId = dragLinkSourceRef.current;
        if (!sourceId || sourceId === targetId) return;
        if (!isValidUsesLinkPair(sourceId, targetId)) return;
        createUsesEdge(sourceId, targetId);
        setDragLinkHoverTargetId(null);
        setDragLinkSourceId(null);
    }, [createUsesEdge, isValidUsesLinkPair]);

    const handleNodesChange = React.useCallback((changes: NodeChange[]) => {
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
        if (!graph) return;

        const initialNodes = graph.nodes.map(n => {
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
                    canLinkThroughPills: n.type === 'agent' || n.type === 'subagent' || n.type === 'skill',
                    isLinkSourceArmed: false,
                    isLinkTargetActive: false,
                    isDragLinkHoverTarget: false,
                    suggestedCount: suggestedCounts[n.id] || 0,
                    isActive: n.id === selectedNodeId,
                    onContextMenu: (event: React.MouseEvent) => {
                        event.preventDefault();
                        setNodeContextMenu({ node: n, position: { x: event.clientX, y: event.clientY } });
                    },
                },
                position: { x: 0, y: 0 }
            };
        });

        const initialEdges = graph.edges.map(e => {
            const label = e.label || '';
            const cfg = edgeConfigs[label] || defaultEdgeCfg;

            // FEAT-011: Apply idoneity-modulated styling for uses edges (R5)
            let effectiveCfg = cfg;
            if (label === 'uses' && e.metadata?.idoneity !== undefined) {
                effectiveCfg = applyIdoneityStyle(cfg, e.metadata.idoneity as number);
            }

            // T13 (R5): Disabled edge style
            const isMismatchEdge = label === 'uses' && e.metadata?._mismatch === true;
            const isDisabled = label === 'uses' && e.metadata?.disabled === true;
            const edgeStyle = isDisabled
                ? { stroke: '#6c6c8a', strokeWidth: 2, strokeDasharray: '4,4', strokeLinecap: 'round' as const, opacity: 0.45 }
                : isMismatchEdge
                ? { ...effectiveCfg.style, stroke: '#e86f4a', strokeDasharray: '6,3', opacity: 1 }
                : effectiveCfg.style;

            // Show score in label for suggested edges (FEAT-010 R7)
            const displayLabel = isDisabled
                ? `⏸ ${label}`
                : label === 'suggested'
                ? ''
                : label === 'uses' && e.metadata?.idoneity !== undefined
                    ? `uses (${e.metadata.idoneity})`
                    : label;

            return {
                id: e.id,
                source: e.source,
                target: e.target,
                label: displayLabel,
                type: EDGE_TYPE_ROUTING[label] ?? 'default',
                className: `harness-edge harness-edge--${label}`,
                style: edgeStyle,
                animated: isMismatchEdge && !isDisabled ? true : effectiveCfg.animated,
                markerEnd: isMismatchEdge && !isDisabled
                    ? { type: MarkerType.ArrowClosed, width: 20, height: 14, color: '#e86f4a' }
                    : effectiveCfg.markerEnd,
                data: { metadata: e.metadata, originalLabel: label },
                labelStyle: { 
                    fontSize: '11px', 
                    fontWeight: 600,
                    color: isDisabled ? '#6c6c8a' : isMismatchEdge ? '#e86f4a' : (cfg.style.stroke as string),
                    background: 'var(--vscode-editor-background)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: isMismatchEdge
                        ? '1px solid #e86f4a'
                        : isDisabled
                        ? '1px solid #6c6c8a'
                        : `1px solid ${effectiveCfg.style.stroke as string}`,
                },
                labelBgPadding: [10, 5] as [number, number],
                labelBgBorderRadius: 4,
                labelBgStyle: { fill: 'var(--vscode-editor-background)', fillOpacity: 0.95 },
            };
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
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

        const nodeSignature = mergedNodes.map((node) => node.id).sort().join('|');
        const shouldFitView = !hasInitialFitRef.current || nodeSignature !== previousNodeSignatureRef.current;
        previousNodeSignatureRef.current = nodeSignature;

        if (shouldFitView) {
            window.requestAnimationFrame(() => fitView({ padding: 0.2 }));
            hasInitialFitRef.current = true;
        }
    }, [graph, fitView, allSkills, allOwners, connectedSkills, connectedOwners, createUsesEdge, handleSourcePillClick, handleTargetPillClick, handleDragLinkHoverChange, handleDragLinkDropOnNode, setEdges, suggestedCounts, selectedNodeId]);

    // Update isActive + className on nodes when selectedNodeId changes — no full layout rerun
    React.useEffect(() => {
        setNodes(nds => nds.map(n => ({
            ...n,
            selected: n.id === selectedNodeId,
            className: n.id === selectedNodeId ? 'harness-active-node' : '',
            data: { ...n.data, isActive: n.id === selectedNodeId },
        })));
    }, [selectedNodeId]);

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

    const onConnect = React.useCallback(
        (params: Edge | Connection) => {
            createUsesEdge(params.source, params.target);
            setPendingLinkSourceId(null);
            setDragLinkSourceId(null);
            setDragLinkHoverTargetId(null);
        },
        [createUsesEdge]
    );

    const onConnectStart = React.useCallback((_: MouseEvent | TouchEvent, params: any) => {
        const sourceId = params?.handleType === 'source' ? params?.nodeId : null;
        setPendingLinkSourceId(null);
        setDragLinkSourceId(sourceId ?? null);
        setDragLinkHoverTargetId(null);
    }, []);

    const onConnectEnd = React.useCallback(() => {
        window.setTimeout(() => {
            setDragLinkSourceId(null);
            setDragLinkHoverTargetId(null);
        }, 0);
    }, []);

    // Edge click handler — show context menu
    const onEdgeClick = React.useCallback((event: React.MouseEvent, edge: Edge) => {
        event.stopPropagation();
        setContextMenuEdge(edge);
        setContextMenuPos({ x: event.clientX, y: event.clientY });
        setSelectedEdgeId(edge.id);
    }, []);

    // Edge deletion handler (R1, R8)
    const handleDeleteEdge = React.useCallback((edge: Edge) => {
        // Delegate to extension for confirmation + persistence (R8)
        // Use originalLabel from data to avoid sending display label (e.g. "uses (0.87)") — see FEAT-011
        const vscode = (window as any).__harness_vscode_api;
        if (vscode && vscode.postMessage) {
            vscode.postMessage({ 
                type: 'confirmAndDeleteEdge', 
                source: edge.source, 
                target: edge.target, 
                label: (edge.data as any)?.originalLabel || edge.label || 'uses',
                edgeId: edge.id,
            });
        }
        setContextMenuEdge(null);
        setSelectedEdgeId(null);
    }, []);

    // Edge label change handler (R9)
    const handleChangeLabel = React.useCallback((edge: Edge, newLabel: EdgeLabel) => {
        const cfg = edgeConfigs[newLabel] || defaultEdgeCfg;
        setEdges((eds) => eds.map(e => {
            if (e.id === edge.id) {
                return {
                    ...e,
                    label: newLabel,
                    style: cfg.style,
                    animated: cfg.animated,
                    markerEnd: cfg.markerEnd,
                    type: EDGE_TYPE_ROUTING[newLabel] ?? 'default',
                    className: `harness-edge harness-edge--${newLabel}`,
                    labelStyle: {
                        ...e.labelStyle,
                        color: cfg.style.stroke,
                        border: `1px solid ${cfg.style.stroke}`,
                    } as any,
                };
            }
            return e;
        }));
        
        const vscode = (window as any).__harness_vscode_api;
        if (vscode && vscode.postMessage) {
            vscode.postMessage({ 
                type: 'updateEdgeLabel', 
                source: edge.source, 
                target: edge.target, 
                label: newLabel,
            });
        }
        setContextMenuEdge(null);
    }, [setEdges]);

    // Dismiss suggestion handler: remove suggested edge from state + persist (T10 R1, R8)
    const handleDismissSuggestion = React.useCallback((source: string, target: string) => {
        // R8: use originalLabel so the filter works even when label is the display string
        setEdges((eds) => eds.filter(e =>
            !(e.source === source && e.target === target && (e.data as any)?.originalLabel === 'suggested')
        ));
        // R1: persist dismissed pair so it doesn't re-appear after parse
        const vscode = (window as any).__harness_vscode_api;
        if (vscode?.postMessage) {
            vscode.postMessage({ type: 'dismissSuggestion', subagentId: source, skillId: target });
        }
    }, [setEdges]);

    // Accept suggestion handler (R5): convert suggested → uses + persist
    const handleAcceptSuggestion = React.useCallback((edge: Edge) => {
        const cfg = edgeConfigs['uses'] || defaultEdgeCfg;
        setEdges((eds) => eds.map(e => {
            if (e.id === edge.id) {
                return {
                    ...e,
                    label: 'uses',
                    type: EDGE_TYPE_ROUTING['uses'],
                    className: 'harness-edge harness-edge--uses',
                    style: cfg.style,
                    animated: cfg.animated,
                    markerEnd: cfg.markerEnd,
                    labelStyle: {
                        ...e.labelStyle,
                        color: cfg.style.stroke,
                        border: `1px solid ${cfg.style.stroke as string}`,
                    } as any,
                };
            }
            return e;
        }));

        const vscode = (window as any).__harness_vscode_api;
        if (vscode && vscode.postMessage) {
            vscode.postMessage({
                type: 'acceptSuggestion',
                subagentId: edge.source,
                skillId: edge.target,
            });
        }
        setContextMenuEdge(null);
    }, [setEdges]);

    // T12 (R4, R6): Toggle disabled state of a uses edge
    const handleToggleConnection = React.useCallback((edge: Edge, disable: boolean) => {
        const vscode = (window as any).__harness_vscode_api;
        if (vscode?.postMessage) {
            vscode.postMessage({ type: 'toggleSkillConnection', source: edge.source, target: edge.target, disabled: disable });
        }
        setContextMenuEdge(null);
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
                fitView
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
                selectionMode={SelectionMode.Partial}
                defaultEdgeOptions={{
                    style: { transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' },
                }}
                deleteKeyCode={null} // We handle delete ourselves via keyboard listener
            >
                <Background 
                    gap={20} 
                    size={1}
                    style={{ background: 'var(--vscode-editor-background)' }}
                />
                <Controls />
            </ReactFlow>

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
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                        onClick={() => setNodeContextMenu(null)}
                    />
                    <div style={{
                        position: 'fixed',
                        left: `${nodeContextMenu.position.x}px`,
                        top: `${nodeContextMenu.position.y}px`,
                        background: 'var(--vscode-dropdown-background)',
                        border: '1px solid var(--vscode-dropdown-border)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        zIndex: 9999,
                        minWidth: '200px',
                        padding: '4px 0',
                        animation: 'pickerFadeIn 0.15s ease-out',
                    }}>
                    <div style={{
                        padding: '4px 16px 8px',
                        fontSize: '0.65em',
                        textTransform: 'uppercase',
                        opacity: 0.5,
                        letterSpacing: '1px',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--vscode-dropdown-border)',
                    }}>
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
                                            style={{
                                                padding: '8px 16px',
                                                cursor: 'pointer',
                                                fontSize: '0.85em',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'background 0.12s ease',
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#e86f4a',
                                                width: '100%',
                                                textAlign: 'left',
                                                fontFamily: 'inherit',
                                                fontWeight: 600,
                                            }}
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
                                            score: e.metadata?.score || 0,
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
                                style={{
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
                                }}
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
            )}

            {/* Suggestion Dialog (R6) */}
            {suggestionDialog && (
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
            )}

            {/* FEAT-011: Idoneity Dialog (R7) */}
            {idoneityDialog && (
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
            )}
        </div>
    );
};
