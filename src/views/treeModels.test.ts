// FEAT-045 T3 — Sources and Findings view models and menus (R1–R4, R7).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFindings, buildSources, errorCount } from './treeModels.js';
import { md, resourceTooltip } from './treeText.js';
import type { DashboardData } from '../types.js';
import type { OptimizerReport } from '../optimizer/types.js';
import type { AgenticProfile } from '../agentic-detector/types.js';

const label = (id: string) => ({ 'claude-code': 'Claude Code', 'harness-sdd': 'Harness' } as Record<string, string>)[id] ?? id;
const node = (id: string, providerId: string, filePath: string, type = 'agent') =>
    ({ id, type, label: id, metadata: { _filePath: filePath }, source: { workspaceUri: 'w', providerId, nativeId: id, sourceUri: `file:///w/${filePath}`, loadMode: 'always' as const } });

describe('Sources (R2, R4)', () => {
    const data = { graph: { nodes: [node('b', 'claude-code', 'CLAUDE.md'), node('a', 'claude-code', '.claude/agents/r.md', 'subagent'), node('s', 'harness-sdd', '.agents/skills/x/SKILL.md', 'skill'), { id: 'orphan', type: 'agent', label: 'o', metadata: {} }], edges: [] }, milestones: [], errors: [] } as unknown as DashboardData;
    const describe_ = (id: string) => id === 'a' ? {
        providerId: 'claude-code', providerLabel: 'Claude Code', nativePath: '.claude/agents/r.md',
        capabilities: { discovery: 'supported', hooks: 'partial', steering: 'partial', commands: 'unsupported', agentRuns: 'partial', editing: 'partial', validation: 'unsupported' },
        operations: [{ op: 'editing.deleteEntity', label: 'Delete', available: false, reason: 'Claude Code resources are read-only for "Delete".' }],
    } as never : undefined;

    it('lists each provider with its resources, native path, type and load mode', () => {
        const groups = buildSources(data, describe_, label);
        // FEAT-046 R9: by type (agent before subagent), then name.
        expect(groups.map(g => [g.label, g.resources.map(r => r.nativePath)])).toEqual([
            ['Claude Code', ['CLAUDE.md', '.claude/agents/r.md']],
            ['Harness', ['.agents/skills/x/SKILL.md']],
        ]);
        expect(groups[0].resources[1]).toMatchObject({ type: 'subagent', loadMode: 'always', sourceUri: 'file:///w/.claude/agents/r.md' });
    });

    it('puts capability levels and denied operations with their reasons in the tooltip', () => {
        const tip = resourceTooltip(buildSources(data, describe_, label)[0].resources[1]);
        expect(tip).toContain('Owner: Claude Code');
        expect(tip).toContain(md('.claude/agents/r.md'));
        expect(tip).toContain('Editing partial · Agent runs partial');
        expect(tip).toContain(`Not available — Delete: ${md('Claude Code resources are read-only for "Delete".')}`);
    });
});

describe('Findings (R3)', () => {
    const report = { ok: true, findings: [
        { ruleId: 'OPT-S01', nodeId: 'a', nodeType: 'skill', filePath: 'a.md', severity: 'error', dimension: 'structure', title: 'No frontmatter', detail: 'd', line: 3, source: { workspaceUri: 'w', providerId: 'harness-sdd', nativeId: 'a', sourceUri: 'file:///w/a.md' } },
        { ruleId: 'OPT-H01', nodeId: 'a', nodeType: 'skill', filePath: 'a.md', severity: 'warning', dimension: 'hygiene', title: 'Path', detail: 'd', source: { workspaceUri: 'w', providerId: 'harness-sdd', nativeId: 'a' } },
    ] } as unknown as OptimizerReport;
    const profile = { dismissedSuggestionIds: ['gone'], suggestions: [
        { id: 'use-skill-files', title: 'Add skills', description: 'd', impact: 'medium', scope: { kind: 'workspace' } },
        { id: 'gone', title: 'Dismissed', description: 'd', impact: 'high', scope: { kind: 'workspace' } },
    ] } as unknown as AgenticProfile;

    it('groups findings by owner and resource, workspace-wide last, without dismissed ones', () => {
        const groups = buildFindings(report, profile, label);
        expect(groups.map(g => g.label)).toEqual(['Harness', 'Workspace-wide']);
        expect(groups[0].resources[0]).toMatchObject({ label: 'a.md', findings: [{ severity: 'error', line: 3, sourceUri: 'file:///w/a.md' }, { severity: 'warning' }] });
        expect(groups[1].resources[0].findings.map(f => f.label)).toEqual(['Add skills']);
    });

    it('puts an evidenced Advisory suggestion under its resource, beside that resource\'s Optimizer findings', () => {
        const evidenced = { dismissedSuggestionIds: [], suggestions: [
            { id: 's1', title: 'Describe the skill', description: 'd', impact: 'high', scope: { kind: 'provider', providerId: 'harness-sdd' }, evidence: [{ providerId: 'harness-sdd', nodeId: 'a', sourceUri: 'file:///w/a.md' }] },
            { id: 's2', title: 'Name the agent', description: 'd', impact: 'low', scope: { kind: 'provider', providerId: 'harness-sdd' }, evidence: [{ providerId: 'harness-sdd', nodeId: 'b', sourceUri: 'file:///w/agents/b.md' }] },
        ] } as unknown as AgenticProfile;
        const [harness] = buildFindings(report, evidenced, label);
        expect(harness.resources.map(r => r.label)).toEqual(['a.md', 'agents/b.md']);
        // FEAT-046 R8, R9: title as label, rule id kept; most severe first, then by title.
        expect(harness.resources[0].findings.map(f => [f.label, f.ruleId])).toEqual([['No frontmatter', 'OPT-S01'], ['Describe the skill', 's1'], ['Path', 'OPT-H01']]);
    });

    it('counts error findings for the badge, and none at zero', () => {
        expect(errorCount(buildFindings(report, profile, label))).toBe(1);
        expect(errorCount(buildFindings(null, null, label))).toBe(0);
    });
});

describe('views and menus in the manifest (R1, R4, R7)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const views: Array<{ id: string; type?: string; icon?: string }> = pkg.contributes.views['harness-dashboard'];
    const menus = pkg.contributes.menus;

    it('contributes the Sources and Findings tree views with icons', () => {
        for (const id of ['harness-dashboard.sources', 'harness-dashboard.findings']) {
            const v = views.find(x => x.id === id);
            expect(v?.type ?? 'tree').toBe('tree');
            expect(v?.icon).toBeTruthy();
        }
    });

    it('offers at most three title actions per view and three actions per item', () => {
        for (const view of ['harness-dashboard.sources', 'harness-dashboard.findings']) {
            const title = menus['view/title'].filter((m: { when: string }) => m.when.includes(view));
            // R7: icon actions are the navigation group; settings and local configuration sit in the overflow.
            expect(title.filter((m: { group: string }) => m.group.startsWith('navigation')).length).toBeLessThanOrEqual(3);
        }
        const overflow = menus['view/title'].filter((m: { group: string; when: string }) => !m.group.startsWith('navigation') && m.when.includes('harness-dashboard.sources')).map((m: { command: string }) => m.command);
        expect(overflow).toEqual(expect.arrayContaining(['harness-dashboard.openSettings', 'harness-dashboard.openLocalConfig']));
        for (const kind of ['resource', 'finding']) {
            expect(menus['view/item/context'].filter((m: { when: string }) => m.when.includes(`viewItem == ${kind}`)).length).toBeLessThanOrEqual(3);
        }
    });
});
