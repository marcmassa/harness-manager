// FEAT-043 T1 — rules run only where their prerequisites hold for the owner (R1, R4).
import { describe, expect, it } from 'vitest';
import { applicability, PROVIDER_CONVENTIONS, RULE_REQUIREMENTS } from './applicability.js';
import { scan } from './optimizerEngine.js';
import { activeRules } from './rules/index.js';
import { DEFAULT_OPTIMIZER_CONFIG, type ComponentSource } from './types.js';
import matter from '../frontmatter.js';
import { SUPPORTED_FRAMEWORKS } from '../frameworks.js';

function component(providerId: string, over: Partial<ComponentSource> & { raw: string }): ComponentSource {
    const { data, content } = matter(over.raw);
    return {
        nodeId: `${providerId}::${over.label ?? 'x'}`, nodeType: 'subagent', label: 'x', filePath: 'x.md',
        frontmatter: data, body: content, exists: true, pathKind: 'file', tokenEstimate: 40,
        source: { workspaceUri: 'file:///w', providerId, nativeId: over.label ?? 'x', sourceUri: `file:///w/${over.filePath ?? 'x.md'}` },
        ...over,
    };
}

const rulesOf = (sources: ComponentSource[]) => {
    const report = scan(sources, [], new Set(sources.map(s => s.nodeId)), new Set(sources.map(s => s.filePath)), DEFAULT_OPTIMIZER_CONFIG);
    return report.findings;
};

describe('rule applicability (R1)', () => {
    it('classifies every registered rule', () => {
        expect(Object.keys(RULE_REQUIREMENTS).sort()).toEqual(activeRules([]).map(r => r.id).sort());
        const known = new Set(SUPPORTED_FRAMEWORKS.map(f => f.id));
        for (const provider of Object.keys(PROVIDER_CONVENTIONS)) expect(known.has(provider)).toBe(true);
    });

    it('does not ask a Claude agent to be named after its folder or to add Harness SDD sections', () => {
        const reviewer = component('claude-code', {
            label: 'reviewer', filePath: '.claude/agents/reviewer.md',
            raw: '---\nname: reviewer\ndescription: Review contributions to the native workspace.\n---\nRead changed files before preparing a review.',
        });
        const ids = rulesOf([reviewer]).map(f => f.ruleId);
        expect(ids).not.toContain('OPT-S02');
        expect(ids).not.toContain('OPT-S05');
        expect(applicability('OPT-S02', reviewer)).toMatchObject({ applies: false, reason: expect.stringContaining('nameMatchesDirectory') });
        // Claude Code does document name/description frontmatter for subagents.
        expect(applicability('OPT-S01', reviewer).applies).toBe(true);
    });

    it('runs only shared rules on a custom profile that declares no conventions', () => {
        const guide = component('team-guides', {
            label: 'reviewer', filePath: 'team/agents/reviewer.md', nodeType: 'agent',
            raw: 'Review contributions. No frontmatter here, and none is required.',
        });
        const findings = rulesOf([guide]);
        for (const f of findings) expect(RULE_REQUIREMENTS[f.ruleId]).toEqual({ kind: 'shared' });
        expect(findings.map(f => f.ruleId)).not.toContain('OPT-S01');
    });

    it('still reports a native component that genuinely violates its own convention', () => {
        const skill = component('harness-sdd', {
            label: 'linter', nodeType: 'skill', filePath: '.agents/skills/lint/SKILL.md',
            raw: '---\nname: linter\ndescription: Use when code changes to run the linter.\n---\n## Usage\nRun it.',
        });
        const s02 = rulesOf([skill]).find(f => f.ruleId === 'OPT-S02');
        expect(s02).toBeDefined();
        expect(s02?.source?.providerId).toBe('harness-sdd'); // R4: owner on the finding
    });

    it('never applies a convention to a component without a known owner', () => {
        const orphan = { ...component('x', { raw: 'Text.' }), source: undefined };
        expect(applicability('OPT-S01', orphan).applies).toBe(false);
        expect(applicability('OPT-H01', orphan).applies).toBe(true);
    });
});

describe('FEAT-043 review fixes', () => {
    it('keeps native checks on the Harness SDD primary agent (a SUBAGENT.md typed agent), not on the manifest root', () => {
        const primary = component('harness-sdd', { label: 'harness-vscode', nodeType: 'agent', filePath: '.agents/subagents/harness-vscode/SUBAGENT.md', raw: 'No frontmatter.' });
        const manifest = component('harness-sdd', { label: 'harness', nodeType: 'agent', filePath: '.agents/agentic.json', raw: '{}' });
        expect(applicability('OPT-S01', primary).applies).toBe(true);
        expect(applicability('OPT-S03', primary).applies).toBe(true);
        expect(applicability('OPT-S01', manifest).applies).toBe(false);
        expect(rulesOf([primary]).map(f => f.ruleId)).toContain('OPT-S01');
    });

    it('records a consistency check that cannot calibrate as skipped, not as a perfect score', () => {
        const a = component('claude-code', { label: 'a', nodeId: 'claude-code::a', filePath: '.claude/agents/a.md', raw: '---\nname: a\ndescription: Reviews code changes carefully.\n---\nA.' });
        const b = component('claude-code', { label: 'b', nodeId: 'claude-code::b', filePath: '.claude/agents/b.md', raw: '---\nname: b\ndescription: Writes the documentation pages.\n---\nB.' });
        const report = scan([a, b], [], new Set([a.nodeId, b.nodeId]), new Set([a.filePath, b.filePath]), DEFAULT_OPTIMIZER_CONFIG);
        const comp = report.components[0];
        expect(comp.dimensions.consistency).toBeNull();
        expect(comp.coverage.skipped).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'OPT-C01', reason: expect.stringContaining('needs 3 to calibrate') })]));
    });

    it('offers extract-to-references only in folder-per-component formats', () => {
        const body = '---\nname: x\ndescription: Use when needed for the work at hand.\n---\n## One\na\n## Two\nb\n## Three\nc';
        const flat = component('claude-code', { label: 'x', filePath: '.claude/agents/x.md', raw: body, tokenEstimate: 99999 });
        const folder = component('harness-sdd', { label: 'x', nodeType: 'skill', filePath: '.agents/skills/x/SKILL.md', raw: body, tokenEstimate: 99999 });
        const b02 = (s: ComponentSource) => rulesOf([s]).find(f => f.ruleId === 'OPT-B02');
        expect(b02(flat)?.fix).toBeUndefined();
        expect(b02(folder)?.fix?.type).toBe('extract-to-references');
    });
});
