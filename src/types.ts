export type NodeType = 'agent' | 'subagent' | 'skill' | 'feature';

export interface HarnessNode {
    id: string;
    type: NodeType;
    label: string;
    metadata: Record<string, any>;
}

export interface HarnessEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
}

export interface HarnessGraph {
    nodes: HarnessNode[];
    edges: HarnessEdge[];
}

export interface ParserError {
    file: string;
    message: string;
}

export interface ParserResult {
    graph: HarnessGraph;
    errors: ParserError[];
}
