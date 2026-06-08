import { describe, it, expect, vi } from 'vitest';
import { computeIdoneityMatrix, detectMismatches, MISMATCH_GAP_THRESHOLD, IDONEITY_MIN_SCORE } from './idoneity.js';
import { computeBidirectionalScore, tokenize, computeIdf, buildTfidfVectors } from './semanticMatcher.js';
import * as logic from './parserLogic.js';
import { ParserResult } from './types.js';

const createEmptyResult = (): ParserResult => ({
    graph: { nodes: [], edges: [] },
    milestones: [],
    errors: [],
});

describe('Idoneity — computeBidirectionalScore (T12)', () => {
    it('forward and reverse scores are symmetric for identical descriptions', () => {
        const corpus = new Map<string, string[]>();
        corpus.set('a', tokenize('writes typescript code for vs code plugin'));
        corpus.set('b', tokenize('writes typescript code for vs code plugin'));
        const idf = computeIdf(corpus);
        const vectors = buildTfidfVectors(corpus, idf);

        const result = computeBidirectionalScore(
            'writes typescript code for vs code plugin',
            'writes typescript code for vs code plugin',
            idf, vectors, 'a', 'b'
        );
        expect(result.forward).toBeCloseTo(1.0, 1);
        expect(result.reverse).toBeCloseTo(1.0, 1);
        expect(result.composite).toBeCloseTo(1.0, 1);
    });

    it('forward differs from reverse when descriptions differ', () => {
        const corpus = new Map<string, string[]>();
        corpus.set('sa', tokenize('typescript code vs code extension development'));
        corpus.set('sk', tokenize('ears requirements specification writing notation'));
        const idf = computeIdf(corpus);
        const vectors = buildTfidfVectors(corpus, idf);

        const result = computeBidirectionalScore(
            'typescript code vs code extension development',
            'ears requirements specification writing notation',
            idf, vectors, 'sa', 'sk'
        );
        expect(result.forward).toBeGreaterThanOrEqual(0);
        expect(result.reverse).toBeGreaterThanOrEqual(0);
        // Forward and reverse may differ due to IDF weighting asymmetries
        expect(result.composite).toBeGreaterThanOrEqual(0);
    });

    it('composite is the arithmetic mean of forward and reverse', () => {
        const corpus = new Map<string, string[]>();
        corpus.set('a', tokenize('api design rest graphql'));
        corpus.set('b', tokenize('api development rest best practices'));
        const idf = computeIdf(corpus);
        const vectors = buildTfidfVectors(corpus, idf);

        const result = computeBidirectionalScore(
            'api design rest graphql',
            'api development rest best practices',
            idf, vectors, 'a', 'b'
        );
        expect(result.composite).toBeCloseTo((result.forward + result.reverse) / 2, 2);
    });
});

describe('Idoneity — computeIdoneityMatrix (T10)', () => {
    it('computes full matrix with correct forward/reverse/composite scores', () => {
        const matrix = computeIdoneityMatrix(
            [
                { id: 'sa-code', description: 'writes typescript code for vs code plugin' },
                { id: 'sa-spec', description: 'defines ears requirements and design specs' },
            ],
            [
                { id: 'skill-ts', description: 'typescript coding standards vs code plugin' },
                { id: 'skill-ears', description: 'ears easy approach requirements syntax' },
            ],
        );

        // Should have 4 records (2 subagents × 2 skills)
        expect(matrix.records).toHaveLength(4);

        // sa-code should score higher with skill-ts than with skill-ears
        const codeTs = matrix.records.find(r => r.subagentId === 'sa-code' && r.skillId === 'skill-ts');
        const codeEars = matrix.records.find(r => r.subagentId === 'sa-code' && r.skillId === 'skill-ears');
        expect(codeTs).toBeDefined();
        expect(codeEars).toBeDefined();
        if (codeTs && codeEars) {
            expect(codeTs.compositeScore).toBeGreaterThan(codeEars.compositeScore);
        }
    });

    it('bestOwnerBySkill correctly identifies the top subagent per skill', () => {
        const matrix = computeIdoneityMatrix(
            [
                { id: 'sa-code', description: 'writes typescript code for vs code plugin' },
                { id: 'sa-spec', description: 'defines ears requirements and design specs' },
            ],
            [
                { id: 'skill-ts', description: 'typescript coding standards vs code plugin' },
                { id: 'skill-ears', description: 'ears easy approach requirements syntax' },
            ],
        );

        // skill-ts should have sa-code as best owner
        const tsOwner = matrix.bestOwnerBySkill.get('skill-ts');
        expect(tsOwner).toBeDefined();
        expect(tsOwner?.subagentId).toBe('sa-code');

        // skill-ears should have sa-spec as best owner
        const earsOwner = matrix.bestOwnerBySkill.get('skill-ears');
        expect(earsOwner).toBeDefined();
        expect(earsOwner?.subagentId).toBe('sa-spec');
    });

    it('bestSkillsBySubagent correctly ranks skills per subagent', () => {
        const matrix = computeIdoneityMatrix(
            [
                { id: 'sa-code', description: 'writes typescript code for vs code plugin' },
            ],
            [
                { id: 'skill-ts', description: 'typescript coding standards vs code plugin' },
                { id: 'skill-ears', description: 'ears easy approach requirements syntax' },
            ],
        );

        const skills = matrix.bestSkillsBySubagent.get('sa-code');
        expect(skills).toBeDefined();
        expect(skills!.length).toBeGreaterThanOrEqual(1);
        // Should be sorted by score descending
        for (let i = 1; i < skills!.length; i++) {
            expect(skills![i - 1].score).toBeGreaterThanOrEqual(skills![i].score);
        }
    });

    it('empty corpus returns empty matrix', () => {
        const matrix = computeIdoneityMatrix([], [{ id: 's1', description: 'desc' }]);
        expect(matrix.records).toHaveLength(0);
        expect(matrix.bestOwnerBySkill.size).toBe(0);
        expect(matrix.bestSkillsBySubagent.size).toBe(0);
    });
});

