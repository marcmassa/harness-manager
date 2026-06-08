import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 80;

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ 
        rankdir: direction,
        ranksep: 120, 
        nodesep: 100,
    });

    // To influence hierarchy, we can set node rank based on type
    nodes.forEach((node) => {
        // High rank (top) for agents, low rank (bottom) for skills
        let rank = 1;
        if (node.type === 'agent') rank = 0;
        if (node.type === 'subagent') rank = 1;
        if (node.type === 'skill') rank = 2;
        if (node.type === 'feature') rank = 3;

        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight, rank });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = isHorizontal ? 'left' as any : 'top' as any;
        node.sourcePosition = isHorizontal ? 'right' as any : 'bottom' as any;

        // We are shifting the dagre node position (which is center-based) to top-left (React Flow default)
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes, edges };
};
