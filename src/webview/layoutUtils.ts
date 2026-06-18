import { Node, Edge } from 'reactflow';

const nodeWidth = 200;
const nodeHeight = 80;
const GROUP_VERTICAL_GAP = 80;
const GROUP_HORIZONTAL_PADDING = 40;
const GROUP_VERTICAL_PADDING = 80;

// Maximum nodes per row within a rank before wrapping to a new sub-row.
// Keeps the sector width predictable regardless of how many nodes share a rank.
const MAX_NODES_PER_ROW = 4;
const NODE_H_GAP = 60;  // horizontal gap between nodes in the same row
const NODE_V_GAP = 80;  // vertical gap between rows within the same rank
const RANK_V_GAP = 100; // vertical gap between different ranks

// Feature chip dimensions (compact, grid below the arch graph)
const FEAT_W = 160;
const FEAT_H = 36;
const FEAT_COL_GAP = 12;
const FEAT_ROW_GAP = 10;
const FEATURE_SECTION_GAP = 48;
// Feature columns calculated from available width
const FEAT_COLS = MAX_NODES_PER_ROW;  // same cap keeps widths consistent

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

// ARCHITECTURAL NODE TYPES — shown in the whiteboard hierarchy.
// Feature nodes are intentionally excluded: they belong in the SDD panel.
const ARCH_TYPES = new Set(['agent', 'subagent', 'skill', 'steering', 'hook']);

function rankFor(node: Node): number {
    if (node.type === 'agent')    return 0;
    if (node.type === 'subagent') return 1;
    if (node.type === 'skill')    return 2;
    if (node.type === 'steering') return 2;
    if (node.type === 'hook')     return 2;
    return 3;
}

/**
 * Layout a set of nodes for one rank (same Y tier) with automatic row-wrapping.
 * Returns the positioned nodes and the total height consumed by this rank.
 *
 * Nodes are grouped into rows of MAX_NODES_PER_ROW, each row centred on
 * `centreX`. Rows stack vertically with NODE_V_GAP between them.
 */
function layoutRank(
    rankNodes: Node[],
    startY: number,
    centreX: number,
): { placedNodes: Node[]; rankHeight: number } {
    if (rankNodes.length === 0) return { placedNodes: [], rankHeight: 0 };

    const placedNodes: Node[] = [];
    const rows = Math.ceil(rankNodes.length / MAX_NODES_PER_ROW);
    let maxRowY = startY;

    for (let row = 0; row < rows; row++) {
        const slice = rankNodes.slice(row * MAX_NODES_PER_ROW, (row + 1) * MAX_NODES_PER_ROW);
        const rowWidth = slice.length * nodeWidth + (slice.length - 1) * NODE_H_GAP;
        const rowStartX = centreX - rowWidth / 2;
        const rowY = startY + row * (nodeHeight + NODE_V_GAP);
        maxRowY = rowY;

        slice.forEach((n, i) => {
            n.targetPosition = 'top' as any;
            n.sourcePosition = 'bottom' as any;
            n.position = {
                x: rowStartX + i * (nodeWidth + NODE_H_GAP),
                y: rowY,
            };
            placedNodes.push(n);
        });
    }

    const rankHeight = (maxRowY - startY) + nodeHeight;
    return { placedNodes, rankHeight };
}