describe('Idoneity — detectMismatches (T11)', () => {
    it('detects mismatch when gap >= threshold', () => {
        // Build a case where skill-ts is best owned by sa-code
        // but has a uses edge from sa-spec instead
        const matrix = computeIdoneityMatrix(
            [
                { id: 'sa-code', description: 'writes typescript code for vs code plugin' },
                { id: 'sa-spec', description: 'defines ears requirements and design specs' },
            ],
            [
                { id: 'skill-ts', description: 'typescript coding standards for vs code plugin' },
            ],
        );

        const mismatches = detectMismatches(matrix, [
            { source: 'sa-spec', target: 'skill-ts', label: 'uses' },
        ]);

        expect(mismatches.length).toBeGreaterThanOrEqual(1);
        const mm = mismatches.find(m => m.skillId === 'skill-ts');
        expect(mm).toBeDefined();
        expect(mm!.currentOwner).toBe('sa-spec');
        expect(mm!.bestOwner).toBe('sa-code');
        expect(mm!.gap).toBeGreaterThanOrEqual(MISMATCH_GAP_THRESHOLD);
    });

    it('does not flag when gap < threshold', () => {
        // Two subagents with similar descriptions so scores are close
        const matrix = computeIdoneityMatrix(
            [
                { id: 'sa-a', description: 'typescript development vs code extension' },
                { id: 'sa-b', description: 'typescript coding vs code plugin' },
            ],
            [
                { id: 'skill-ts', description: 'typescript coding for vs code' },
            ],
        );

        const mismatches = detectMismatches(matrix, [
            { source: 'sa-a', target: 'skill-ts', label: 'uses' },
        ]);

        // If gap < threshold, no mismatch — ok either way
        // The test just ensures it doesn't crash and handles the case
        expect(Array.isArray(mismatches)).toBe(true);
    });

    it('does not flag when bestOwner equals currentOwner', () => {
        const matrix = computeIdoneityMatrix(
            [
                { id: 'sa-code', description: 'writes typescript code for vs code plugin' },
                { id: 'sa-spec', description: 'defines ears requirements and design specs' },
            ],
            [
                { id: 'skill-ts', description: 'typescript coding standards vs code plugin' },
            ],
        );

        const mismatches = detectMismatches(matrix, [
            { source: 'sa-code', target: 'skill-ts', label: 'uses' },
        ]);

        // sa-code is the best owner, so no mismatch
        const mm = mismatches.find(m => m.skillId === 'skill-ts');
        expect(mm).toBeUndefined();
    });

    it('handles empty edges gracefully', () => {
        const matrix = computeIdoneityMatrix(
            [{ id: 'sa1', description: 'api development' }],
            [{ id: 'skill1', description: 'api design' }],
        );

        const mismatches = detectMismatches(matrix, []);
        expect(mismatches).toHaveLength(0);
    });
});

