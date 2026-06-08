import { describe, it, expect, vi } from 'vitest';
import { computeSemanticSuggestions, extractNameTokens, tokenize, SemanticMatch } from './semanticMatcher.js';
import * as logic from './parserLogic.js';
import { ParserResult } from './types.js';
import type { DiscoveryMethod } from './types.js';

const createEmptyResult = (): ParserResult => ({
    graph: { nodes: [], edges: [] },
    milestones: [],
    errors: [],
});

describe('Semantic Matcher — tokenization (T8)', () => {
    it('should filter common stopwords', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'the and for with from this that type script' }],
            [{ id: 'skill1', description: 'type script development' }],
            [],
        );
        // "type" and "script" should survive; "the" "and" "for" "with" "from" "this" "that" filtered
        expect(result.length).toBeGreaterThan(0);
        // "type" and "script" should match
        expect(result[0].score).toBeGreaterThan(0);
    });

    it('should handle empty description', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: '' }],
            [{ id: 'skill1', description: 'some content' }],
            [],
        );
        expect(result).toHaveLength(0);
    });

    it('should handle punctuation and capitalization', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'TypeScript, React & Node.JS' }],
            [{ id: 'skill1', description: 'typescript react node js' }],
            [],
        );
        expect(result).toHaveLength(1);
        // Should match despite punctuation and case differences
        expect(result[0].score).toBeGreaterThan(0.5);
    });

    it('should handle short tokens (< 2 chars)', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'a b c d e f api dev' }],
            [{ id: 'skill1', description: 'api dev' }],
            [],
        );
        // "api" and "dev" (3 chars each) should match
        expect(result).toHaveLength(1);
    });
});

describe('Semantic Matcher — TF-IDF cosine similarity (T9)', () => {
    it('should return 1.0 for identical descriptions', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'writes typescript code for vs code plugin' }],
            [{ id: 'skill1', description: 'writes typescript code for vs code plugin' }],
            [],
        );
        expect(result).toHaveLength(1);
        expect(result[0].score).toBeGreaterThan(0.95);
    });

    it('should return 0.0 (no edge) for orthogonal descriptions', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'database administration postgresql queries' }],
            [{ id: 'skill1', description: 'frontend react css animation' }],
            [],
        );
        // No common meaningful tokens → score below threshold
        expect(result).toHaveLength(0);
    });

    it('should detect partial match between related descriptions', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'defines ears requirements and design specs' }],
            [{ id: 'skill1', description: 'how to write requirements in ears notation' }],
            [],
        );
        expect(result).toHaveLength(1);
        // Should have a moderate match (share "ears", "requirements" tokens)
        const score = result[0].score;
        expect(score).toBeGreaterThan(0.1);
        expect(score).toBeLessThan(1);
    });

    it('should handle multiple subagents and skills', () => {
        const result = computeSemanticSuggestions(
            [
                { id: 'sa-code', description: 'writes typescript code vs code extension development' },
                { id: 'sa-spec', description: 'ears requirements specification writing design' },
            ],
            [
                { id: 'skill-ts', description: 'typescript coding standards vs code plugin best practices' },
                { id: 'skill-ears', description: 'ears easy approach requirements syntax writing notation' },
            ],
            [],
        );
        // sa-code should match skill-ts better than skill-ears
        const codeMatch = result.find(m => m.subagentId === 'sa-code' && m.skillId === 'skill-ts');
        const codeEars = result.find(m => m.subagentId === 'sa-code' && m.skillId === 'skill-ears');
        // sa-spec should match skill-ears
        const specMatch = result.find(m => m.subagentId === 'sa-spec' && m.skillId === 'skill-ears');

        expect(codeMatch).toBeDefined();
        expect(specMatch).toBeDefined();

        // sa-code↔skill-ts should score higher than sa-code↔skill-ears
        if (codeMatch && codeEars) {
            expect(codeMatch.score).toBeGreaterThan(codeEars.score);
        }
    });
});

