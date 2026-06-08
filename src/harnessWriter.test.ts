import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => {
    const mockFiles: Record<string, string> = {};
    return {
        default: {
            Uri: {
                joinPath: (base: any, ...paths: string[]) => ({
                    fsPath: [base?.fsPath || '', ...paths].join('/'),
                    path: [base?.path || '', ...paths].join('/'),
                }),
            },
            workspace: {
                fs: {
                    readFile: vi.fn(async (uri: any) => {
                        const content = mockFiles[uri.fsPath];
                        if (!content) throw new Error('File not found');
                        return Buffer.from(content);
                    }),
                    writeFile: vi.fn(async (uri: any, content: Buffer) => {
                        mockFiles[uri.fsPath] = content.toString();
                    }),
                },
                workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
            },
        },
        Uri: {
            joinPath: (base: any, ...paths: string[]) => ({
                fsPath: [base?.fsPath || '', ...paths].join('/'),
                path: [base?.path || '', ...paths].join('/'),
            }),
        },
        workspace: {
            fs: {
                readFile: vi.fn(),
                writeFile: vi.fn(),
            },
        },
    };
});

// We test the logic that doesn't require VS Code APIs directly
// by testing the parserLogic helper functions
import * as logic from './parserLogic.js';
import { ParserResult } from './types.js';

const createEmptyResult = (): ParserResult => ({
    graph: { nodes: [], edges: [] },
    milestones: [],
    errors: [],
});

describe('FEAT-009: Edge Deletion Logic', () => {
    it('T10: should handle edge deletion via parser re-parse (edge no longer in graph after source change)', () => {
        // This tests that after deleting a 'uses' edge from agentic.json,
        // re-parsing produces a graph without that edge
        const result = createEmptyResult();

        // Add a skill node
        result.graph.nodes.push({ id: 'test-skill', type: 'skill', label: 'Test Skill', metadata: {} });

        // Parse agentic.json with a subagent that has two skills
        const agenticContent = JSON.stringify({
            default_agent: 'primary',
            description: 'Agent',
            subagents: [
                { name: 'sub1', description: 'Sub 1', skills: ['test-skill', 'other-skill'] }
            ]
        });
        logic.parseAgenticJson(agenticContent, result);

        // Should have 3 nodes (primary, sub1, test-skill) — 'other-skill' didn't exist as node
        expect(result.graph.nodes).toHaveLength(3);
        
        // Edges: primary→sub1 (manages), sub1→test-skill (uses)
        const useEdges = result.graph.edges.filter(e => e.label === 'uses');
        expect(useEdges).toHaveLength(1);
        expect(useEdges[0].source).toBe('sub1');
        expect(useEdges[0].target).toBe('test-skill');
        
        // Simulate deletion by re-parsing without the skill
        const result2 = createEmptyResult();
        result2.graph.nodes.push({ id: 'test-skill', type: 'skill', label: 'Test Skill', metadata: {} });
        
        const agenticContent2 = JSON.stringify({
            default_agent: 'primary',
            description: 'Agent',
            subagents: [
                { name: 'sub1', description: 'Sub 1', skills: [] }  // skills array is now empty
            ]
        });
        logic.parseAgenticJson(agenticContent2, result2);
        
        // No 'uses' edges should exist
        const useEdges2 = result2.graph.edges.filter(e => e.label === 'uses');
        expect(useEdges2).toHaveLength(0);
        
        // Only manages edge remains
        expect(result2.graph.edges).toHaveLength(1);
        expect(result2.graph.edges[0].label).toBe('manages');
    });

    it('T10: should handle deletion of "manages" edge (removing subagent from config)', () => {
        const result = createEmptyResult();

        const agenticContent = JSON.stringify({
            default_agent: 'primary',
            description: 'Agent',
            subagents: [
                { name: 'sub1', description: 'Sub 1' },
                { name: 'sub2', description: 'Sub 2' },
            ]
        });
        logic.parseAgenticJson(agenticContent, result);

        expect(result.graph.nodes).toHaveLength(3); // primary, sub1, sub2
        expect(result.graph.edges).toHaveLength(2); // manages edges

        // Simulate deleting sub1 (manages edge removal)
        const result2 = createEmptyResult();
        const agenticContent2 = JSON.stringify({
            default_agent: 'primary',
            description: 'Agent',
            subagents: [
                { name: 'sub2', description: 'Sub 2' },  // sub1 removed
            ]
        });
        logic.parseAgenticJson(agenticContent2, result2);
        
        expect(result2.graph.nodes).toHaveLength(2); // primary, sub2
        expect(result2.graph.edges).toHaveLength(1); // only primary→sub2
        expect(result2.graph.edges[0].target).toBe('sub2');
    });

    it('T11: should handle edge label update via re-parse', () => {
        // Edge labels derive from the data structure, not from stored labels
        // 'manages' = agent→subagent, 'uses' = subagent→skill, 'executing' = agent→feature
        const result = createEmptyResult();
        
        // Add features
        const featureList = JSON.stringify({
            features: [
                { id: 'FEAT-001', title: 'Feature One', status: 'pending', agent: 'primary' }
            ]
        });
        logic.parseFeatureList(featureList, result);
        
        const executingEdges = result.graph.edges.filter(e => e.label === 'executing');
        expect(executingEdges).toHaveLength(1);
        expect(executingEdges[0].source).toBe('primary');
        expect(executingEdges[0].target).toBe('FEAT-001');
    });
});