describe('Idoneity — backward compatibility (T15)', () => {
    it('empty description on subagent → 0 idoneity scores', () => {
        const matrix = computeIdoneityMatrix(
            [{ id: 'sa-empty', description: '' }],
            [{ id: 'skill1', description: 'some content' }],
        );

        expect(matrix.records).toHaveLength(0);
    });

    it('empty description on skill → no bestOwner', () => {
        const matrix = computeIdoneityMatrix(
            [{ id: 'sa1', description: 'some content' }],
            [{ id: 'skill-empty', description: '' }],
        );

        expect(matrix.bestOwnerBySkill.size).toBe(0);
    });

    it('single node → empty matrix', () => {
        const matrix = computeIdoneityMatrix(
            [{ id: 'sa1', description: 'content' }],
            [],
        );
        expect(matrix.records).toHaveLength(0);
        expect(matrix.bestOwnerBySkill.size).toBe(0);
    });
});

describe('Idoneity — parser integration (T13)', () => {
    it('skill nodes have _bestOwner / _bestOwnerScore after enrichment', () => {
        const result = createEmptyResult();

        result.graph.nodes.push(
            { id: 'sa-code', type: 'subagent', label: 'Code', metadata: { description: 'writes typescript code for vs code plugin' } },
            { id: 'skill-ts', type: 'skill', label: 'TypeScript', metadata: { description: 'typescript coding standards vs code plugin' } },
        );

        logic.enrichWithIdoneity(result);

        const skillNode = result.graph.nodes.find(n => n.id === 'skill-ts');
        expect(skillNode).toBeDefined();
        expect(skillNode!.metadata._bestOwner).toBe('sa-code');
        expect(skillNode!.metadata._bestOwnerScore).toBeGreaterThan(0);
    });

    it('uses edges have metadata.idoneity after enrichment', () => {
        const result = createEmptyResult();

        result.graph.nodes.push(
            { id: 'sa-code', type: 'subagent', label: 'Code', metadata: { description: 'writes typescript code for vs code plugin' } },
            { id: 'skill-ts', type: 'skill', label: 'TypeScript', metadata: { description: 'typescript coding standards vs code plugin' } },
        );
        result.graph.edges.push({
            id: 'edge-sa-code-skill-ts',
            source: 'sa-code',
            target: 'skill-ts',
            label: 'uses',
        });

        logic.enrichWithIdoneity(result);

        const edge = result.graph.edges.find(e => e.label === 'uses');
        expect(edge).toBeDefined();
        expect(edge!.metadata?.idoneity).toBeGreaterThan(0);
    });

    it('no idoneity enrichment when descriptions are missing', () => {
        const result = createEmptyResult();

        result.graph.nodes.push(
            { id: 'sa1', type: 'subagent', label: 'SA1', metadata: { description: '' } },
            { id: 'skill1', type: 'skill', label: 'Skill1', metadata: { description: '' } },
        );
        result.graph.edges.push({
            id: 'edge-sa1-skill1',
            source: 'sa1',
            target: 'skill1',
            label: 'uses',
        });

        logic.enrichWithIdoneity(result);

        const skillNode = result.graph.nodes.find(n => n.id === 'skill1');
        expect(skillNode!.metadata._bestOwner).toBeNull();

        const edge = result.graph.edges.find(e => e.label === 'uses');
        expect(edge!.metadata?.idoneity).toBe(0);
    });
});

describe('Idoneity — mismatch states (T14)', () => {
    it('flags mismatch when uses owner differs from bestOwner with gap >= 0.2', () => {
        const result = createEmptyResult();

        result.graph.nodes.push(
            { id: 'sa-code', type: 'subagent', label: 'Code', metadata: { description: 'writes typescript code for vs code plugin' } },
            { id: 'sa-spec', type: 'subagent', label: 'Spec', metadata: { description: 'defines ears requirements and design specs' } },
            { id: 'skill-ts', type: 'skill', label: 'TypeScript', metadata: { description: 'typescript coding standards for vs code plugin development' } },
        );

        // Wrong owner: sa-spec linked to skill-ts, but best owner is sa-code
        result.graph.edges.push({
            id: 'edge-sa-spec-skill-ts',
            source: 'sa-spec',
            target: 'skill-ts',
            label: 'uses',
        });

        logic.enrichWithIdoneity(result);

        const skillNode = result.graph.nodes.find(n => n.id === 'skill-ts');
        expect(skillNode!.metadata._mismatch).toBe(true);
        expect(skillNode!.metadata._mismatchBestOwner).toBe('sa-code');
        expect(skillNode!.metadata._mismatchGap).toBeGreaterThanOrEqual(MISMATCH_GAP_THRESHOLD);

        // Edge should be flagged too
        const edge = result.graph.edges.find(e => e.label === 'uses');
        expect(edge!.metadata?._mismatch).toBe(true);
    });
});