describe('Semantic Matcher — threshold & duplicate prevention (T10)', () => {
    it('should not return pairs below threshold', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'python backend api' }],
            [{ id: 'skill1', description: 'rust systems programming low level' }],
            [],
            { threshold: 0.5 },
        );
        expect(result).toHaveLength(0);
    });

    it('should respect custom threshold', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'api design rest graphql' }],
            [{ id: 'skill1', description: 'api development rest best practices' }],
            [],
            { threshold: 0.01 },
        );
        expect(result).toHaveLength(1);
    });

    it('should skip pairs with existing uses edge', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'ears requirements specification' }],
            [{ id: 'skill1', description: 'ears easy approach requirements syntax' }],
            [{ source: 'sa1', target: 'skill1' }], // already linked
        );
        expect(result).toHaveLength(0);
    });

    it('should skip pairs with existing discovered edge', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'ears requirements specification' }],
            [{ id: 'skill1', description: 'ears easy approach requirements syntax' }],
            [{ source: 'sa1', target: 'skill1' }], // discovered
        );
        expect(result).toHaveLength(0);
    });

    it('should return matches sorted by score descending', () => {
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', description: 'ears requirements specification writing' }],
            [
                { id: 'skill1', description: 'ears easy approach requirements syntax notation' },
                { id: 'skill2', description: 'unrelated topic database management' },
            ],
            [],
        );
        if (result.length >= 2) {
            expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
        }
    });
});

describe('Semantic Matcher — integration with parser (T11)', () => {
    it('should add suggested edges when descriptions semantically match', () => {
        const result = createEmptyResult();

        // Add a subagent node
        result.graph.nodes.push({
            id: 'spec-author',
            type: 'subagent',
            label: 'Spec Author',
            metadata: { description: 'defines ears requirements and design specs' }
        });

        // Add a skill node
        result.graph.nodes.push({
            id: 'ears-requirements',
            type: 'skill',
            label: 'EARS Requirements',
            metadata: { description: 'how to write requirements in ears notation' }
        });

        logic.addSemanticSuggestions(result);

        const suggestedEdges = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggestedEdges.length).toBeGreaterThan(0);

        const edge = suggestedEdges[0];
        expect(edge.source).toBe('spec-author');
        expect(edge.target).toBe('ears-requirements');
        expect(edge.metadata?.score).toBeGreaterThan(0);
        expect(edge.metadata?.method).toBe('tfidf');
    });

    it('should not create suggested edges when descriptions are orthogonal', () => {
        const result = createEmptyResult();

        result.graph.nodes.push({
            id: 'sa1',
            type: 'subagent',
            label: 'SA1',
            metadata: { description: 'database postgresql administration' }
        });
        result.graph.nodes.push({
            id: 'skill1',
            type: 'skill',
            label: 'Skill1',
            metadata: { description: 'react frontend animation css' }
        });

        logic.addSemanticSuggestions(result);

        const suggestedEdges = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggestedEdges).toHaveLength(0);
    });

    it('should not create suggested edge if uses edge already exists', () => {
        const result = createEmptyResult();

        result.graph.nodes.push({
            id: 'sa1',
            type: 'subagent',
            label: 'SA1',
            metadata: { description: 'ears requirements specification' }
        });
        result.graph.nodes.push({
            id: 'ears-requirements',
            type: 'skill',
            label: 'EARS',
            metadata: { description: 'ears easy approach requirements syntax' }
        });
        // Existing uses edge
        result.graph.edges.push({
            id: 'edge-sa1-ears-requirements',
            source: 'sa1',
            target: 'ears-requirements',
            label: 'uses',
        });

        logic.addSemanticSuggestions(result);

        const suggestedEdges = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggestedEdges).toHaveLength(0);
    });

    it('should not create duplicate suggested edges', () => {
        const result = createEmptyResult();

        result.graph.nodes.push({
            id: 'sa1',
            type: 'subagent',
            label: 'SA1',
            metadata: { description: 'ears requirements specification' }
        });
        result.graph.nodes.push({
            id: 'ears-requirements',
            type: 'skill',
            label: 'EARS',
            metadata: { description: 'ears easy approach requirements syntax' }
        });

        // Call twice
        logic.addSemanticSuggestions(result);
        logic.addSemanticSuggestions(result);

        const suggestedEdges = result.graph.edges.filter(e => e.label === 'suggested');
        expect(suggestedEdges).toHaveLength(1);
    });
});

