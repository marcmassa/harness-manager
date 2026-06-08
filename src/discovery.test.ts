import { describe, it, expect } from 'vitest';
import * as logic from './parserLogic.js';
import { ParserResult } from './types.js';
import type { DiscoveryMethod } from './types.js';

const createEmptyResult = (): ParserResult => ({
    graph: { nodes: [], edges: [] },
    milestones: [],
    errors: [],
});

describe('Progressive Disclosure — Skill Discovery', () => {
    it('should tag scanned skills with _discovery: "scanned"', () => {
        const result = createEmptyResult();

        const mdContent = `---
name: my-skill
description: A test skill
type: skill
---
Body content`;

        logic.parseMarkdown(mdContent, '.agents/skills/my-skill/SKILL.md', result);

        const skillNode = result.graph.nodes.find(n => n.id === 'my-skill');
        expect(skillNode).toBeDefined();
        expect(skillNode!.metadata._discovery).toBe('scanned');
    });

    it('should mark skill as "linked" when referenced via agentic.json skills[] array', () => {
        const result = createEmptyResult();

        // First add skill node (scanned)
        result.graph.nodes.push({
            id: 'test-skill',
            type: 'skill',
            label: 'Test Skill',
            metadata: { _discovery: 'scanned' as DiscoveryMethod }
        });

        // Parse agentic.json with subagent referencing the skill
        const agenticContent = JSON.stringify({
            default_agent: 'primary',
            description: 'Agent',
            subagents: [
                { name: 'sub1', description: 'Sub 1', skills: ['test-skill'] }
            ]
        });
        logic.parseAgenticJson(agenticContent, result);

        // Skill should now be 'linked'
        const skillNode = result.graph.nodes.find(n => n.id === 'test-skill');
        expect(skillNode!.metadata._discovery).toBe('linked');
    });

    it('should mark skill as "linked" when referenced via ## Skills section in SUBAGENT.md', () => {
        const result = createEmptyResult();

        // First add skill node (scanned)
        result.graph.nodes.push({
            id: 'my-skill',
            type: 'skill',
            label: 'My Skill',
            metadata: { _discovery: 'scanned' as DiscoveryMethod }
        });

        // Parse SUBAGENT.md with ## Skills section referencing the skill
        const mdContent = `---
name: my-subagent
type: subagent
---
## Skills
- my-skill`;

        logic.parseMarkdown(mdContent, '.agents/subagents/my-subagent/SUBAGENT.md', result);

        // Skill should now be 'linked'
        const skillNode = result.graph.nodes.find(n => n.id === 'my-skill');
        expect(skillNode!.metadata._discovery).toBe('linked');
    });

    it('should mark skill as "linked" when auto-linked via file path', () => {
        const result = createEmptyResult();

        // Parse SKILL.md inside a subagent's folder (auto-link)
        const skillContent = `---
name: embedded-skill
type: skill
---
Embedded skill`;

        logic.parseMarkdown(skillContent, '.agents/subagents/my-subagent/skills/embedded-skill/SKILL.md', result);

        // Skill should be 'linked' (auto-linked via file path)
        const skillNode = result.graph.nodes.find(n => n.id === 'embedded-skill');
        expect(skillNode).toBeDefined();
        expect(skillNode!.metadata._discovery).toBe('linked');

        // Should have a 'uses' edge from subagent to skill
        const useEdge = result.graph.edges.find(e => e.label === 'uses');
        expect(useEdge).toBeDefined();
        expect(useEdge!.source).toBe('my-subagent');
        expect(useEdge!.target).toBe('embedded-skill');
    });
});

