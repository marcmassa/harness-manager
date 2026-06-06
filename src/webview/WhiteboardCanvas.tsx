import * as React from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    useNodesState, 
    useEdgesState,
    addEdge,
    Connection,
    Edge
} from 'reactflow';
import { CustomNode } from './components/CustomNode.js';
import { getLayoutedElements } from './layoutUtils.js';
import { HarnessGraph } from '../types.js';

// Base styles for reactflow (usually we'd import CSS, but for esbuild setup without CSS loader, we can inject or rely on global)
// We'll rely on the user having reactflow/dist/style.css available or inject basic styles.

const nodeTypes = {
    agent: CustomNode,
    subagent: CustomNode,
    skill: CustomNode,
    feature: CustomNode
};

interface Props {
    graph: HarnessGraph;
    onNodeSelect: (node: any) => void;
}

export const WhiteboardCanvas = ({ graph, onNodeSelect }: Props) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    React.useEffect(() => {
        if (!graph) return;

        const initialNodes = graph.nodes.map(n => ({
            id: n.id,
            type: n.type,
            data: { label: n.label, metadata: n.metadata },
            position: { x: 0, y: 0 }
        }));

        const initialEdges = graph.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            animated: true
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges
        );

        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
    }, [graph]);

    const onConnect = React.useCallback(
        (params: Edge | Connection) => {
            const vscode = (window as any).acquireVsCodeApi();
            vscode.postMessage({ type: 'createEdge', source: params.source, target: params.target });
            setEdges((eds) => addEdge(params, eds));
        },
        [setEdges]
    );

    return (
        <div style={{ width: '100%', height: '80vh', border: '1px solid var(--vscode-panel-border)' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => onNodeSelect(node)}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};
