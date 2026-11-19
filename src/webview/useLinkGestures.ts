// Link-creation gestures for WhiteboardCanvas: pill clicks, drag-to-link and
// React Flow onConnect* (FEAT-048 split; moved verbatim).
import * as React from 'react';
import { addEdge, type Connection, type Edge } from '@xyflow/react';
import { edgeConfigs, defaultEdgeCfg, EDGE_TYPE_ROUTING } from './whiteboardEdgeStyles.js';

interface LinkGestureDeps {
    edges: Edge[];
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    getCanonicalEdgeForPair: (sourceId: string, targetId: string) => { sourceId: string; targetId: string; label: string } | null;
    isValidUsesLinkPair: (sourceId: string, targetId: string) => boolean;
}

export function useLinkGestures({ edges, setEdges, getCanonicalEdgeForPair, isValidUsesLinkPair }: LinkGestureDeps) {
    const [highlightEdgeId, setHighlightEdgeId] = React.useState<string | null>(null);
    const [pendingLinkSourceId, setPendingLinkSourceId] = React.useState<string | null>(null);
    const [dragLinkSourceId, setDragLinkSourceId] = React.useState<string | null>(null);
    const [dragLinkHoverTargetId, setDragLinkHoverTargetId] = React.useState<string | null>(null);
    const edgesRef = React.useRef<Edge[]>([]);
    const dragLinkSourceRef = React.useRef<string | null>(null);
    const pendingEdgeCreationKeysRef = React.useRef<Set<string>>(new Set());

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
        const canonicalPair = getCanonicalEdgeForPair(sourceId, targetId);
        if (!canonicalPair) return;

        const { sourceId: canonicalSourceId, targetId: canonicalTargetId, label } = canonicalPair;
        const edgeKey = `${canonicalSourceId}::${canonicalTargetId}::${label}`;

        if (pendingEdgeCreationKeysRef.current.has(edgeKey)) return;

        const alreadyExists = edgesRef.current.some((edge) => {
            const edgeKind = String((edge.data as any)?.originalLabel || edge.label || '').toLowerCase();
            return edge.source === canonicalSourceId && edge.target === canonicalTargetId && edgeKind === label;
        });
        if (alreadyExists) return;
        pendingEdgeCreationKeysRef.current.add(edgeKey);
        window.setTimeout(() => pendingEdgeCreationKeysRef.current.delete(edgeKey), 400);

        const cfg = edgeConfigs[label] || defaultEdgeCfg;
        const edgeId = `edge-${canonicalSourceId}-${canonicalTargetId}-${Date.now()}`;
        const newEdge: Edge = {
            id: edgeId,
            source: canonicalSourceId,
            target: canonicalTargetId,
            label,
            type: EDGE_TYPE_ROUTING[label] ?? 'default',
            className: `harness-edge harness-edge--${label}`,
            style: cfg.style,
            animated: cfg.animated,
            markerEnd: cfg.markerEnd,
            data: { originalLabel: label },
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
                return edge.source === canonicalSourceId && edge.target === canonicalTargetId && edgeKind === label;
            });
            return existsInState ? eds : addEdge(newEdge, eds);
        });
        triggerEdgeCreationFeedback(edgeId);

        const vscode = (window as any).__harness_vscode_api;
        if (vscode?.postMessage) {
            vscode.postMessage({ type: 'createEdge', source: canonicalSourceId, target: canonicalTargetId, label });
        }
    }, [setEdges, triggerEdgeCreationFeedback, getCanonicalEdgeForPair]);

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
        // capture from any handle type — ReactFlow normalizes direction in onConnect
        const sourceId = params?.nodeId ?? null;
        setPendingLinkSourceId(null);
        setDragLinkSourceId(sourceId);
        setDragLinkHoverTargetId(null);
    }, []);

    const onConnectEnd = React.useCallback(() => {
        window.setTimeout(() => {
            setDragLinkSourceId(null);
            setDragLinkHoverTargetId(null);
        }, 0);
    }, []);

    return {
        highlightEdgeId, pendingLinkSourceId, setPendingLinkSourceId,
        dragLinkSourceId, setDragLinkSourceId, dragLinkHoverTargetId, setDragLinkHoverTargetId,
        createUsesEdge, handleSourcePillClick, handleTargetPillClick,
        handleDragLinkHoverChange, handleDragLinkDropOnNode,
        onConnect, onConnectStart, onConnectEnd,
    };
}
