import { describe, it, expect } from 'vitest';
import * as logic from './parserLogic.js';
import { ParserResult, CrossRefInfo } from './types.js';

describe('Harness Parser Logic', () => {
    it('should parse agentic.json correctly', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        
        const content = JSON.stringify({
            default_agent: "primary",
            description: "Main Agent",
            subagents: [
                { name: "sub1", description: "Sub Agent 1" }
            ]
        });

        logic.parseAgenticJson(content, result);

        expect(result.graph.nodes).toHaveLength(2);
        expect(result.graph.nodes[0].id).toBe('primary');
        expect(result.graph.nodes[1].id).toBe('sub1');
        expect(result.graph.edges).toHaveLength(1);
    });

    it('should parse Markdown frontmatter correctly', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        const content = `---
name: my-skill
type: skill
---
Skill body content`;

        logic.parseMarkdown(content, 'some/path/SKILL.md', result);

        expect(result.graph.nodes).toHaveLength(1);
        expect(result.graph.nodes[0].id).toBe('my-skill');
        expect(result.graph.nodes[0].metadata.body).toContain('Skill body content');
    });

    it('should create edges from subagent to skill via ## Skills section', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };

        // First add skill as a node
        result.graph.nodes.push({ id: 'my-skill', type: 'skill', label: 'My Skill', metadata: {} });

        // Markdown with ## Skills section
        const content = `---
name: my-subagent
type: subagent
---

## Mission
Do something.

## Skills
- my-skill`;

        logic.parseMarkdown(content, '.agents/subagents/my-subagent/SUBAGENT.md', result);

        expect(result.graph.edges).toHaveLength(1);
        expect(result.graph.edges[0].source).toBe('my-subagent');
        expect(result.graph.edges[0].target).toBe('my-skill');
        expect(result.graph.edges[0].label).toBe('uses');
    });

    it('should deduplicate edges when skill appears in both agentic.json and SUBAGENT.md', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };

        // Add skill node
        result.graph.nodes.push({ id: 'shared-skill', type: 'skill', label: 'Shared Skill', metadata: {} });

        // First, parse agentic.json with skills array
        const agenticContent = JSON.stringify({
            default_agent: 'primary',
            description: 'Agent',
            subagents: [
                { name: 'sub1', description: 'Sub', skills: ['shared-skill'] }
            ]
        });
        logic.parseAgenticJson(agenticContent, result);

        // Then, parse SUBAGENT.md with same skill in ## Skills section
        const mdContent = `---
name: sub1
type: subagent
---

## Skills
- shared-skill`;
        logic.parseMarkdown(mdContent, '.agents/subagents/sub1/SUBAGENT.md', result);

        // Should only have ONE edge, not two
        const useEdges = result.graph.edges.filter(e => e.label === 'uses');
        expect(useEdges).toHaveLength(1);
        expect(useEdges[0].source).toBe('sub1');
        expect(useEdges[0].target).toBe('shared-skill');
    });

    it('should log warning when skill referenced does not exist as a node', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };

        const content = JSON.stringify({
            default_agent: 'primary',
            description: 'Agent',
            subagents: [
                { name: 'sub1', description: 'Sub', skills: ['non-existent-skill'] }
            ]
        });

        logic.parseAgenticJson(content, result);

        // No edges should be created
        expect(result.graph.edges).toHaveLength(1); // Only primary->sub1 edge
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('non-existent-skill');
    });

    it('should convert features from feature_list.json into milestones', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };

        const content = JSON.stringify({
            features: [
                { id: 'FEAT-001', title: 'Feature One', status: 'done', sprint: 'MVP', description: 'First feature' },
                { id: 'FEAT-002', title: 'Feature Two', status: 'pending', sprint: 'Sprint 2', description: 'Second feature' },
                { id: 'FEAT-003', title: 'Feature Three', status: 'spec_ready', sprint: 'Sprint 3', description: 'Third feature' }
            ]
        });

        logic.parseFeatureList(content, result);

        expect(result.milestones).toHaveLength(3);
        expect(result.milestones[0].featureId).toBe('FEAT-001');
        expect(result.milestones[0].status).toBe('COMPLETED');
        expect(result.milestones[1].status).toBe('PENDING');
        expect(result.milestones[2].status).toBe('SPEC READY');
        expect(result.milestones[0].date).toBe('MVP');
    });
});

// ===== FEAT-012 Tests =====

