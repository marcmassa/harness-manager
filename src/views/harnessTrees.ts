// FEAT-045 T3, FEAT-046 T4 — the Sources and Findings tree views.
// Selecting an item opens its native source; other operations are menu
// actions (package.json). Visibility drives the scan scheduler.
import * as vscode from 'vscode';
import type { DashboardData } from '../types.js';
import type { ResourceOwnership } from '../operations/operationGate.js';
import type { OptimizerReport } from '../optimizer/types.js';
import type { AgenticProfile } from '../agentic-detector/types.js';
import { iconForType, type TreeIconName } from '../shared/typeIcons.js';
import { buildFindings, buildSources, errorCount, type FindingGroup, type ProviderGroup } from './treeModels.js';
import { findingResourceDescription, findingTooltip, providerDescription, providerTooltip, resourceDescription, resourceTooltip } from './treeText.js';
import { iconPath } from './treeIcons.js';

export const SOURCES_VIEW_ID = 'harness-dashboard.sources';
export const FINDINGS_VIEW_ID = 'harness-dashboard.findings';
export const OPEN_SOURCE_COMMAND = 'harness-dashboard.openSource';
export const OPEN_DASHBOARD_COMMAND = 'harness-dashboard.openDashboard';

type Node = { kind: 'dashboard' | 'group' | 'resource' | 'finding'; item: vscode.TreeItem; children?: Node[] };

/** R4: severity icons coloured like the Problems view. */
const SEVERITY_ICON: Record<string, [string, string]> = {
    error: ['error', 'problemsErrorIcon.foreground'],
    warning: ['warning', 'problemsWarningIcon.foreground'],
    info: ['info', 'problemsInfoIcon.foreground'],
};

/** R10: Markdown, never trusted, so no command link runs; no theme icons, so `$(…)` in a file name stays text. */
function tooltip(text: string): vscode.MarkdownString {
    const m = new vscode.MarkdownString(text, false);
    m.isTrusted = false;
    return m;
}

function openCommand(sourceUri: string | undefined, line?: number): vscode.Command | undefined {
    return sourceUri ? { command: OPEN_SOURCE_COMMAND, title: 'Open source', arguments: [sourceUri, line] } : undefined;
}

class Tree implements vscode.TreeDataProvider<Node> {
    private readonly emitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeTreeData = this.emitter.event;
    private roots: Node[] = [];
    public constructor(private readonly build: () => Node[]) {}
    public refresh(): void { this.roots = this.build(); this.emitter.fire(); }
    public getTreeItem(node: Node): vscode.TreeItem { return node.item; }
    public getChildren(node?: Node): Node[] { return node ? node.children ?? [] : this.roots; }
}

export interface HarnessViewsDeps {
    context: vscode.ExtensionContext;
    getData(): DashboardData | null;
    describe(nodeId: string): ResourceOwnership | undefined;
    providerLabel(id: string): string;
    getReport(): OptimizerReport | null;
    getProfile(): AgenticProfile | null;
    onVisible(surface: string, visible: boolean): void;
}

export interface HarnessViews { refresh(): void }

/** R5: the first item of a view with data — the Dashboard, on `tab` when given. */
function dashboardEntry(icon: (name: TreeIconName) => vscode.TreeItem['iconPath'], tab?: string): Node {
    const item = new vscode.TreeItem('Open Dashboard', vscode.TreeItemCollapsibleState.None);
    item.iconPath = icon('dashboard');
    item.description = tab === 'advisory' ? 'Advisory and Optimizer' : 'whiteboard, Advisory, Optimizer';
    item.tooltip = 'Open the Harness Dashboard in an editor tab';
    item.command = { command: OPEN_DASHBOARD_COMMAND, title: 'Open Dashboard', arguments: tab ? [tab] : [] };
    item.contextValue = 'dashboard';
    item.accessibilityInformation = { label: 'Open Dashboard' };
    return { kind: 'dashboard', item };
}