export function getLayoutedElementsByProvider(
    nodes: Node[],
    edges: Edge[],
): { nodes: Node[]; edges: Edge[]; groups: ProviderGroup[] } {

    // ── Filter: only architectural nodes go to the whiteboard ──────────────
    const archNodes    = nodes.filter((n) => ARCH_TYPES.has(n.type ?? ''));
    const featureNodes = nodes.filter((n) => n.type === 'feature');
    // Edges that touch a feature node are also excluded from the whiteboard
    const archEdges    = edges.filter(
        (e) => archNodes.some((n) => n.id === e.source) &&
               archNodes.some((n) => n.id === e.target),
    );

    // ── Group arch nodes by provider ───────────────────────────────────────
    const groupsMap = new Map<string, Node[]>();
    for (const n of archNodes) {
        const fw = providerOf(n);
        if (!groupsMap.has(fw)) groupsMap.set(fw, []);
        groupsMap.get(fw)!.push(n);
    }

    const sortedFwIds = Array.from(groupsMap.keys()).sort((a, b) =>
        paletteFor(a).label.localeCompare(paletteFor(b).label),
    );

    const placed: Node[] = [];
    const groups: ProviderGroup[] = [];
    let cursorY = 0;

    for (const fwId of sortedFwIds) {
        const groupNodes = groupsMap.get(fwId)!;
        const palette = paletteFor(fwId);

        // ── TB hierarchy: group nodes by rank then layout each rank ─────────
        // Find the max rank present so we know how many tiers to draw
        const maxRank = groupNodes.reduce((m, n) => Math.max(m, rankFor(n)), 0);

        // Compute a stable centre X: wide enough to fit the largest rank row
        // (MAX_NODES_PER_ROW nodes + gaps), plus padding.
        const centreX = GROUP_HORIZONTAL_PADDING
            + (MAX_NODES_PER_ROW * nodeWidth + (MAX_NODES_PER_ROW - 1) * NODE_H_GAP) / 2;

        let rankCursorY = cursorY + GROUP_VERTICAL_PADDING;
        let maxNodeX = 0;

        for (let rank = 0; rank <= maxRank; rank++) {
            const rankNodes = groupNodes.filter((n) => rankFor(n) === rank);
            if (rankNodes.length === 0) continue;

            const { placedNodes, rankHeight } = layoutRank(rankNodes, rankCursorY, centreX);
            placed.push(...placedNodes);

            // Track rightmost node for group width
            for (const n of placedNodes) {
                maxNodeX = Math.max(maxNodeX, n.position.x + nodeWidth);
            }

            rankCursorY += rankHeight + RANK_V_GAP;
        }

        const archHeight = rankCursorY - cursorY - RANK_V_GAP - GROUP_VERTICAL_PADDING;

        // ── Feature chips: compact grid below the hierarchy ─────────────────
        // Features are shown as read-only chips so users know what exists,
        // but they never interfere with the architectural layout.
        // (Features are positioned but NOT added to `placed` — they are
        //  returned in the node list but the whiteboard renders them last,
        //  below the sector, so they don't inflate the sector bounding box.)
        let featGridHeight = 0;

        if (featureNodes.length > 0) {
            // Only show features that belong to this provider group
            const groupFeatures = featureNodes.filter(
                (n) => providerOf(n) === fwId,
            );
            if (groupFeatures.length > 0) {
                const cols = Math.min(groupFeatures.length, FEAT_COLS);
                const cellW = FEAT_W + FEAT_COL_GAP;
                const cellH = FEAT_H + FEAT_ROW_GAP;
                const gridStartY = rankCursorY + FEATURE_SECTION_GAP - RANK_V_GAP;

                groupFeatures.forEach((n, i) => {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    n.targetPosition = 'top' as any;
                    n.sourcePosition = 'bottom' as any;
                    n.position = {
                        x: GROUP_HORIZONTAL_PADDING + col * cellW,
                        y: gridStartY + row * cellH,
                    };
                    placed.push(n);
                });

                const rows = Math.ceil(groupFeatures.length / cols);
                featGridHeight = FEATURE_SECTION_GAP + rows * cellH - FEAT_ROW_GAP;
            }
        }

        // ── Sector bounding box ──────────────────────────────────────────────
        const innerW = Math.max(
            maxNodeX - GROUP_HORIZONTAL_PADDING,
            FEAT_COLS * (FEAT_W + FEAT_COL_GAP) - FEAT_COL_GAP,
        );
        const groupWidth  = innerW + GROUP_HORIZONTAL_PADDING * 2;
        const groupHeight = GROUP_VERTICAL_PADDING + archHeight + featGridHeight + GROUP_VERTICAL_PADDING;

        groups.push({
            id:     fwId,
            label:  palette.label,
            tint:   palette.tint,
            border: palette.border,
            x:      0,
            y:      cursorY,
            width:  groupWidth,
            height: groupHeight,
            count:  groupNodes.length,
        });

        cursorY += groupHeight + GROUP_VERTICAL_GAP;
    }

    return { nodes: placed, edges: archEdges, groups };
}
