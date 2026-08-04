import { describe, it, expect } from 'vitest';
import { optH01, optH02, optH03 } from './hygiene.js';
import type { ComponentSource, RuleContext } from '../types.js';
import { DEFAULT_OPTIMIZER_CONFIG } from '../types.js';
import { estimateTokens } from '../tokenEstimator.js';

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

describe('OPT-H01 — absolute paths and machine-specific values (R27)', () => {
    it('flags a /Users/ absolute path with a line number', () => {
        const source = makeSource({ body: 'ok\nSee /Users/marc/project/file.ts for reference.\nmore' });
        const findings = optH01.evaluate(makeCtx(source));
        expect(findings).toHaveLength(1);
        expect(findings[0].line).toBe(2);
    });

    it('attaches a relativize-path fix when the path is inside the workspace root', () => {
        const source = makeSource({ body: 'See /Users/marc/project/src/index.ts here.' });
        const existingPaths = new Set(['src/index.ts']);
        const findings = optH01.evaluate(makeCtx(source, { existingPaths }));
        expect(findings[0].fix?.type).toBe('relativize-path');
        expect(findings[0].fix?.payload.relativePath).toBe('src/index.ts');
    });

    it('attaches no fix when the path cannot be resolved inside the workspace', () => {
        const source = makeSource({ body: 'See /Users/marc/somewhere/else.ts here.' });
        const findings = optH01.evaluate(makeCtx(source, { existingPaths: new Set(['src/index.ts']) }));
        expect(findings[0].fix).toBeUndefined();
    });

    it('does not flag a component with no absolute paths', () => {
        const source = makeSource({ body: 'Nothing machine-specific here.' });
        expect(optH01.evaluate(makeCtx(source))).toHaveLength(0);
    });
});

describe('OPT-H02 — credential-shaped strings (R28)', () => {
    const cases: { name: string; secret: string }[] = [
        { name: 'OpenAI-style', secret: 'sk-abcdEFGH12345678ijklMNOP' },
        { name: 'GitHub PAT', secret: 'ghp_abcdefghijklmnopqrstuvwxyz1234' },
        { name: 'AWS access key', secret: 'AKIAABCDEFGHIJ12KLMN' },
        { name: 'PEM private key', secret: '-----BEGIN RSA PRIVATE KEY-----' },
    ];

    for (const { name, secret } of cases) {
        it(`matches the ${name} pattern`, () => {
            const source = makeSource({ body: `some text\n${secret}\nmore text` });
            const findings = optH02.evaluate(makeCtx(source));
            expect(findings).toHaveLength(1);
            expect(findings[0].severity).toBe('error');
        });

        it(`never reproduces the matched ${name} secret in title or detail`, () => {
            const source = makeSource({ body: `some text\n${secret}\nmore text` });
            const findings = optH02.evaluate(makeCtx(source));
            for (const f of findings) {
                expect(f.title).not.toContain(secret);
                expect(f.detail).not.toContain(secret);
                expect(JSON.stringify(f)).not.toContain(secret);
            }
        });
    }

    it('does not flag a component with no credential-shaped strings', () => {
        const source = makeSource({ body: 'Nothing secret-shaped here, just prose.' });
        expect(optH02.evaluate(makeCtx(source))).toHaveLength(0);
    });

    it('reports multiple matches, one finding per occurrence', () => {
        const source = makeSource({ body: 'sk-abcdEFGH12345678ijklMNOP and also sk-zzzzYYYYxxxxWWWWvvvvUUUU' });
        const findings = optH02.evaluate(makeCtx(source));
        expect(findings).toHaveLength(2);
    });
});

describe('OPT-H03 — vague-quantifier density (R29)', () => {
    it('emits nothing when there are no vague quantifiers', () => {
        const body = 'This document is precise and specific throughout.';
        const source = makeSource({ body, tokenEstimate: estimateTokens(body) });
        expect(optH03.evaluate(makeCtx(source))).toHaveLength(0);
    });

    it('emits nothing just under the density threshold (1 per 150 tokens)', () => {
        const source = makeSource({ body: 'some appropriate content here', tokenEstimate: 150 });
        // 2 occurrences ("some", "appropriate") at tokenEstimate 150 → 2 * 150 = 300 > 150 would trip;
        // use a single occurrence to stay under the boundary.
        const singleOccurrence = makeSource({ body: 'some content here, nothing else vague', tokenEstimate: 150 });
        expect(optH03.evaluate(makeCtx(singleOccurrence))).toHaveLength(0);
    });

    it('emits exactly one aggregate info finding just over the density threshold', () => {
        const source = makeSource({ body: 'some content and various other appropriate things', tokenEstimate: 150 });
        const findings = optH03.evaluate(makeCtx(source));
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe('info');
    });

    it('never emits one finding per occurrence, even with a dozen vague words', () => {
        const body = Array(12).fill('some appropriate thing as needed if necessary').join('. ');
        const source = makeSource({ body, tokenEstimate: estimateTokens(body) });
        const findings = optH03.evaluate(makeCtx(source));
        expect(findings.length).toBeLessThanOrEqual(1);
    });

    it('does not flag a long document with only sparse vague words', () => {
        const preciseSentence = 'The deployment pipeline validates every artifact against a fixed checksum. ';
        const body = preciseSentence.repeat(80) + 'There is some flexibility here.';
        const source = makeSource({ body, tokenEstimate: estimateTokens(body) });
        expect(optH03.evaluate(makeCtx(source))).toHaveLength(0);
    });
});
