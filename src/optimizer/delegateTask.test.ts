import { describe, it, expect } from 'vitest';
import { buildDelegateTask } from './delegateTask.js';
import type { OptimizerFinding } from './types.js';

function f(over: Partial<OptimizerFinding> = {}): OptimizerFinding {
    return {
        ruleId: 'OPT-S01',
        nodeId: 'skill-a',
        nodeType: 'skill',
        filePath: '.agents/skills/skill-a/SKILL.md',
        severity: 'error',
        dimension: 'structure',
        title: 'Missing frontmatter',
        detail: 'The file has no YAML frontmatter block.',
        ...over,
    };
}

describe('buildDelegateTask — single finding (R15)', () => {
    it('names the file, the rule and the detail', () => {
        const t = buildDelegateTask({ kind: 'finding', finding: f() });
        expect(t.text).toContain('.agents/skills/skill-a/SKILL.md');
        expect(t.text).toContain('OPT-S01');
        expect(t.text).toContain('no YAML frontmatter block');
        expect(t.filePaths).toEqual(['.agents/skills/skill-a/SKILL.md']);
        expect(t.componentCount).toBe(1);
    });

    it('constrains the agent to the listed files', () => {
        const t = buildDelegateTask({ kind: 'finding', finding: f() });
        expect(t.text).toContain('Change ONLY these files');
        expect(t.text).toContain('Do not modify any other file');
    });

    it('includes the line number when the finding has one', () => {
        const t = buildDelegateTask({ kind: 'finding', finding: f({ line: 42 }) });
        expect(t.text).toContain('line 42');
    });

    it('omits the line clause when there is none', () => {
        const t = buildDelegateTask({ kind: 'finding', finding: f() });
        expect(t.text).not.toContain('line ');
    });
});

describe('buildDelegateTask — component scope (R3)', () => {
    it('lists every finding but the file only once', () => {
        const t = buildDelegateTask({
            kind: 'component',
            nodeId: 'skill-a',
            findings: [f(), f({ ruleId: 'OPT-S03', title: 'Description too short' })],
        });
        expect(t.filePaths).toHaveLength(1);
        expect(t.componentCount).toBe(1);
        expect(t.text).toContain('OPT-S01');
        expect(t.text).toContain('OPT-S03');
        expect(t.text).toContain('2 issues');
    });

    it('uses the singular for a single issue', () => {
        const t = buildDelegateTask({ kind: 'component', nodeId: 'skill-a', findings: [f()] });
        expect(t.text).toContain('1 issue ');
    });
});

describe('buildDelegateTask — rule batch scope (R3, R20)', () => {
    const batch = [
        f({ nodeId: 'a', filePath: 'skills/a/SKILL.md' }),
        f({ nodeId: 'b', filePath: 'skills/b/SKILL.md' }),
        f({ nodeId: 'c', filePath: 'skills/c/SKILL.md' }),
    ];

    it('counts distinct components, not findings', () => {
        // Two findings on the same component must count as one component: the
        // R20 cap is about how much of the architecture an agent may rewrite.
        const t = buildDelegateTask({
            kind: 'rule',
            ruleId: 'OPT-S01',
            findings: [...batch, f({ nodeId: 'a', filePath: 'skills/a/SKILL.md', ruleId: 'OPT-S01', title: 'again' })],
        });
        expect(t.componentCount).toBe(3);
        expect(t.filePaths).toHaveLength(3);
    });

    it('lists each distinct path once', () => {
        const t = buildDelegateTask({ kind: 'rule', ruleId: 'OPT-S01', findings: batch });
        const listed = t.text.split('Change ONLY these files:')[1];
        expect((listed.match(/skills\/a\/SKILL\.md/g) ?? [])).toHaveLength(1);
    });

    it('names the rule and the component count in the heading', () => {
        const t = buildDelegateTask({ kind: 'rule', ruleId: 'OPT-S01', findings: batch });
        expect(t.text).toContain('OPT-S01');
        expect(t.text).toContain('3 components');
    });

    it('deduplicates the rule list when a batch spans several rules', () => {
        const t = buildDelegateTask({
            kind: 'component',
            nodeId: 'a',
            findings: [f(), f(), f({ ruleId: 'OPT-S03' })],
        });
        const rulesLine = t.text.split('\n').find(l => l.startsWith('Rules involved:'))!;
        expect(rulesLine).toBe('Rules involved: OPT-S01, OPT-S03');
    });
});

describe('buildDelegateTask — robustness', () => {
    it('drops empty file paths rather than emitting a blank bullet', () => {
        const t = buildDelegateTask({
            kind: 'component',
            nodeId: 'ghost',
            findings: [f({ filePath: '' })],
        });
        expect(t.filePaths).toEqual([]);
        expect(t.text).not.toMatch(/^- $/m);
    });

    it('is deterministic', () => {
        const scope = { kind: 'rule' as const, ruleId: 'OPT-S01', findings: batchFixture() };
        expect(buildDelegateTask(scope).text).toBe(buildDelegateTask(scope).text);
    });
});

function batchFixture(): OptimizerFinding[] {
    return [
        f({ nodeId: 'a', filePath: 'skills/a/SKILL.md' }),
        f({ nodeId: 'b', filePath: 'skills/b/SKILL.md' }),
    ];
}
