export type NodeType = 'agent' | 'subagent' | 'skill' | 'feature';

export type EdgeLabel = 'manages' | 'uses' | 'executing' | 'discovered' | 'suggested';

/**
 * Cómo fue descubierta una skill según el mecanismo de Progressive Disclosure (agentskills.io):
 * - 'scanned':  encontrada via escaneo de directorio .agents/skills/, SIN vínculo explícito a subagent
 * - 'linked':   vinculada explícitamente a uno o más subagents (skills[] array o ## Skills section)
 * - 'orphan':   escaneada pero sin ningún subagent que la referencie (disponible para activación)
 */
export type DiscoveryMethod = 'scanned' | 'linked' | 'orphan';

export interface CrossRefInfo {
    targetId: string;
    linkType: 'markdown' | 'wiki';
    confidence: 'high' | 'medium';
    context: string; // surrounding text snippet
}

export interface MarkdownFileContent {
    nodeId: string;
    filePath: string;
    content: string;
    exists: boolean;
}

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
    metadata?: Record<string, any>;
}

export interface HarnessGraph {
    nodes: HarnessNode[];
    edges: HarnessEdge[];
}

export interface ParserError {
    file: string;
    message: string;
}

export interface Milestone {
    date: string;
    featureId: string;
    title: string;
    outcome: string;
    status: string;
}

export interface DashboardData {
    graph: HarnessGraph;
    milestones: Milestone[];
    errors: ParserError[];
    detectedFrameworks?: string[];
}

export interface ParserResult {
    graph: HarnessGraph;
    milestones: Milestone[];
    errors: ParserError[];
    detectedFrameworks?: string[];
}
