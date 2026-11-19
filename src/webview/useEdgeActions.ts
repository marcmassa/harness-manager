// Edge actions behind the edge context menu and suggestion dialog
// (delete, relabel, accept/dismiss suggestion, toggle) — FEAT-048 split; moved verbatim.
import * as React from 'react';
import type { Edge } from '@xyflow/react';
import type { EdgeLabel } from '../types.js';
import { edgeConfigs, defaultEdgeCfg, EDGE_TYPE_ROUTING } from './whiteboardEdgeStyles.js';

interface EdgeActionDeps {
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    setContextMenuEdge: (edge: Edge | null) => void;
    setSelectedEdgeId: (id: string | null) => void;
}

export function useEdgeActions({ setEdges, setContextMenuEdge, setSelectedEdgeId }: EdgeActionDeps) {
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

    return { handleDeleteEdge, handleChangeLabel, handleDismissSuggestion, handleAcceptSuggestion, handleToggleConnection };
}
