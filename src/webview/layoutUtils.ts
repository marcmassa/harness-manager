import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const nodeWidth = 200;
const nodeHeight = 80;
const GROUP_VERTICAL_GAP = 120;
const GROUP_HORIZONTAL_PADDING = 60;
const GROUP_VERTICAL_PADDING = 100;

export const PROVIDER_PALETTE: Record<string, { tint: string; border: string; label: string }> = {
    'harness-sdd':    { tint: 'rgba(74, 125, 255, 0.07)',  border: 'rgba(74, 125, 255, 0.40)',  label: 'Harness SDD' },
    'opencode':       { tint: 'rgba(212, 168, 74, 0.07)',  border: 'rgba(212, 168, 74, 0.40)',  label: 'OpenCode' },
    'claude-code':    { tint: 'rgba(232, 111, 74, 0.07)',  border: 'rgba(232, 111, 74, 0.40)',  label: 'Claude Code' },
    'cursor':         { tint: 'rgba(42, 161, 152, 0.07)',  border: 'rgba(42, 161, 152, 0.40)',  label: 'Cursor' },
    'gemini-cli':     { tint: 'rgba(155, 89, 182, 0.07)',  border: 'rgba(155, 89, 182, 0.40)',  label: 'Gemini CLI' },
    'copilot':        { tint: 'rgba(91, 154, 209, 0.07)',  border: 'rgba(91, 154, 209, 0.40)',  label: 'GitHub Copilot' },
    'windsurf':       { tint: 'rgba(108, 108, 138, 0.07)', border: 'rgba(108, 108, 138, 0.40)', label: 'Windsurf' },
    'kiro':           { tint: 'rgba(46, 204, 113, 0.07)',  border: 'rgba(46, 204, 113, 0.40)',  label: 'Kiro' },
};

export const FALLBACK_PROVIDER = {
    tint: 'rgba(136, 136, 136, 0.07)',
    border: 'rgba(136, 136, 136, 0.40)',
    label: 'Other',
};

export interface ProviderGroup {
    id: string;
    label: string;
    tint: string;
    border: string;
    x: number;
    y: number;
    width: number;
    height: number;
    count: number;
}

export function paletteFor(providerId: string): { tint: string; border: string; label: string } {
    return PROVIDER_PALETTE[providerId] ?? FALLBACK_PROVIDER;
}

function providerOf(node: Node): string {
    const fw = (node.data as any)?.metadata?._framework;
    if (typeof fw === 'string' && fw.length > 0) return fw;
    return 'harness-sdd';
}

function rankFor(node: Node): number {
    if (node.type === 'agent') return 0;
    if (node.type === 'subagent') return 1;
    if (node.type === 'skill') return 2;
    if (node.type === 'feature') return 3;
    if (node.type === 'steering') return 2;
    if (node.type === 'hook') return 2;
    return 4;
}

export function getLayoutedElementsByProvider(
    nodes: Node[],
    edges: Edge[],
): { nodes: Node[]; edges: Edge[]; groups: ProviderGroup[] } {
    const groupsMap = new Map<string, Node[]>();
    for (const n of nodes) {
        const fw = providerOf(n);
        if (!groupsMap.has(fw)) groupsMap.set(fw, []);
        groupsMap.get(fw)!.push(n);
    }

    const sortedFwIds = Array.from(groupsMap.keys()).sort((a, b) => {
        return paletteFor(a).label.localeCompare(paletteFor(b).label);
    });

    const edgesByGroup = new Map<string, Edge[]>();
    for (const fw of sortedFwIds) edgesByGroup.set(fw, []);
    for (const e of edges) {
        const sourceNode = nodes.find((n) => n.id === e.source);
        if (!sourceNode) continue;
        const fw = providerOf(sourceNode);
        edgesByGroup.get(fw)?.push(e);
    }

    const placed: Node[] = [];
    const groups: ProviderGroup[] = [];
    let cursorY = 0;

    for (const fwId of sortedFwIds) {
        const groupNodes = groupsMap.get(fwId)!;
        const groupEdges = edgesByGroup.get(fwId)!;
        const palette = paletteFor(fwId);

        const dg = new dagre.graphlib.Graph();
        dg.setDefaultEdgeLabel(() => ({}));
        dg.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 60 });
        for (const n of groupNodes) {
            dg.setNode(n.id, { width: nodeWidth, height: nodeHeight, rank: rankFor(n) });
        }
        for (const e of groupEdges) {
            dg.setEdge(e.source, e.target);
        }
        dagre.layout(dg);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of groupNodes) {
            const dnode = dg.node(n.id);
            if (!dnode) continue;
            const cx = dnode.x, cy = dnode.y;
            if (cx - nodeWidth / 2 < minX) minX = cx - nodeWidth / 2;
            if (cy - nodeHeight / 2 < minY) minY = cy - nodeHeight / 2;
            if (cx + nodeWidth / 2 > maxX) maxX = cx + nodeWidth / 2;
            if (cy + nodeHeight / 2 > maxY) maxY = cy + nodeHeight / 2;
        }
        if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

        const groupOffsetX = GROUP_HORIZONTAL_PADDING;
        const groupOffsetY = cursorY + GROUP_VERTICAL_PADDING;

        for (const n of groupNodes) {
            const dnode = dg.node(n.id);
            if (!dnode) continue;
            n.targetPosition = 'top' as any;
            n.sourcePosition = 'bottom' as any;
            n.position = {
                x: dnode.x - nodeWidth / 2 + groupOffsetX - minX,
                y: dnode.y - nodeHeight / 2 + groupOffsetY - minY,
            };
            placed.push(n);
        }

        const groupWidth = (maxX - minX) + GROUP_HORIZONTAL_PADDING * 2;
        const groupHeight = (maxY - minY) + GROUP_VERTICAL_PADDING * 2;
        groups.push({
            id: fwId,
            label: palette.label,
            tint: palette.tint,
            border: palette.border,
            x: 0,
            y: cursorY,
            width: groupWidth,
            height: groupHeight,
            count: groupNodes.length,
        });

        cursorY += groupHeight + GROUP_VERTICAL_GAP;
    }

    return { nodes: placed, edges, groups };
}