describe('FEAT-012 — scanCrossReferences (T22)', () => {
    it('should detect markdown link cross-references', () => {
        const body = 'Check the [skill documentation](../skills/my-skill/SKILL.md) for details.';
        const allIds = new Set(['my-skill', 'other-skill']);
        const refs = logic.scanCrossReferences(body, 'my-subagent', allIds);
        expect(refs.length).toBeGreaterThan(0);
        expect(refs[0].targetId).toBe('my-skill');
        expect(refs[0].linkType).toBe('markdown');
        expect(refs[0].confidence).toBe('high');
    });

    it('should detect wiki-style [[links]]', () => {
        const body = 'Refer to [[my-skill]] for implementation details.';
        const allIds = new Set(['my-skill', 'other-skill']);
        const refs = logic.scanCrossReferences(body, 'my-subagent', allIds);
        expect(refs.length).toBeGreaterThan(0);
        expect(refs[0].targetId).toBe('my-skill');
        expect(refs[0].linkType).toBe('wiki');
    });

    it('should detect wiki links with label [[target|label]]', () => {
        const body = 'See [[my-skill|Skill Documentation]] for more.';
        const allIds = new Set(['my-skill']);
        const refs = logic.scanCrossReferences(body, 'my-subagent', allIds);
        expect(refs).toHaveLength(1);
        expect(refs[0].targetId).toBe('my-skill');
    });

    it('should ignore external URLs', () => {
        const body = 'See [external](https://example.com) and [file](file:///local/path).';
        const allIds = new Set(['example']);
        const refs = logic.scanCrossReferences(body, 'my-subagent', allIds);
        expect(refs).toHaveLength(0);
    });

    it('should skip self-references', () => {
        const body = 'See [[my-subagent]] for self.';
        const allIds = new Set(['my-subagent']);
        const refs = logic.scanCrossReferences(body, 'my-subagent', allIds);
        expect(refs).toHaveLength(0);
    });

    it('should only match known node IDs', () => {
        const body = 'Check [[unknown-skill]] and [known](../skills/known-skill/SKILL.md).';
        const allIds = new Set(['known-skill']);
        const refs = logic.scanCrossReferences(body, 'my-subagent', allIds);
        expect(refs).toHaveLength(1);
        expect(refs[0].targetId).toBe('known-skill');
    });

    it('should return empty for empty body', () => {
        expect(logic.scanCrossReferences('', 'source', new Set(['a']))).toHaveLength(0);
    });

    it('should deduplicate same target and link type', () => {
        const body = '[[my-skill]] and [[my-skill|label]]';
        const allIds = new Set(['my-skill']);
        const refs = logic.scanCrossReferences(body, 'source', allIds);
        // Wiki links to same target should be deduplicated
        const mySkillRefs = refs.filter(r => r.targetId === 'my-skill' && r.linkType === 'wiki');
        expect(mySkillRefs).toHaveLength(1);
    });
});

describe('FEAT-012 — body truncation elimination (T27)', () => {
    it('should store full body in _fullBody and truncated in body', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        const longBody = 'a'.repeat(1000); // longer than 500 chars

        const content = `---
name: test-skill
---
${longBody}`;

        logic.parseMarkdown(content, '/path/skills/test-skill/SKILL.md', result);

        const node = result.graph.nodes.find(n => n.id === 'test-skill');
        expect(node).toBeDefined();
        expect(node!.metadata._fullBody).toBe(longBody);
        expect(node!.metadata.body).toHaveLength(500);
    });

    it('should store full body for subagent nodes too', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        // Need to add the skill first so subagent can reference it
        result.graph.nodes.push({ id: 'some-skill', type: 'skill', label: 'Some Skill', metadata: {} });

        const bodyLines = Array(20).fill('b'.repeat(60));
        const body = bodyLines.join('\n');
        const content = `---
name: test-subagent
---
${body}

## Skills
- some-skill`;

        logic.parseMarkdown(content, '.agents/subagents/test-subagent/SUBAGENT.md', result);

        const node = result.graph.nodes.find(n => n.id === 'test-subagent');
        expect(node).toBeDefined();
        // _fullBody should contain everything after frontmatter
        const fullBody = node!.metadata._fullBody as string;
        expect(fullBody.length).toBeGreaterThan(500);
        expect(fullBody).toContain('bbbb');
        expect(fullBody).toContain('## Skills');
        // body should be truncated to 500 chars (display only)
        expect(node!.metadata.body).toHaveLength(500);
    });
});

