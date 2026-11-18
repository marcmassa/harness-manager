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
