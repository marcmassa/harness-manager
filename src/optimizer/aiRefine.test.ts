import { describe, it, expect } from 'vitest';
import { buildRefinePrompt, normalizeRefineResponse } from './aiRefine.js';
import type { ComponentSource, OptimizerFinding } from './types.js';

function src(over: Partial<ComponentSource> = {}): ComponentSource {
    return {
        nodeId: 'my-skill',
        nodeType: 'skill',
        label: 'my-skill',
        filePath: '.agents/skills/my-skill/SKILL.md',
        raw: '---\nname: my-skill\ndescription: does a thing\n---\n\n## Usage\ntext\n',
        frontmatter: { name: 'my-skill', description: 'does a thing' },
        body: '\n## Usage\ntext\n',
        exists: true,
        pathKind: 'file' as const,
        tokenEstimate: 40,
        ...over,
    };
}

function finding(over: Partial<OptimizerFinding> = {}): OptimizerFinding {
    return {
        ruleId: 'OPT-B01',
        nodeId: 'my-skill',
        nodeType: 'skill',
        filePath: '.agents/skills/my-skill/SKILL.md',
        severity: 'info',
        dimension: 'budget',
        title: 'Component is unusually large for this workspace',
        detail: 'Estimated 4000 tokens, over 2500.',
        ...over,
    };
}

describe('buildRefinePrompt — R8', () => {
    it('is deterministic for the same input', () => {
        const input = { source: src(), finding: finding() };
        expect(buildRefinePrompt(input)).toBe(buildRefinePrompt(input));
    });

    it('carries the file path, node type, rule id, title, detail and full content', () => {
        const prompt = buildRefinePrompt({ source: src(), finding: finding() });
        expect(prompt).toContain('.agents/skills/my-skill/SKILL.md');
        expect(prompt).toContain('skill');
        expect(prompt).toContain('OPT-B01');
        expect(prompt).toContain('Component is unusually large');
        expect(prompt).toContain('Estimated 4000 tokens');
        expect(prompt).toContain('description: does a thing');
    });

    it('asks for the complete file, not a patch', () => {
        const prompt = buildRefinePrompt({ source: src(), finding: finding() });
        expect(prompt).toContain('COMPLETE corrected file');
    });

    it('never includes another component content or path — R28', () => {
        // The prompt is built from one source; assert nothing else can leak in
        // by checking the only path present is the component's own.
        const prompt = buildRefinePrompt({ source: src(), finding: finding() });
        const paths = prompt.match(/\.agents\/skills\/[\w-]+\//g) ?? [];
        expect(new Set(paths).size).toBe(1);
        expect(prompt).not.toContain('other-skill');
    });
});

describe('normalizeRefineResponse — R9 fence stripping', () => {
    const body = '---\nname: my-skill\ndescription: does a thing\n---\n\n## Usage\ntext\n';

    it('accepts content with no fence', () => {
        const out = normalizeRefineResponse(body, src());
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.content).toBe(body.trim());
    });

    it('strips a bare fence', () => {
        const out = normalizeRefineResponse('```\n' + body + '```', src());
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.content).toContain('name: my-skill');
        if (out.ok) expect(out.content).not.toContain('```');
    });

    it('strips a language-tagged fence', () => {
        const out = normalizeRefineResponse('```markdown\n' + body + '```', src());
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.content).not.toContain('```');
    });

    it('leaves an unbalanced fence alone rather than mangling content', () => {
        const raw = '```\n' + body;
        const out = normalizeRefineResponse(raw, src());
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.content).toBe(raw.trim());
    });

    it('preserves fences that are part of the content', () => {
        const withCode = '---\nname: my-skill\n---\n\n## Usage\n\n```bash\nls -la\n```\n';
        const out = normalizeRefineResponse(withCode, src());
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.content).toContain('```bash');
    });

    it('rejects an empty response', () => {
        for (const empty of ['', '   \n  ', '```\n```']) {
            const out = normalizeRefineResponse(empty, src());
            expect(out.ok).toBe(false);
            if (!out.ok) expect(out.reason).toMatch(/no content/i);
        }
    });
});

describe('normalizeRefineResponse — R11 frontmatter integrity', () => {
    it('warns but still accepts when a frontmatter key is dropped', () => {
        const out = normalizeRefineResponse('---\nname: my-skill\n---\n\nbody\n', src());
        expect(out.ok).toBe(true);
        if (out.ok) {
            expect(out.warnings).toHaveLength(1);
            expect(out.warnings[0]).toContain('description');
        }
    });

    it('warns when frontmatter disappears entirely', () => {
        const out = normalizeRefineResponse('# Just a heading\n\nbody\n', src());
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.warnings[0]).toMatch(/no YAML frontmatter/i);
    });

    it('is silent when frontmatter is preserved', () => {
        const out = normalizeRefineResponse(src().raw, src());
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.warnings).toEqual([]);
    });

    it('does not warn about keys the model ADDED', () => {
        const out = normalizeRefineResponse(
            '---\nname: my-skill\ndescription: does a thing\nlicense: MIT\n---\n\nbody\n',
            src(),
        );
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.warnings).toEqual([]);
    });

    it('does not warn when the original had no frontmatter to lose', () => {
        const bare = src({ frontmatter: {}, raw: '# heading\n' });
        const out = normalizeRefineResponse('# heading\n\nmore\n', bare);
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.warnings).toEqual([]);
    });
});