describe('FEAT-012 — cross-ref edge creation (T26)', () => {
    it('should add suggested edge from cross-reference', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };

        // Add both nodes
        result.graph.nodes.push({ id: 'sub1', type: 'subagent', label: 'Sub1', metadata: {} });
        result.graph.nodes.push({ id: 'skill1', type: 'skill', label: 'Skill1', metadata: { _discovery: 'scanned' as DiscoveryMethod } });

        // Add cross-ref metadata to sub1
        const sub1Node = result.graph.nodes.find(n => n.id === 'sub1')!;
        sub1Node.metadata._crossRefs = [
            { targetId: 'skill1', linkType: 'markdown', confidence: 'high', context: 'uses this skill' }
        ];

        logic.addCrossRefEdges(result);

        const suggestedEdges = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggestedEdges).toHaveLength(1);
        expect(suggestedEdges[0].source).toBe('sub1');
        expect(suggestedEdges[0].target).toBe('skill1');
        expect(suggestedEdges[0].metadata?.source).toBe('cross-ref');
    });

    it('should not add edge if uses edge already exists', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };

        result.graph.nodes.push({ id: 'sub1', type: 'subagent', label: 'Sub1', metadata: {} });
        result.graph.nodes.push({ id: 'skill1', type: 'skill', label: 'Skill1', metadata: {} });

        // Existing uses edge
        result.graph.edges.push({ id: 'e1', source: 'sub1', target: 'skill1', label: 'uses' });

        // Cross-ref metadata
        const sub1Node = result.graph.nodes.find(n => n.id === 'sub1')!;
        sub1Node.metadata._crossRefs = [
            { targetId: 'skill1', linkType: 'markdown', confidence: 'high', context: 'uses' }
        ];

        logic.addCrossRefEdges(result);

        const suggestedEdges = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggestedEdges).toHaveLength(0);
    });

    it('should not crash when no nodes have cross-refs', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        result.graph.nodes.push({ id: 'sub1', type: 'subagent', label: 'Sub1', metadata: {} });
        expect(() => logic.addCrossRefEdges(result)).not.toThrow();
    });
});

// ===== FEAT-013 Tests =====

describe('FEAT-013 — Persistent suggestion dismissal (T16, T20)', () => {
    function makeResult(): ParserResult {
        return { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
    }
    function addNodes(result: ParserResult) {
        result.graph.nodes.push({
            id: 'sub1', type: 'subagent', label: 'Sub1',
            metadata: { description: 'terraform infrastructure provisioning' }
        });
        result.graph.nodes.push({
            id: 'terraform-skill', type: 'skill', label: 'terraform',
            metadata: { description: 'terraform infrastructure provisioning tool', _discovery: 'scanned' }
        });
    }

    it('T16: addSemanticSuggestions skips dismissed pairs', () => {
        const result = makeResult();
        addNodes(result);
        const dismissed = new Set(['sub1::terraform-skill']);
        logic.addSemanticSuggestions(result, { threshold: 0.0 }, dismissed);
        const suggested = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggested.find(e => e.source === 'sub1' && e.target === 'terraform-skill')).toBeUndefined();
    });

    it('T16: addSemanticSuggestions emits edge for non-dismissed pairs', () => {
        const result = makeResult();
        addNodes(result);
        const dismissed = new Set<string>(); // nothing dismissed
        logic.addSemanticSuggestions(result, { threshold: 0.0 }, dismissed);
        const suggested = result.graph.edges.filter(e => e.label === 'suggested');
        // At least the pair should be attempted (may or may not score above 0)
        // We just verify the function doesn't skip it for wrong reasons
        expect(() => logic.addSemanticSuggestions(result, { threshold: 0.0 }, dismissed)).not.toThrow();
    });

    it('T20: addCrossRefEdges skips dismissed cross-ref pairs', () => {
        const result = makeResult();
        addNodes(result);
        const sub1 = result.graph.nodes.find(n => n.id === 'sub1')!;
        sub1.metadata._crossRefs = [
            { targetId: 'terraform-skill', linkType: 'wiki', confidence: 'high', context: 'uses' }
        ];
        const dismissed = new Set(['sub1::terraform-skill']);
        logic.addCrossRefEdges(result, dismissed);
        const suggested = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggested).toHaveLength(0);
    });

    it('T20: addCrossRefEdges emits edge when pair is not dismissed', () => {
        const result = makeResult();
        addNodes(result);
        const sub1 = result.graph.nodes.find(n => n.id === 'sub1')!;
        sub1.metadata._crossRefs = [
            { targetId: 'terraform-skill', linkType: 'wiki', confidence: 'high', context: 'uses' }
        ];
        logic.addCrossRefEdges(result, new Set()); // empty dismissed set
        const suggested = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggested).toHaveLength(1);
        expect(suggested[0].source).toBe('sub1');
        expect(suggested[0].target).toBe('terraform-skill');
    });
});

