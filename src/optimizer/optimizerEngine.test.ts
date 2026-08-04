import { describe, it, expect } from 'vitest';
import { scan, MAX_OPTIMIZABLE_COMPONENTS } from './optimizerEngine.js';
import { DEFAULT_OPTIMIZER_CONFIG } from './types.js';
import type { ComponentSource, OptimizerRule } from './types.js';

function makeSource(overrides: Partial<ComponentSource>): ComponentSource {
    return {
        nodeId: 'x',
        nodeType: 'skill',
        label: 'x',
        filePath: 'skills/x/SKILL.md',
        raw: '',
        frontmatter: { name: 'x', description: 'A description that is definitely long enough to pass.' },
        body: '## Usage\n\nDo the thing.',
        exists: true,
        pathKind: 'file' as const,
        tokenEstimate: 10,
        ...overrides,
    };
}

describe('optimizerEngine.scan — R5 scan scope cap', () => {
    it('caps analysis at 500 components, marks truncated, and records the true total', () => {
        const sources = Array.from({ length: 650 }, (_, i) =>
            makeSource({ nodeId: `skill-${i}`, filePath: `skills/skill-${i}/SKILL.md` }),
        );
        const report = scan(sources, [], new Set(sources.map(s => s.nodeId)), new Set(), DEFAULT_OPTIMIZER_CONFIG);
        expect(report.ok).toBe(true);
        expect(report.truncated).toBe(true);
        expect(report.totalComponents).toBe(650);
        expect(report.components).toHaveLength(MAX_OPTIMIZABLE_COMPONENTS);
    });

    it('does not truncate at exactly 500', () => {
        const sources = Array.from({ length: 500 }, (_, i) => makeSource({ nodeId: `skill-${i}` }));
        const report = scan(sources, [], new Set(), new Set(), DEFAULT_OPTIMIZER_CONFIG);
        expect(report.truncated).toBe(false);
        expect(report.totalComponents).toBe(500);
    });
});

describe('optimizerEngine.scan — R30 rule disablement', () => {
    it('removes both the findings and their score contribution for a disabled rule', () => {
        // A component that is otherwise clean structurally/budget/integration-wise,
        // but has exactly one absolute path in its body (triggers only OPT-H01).
        const withAbsPath = makeSource({ nodeId: 's1', body: '## Usage\n\nSee /Users/marc/project/file.ts.' });

        const configEnabled = { ...DEFAULT_OPTIMIZER_CONFIG, disabledRules: [] };
        const enabled = scan([withAbsPath], [], new Set(['s1']), new Set(), configEnabled);
        expect(enabled.findings.some(f => f.ruleId === 'OPT-H01')).toBe(true);
        expect(enabled.components[0].dimensions.hygiene).toBeLessThan(100);

        const configDisabled = { ...DEFAULT_OPTIMIZER_CONFIG, disabledRules: ['OPT-H01'] };
        const disabled = scan([withAbsPath], [], new Set(['s1']), new Set(), configDisabled);
        expect(disabled.findings.some(f => f.ruleId === 'OPT-H01')).toBe(false);
        expect(disabled.components[0].dimensions.hygiene).toBe(100);
    });
});

