export type NodeType = 'agent' | 'subagent' | 'skill' | 'feature' | 'steering' | 'hook'
  | 'discovered-agent' | 'discovered-skill' | 'discovered-tool' | 'discovered-resource' | 'cli-install';

export type EdgeLabel = 'manages' | 'uses' | 'executing' | 'discovered' | 'suggested' | 'governs' | 'triggers' | 'inferred';

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
    metadata: NodeMetadata;
}

export interface HarnessEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    metadata?: Record<string, unknown>;
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

// ── Webview message discriminator (FEAT-030 R5, R6) ──────────────────────────

export type WebviewMessageType =
    | 'ready' | 'getData'
    | 'createNode' | 'deleteNode' | 'updateMetadata'
    | 'createEdge' | 'deleteEdge' | 'confirmAndDeleteEdge'
    | 'getMarkdownContent' | 'openMarkdownFile'
    | 'acceptSuggestion' | 'dismissSuggestion'
    | 'reassignSkill' | 'updateEdgeLabel' | 'toggleSkillConnection'
    | 'getFeatureList' | 'getSpecFile' | 'saveSpecFile'
    | 'generateWithAI' | 'createSpecFile' | 'generateSpecDraft'
    | 'openInEditor' | 'createFeature' | 'generateFeatureDescription' | 'deleteFeature'
    | 'dismissAgenticSuggestion' | 'applyHarnessSDD' | 'rescanAgentic'
    | 'openFullWindow' | 'openSettings';

export interface WebviewMessage {
    type: WebviewMessageType;
    [key: string]: unknown;
}

const KNOWN_MESSAGE_TYPES = new Set<string>([
    'ready', 'getData',
    'createNode', 'deleteNode', 'updateMetadata',
    'createEdge', 'deleteEdge', 'confirmAndDeleteEdge',
    'getMarkdownContent', 'openMarkdownFile',
    'acceptSuggestion', 'dismissSuggestion',
    'reassignSkill', 'updateEdgeLabel', 'toggleSkillConnection',
    'getFeatureList', 'getSpecFile', 'saveSpecFile',
    'generateWithAI', 'createSpecFile', 'generateSpecDraft',
    'openInEditor', 'createFeature', 'generateFeatureDescription', 'deleteFeature',
    'dismissAgenticSuggestion', 'applyHarnessSDD', 'rescanAgentic',
    'openFullWindow', 'openSettings',
]);

export function isKnownWebviewMessage(msg: unknown): msg is WebviewMessage {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        typeof (msg as Record<string, unknown>).type === 'string' &&
        KNOWN_MESSAGE_TYPES.has((msg as Record<string, unknown>).type as string)
    );
}

// ── HarnessNode.metadata typed interfaces (FEAT-030 R12) ─────────────────────
// Fields shared by all node types produced by withFrameworkMetadata().

interface FrameworkFields {
    _filePath?: string;
    _framework?: string;
    _frameworkLabel?: string;
}

// Index signature on each interface allows frontmatter fields from markdown
// files to pass through without individual declaration.

export interface AgentMetadata extends FrameworkFields {
    description?: string;
    body?: string;
    _fullBody?: string;
    [key: string]: unknown;
}

export interface SubagentMetadata extends FrameworkFields {
    description?: string;
    body?: string;
    _fullBody?: string;
    roleFile?: string;
    _orphan?: boolean;
    _discovery?: DiscoveryMethod;
    [key: string]: unknown;
}

export interface SkillMetadata extends FrameworkFields {
    description?: string;
    body?: string;
    _fullBody?: string;
    discoveryMethod?: DiscoveryMethod;
    [key: string]: unknown;
}

export interface SteeringMetadata extends FrameworkFields {
    description?: string;
    body?: string;
    appliesTo?: string[];
    [key: string]: unknown;
}

export interface HookMetadata extends FrameworkFields {
    event?: string;
    script?: string;
    body?: string;
    [key: string]: unknown;
}

export interface FeatureMetadata extends FrameworkFields {
    id?: string;
    name?: string;
    title?: string;
    status?: string;
    priority?: string;
    sprint?: string;
    type?: string;
    sdd?: boolean;
    agent?: string;
    [key: string]: unknown;
}

export interface DiscoveredMetadata {
    _filePath?: string;
    layer?: 'cli' | 'impl' | 'harness' | 'sdd';
    signals?: string[];
    confidence?: number;
    acknowledged?: boolean;
    custom?: boolean;
    [key: string]: unknown;
}

export type NodeMetadata =
    | AgentMetadata | SubagentMetadata | SkillMetadata
    | SteeringMetadata | HookMetadata | FeatureMetadata | DiscoveredMetadata;