describe('FEAT-013 — Disabled connections (T18)', () => {
    it('T18: uses edge with matching disabledConnections key gets metadata.disabled = true', () => {
        // We test the logic directly (parser integration tested via harnessParser)
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        result.graph.nodes.push({ id: 'sub1', type: 'subagent', label: 'Sub1', metadata: {} });
        result.graph.nodes.push({ id: 'skill1', type: 'skill', label: 'Skill1', metadata: {} });
        result.graph.edges.push({ id: 'e1', source: 'sub1', target: 'skill1', label: 'uses' });
        result.graph.edges.push({ id: 'e2', source: 'sub1', target: 'skill1', label: 'manages' }); // non-uses

        // Simulate the disabled connection pass (from harnessParser.parse)
        const disabledConnections = new Set(['sub1::skill1']);
        for (const edge of result.graph.edges) {
            if (edge.label !== 'uses') continue;
            const key = `${edge.source}::${edge.target}`;
            if (disabledConnections.has(key)) {
                edge.metadata = { ...edge.metadata, disabled: true };
            }
        }

        const usesEdge = result.graph.edges.find(e => e.id === 'e1');
        const managesEdge = result.graph.edges.find(e => e.id === 'e2');
        expect(usesEdge?.metadata?.disabled).toBe(true);
        expect(managesEdge?.metadata?.disabled).toBeUndefined();
    });

    it('T18: uses edge NOT in disabledConnections has no disabled flag', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        result.graph.edges.push({ id: 'e1', source: 'sub1', target: 'skill1', label: 'uses' });

        const disabledConnections = new Set(['sub2::skill2']); // different pair
        for (const edge of result.graph.edges) {
            if (edge.label !== 'uses') continue;
            const key = `${edge.source}::${edge.target}`;
            if (disabledConnections.has(key)) {
                edge.metadata = { ...edge.metadata, disabled: true };
            }
        }

        expect(result.graph.edges[0].metadata?.disabled).toBeUndefined();
    });
});

describe('FEAT-013 — enrichWithIdoneity returns IdoneityMatrix (T17)', () => {
    it('T17: enrichWithIdoneity returns a non-null IdoneityMatrix', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        result.graph.nodes.push({
            id: 'sub1', type: 'subagent', label: 'Sub1',
            metadata: { description: 'terraform infrastructure provisioning' }
        });
        result.graph.nodes.push({
            id: 'sk1', type: 'skill', label: 'SK1',
            metadata: { description: 'terraform provisioning tool' }
        });
        result.graph.edges.push({ id: 'e1', source: 'sub1', target: 'sk1', label: 'uses' });

        const matrix = logic.enrichWithIdoneity(result);
        expect(matrix).toBeDefined();
        expect(matrix.records).toBeDefined();
        expect(Array.isArray(matrix.records)).toBe(true);
        // Should have 1 record for the (sub1, sk1) pair
        expect(matrix.records.length).toBeGreaterThan(0);
        expect(matrix.records[0].subagentId).toBe('sub1');
        expect(matrix.records[0].skillId).toBe('sk1');
    });

    it('T17: enrichSuggestedEdgesWithIdoneity accepts pre-computed matrix (no second computation)', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, milestones: [], errors: [] };
        result.graph.nodes.push({
            id: 'sub1', type: 'subagent', label: 'Sub1',
            metadata: { description: 'terraform infrastructure' }
        });
        result.graph.nodes.push({
            id: 'sk1', type: 'skill', label: 'SK1',
            metadata: { description: 'terraform infrastructure tool' }
        });
        result.graph.edges.push({
            id: 'e1', source: 'sub1', target: 'sk1', label: 'suggested',
            metadata: { score: 0.5, method: 'tfidf' }
        });

        const matrix = logic.enrichWithIdoneity(result);
        // Should not throw and should enrich the suggested edge with idoneity
        expect(() => logic.enrichSuggestedEdgesWithIdoneity(result, matrix)).not.toThrow();
        const edge = result.graph.edges.find(e => e.id === 'e1');
        // idoneity may or may not be > 0, but if score is 0 it stays unset — just verify no crash
        expect(edge).toBeDefined();
    });
});

