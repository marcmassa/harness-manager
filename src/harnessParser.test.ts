import { describe, it, expect } from 'vitest';
import { HarnessParser, ParserResult } from './harnessParser.js';
import * as vscode from 'vscode';

// Mocking vscode purely for the constructor, though we won't use it in these tests
const mockUri = {} as vscode.Uri;

describe('HarnessParser Logic', () => {
    it('should parse agentic.json correctly', () => {
        const parser = new HarnessParser(mockUri);
        const result: ParserResult = { graph: { nodes: [], edges: [] }, errors: [] };
        
        const content = JSON.stringify({
            default_agent: "primary",
            description: "Main Agent",
            subagents: [
                { name: "sub1", description: "Sub Agent 1" }
            ]
        });

        parser.parseAgenticJson(content, result);

        expect(result.graph.nodes).toHaveLength(2);
        expect(result.graph.nodes[0].id).toBe('primary');
        expect(result.graph.nodes[1].id).toBe('sub1');
        expect(result.graph.edges).toHaveLength(1);
        expect(result.graph.edges[0].source).toBe('primary');
        expect(result.graph.edges[0].target).toBe('sub1');
    });

    it('should handle invalid JSON gracefully', () => {
        const parser = new HarnessParser(mockUri);
        const result: ParserResult = { graph: { nodes: [], edges: [] }, errors: [] };
        
        parser.parseAgenticJson('invalid-json', result);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].file).toBe('.agents/agentic.json');
    });
});