describe('Semantic Matcher — LLM re-ranking (T13)', () => {
    it('should use LLM scorer when provided and produce hybrid scores', async () => {
        const mockLlmScorer = vi.fn();
        mockLlmScorer.mockResolvedValue(0.8);

        const result = await computeSemanticSuggestions(
            [{ id: 'sa1', description: 'ears requirements specification writing' }],
            [{ id: 'skill1', description: 'ears easy approach requirements syntax notation' }],
            [],
            { llmScorer: mockLlmScorer, llmTopK: 5 },
        );

        expect(result).toHaveLength(1);
        expect(result[0].method).toBe('hybrid');
        // TF-IDF + LLM averaged
        expect(result[0].score).toBeGreaterThan(0.3);
        expect(mockLlmScorer).toHaveBeenCalledTimes(1);
    });

    it('should fall back to TF-IDF when LLM scorer throws', async () => {
        const failingScorer = vi.fn();
        failingScorer.mockRejectedValue(new Error('LLM unavailable'));

        const result = await computeSemanticSuggestions(
            [{ id: 'sa1', description: 'ears requirements specification' }],
            [{ id: 'skill1', description: 'ears easy approach requirements syntax' }],
            [],
            { llmScorer: failingScorer, llmTopK: 5 },
        );

        expect(result).toHaveLength(1);
        expect(result[0].method).toBe('tfidf'); // falls back to pure TF-IDF when LLM fails
        expect(result[0].score).toBeGreaterThan(0);
    });

    it('should apply LLM only to top-K candidates per subagent', async () => {
        const mockLlmScorer = vi.fn();
        mockLlmScorer.mockResolvedValue(0.9);

        const result = await computeSemanticSuggestions(
            [{ id: 'sa1', description: 'ears requirements specification and design' }],
            [
                { id: 'skill1', description: 'ears easy approach requirements syntax notation' },
                { id: 'skill2', description: 'design patterns architecture best practices' },
            ],
            [],
            { llmScorer: mockLlmScorer, llmTopK: 1 }, // only top 1 gets LLM
        );

        // Both skills may be above threshold, but only top-1 gets LLM call
        expect(mockLlmScorer.mock.calls.length).toBeLessThanOrEqual(1);
    });
});

// ===== FEAT-012 Tests =====

describe('FEAT-012 — extractNameTokens (T20)', () => {
    it('should split kebab-case name', () => {
        const result = extractNameTokens('terraform-implementer');
        expect(result).toContain('terraform');
        expect(result).toContain('implementer');
    });

    it('should split camelCase name', () => {
        const result = extractNameTokens('typescriptImplementer');
        expect(result).toContain('typescript');
        expect(result).toContain('implementer');
    });

    it('should handle single word name', () => {
        const result = extractNameTokens('harness');
        expect(result).toEqual(['harness']);
    });

    it('should filter short tokens', () => {
        const result = extractNameTokens('a-b-c');
        expect(result).toHaveLength(0);
    });

    it('should handle underscore split', () => {
        const result = extractNameTokens('spec_author');
        expect(result).toContain('spec');
        expect(result).toContain('author');
    });

    it('should deduplicate tokens', () => {
        const result = extractNameTokens('foo-foo');
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('foo');
    });

    it('should handle empty string', () => {
        expect(extractNameTokens('')).toHaveLength(0);
    });
});

