import { describe, it, expect } from 'vitest';
import { optO01, optO02, optO03 } from './overlap.js';
import type { ComponentSource, OptimizerConfig, RuleContext } from '../types.js';
import { DEFAULT_OPTIMIZER_CONFIG } from '../types.js';

function makeSource(overrides: Partial<ComponentSource>): ComponentSource {
    return {
        nodeId: 'x',
        nodeType: 'skill',
        label: 'x',
        filePath: 'skills/x/SKILL.md',
        raw: '',
        frontmatter: {},
        body: '',
        exists: true,
        pathKind: 'file' as const,
        tokenEstimate: 10,
        ...overrides,
    };
}

function makeCtx(source: ComponentSource, opts?: Partial<RuleContext>): RuleContext {
    const all = opts?.all ?? [source];
    return {
        source,
        all,
        sourcesById: new Map(all.map(s => [s.nodeId, s])),
        edges: opts?.edges ?? [],
        nodeIds: opts?.nodeIds ?? new Set(all.map(s => s.nodeId)),
        existingPaths: opts?.existingPaths ?? new Set(),
        config: opts?.config ?? DEFAULT_OPTIMIZER_CONFIG,
    };
}

describe('OPT-O01 — semantic overlap between components (R22)', () => {
    it('emits symmetrically on both components when they overlap', () => {
        const descA = { description: 'Deploy and configure the kubernetes cluster with helm charts.' };
        const descB = { description: 'Deploy and configure the kubernetes cluster with helm charts.' };
        const skillA = makeSource({ nodeId: 'skillA', nodeType: 'skill', frontmatter: descA });
        const skillB = makeSource({ nodeId: 'skillB', nodeType: 'skill', frontmatter: descB });
        const config: OptimizerConfig = { ...DEFAULT_OPTIMIZER_CONFIG, overlapThreshold: 0.9 };

        const findingsA = optO01.evaluate(makeCtx(skillA, { all: [skillA, skillB], config }));
        const findingsB = optO01.evaluate(makeCtx(skillB, { all: [skillA, skillB], config }));

        expect(findingsA).toHaveLength(1);
        expect(findingsA[0].relatedNodeIds).toEqual(['skillB']);
        expect(findingsB).toHaveLength(1);
        expect(findingsB[0].relatedNodeIds).toEqual(['skillA']);
    });

    it('includes a pair whose similarity is exactly at the threshold (inclusive boundary)', () => {
        const identicalText = 'Deploy and configure the kubernetes cluster with helm charts.';
        const skillA = makeSource({ nodeId: 'skillA', nodeType: 'skill', frontmatter: { description: identicalText } });
        const skillB = makeSource({ nodeId: 'skillB', nodeType: 'skill', frontmatter: { description: identicalText } });
        // Identical text → cosine similarity of exactly 1.0.
        const config: OptimizerConfig = { ...DEFAULT_OPTIMIZER_CONFIG, overlapThreshold: 1.0 };
        const findings = optO01.evaluate(makeCtx(skillA, { all: [skillA, skillB], config }));
        expect(findings).toHaveLength(1);
    });

    it('does not flag unrelated components', () => {
        const skillA = makeSource({ nodeId: 'skillA', nodeType: 'skill', frontmatter: { description: 'Deploy kubernetes clusters using helm charts.' } });
        const skillB = makeSource({ nodeId: 'skillB', nodeType: 'skill', frontmatter: { description: 'Format financial spreadsheets for quarterly reports.' } });
        const config: OptimizerConfig = { ...DEFAULT_OPTIMIZER_CONFIG, overlapThreshold: 0.5 };
        const findings = optO01.evaluate(makeCtx(skillA, { all: [skillA, skillB], config }));
        expect(findings).toHaveLength(0);
    });

    it('does not compare components of different types', () => {
        const skill = makeSource({ nodeId: 'skillA', nodeType: 'skill', frontmatter: { description: 'Deploy kubernetes clusters using helm charts.' } });
        const subagent = makeSource({ nodeId: 'subagentA', nodeType: 'subagent', frontmatter: { description: 'Deploy kubernetes clusters using helm charts.' } });
        const config: OptimizerConfig = { ...DEFAULT_OPTIMIZER_CONFIG, overlapThreshold: 0.1 };
        const findings = optO01.evaluate(makeCtx(skill, { all: [skill, subagent], config }));
        expect(findings).toHaveLength(0);
    });
});

