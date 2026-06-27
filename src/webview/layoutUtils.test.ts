import { describe, it, expect } from 'vitest';
import { getLayoutedElementsByProvider } from './layoutUtils.js';
import type { Node, Edge } from 'reactflow';

function makeNode(id: string, type: string, framework = 'harness-sdd'): Node {
    return {
        id,
        type,
        position: { x: 0, y: 0 },
        data: { metadata: { _framework: framework } },
    };
}

describe('getLayoutedElementsByProvider', () => {
    it('returns empty arrays for zero nodes', () => {
        const { nodes, edges, groups } = getLayoutedElementsByProvider([], []);
        expect(nodes).toHaveLength(0);
        expect(edges).toHaveLength(0);
        expect(groups).toHaveLength(0);
    });

    it('positions a single agent node', () => {
        const node = makeNode('agent-1', 'agent');
        const { nodes, groups } = getLayoutedElementsByProvider([node], []);
        expect(nodes).toHaveLength(1);
        expect(groups).toHaveLength(1);
        expect(nodes[0].position.x).toBeGreaterThanOrEqual(0);
        expect(nodes[0].position.y).toBeGreaterThanOrEqual(0);
    });

    it('wraps nodes into multiple rows when rank exceeds MAX_NODES_PER_ROW (4)', () => {
        // 5 skill nodes in the same rank → row 0 has 4, row 1 has 1
        const skills = Array.from({ length: 5 }, (_, i) => makeNode(`skill-${i}`, 'skill'));
        const { nodes } = getLayoutedElementsByProvider(skills, []);
        expect(nodes).toHaveLength(5);

        // All 5 positions should be different
        const positions = nodes.map(n => `${n.position.x},${n.position.y}`);
        expect(new Set(positions).size).toBe(5);

        // The 5th node (wraps) must have a higher Y than the first 4
        const ys = nodes.map(n => n.position.y);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        expect(maxY).toBeGreaterThan(minY);
    });

    it('filters out non-architectural types (feature nodes)', () => {
        const feature = makeNode('feat-1', 'feature');
        const agent = makeNode('agent-1', 'agent');
        const { nodes } = getLayoutedElementsByProvider([feature, agent], []);
        // Both appear but the agent is in the arch layout; feature is positioned separately
        expect(nodes).toHaveLength(2); // feature chip + agent
    });

    it('creates one group per provider framework', () => {
        const harness = makeNode('agent-h', 'agent', 'harness-sdd');
        const claude = makeNode('agent-c', 'agent', 'claude-code');
        const { groups } = getLayoutedElementsByProvider([harness, claude], []);
        expect(groups).toHaveLength(2);
        const labels = groups.map(g => g.label);
        expect(labels).toContain('Harness SDD');
        expect(labels).toContain('Claude Code');
    });

    it('excludes edges that touch non-arch nodes', () => {
        const agent = makeNode('agent-1', 'agent');
        const feat = makeNode('feat-1', 'feature');
        const edge: Edge = { id: 'e1', source: 'agent-1', target: 'feat-1' };
        const { edges } = getLayoutedElementsByProvider([agent, feat], [edge]);
        expect(edges).toHaveLength(0);
    });

    it('includes edges between arch nodes', () => {
        const agent = makeNode('agent-1', 'agent');
        const skill = makeNode('skill-1', 'skill');
        const edge: Edge = { id: 'e1', source: 'agent-1', target: 'skill-1' };
        const { edges } = getLayoutedElementsByProvider([agent, skill], [edge]);
        expect(edges).toHaveLength(1);
    });
});