describe('Progressive Disclosure — Reconciliation', () => {
    it('should reconcile orphan skills with "discovered" edge from primary agent', () => {
        const result = createEmptyResult();

        // Add primary agent
        result.graph.nodes.push({
            id: 'primary',
            type: 'agent',
            label: 'primary',
            metadata: { isPrimary: true }
        });

        // Add an orphan skill (scanned but never linked)
        result.graph.nodes.push({
            id: 'orphan-skill',
            type: 'skill',
            label: 'Orphan Skill',
            metadata: { _discovery: 'scanned' as DiscoveryMethod }
        });

        // Add a linked skill (already marked as linked)
        result.graph.nodes.push({
            id: 'linked-skill',
            type: 'skill',
            label: 'Linked Skill',
            metadata: { _discovery: 'linked' as DiscoveryMethod }
        });

        // Reconcile
        logic.reconcileSkillDiscovery(result, 'primary');

        // Orphan skill should now be 'orphan'
        const orphanNode = result.graph.nodes.find(n => n.id === 'orphan-skill');
        expect(orphanNode!.metadata._discovery).toBe('orphan');

        // Linked skill should still be 'linked'
        const linkedNode = result.graph.nodes.find(n => n.id === 'linked-skill');
        expect(linkedNode!.metadata._discovery).toBe('linked');

        // Should have a 'discovered' edge from primary to orphan skill
        const discoveredEdge = result.graph.edges.find(e => e.label === 'discovered');
        expect(discoveredEdge).toBeDefined();
        expect(discoveredEdge!.source).toBe('primary');
        expect(discoveredEdge!.target).toBe('orphan-skill');

        // Should NOT have a 'discovered' edge for linked skill
        const linkedDiscovered = result.graph.edges.find(
            e => e.label === 'discovered' && e.target === 'linked-skill'
        );
        expect(linkedDiscovered).toBeUndefined();
    });

    it('should not create duplicate discovered edges', () => {
        const result = createEmptyResult();

        result.graph.nodes.push({
            id: 'primary',
            type: 'agent',
            label: 'primary',
            metadata: { isPrimary: true }
        });

        result.graph.nodes.push({
            id: 'orphan-skill',
            type: 'skill',
            label: 'Orphan Skill',
            metadata: { _discovery: 'scanned' as DiscoveryMethod }
        });

        // Reconcile twice
        logic.reconcileSkillDiscovery(result, 'primary');
        logic.reconcileSkillDiscovery(result, 'primary');

        // Should only have ONE discovered edge
        const discoveredEdges = result.graph.edges.filter(e => e.label === 'discovered');
        expect(discoveredEdges).toHaveLength(1);
    });

    it('should produce correct counts after full parsing pipeline with reconciliation', () => {
        // Simulate the full pipeline: skills parsed first, then subagents
        const result = createEmptyResult();

        // 1. Parse agentic.json
        const agenticContent = JSON.stringify({
            default_agent: 'harness',
            description: 'Main harness agent',
            subagents: [
                { name: 'implementer', description: 'Implements code', skills: ['typescript-skill'] }
            ]
        });
        logic.parseAgenticJson(agenticContent, result);
        // Adds: primary agent + implementer subagent + manages edge

        // 2. Parse skills (as harnessParser.ts does: skills FIRST)
        const skillContent1 = `---
name: typescript-skill
description: TypeScript coding skill
type: skill
---
TS body`;
        logic.parseMarkdown(skillContent1, '.agents/skills/typescript-skill/SKILL.md', result);
        // → scanned initially, but reconcile will check vs existing uses edges

        const skillContent2 = `---
name: terraform-skill
description: Terraform infrastructure skill
type: skill
---
TF body`;
        logic.parseMarkdown(skillContent2, '.agents/skills/terraform-skill/SKILL.md', result);
        // → scanned initially, never linked → will become orphan

        // 3. Parse subagents (as harnessParser.ts does: subagents SECOND)
        const subagentMd = `---
name: implementer
type: subagent
---
## Skills
- typescript-skill`;
        logic.parseMarkdown(subagentMd, '.agents/subagents/implementer/SUBAGENT.md', result);
        // This creates a 'uses' edge from implementer → typescript-skill

        // 4. Reconcile (as harnessParser.ts does at end of parse())
        logic.reconcileSkillDiscovery(result, 'harness');

        // Verify
        const typescript = result.graph.nodes.find(n => n.id === 'typescript-skill');
        expect(typescript!.metadata._discovery).toBe('linked');

        const terraform = result.graph.nodes.find(n => n.id === 'terraform-skill');
        expect(terraform!.metadata._discovery).toBe('orphan');

        // Should have exactly one 'discovered' edge (harness → terraform-skill)
        const discoveredEdges = result.graph.edges.filter(e => e.label === 'discovered');
        expect(discoveredEdges).toHaveLength(1);
        expect(discoveredEdges[0].source).toBe('harness');
        expect(discoveredEdges[0].target).toBe('terraform-skill');

        // Should have exactly one 'uses' edge (implementer → typescript-skill)
        const usesEdges = result.graph.edges.filter(e => e.label === 'uses');
        expect(usesEdges).toHaveLength(1);
        expect(usesEdges[0].source).toBe('implementer');
        expect(usesEdges[0].target).toBe('typescript-skill');

        // Total edges: manages + uses + discovered = 3
        expect(result.graph.edges).toHaveLength(3);
    });
});