export function sourcesNodes(groups: ProviderGroup[], icon: (name: TreeIconName) => vscode.TreeItem['iconPath']): Node[] {
    if (groups.length === 0) return [];
    return [dashboardEntry(icon), ...groups.map(g => {
        const item = new vscode.TreeItem(g.label, vscode.TreeItemCollapsibleState.Expanded);
        item.description = providerDescription(g);
        item.tooltip = tooltip(providerTooltip(g));
        item.iconPath = icon('provider');
        item.contextValue = 'provider';
        item.accessibilityInformation = { label: `Provider ${g.label}, ${item.description}` };
        return {
            kind: 'group' as const, item, children: g.resources.map(r => {
                const res = new vscode.TreeItem(r.label, vscode.TreeItemCollapsibleState.None);
                res.description = resourceDescription(r);
                res.tooltip = tooltip(resourceTooltip(r));
                res.iconPath = icon(iconForType(r.type));
                res.command = openCommand(r.sourceUri);
                res.contextValue = 'resource';
                res.accessibilityInformation = { label: `${r.type} ${r.label}, ${res.description}` };
                return { kind: 'resource' as const, item: res };
            }),
        };
    })];
}

export function findingNodes(groups: FindingGroup[], icon: (name: TreeIconName) => vscode.TreeItem['iconPath']): Node[] {
    if (groups.length === 0) return [];
    return [dashboardEntry(icon, 'advisory'), ...groups.map(g => {
        const item = new vscode.TreeItem(g.label, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = icon('provider');
        item.contextValue = 'owner';
        item.accessibilityInformation = { label: `Findings for ${g.label}` };
        return {
            kind: 'group' as const, item, children: g.resources.map(r => {
                const res = new vscode.TreeItem(r.label, vscode.TreeItemCollapsibleState.Expanded);
                res.description = findingResourceDescription(r);
                res.iconPath = icon(iconForType(r.type ?? ''));
                res.contextValue = 'findingResource';
                res.accessibilityInformation = { label: `${r.type ?? 'resource'} ${r.label}, ${res.description}` };
                return {
                    kind: 'group' as const, item: res, children: r.findings.map(f => {
                        const fi = new vscode.TreeItem(f.label, vscode.TreeItemCollapsibleState.None);
                        fi.description = f.ruleId;
                        fi.tooltip = tooltip(findingTooltip(f));
                        const [codicon, colour] = SEVERITY_ICON[f.severity] ?? SEVERITY_ICON.info;
                        fi.iconPath = new vscode.ThemeIcon(codicon, new vscode.ThemeColor(colour));
                        fi.command = openCommand(f.sourceUri, f.line);
                        fi.contextValue = 'finding';
                        fi.accessibilityInformation = { label: `${f.severity} ${f.label}, rule ${f.ruleId}` };
                        return { kind: 'finding' as const, item: fi };
                    }),
                };
            }),
        };
    })];
}

export function registerHarnessViews(deps: HarnessViewsDeps): HarnessViews {
    const icon = (name: TreeIconName) => iconPath(deps.context.extensionUri, name);
    const lookup = (nodeId: string) => {
        const node = deps.getData()?.graph.nodes.find(n => n.id === nodeId);
        return node ? { name: node.label, type: node.type } : undefined;
    };
    const sources = new Tree(() => sourcesNodes(buildSources(deps.getData(), deps.describe, deps.providerLabel, deps.getReport()), icon));
    // The badge needs the groups now, not when VS Code next asks for the children (FEAT-045 R3).
    let findingGroups: FindingGroup[] = [];
    const findings = new Tree(() => findingNodes(findingGroups, icon));
    const sourcesView = vscode.window.createTreeView(SOURCES_VIEW_ID, { treeDataProvider: sources });
    const findingsView = vscode.window.createTreeView(FINDINGS_VIEW_ID, { treeDataProvider: findings });
    for (const [id, view] of [[SOURCES_VIEW_ID, sourcesView], [FINDINGS_VIEW_ID, findingsView]] as const) {
        deps.context.subscriptions.push(view, view.onDidChangeVisibility(e => deps.onVisible(id, e.visible)));
        if (view.visible) deps.onVisible(id, true);
    }
    deps.context.subscriptions.push(vscode.commands.registerCommand(OPEN_SOURCE_COMMAND, async (sourceUri: string, line?: number) => {
        const position = line && line > 0 ? new vscode.Position(line - 1, 0) : undefined;
        await vscode.window.showTextDocument(vscode.Uri.parse(sourceUri), position ? { selection: new vscode.Range(position, position) } : {});
    }));
    return {
        refresh: () => {
            findingGroups = buildFindings(deps.getReport(), deps.getProfile(), deps.providerLabel, lookup);
            sources.refresh();
            findings.refresh();
            const errors = errorCount(findingGroups);
            findingsView.badge = errors > 0 ? { value: errors, tooltip: `${errors} error finding${errors === 1 ? '' : 's'}` } : undefined;
        },
    };
}
