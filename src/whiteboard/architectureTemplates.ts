// FEAT-033 Phase 2 — Architecture Templates (R23)

export interface TemplateNodeDef {
    id: string;
    type: 'subagent' | 'skill';
    name: string;
    description: string;
}

export interface TemplateEdgeDef {
    source: string;
    target: string;
}

export interface ArchitectureTemplate {
    id: string;
    name: string;
    description: string;
    nodeCount: number;
    edgeCount: number;
    previewAscii: string;
    nodes: TemplateNodeDef[];
    edges: TemplateEdgeDef[];
}

export const ARCHITECTURE_TEMPLATES: ArchitectureTemplate[] = [
    {
        id: 'solo-agent',
        name: 'Solo Agent',
        description: 'Single agent with a focused role and CLAUDE.md.',
        nodeCount: 1,
        edgeCount: 0,
        previewAscii: '[ Agent ]',
        nodes: [
            { id: 'n0', type: 'subagent', name: 'main-agent', description: 'A general-purpose agent.' },
        ],
        edges: [],
    },
    {
        id: 'agent-with-skills',
        name: 'Agent + Skills',
        description: 'One agent wired to three reusable skills.',
        nodeCount: 4,
        edgeCount: 3,
        previewAscii: '     [ Agent ]\n    /    |    \\\n[Sk1] [Sk2] [Sk3]',
        nodes: [
            { id: 'n0', type: 'subagent', name: 'main-agent', description: 'Orchestrates the skills below.' },
            { id: 'n1', type: 'skill', name: 'read-skill', description: 'Reads and parses input data.' },
            { id: 'n2', type: 'skill', name: 'process-skill', description: 'Processes and transforms data.' },
            { id: 'n3', type: 'skill', name: 'write-skill', description: 'Writes and formats output.' },
        ],
        edges: [
            { source: 'n0', target: 'n1' },
            { source: 'n0', target: 'n2' },
            { source: 'n0', target: 'n3' },
        ],
    },
    {
        id: 'coordinator-specialists',
        name: 'Coordinator + Specialists',
        description: 'Coordinator agent orchestrates two domain-specialist agents.',
        nodeCount: 3,
        edgeCount: 2,
        previewAscii: '  [Coordinator]\n   /         \\\n[Spec-A]  [Spec-B]',
        nodes: [
            { id: 'n0', type: 'subagent', name: 'coordinator', description: 'Routes tasks to specialist agents.' },
            { id: 'n1', type: 'subagent', name: 'specialist-a', description: 'Handles domain A tasks.' },
            { id: 'n2', type: 'subagent', name: 'specialist-b', description: 'Handles domain B tasks.' },
        ],
        edges: [
            { source: 'n0', target: 'n1' },
            { source: 'n0', target: 'n2' },
        ],
    },
    {
        id: 'sdd-pipeline',
        name: 'Full SDD Pipeline',
        description: 'Frontend, Backend, QA and Review agents wired to an SDD workflow.',
        nodeCount: 4,
        edgeCount: 3,
        previewAscii: '[Frontend] [Backend]\n    \\         /\n      [Review]\n        |\n       [QA]',
        nodes: [
            { id: 'n0', type: 'subagent', name: 'frontend-agent', description: 'Implements frontend features from SDD specs.' },
            { id: 'n1', type: 'subagent', name: 'backend-agent', description: 'Implements backend features from SDD specs.' },
            { id: 'n2', type: 'subagent', name: 'review-agent', description: 'Reviews PRs for correctness and SDD compliance.' },
            { id: 'n3', type: 'subagent', name: 'qa-agent', description: 'Writes and runs tests against the implemented features.' },
        ],
        edges: [
            { source: 'n0', target: 'n2' },
            { source: 'n1', target: 'n2' },
            { source: 'n2', target: 'n3' },
        ],
    },
];