describe('optimizerEngine.scan — R53 a throwing rule is contained', () => {
    it('does not abort the scan or other rules when one rule throws', () => {
        const throwingRule: OptimizerRule = {
            id: 'OPT-S99',
            appliesTo: ['skill'],
            dimension: 'structure',
            defaultSeverity: 'error',
            evaluate() {
                throw new Error('boom');
            },
        };
        const okRule: OptimizerRule = {
            id: 'OPT-S98',
            appliesTo: ['skill'],
            dimension: 'hygiene',
            defaultSeverity: 'info',
            evaluate(ctx) {
                return [{
                    ruleId: 'OPT-S98',
                    nodeId: ctx.source.nodeId,
                    nodeType: ctx.source.nodeType,
                    filePath: ctx.source.filePath,
                    severity: 'info',
                    dimension: 'hygiene',
                    title: 'ok',
                    detail: 'ok',
                }];
            },
        };
        const source = makeSource({ nodeId: 's1' });
        const report = scan(
            [source], [], new Set(['s1']), new Set(), DEFAULT_OPTIMIZER_CONFIG, new Set(), [throwingRule, okRule],
        );
        expect(report.ok).toBe(true);
        expect(report.findings.some(f => f.ruleId === 'OPT-S98')).toBe(true);
    });

    it('returns ok:false when the whole scan fails unexpectedly', () => {
        // Force a top-level failure: `sources` is not array-like at runtime.
        const report = scan(
            null as unknown as ComponentSource[], [], new Set(), new Set(), DEFAULT_OPTIMIZER_CONFIG,
        );
        expect(report.ok).toBe(false);
        expect(report.error).toBeTruthy();
    });
});

describe('optimizerEngine.scan — R43 dismissed findings', () => {
    it('excludes dismissed findings from the report and from score computation', () => {
        const withAbsPath = makeSource({ nodeId: 's1', body: '## Usage\n\nSee /Users/marc/project/file.ts.' });
        const withoutDismissal = scan([withAbsPath], [], new Set(['s1']), new Set(), DEFAULT_OPTIMIZER_CONFIG);
        const dismissedKey = 'OPT-H01::s1';
        const withDismissal = scan(
            [withAbsPath], [], new Set(['s1']), new Set(), DEFAULT_OPTIMIZER_CONFIG, new Set([dismissedKey]),
        );

        expect(withoutDismissal.findings.some(f => f.ruleId === 'OPT-H01')).toBe(true);
        expect(withDismissal.findings.some(f => f.ruleId === 'OPT-H01')).toBe(false);
        expect(withDismissal.dismissedCount).toBe(1);
        expect(withDismissal.components[0].dimensions.hygiene).toBe(100);
    });
});

describe('optimizerEngine.scan — determinism (R10)', () => {
    it('produces identical reports (minus scanTimestamp) across two runs', () => {
        const sources = [
            makeSource({ nodeId: 's1' }),
            makeSource({ nodeId: 's2', frontmatter: {} }),
            makeSource({ nodeId: 's3', nodeType: 'subagent', filePath: 'subagents/s3/SUBAGENT.md', body: '## Role\n\nDoes things.' }),
        ];
        const nodeIds = new Set(sources.map(s => s.nodeId));
        const run1 = scan(sources, [], nodeIds, new Set(), DEFAULT_OPTIMIZER_CONFIG);
        const run2 = scan(sources, [], nodeIds, new Set(), DEFAULT_OPTIMIZER_CONFIG);

        const { scanTimestamp: _t1, ...rest1 } = run1;
        const { scanTimestamp: _t2, ...rest2 } = run2;
        expect(rest1).toEqual(rest2);
    });
});

describe('optimizerEngine.scan — R52 performance budget', () => {
    it('scans 100 pre-loaded ~2KB components in under 1000ms', () => {
        const bodyChunk = 'This is a moderately detailed paragraph describing behaviour. '.repeat(30); // ~2KB
        const sources = Array.from({ length: 100 }, (_, i) =>
            makeSource({
                nodeId: `skill-${i}`,
                filePath: `skills/skill-${i}/SKILL.md`,
                body: `## Usage\n\n${bodyChunk}`,
                raw: `---\nname: skill-${i}\ndescription: Use when doing task ${i} for the project.\n---\n## Usage\n\n${bodyChunk}`,
                tokenEstimate: Math.ceil(bodyChunk.length / 4),
            }),
        );
        const nodeIds = new Set(sources.map(s => s.nodeId));
        const start = performance.now();
        const report = scan(sources, [], nodeIds, new Set(), DEFAULT_OPTIMIZER_CONFIG);
        const elapsed = performance.now() - start;

        expect(report.ok).toBe(true);
        expect(elapsed).toBeLessThan(1000);
    });
});
