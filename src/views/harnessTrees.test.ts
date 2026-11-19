// FEAT-046 T4 — rendering: Dashboard entry, icons, severity colours, safe tooltips (R4, R5, R10).
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('vscode', () => {
    class TreeItem { constructor(public label: string, public collapsibleState: number) {} [k: string]: unknown }
    class MarkdownString { isTrusted?: boolean; constructor(public value: string, public supportThemeIcons?: boolean) {} }
    class ThemeIcon { constructor(public id: string, public color?: unknown) {} }
    class ThemeColor { constructor(public id: string) {} }
    return {
        TreeItem, MarkdownString, ThemeIcon, ThemeColor,
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        Uri: { joinPath: (b: { path: string }, ...p: string[]) => ({ path: [b.path, ...p].join('/') }) },
        EventEmitter: class { event = () => undefined; fire() {} },
    };
});

const { sourcesNodes, findingNodes } = await import('./harnessTrees.js');
const { iconPath } = await import('./treeIcons.js');
const icon = (name: string) => iconPath({ path: '/ext' } as never, name as never);

const resource = (label: string, type: string) => ({ nodeId: label, label, type, sourceUri: `file:///w/${label}.md`, denied: [] });
const sources = [{ providerId: 'team', label: 'Team guides', resources: [resource('main', 'agent'), resource('reviewer', 'subagent'), resource('notes', 'skill'), resource('rules', 'steering'), resource('pre', 'hook'), resource('odd', 'mystery')] }];
const findings = [{ owner: 'team', label: 'Team guides', resources: [{ key: 'notes', label: 'notes', type: 'skill', findings: [
    { id: '1', label: 'No frontmatter', ruleId: 'OPT-S01', severity: 'error', detail: 'd' },
    { id: '2', label: 'No trigger', ruleId: 'OPT-S04', severity: 'warning', detail: 'd' },
    { id: '3', label: 'Large', ruleId: 'OPT-B01', severity: 'info', detail: 'd' },
] }] }];

describe('Dashboard entry (R5)', () => {
    it('is the first Sources item and opens the Dashboard', () => {
        const [first] = sourcesNodes(sources as never, icon);
        expect(first.item.label).toBe('Open Dashboard');
        expect(first.item.command).toMatchObject({ command: 'harness-dashboard.openDashboard', arguments: [] });
        expect(first.item.iconPath).toEqual(icon('dashboard'));
    });

    it('is the first Findings item and opens the Advisory tab', () => {
        const [first] = findingNodes(findings as never, icon);
        expect(first.item.command).toMatchObject({ command: 'harness-dashboard.openDashboard', arguments: ['advisory'] });
    });

    it('is absent while a view has no data, so the welcome content shows', () => {
        expect(sourcesNodes([], icon)).toEqual([]);
        expect(findingNodes([], icon)).toEqual([]);
    });

    it('is a title action on both views with the Dashboard icon', () => {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
        const action = pkg.contributes.menus['view/title'].find((m: { command: string }) => m.command === 'harness-dashboard.openDashboard');
        expect(action.when).toContain('view == harness-dashboard.sources');
        expect(action.when).toContain('view == harness-dashboard.findings');
        const cmd = pkg.contributes.commands.find((c: { command: string }) => c.command === 'harness-dashboard.openDashboard');
        expect(cmd.icon).toEqual({ light: 'dist/icons/dashboard-light.svg', dark: 'dist/icons/dashboard-dark.svg' });
    });
});

describe('icons (R1, R4)', () => {
    it('gives providers and each resource type their icon, unknown types a document', () => {
        const [, group] = sourcesNodes(sources as never, icon);
        expect(group.item.iconPath).toEqual(icon('provider'));
        expect(group.children!.map(c => (c.item.iconPath as { light: { path: string } }).light.path.split('/').pop()))
            .toEqual(['agent-light.svg', 'subagent-light.svg', 'skill-light.svg', 'steering-light.svg', 'hook-light.svg', 'document-light.svg']);
    });

    it('colours finding severities like the Problems view, with the resource type icon above them', () => {
        const [, owner] = findingNodes(findings as never, icon);
        const res = owner.children![0];
        expect(res.item.iconPath).toEqual(icon('skill'));
        expect(res.children!.map(f => [(f.item.iconPath as { id: string }).id, (f.item.iconPath as { color: { id: string } }).color.id])).toEqual([
            ['error', 'problemsErrorIcon.foreground'], ['warning', 'problemsWarningIcon.foreground'], ['info', 'problemsInfoIcon.foreground']]);
        expect(res.children!.map(f => [f.item.label, f.item.description])).toEqual([['No frontmatter', 'OPT-S01'], ['No trigger', 'OPT-S04'], ['Large', 'OPT-B01']]);
    });
});

describe('accessibility and safety (R10)', () => {
    it('labels every item with its type and name, and never trusts a tooltip', () => {
        const all = [...sourcesNodes(sources as never, icon), ...findingNodes(findings as never, icon)];
        const walk = (nodes: typeof all): typeof all => nodes.flatMap(n => [n, ...walk(n.children ?? [])]);
        for (const n of walk(all)) {
            expect((n.item.accessibilityInformation as { label: string })?.label, String(n.item.label)).toBeTruthy();
            const tip = n.item.tooltip as { isTrusted?: boolean } | string | undefined;
            if (tip && typeof tip !== 'string') expect(tip.isTrusted).toBe(false);
        }
        const [, group] = sourcesNodes(sources as never, icon);
        expect((group.children![1].item.accessibilityInformation as { label: string }).label).toMatch(/^subagent reviewer/);
    });
});
