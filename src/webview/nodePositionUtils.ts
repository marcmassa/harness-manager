export interface NodePosition {
    x: number;
    y: number;
}

export type ManualPositionMap = Record<string, NodePosition>;

export interface LayoutedNodeLike {
    id: string;
    position: NodePosition;
}

export function isValidNodePosition(position: any): position is NodePosition {
    return Boolean(
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y)
    );
}

export function mergeLayoutedNodesWithManualPositions<T extends LayoutedNodeLike>(
    layoutedNodes: T[],
    manualPositions: ManualPositionMap
): { nodes: T[]; manualPositions: ManualPositionMap } {
    const sanitizedManualPositions: ManualPositionMap = { ...manualPositions };

    for (const [nodeId, position] of Object.entries(sanitizedManualPositions)) {
        if (!isValidNodePosition(position)) {
            delete sanitizedManualPositions[nodeId];
        }
    }

    const mergedNodes = layoutedNodes.map((node) => {
        const manualPosition = sanitizedManualPositions[node.id];
        if (!isValidNodePosition(manualPosition)) {
            return node;
        }

        return {
            ...node,
            position: {
                x: manualPosition.x,
                y: manualPosition.y,
            },
        };
    });

    return {
        nodes: mergedNodes,
        manualPositions: sanitizedManualPositions,
    };
}
