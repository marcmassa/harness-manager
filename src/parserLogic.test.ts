import { describe, it, expect } from 'vitest';
import * as logic from './parserLogic.js';
import { ParserResult } from './types.js';

describe('Harness Parser Logic', () => {
    it('should parse agentic.json correctly', () => {
        const result: ParserResult = { graph: { nodes: [], edges: [] }, errors: [] };
        
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
        const result: ParserResult = { graph: { nodes: [], edges: [] }, errors: [] };
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
});