describe('OPT-O02 — orphan and under-connected components (R23)', () => {
    it('flags a skill with no incoming uses edge', () => {
        const skill = makeSource({ nodeId: 'skillA', nodeType: 'skill' });
        const findings = optO02.evaluate(makeCtx(skill, { edges: [] }));
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe('warning');
    });

    it('does not flag a skill with an incoming uses edge', () => {
        const skill = makeSource({ nodeId: 'skillA', nodeType: 'skill' });
        const edges = [{ source: 'subagentA', target: 'skillA', label: 'uses' }];
        expect(optO02.evaluate(makeCtx(skill, { edges }))).toHaveLength(0);
    });

    it('flags an under-connected subagent (no uses owned, no governs targeting it) as info', () => {
        const subagent = makeSource({ nodeId: 'subagentA', nodeType: 'subagent' });
        const findings = optO02.evaluate(makeCtx(subagent, { edges: [] }));
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe('info');
    });

    it('does not flag a subagent that owns a uses edge', () => {
        const subagent = makeSource({ nodeId: 'subagentA', nodeType: 'subagent' });
        const edges = [{ source: 'subagentA', target: 'skillA', label: 'uses' }];
        expect(optO02.evaluate(makeCtx(subagent, { edges }))).toHaveLength(0);
    });

    it('flags a steering file whose appliesTo glob matches nothing', () => {
        const steering = makeSource({ nodeId: 'steer1', nodeType: 'steering', frontmatter: { appliesTo: ['docs/**/*.md'] } });
        const findings = optO02.evaluate(makeCtx(steering, { existingPaths: new Set(['src/index.ts']) }));
        expect(findings).toHaveLength(1);
    });

    it('does not flag a steering file whose appliesTo glob matches an existing file', () => {
        const steering = makeSource({ nodeId: 'steer1', nodeType: 'steering', frontmatter: { appliesTo: ['src/**/*.ts'] } });
        const findings = optO02.evaluate(makeCtx(steering, { existingPaths: new Set(['src/index.ts']) }));
        expect(findings).toHaveLength(0);
    });
});

describe('OPT-O03 — ownership mismatch (R24)', () => {
    it('maps a MismatchInfo to a finding naming bestOwner in relatedNodeIds', () => {
        const subagentA = makeSource({
            nodeId: 'subagentA',
            nodeType: 'subagent',
            body: 'Handles SQL database migrations and schema versioning tasks for the data layer.',
        });
        const subagentB = makeSource({
            nodeId: 'subagentB',
            nodeType: 'subagent',
            body: 'Deploys applications to kubernetes clusters using helm charts and manages releases.',
        });
        const skill = makeSource({
            nodeId: 'skillA',
            nodeType: 'skill',
            body: 'Deploy applications to kubernetes clusters using helm charts and manage releases end to end.',
        });

        const all = [subagentA, subagentB, skill];
        const edges = [{ source: 'subagentA', target: 'skillA', label: 'uses' }];

        const findings = optO03.evaluate(makeCtx(skill, { all, edges }));
        expect(findings.length).toBeGreaterThan(0);
        expect(findings[0].relatedNodeIds).toEqual(['subagentB']);
        expect(findings[0].severity).toBe('info');
    });

    it('does not flag a skill already owned by its best semantic owner', () => {
        const subagentA = makeSource({
            nodeId: 'subagentA',
            nodeType: 'subagent',
            body: 'Deploys applications to kubernetes clusters using helm charts and manages releases.',
        });
        const skill = makeSource({
            nodeId: 'skillA',
            nodeType: 'skill',
            body: 'Deploy applications to kubernetes clusters using helm charts and manage releases end to end.',
        });
        const all = [subagentA, skill];
        const edges = [{ source: 'subagentA', target: 'skillA', label: 'uses' }];
        const findings = optO03.evaluate(makeCtx(skill, { all, edges }));
        expect(findings).toHaveLength(0);
    });
});

describe('OPT-O02 — epistemic tier (smoke-test reclassification)', () => {
    it('is heuristic, not fact: it reads derived graph state', () => {
        // A skill declared in `skills[]` for three subagents was still reported
        // as an orphan. Whatever the derivation gap, a rule that reads the graph
        // cannot claim verified fact about a model it did not build —
        // DESIGN.md principle 5: the graph is derived, never the source of truth.
        expect(optO02.confidence).toBe('heuristic');
    });

    it('says its claim comes from the graph, so a false positive is diagnosable', () => {
        const skill = makeSource({ nodeId: 'orphan', nodeType: 'skill' });
        const out = optO02.evaluate(makeCtx(skill, { all: [skill], edges: [] }));
        const orphan = out.find(f => /orphan/i.test(f.title));
        expect(orphan).toBeDefined();
        expect(orphan!.detail).toMatch(/derived graph/i);
        expect(orphan!.detail).toMatch(/agentic\.json|SUBAGENT\.md/);
    });
});
