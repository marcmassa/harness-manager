// FEAT-046 T3 — item descriptions, Markdown tooltips, order and neutrality (R6–R11).
import { describe, expect, it } from 'vitest';
import { buildFindings, buildSources } from './treeModels.js';
import { findingResourceDescription, findingTooltip, formatTokens, md, providerDescription, providerTooltip, resourceDescription, resourceTooltip } from './treeText.js';
import type { DashboardData } from '../types.js';
import type { OptimizerReport } from '../optimizer/types.js';

const node = (id: string, type: string, providerId = 'team', loadMode?: string) =>
    ({ id, type, label: id, metadata: { _filePath: `team/${id}.md` }, source: { workspaceUri: 'w', providerId, nativeId: id, sourceUri: `file:///w/team/${id}.md`, ...(loadMode ? { loadMode } : {}) } });
const data = (nodes: unknown[]) => ({ graph: { nodes, edges: [] }, milestones: [] }) as unknown as DashboardData;
const report = (extra: Partial<OptimizerReport> = {}) => ({
    ok: true, findings: [], components: [
        { nodeId: 'notes', nodeType: 'skill', label: 'notes', score: 61, tier: 'C', tokenEstimate: 900, findingCount: 2 },
        { nodeId: 'rules', nodeType: 'steering', label: 'rules', score: null, tier: null, tokenEstimate: 12400, findingCount: 0 },
    ],
    cost: { owners: [{ owner: 'team', baseline: 1800, catalog: 600, onDemand: [{ nodeId: 'notes', label: 'notes', tokens: 900 }], unpriced: [{ nodeId: 'x', label: 'x', tokens: 50 }], evaluated: true }], sessionTotal: 2400, unpricedCount: 1, unpricedTokens: 50, money: [] },
    ...extra,
}) as unknown as OptimizerReport;
const label = (id: string) => ({ team: 'Team guides' } as Record<string, string>)[id] ?? id;
const nobody = () => undefined;

describe('token format (R6)', () => {
    it.each([[640, '~640 tok'], [999, '~999 tok'], [999.6, '~1.0k tok'], [1234, '~1.2k tok'], [9_949, '~9.9k tok'], [9_960, '~10k tok'], [12_400, '~12k tok'], [NaN, '~? tok']])('%d → %s', (n, s) => {
        expect(formatTokens(n)).toBe(s);
    });
});

describe('Sources items (R6, R7, R9)', () => {
    const groups = buildSources(data([node('rules', 'steering', 'team', 'always'), node('notes', 'skill', 'team', 'on-trigger'), node('main', 'agent', 'team', 'unknown')]), nobody, label, report());
    const [team] = groups;

    it('orders resources by type, then name', () => {
        expect(team.resources.map(r => r.label)).toEqual(['main', 'notes', 'rules']);
    });

    it('describes type, load mode, tokens and score, leaving out what is unknown or not scored', () => {
        expect(team.resources.map(resourceDescription)).toEqual(['agent', 'skill · on-trigger · ~900 tok · 61', 'steering · always · ~12k tok']);
    });

    it('puts the full detail in the tooltip', () => {
        const tip = resourceTooltip(team.resources[1]);
        for (const part of ['**notes**', md('team/notes.md'), 'Owner: Team guides', 'Type: skill', 'Load mode: on' + md('-') + 'trigger', '~900 tokens', 'Score 61 (C)', '2 findings']) expect(tip).toContain(part);
    });

    it('shows the per-session cost of an evaluated provider and its breakdown', () => {
        expect(providerDescription(team)).toBe('3 resources · ~2.4k tok/session');
        expect(providerTooltip(team)).toContain('Baseline ~1.8k tok · Catalog ~600 tok · On demand ~900 tok · Unpriced ~50 tok');
    });

    it('says when a provider was not evaluated, and shows only the count without a report', () => {
        const unevaluated = report({ cost: { owners: [{ owner: 'team', baseline: 0, catalog: 0, onDemand: [], unpriced: [], evaluated: false }] } as never });
        const [g] = buildSources(data([node('a', 'agent')]), nobody, label, unevaluated);
        expect(providerDescription(g)).toBe('1 resource · cost not evaluated');
        expect(providerTooltip(g)).toContain('no load mode is declared');
        expect(providerDescription(buildSources(data([node('a', 'agent')]), nobody, label)[0])).toBe('1 resource');
    });
});

describe('Findings items (R8, R9)', () => {
    const findings = report({ findings: [
        { ruleId: 'OPT-B01', nodeId: 'notes', nodeType: 'skill', filePath: 'team/notes.md', severity: 'info', dimension: 'budget', title: 'Body exceeds the median', detail: 'd', source: { providerId: 'team' } },
        { ruleId: 'OPT-S04', nodeId: 'notes', nodeType: 'skill', filePath: 'team/notes.md', severity: 'warning', dimension: 'structure', title: 'Description has no trigger', detail: 'Add one.', line: 3, source: { providerId: 'team' } },
        { ruleId: 'OPT-S01', nodeId: 'main', nodeType: 'agent', filePath: 'team/main.md', severity: 'error', dimension: 'structure', title: 'No frontmatter', detail: 'd', source: { providerId: 'team' } },
    ] as never });
    const [team] = buildFindings(findings, null, label, id => ({ name: id, type: id === 'main' ? 'agent' : 'skill' }));

    it('names each resource with its type and finding count, most severe resource first', () => {
        expect(team.resources.map(r => [r.label, r.type, findingResourceDescription(r)])).toEqual([['main', 'agent', '1 finding'], ['notes', 'skill', '2 findings']]);
        expect(team.resources[1].findings.map(f => [f.label, f.ruleId])).toEqual([['Description has no trigger', 'OPT-S04'], ['Body exceeds the median', 'OPT-B01']]);
    });

    it('gives rule, severity, dimension, detail and path with line in the tooltip', () => {
        const tip = findingTooltip(team.resources[1].findings[0]);
        expect(tip).toContain(`${md('OPT-S04')} · warning · structure`);
        expect(tip).toContain(md('Add one.'));
        expect(tip).toContain(`${md('team/notes.md')}:3`);
    });
});

describe('safety and neutrality (R10, R11)', () => {
    it('escapes Markdown from user files so no link or command can be injected', () => {
        const hostile = node('[x](command:workbench.action.terminal.new)', 'agent', 'evil');
        const [g] = buildSources(data([hostile]), nobody, () => '**Evil** <img src=x>');
        const tip = resourceTooltip(g.resources[0]);
        expect(tip).not.toMatch(/(^|[^\\])\[x\]\(/);
        expect(tip).toContain('\\[x\\]\\(command:');
        expect(providerTooltip(g)).toContain('\\*\\*Evil\\*\\* \\<img src=x\\>');
    });

    it('names no framework unless a provider label supplies it', () => {
        const [g] = buildSources(data([node('notes', 'skill', 'team', 'on-trigger')]), nobody, label, report());
        const text = [providerDescription(g), providerTooltip(g), resourceDescription(g.resources[0]), resourceTooltip(g.resources[0])].join('\n');
        expect(text).not.toMatch(/Harness SDD|Claude|Cursor|Copilot|Kiro|Gemini|OpenCode|Windsurf/);
    });
});
