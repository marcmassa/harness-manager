// Derived, memoised graph data for WhiteboardCanvas: link targets, canonical
// edge pairs, idoneity and suggestion counts (FEAT-048 split; moved verbatim).
import * as React from 'react';
import type { HarnessGraph } from '../types.js';

export function useWhiteboardGraphData(
    graph: HarnessGraph,
    discoveredNodes?: { nodes: HarnessGraph['nodes']; edges: HarnessGraph['edges'] },
) {
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
    const getCanonicalEdgeForPair = React.useCallback((sourceId: string, targetId: string): { sourceId: string; targetId: string; label: string } | null => {
        if (!sourceId || !targetId || sourceId === targetId) return null;
        const sType = nodeTypeById.get(sourceId);
        const tType = nodeTypeById.get(targetId);
        if (!sType || !tType) return null;

        const sIsOwner = sType === 'agent' || sType === 'subagent';
        const tIsOwner = tType === 'agent' || tType === 'subagent';

        // agent/subagent ↔ skill → "uses" (canonical: owner → skill)
        if (sIsOwner && tType === 'skill') return { sourceId, targetId, label: 'uses' };
        if (sType === 'skill' && tIsOwner) return { sourceId: targetId, targetId: sourceId, label: 'uses' };

        // agent ↔ subagent → "manages" (canonical: agent → subagent)
        if (sType === 'agent' && tType === 'subagent') return { sourceId, targetId, label: 'manages' };
        if (sType === 'subagent' && tType === 'agent') return { sourceId: targetId, targetId: sourceId, label: 'manages' };

        // agent/subagent ↔ steering → "governs" (canonical: steering → owner)
        if (sType === 'steering' && tIsOwner) return { sourceId, targetId, label: 'governs' };
        if (sIsOwner && tType === 'steering') return { sourceId: targetId, targetId: sourceId, label: 'governs' };

        // agent/subagent ↔ hook → "triggers" (canonical: hook → owner)
        if (sType === 'hook' && tIsOwner) return { sourceId, targetId, label: 'triggers' };
        if (sIsOwner && tType === 'hook') return { sourceId: targetId, targetId: sourceId, label: 'triggers' };

        return null;
    }, [nodeTypeById]);

    // Keep old name as alias so pill/drag code still compiles without touching every callsite
    const getCanonicalUsesLinkPair = getCanonicalEdgeForPair;

    const isValidNodePair = React.useCallback((sourceId: string, targetId: string): boolean => {
        return getCanonicalEdgeForPair(sourceId, targetId) !== null;
    }, [getCanonicalEdgeForPair]);

    // Alias for code that hasn't been renamed yet
    const isValidUsesLinkPair = isValidNodePair;

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

    // Merge discovered nodes into the base graph
    const mergedGraph = React.useMemo(() => {
        if (!discoveredNodes || (discoveredNodes.nodes.length === 0 && discoveredNodes.edges.length === 0)) {
            return graph;
        }
        const existingNodeIds = new Set(graph.nodes.map(n => n.id));
        const existingEdgeKeys = new Set(graph.edges.map(e => `${e.source}::${e.target}::${e.label || ''}`));

        const newNodes = discoveredNodes.nodes.filter(n => !existingNodeIds.has(n.id));
        const newEdges = discoveredNodes.edges.filter(e => !existingEdgeKeys.has(`${e.source}::${e.target}::${e.label || ''}`));

        return {
            nodes: [...graph.nodes, ...newNodes],
            edges: [...graph.edges, ...newEdges],
        };
    }, [graph, discoveredNodes]);

    return {
        connectedSkills, allSkills, allOwners, connectedOwners,
        getCanonicalEdgeForPair, isValidUsesLinkPair,
        idoneityData, suggestedCounts, mergedGraph,
    };
}

export type WhiteboardIdoneityData = ReturnType<typeof useWhiteboardGraphData>['idoneityData'];