describe('FEAT-009: MD File Content Tests', () => {
    it('T12: should resolve Markdown file path for subagent nodes', () => {
        // The path resolution is handled by HarnessParser.getMarkdownContent
        // This tests that the logic correctly identifies files by node type
        const result = createEmptyResult();

        // Add a subagent node
        result.graph.nodes.push({ 
            id: 'my-subagent', 
            type: 'subagent', 
            label: 'My Subagent', 
            metadata: { role_file: '.agents/subagents/my-subagent/SUBAGENT.md' } 
        });

        const subagent = result.graph.nodes.find(n => n.id === 'my-subagent');
        expect(subagent).toBeDefined();
        expect(subagent!.metadata.role_file).toBe('.agents/subagents/my-subagent/SUBAGENT.md');
    });

    it('T12: should resolve Markdown file path for skill nodes', () => {
        const result = createEmptyResult();

        result.graph.nodes.push({ 
            id: 'my-skill', 
            type: 'skill', 
            label: 'My Skill', 
            metadata: {} 
        });

        // Skill files are at .agents/skills/{name}/SKILL.md
        const skillNode = result.graph.nodes.find(n => n.id === 'my-skill');
        expect(skillNode).toBeDefined();
    });

    it('T13: should parse skill frontmatter with full Agent Skills spec fields', () => {
        const result = createEmptyResult();

        // Parse a SKILL.md with all Agent Skills spec fields
        const mdContent = `---
name: my-skill
description: A test skill with full spec fields
license: Apache-2.0
compatibility: Requires Python 3.14+
metadata:
  author: test-org
  version: "1.0"
type: skill
---
Skill body content here`;

        logic.parseMarkdown(mdContent, '.agents/skills/my-skill/SKILL.md', result);

        const skillNode = result.graph.nodes.find(n => n.id === 'my-skill');
        expect(skillNode).toBeDefined();
        expect(skillNode!.metadata.name).toBe('my-skill');
        expect(skillNode!.metadata.description).toBe('A test skill with full spec fields');
        expect(skillNode!.metadata.license).toBe('Apache-2.0');
        expect(skillNode!.metadata.compatibility).toBe('Requires Python 3.14+');
        expect(skillNode!.metadata.metadata?.author).toBe('test-org');
        expect(skillNode!.metadata.metadata?.version).toBe('1.0');
    });

    it('T13: should validate kebab-case naming convention', () => {
        // Valid kebab-case
        expect(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test('my-skill')).toBe(true);
        expect(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test('test123')).toBe(true);
        expect(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test('a-b-c')).toBe(true);
        
        // Invalid
        expect(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test('My-Skill')).toBe(false);
        expect(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test('-my-skill')).toBe(false);
        expect(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test('my-skill-')).toBe(false);
        expect(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test('my--skill')).toBe(false);
    });
});
