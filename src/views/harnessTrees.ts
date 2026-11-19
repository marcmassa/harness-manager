// FEAT-045 T3 — the Sources and Findings tree views (R1–R4, R7).
// Selecting an item opens its native source; other operations are menu
// actions (package.json). Visibility drives the scan scheduler.
import * as vscode from 'vscode';
import type { DashboardData } from '../types.js';
import type { ResourceOwnership } from '../operations/operationGate.js';
import type { OptimizerReport } from '../optimizer/types.js';
import type { AgenticProfile } from '../agentic-detector/types.js';
import { buildFindings, buildSources, errorCount, type FindingGroup, type ProviderGroup } from './treeModels.js';

export const SOURCES_VIEW_ID = 'harness-dashboard.sources';
export const FINDINGS_VIEW_ID = 'harness-dashboard.findings';
export const OPEN_SOURCE_COMMAND = 'harness-dashboard.openSource';

type Node = { kind: 'group' | 'resource' | 'finding'; item: vscode.TreeItem; children?: Node[] };

const SEVERITY_ICON: Record<string, string> = { error: 'error', warning: 'warning', info: 'info' };
const TYPE_ICON: Record<string, string> = { agent: 'account', subagent: 'person', skill: 'tools', steering: 'compass', hook: 'zap' };

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

function sourcesNodes(groups: ProviderGroup[]): Node[] {
    return groups.map(g => {
        const item = new vscode.TreeItem(g.label, vscode.TreeItemCollapsibleState.Expanded);
        item.description = `${g.resources.length} resource${g.resources.length === 1 ? '' : 's'}`;
        item.contextValue = 'provider';
        return {
            kind: 'group', item, children: g.resources.map(r => {
                const res = new vscode.TreeItem(r.nativePath ?? r.label, vscode.TreeItemCollapsibleState.None);
                res.description = [r.type, r.loadMode && r.loadMode !== 'unknown' ? r.loadMode : ''].filter(Boolean).join(' · ');
                res.tooltip = r.tooltip;
                res.iconPath = new vscode.ThemeIcon(TYPE_ICON[r.type] ?? 'file');
                res.command = openCommand(r.sourceUri);
                res.contextValue = 'resource';
                return { kind: 'resource' as const, item: res };
            }),
        };
    });
}

function findingNodes(groups: FindingGroup[]): Node[] {
    return groups.map(g => {
        const item = new vscode.TreeItem(g.label, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = 'owner';
        return {
            kind: 'group', item, children: g.resources.map(r => {
                const res = new vscode.TreeItem(r.label, vscode.TreeItemCollapsibleState.Expanded);
                res.description = `${r.findings.length}`;
                res.contextValue = 'findingResource';
                return {
                    kind: 'group' as const, item: res, children: r.findings.map(f => {
                        const fi = new vscode.TreeItem(f.label, vscode.TreeItemCollapsibleState.None);
                        fi.tooltip = f.detail;
                        fi.description = f.severity;
                        fi.iconPath = new vscode.ThemeIcon(SEVERITY_ICON[f.severity] ?? 'info');
                        fi.command = openCommand(f.sourceUri, f.line);
                        fi.contextValue = 'finding';
                        return { kind: 'finding' as const, item: fi };
                    }),
                };
            }),
        };
    });
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

export function registerHarnessViews(deps: HarnessViewsDeps): HarnessViews {
    const sources = new Tree(() => sourcesNodes(buildSources(deps.getData(), deps.describe, deps.providerLabel)));
    let findingGroups: FindingGroup[] = [];
    const findings = new Tree(() => findingNodes(findingGroups = buildFindings(deps.getReport(), deps.getProfile(), deps.providerLabel)));
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
            sources.refresh();
            findings.refresh();
            const errors = errorCount(findingGroups);
            findingsView.badge = errors > 0 ? { value: errors, tooltip: `${errors} error finding${errors === 1 ? '' : 's'}` } : undefined;
        },
    };
}