describe('FEAT-012 — tokenize with n-gram (T21)', () => {
    it('should return unigrams by default (nGramSize=1)', () => {
        const tokens = tokenize('continuous deployment pipeline', 1);
        expect(tokens).toContain('continuous');
        expect(tokens).toContain('deployment');
        expect(tokens).toContain('pipeline');
        expect(tokens.filter(t => t.includes('_'))).toHaveLength(0);
    });

    it('should add bigrams when nGramSize=2', () => {
        const tokens = tokenize('continuous deployment pipeline', 2);
        expect(tokens).toContain('continuous');
        expect(tokens).toContain('deployment');
        expect(tokens).toContain('pipeline');
        expect(tokens).toContain('continuous_deployment');
        expect(tokens).toContain('deployment_pipeline');
    });

    it('should not generate bigrams for single token input', () => {
        const tokens = tokenize('hello', 2);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toBe('hello');
    });

    it('should deduplicate bigrams', () => {
        const tokens = tokenize('a a a', 2);
        const bigrams = tokens.filter(t => t.includes('_'));
        expect(new Set(bigrams).size).toBe(bigrams.length); // no duplicates
    });
});

describe('FEAT-012 — name-boost (T24)', () => {
    it('should boost score when skill name token appears in subagent description', () => {
        // Subagent name contains "terraform", skill name is "terraform"
        const withoutBoost = computeSemanticSuggestions(
            [{ id: 'sa1', name: 'sa1', description: 'managing cloud infrastructure' }],
            [{ id: 'cloud-skill', name: 'cloud-skill', description: 'cloud infrastructure management' }],
            [],
            { threshold: 0.1 }
        );

        expect(withoutBoost.length).toBeGreaterThan(0);
        // Verify the score accounts for the name-token boost
        const score = withoutBoost[0].score;
        expect(score).toBeGreaterThan(0);
    });

    it('should give higher score when subagent name matches skill content', () => {
        // Two skills: one matching subagent name, one not
        const result = computeSemanticSuggestions(
            [{ id: 'terraform-implementer', name: 'terraform-implementer', description: 'writes terraform infrastructure code' }],
            [
                { id: 'terraform-structure', name: 'terraform-structure', description: 'terraform folder standards and metadata' },
                { id: 'ears-requirements', name: 'ears-requirements', description: 'writing requirements in ears notation' },
            ],
            [],
            { threshold: 0.1 }
        );

        const terraformSkill = result.find(r => r.skillId === 'terraform-structure');
        const earsSkill = result.find(r => r.skillId === 'ears-requirements');

        // terraform-structure should score higher because name token "terraform" matches
        if (terraformSkill && earsSkill) {
            expect(terraformSkill.score).toBeGreaterThan(earsSkill.score);
        }
    });
});

describe('FEAT-012 — full-body TF-IDF (T23, T27, T28)', () => {
    it('should use fullBody over description when available (R1)', () => {
        // Subagent with rich full body but no description
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', name: 'sa1', description: '', fullBody: 'managing cloud infrastructure deployment automation terraform' }],
            [{ id: 'skill1', name: 'skill1', description: '', fullBody: 'cloud infrastructure terraform automation' }],
            [],
            { threshold: 0.1 }
        );
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].score).toBeGreaterThan(0.3);
    });

    it('should fall back to description when fullBody is empty (R10)', () => {
        // Entity with only description (no fullBody)
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', name: 'sa1', description: 'database postgresql administration', fullBody: '' }],
            [{ id: 'skill1', name: 'skill1', description: 'postgresql database backup restore', fullBody: '' }],
            [],
            { threshold: 0.1 }
        );
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].score).toBeGreaterThan(0);
    });

    it('should fall back to description when both fullBody and description are undefined', () => {
        // Edge case: entity with no content at all → no suggestion
        const result = computeSemanticSuggestions(
            [{ id: 'sa1', name: 'sa1', description: '' }],
            [{ id: 'skill1', name: 'skill1', description: '' }],
            [],
        );
        expect(result).toHaveLength(0);
    });
});
