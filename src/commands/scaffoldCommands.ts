// Harness SDD scaffolding commands, extracted from extension.ts. Both write
// the Harness SDD format, so each asks the FEAT-041 operation gate first.
import * as vscode from 'vscode';
import type { HarnessDashboardProvider } from '../HarnessDashboardProvider.js';
import type { OperationGate } from '../operations/operationGate.js';
import type { OperationRequest } from '../operations/operations.js';

export interface ScaffoldCommandDeps {
    context: vscode.ExtensionContext;
    root: vscode.Uri;
    provider: HarnessDashboardProvider;
    gate: OperationGate;
    /** True (after telling the user why) when the operation is not available. */
    denied: (request: OperationRequest) => Promise<boolean>;
    scheduleScan: () => void;
}

export function registerScaffoldCommands({ context, root, provider, gate, denied, scheduleScan }: ScaffoldCommandDeps): void {
    // FEAT-033 T36: Scaffold missing agent files
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.scaffoldMissing', async () => {
            const data = provider.getCachedData();
            if (!data) {
                vscode.window.showWarningMessage('Harness: No data loaded yet. Open the Dashboard first.');
                return;
            }
            const missing: Array<{ id: string; type: string; filePath?: string }> = [];
            // FEAT-041 T3: scaffold only resources whose owner writes that format.
            const scaffoldable = await Promise.all(data.graph.nodes.map(async node =>
                (await gate.authorize({ op: 'editing.createEntity', targets: [node.id] })).ok ? node : null));
            for (const node of scaffoldable.filter((n): n is NonNullable<typeof n> => n !== null)) {
                const fp = (node.metadata as Record<string, unknown>)?._filePath as string | undefined;
                if (!fp) {
                    missing.push({ id: node.id, type: node.type });
                    continue;
                }
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, fp));
                } catch {
                    missing.push({ id: node.id, type: node.type, filePath: fp });
                }
            }
            if (missing.length === 0) {
                vscode.window.showInformationMessage('Harness: All nodes have files on disk.');
                return;
            }
            const items = missing.map(n => ({
                label: n.id,
                description: n.type,
                picked: true,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                canPickMany: true,
                title: `Scaffold missing agent files (${missing.length} found)`,
                placeHolder: 'Select nodes to scaffold',
            });
            if (!selected || selected.length === 0) return;
            const writer = new (await import('../harnessWriter.js')).HarnessWriter(root);
            for (const item of selected) {
                const node = missing.find(n => n.id === item.label);
                if (!node) continue;
                // Re-check after the picker: the scan may have changed meanwhile.
                if (await denied({ op: 'editing.createEntity', targets: [node.id] })) continue;
                if (node.type === 'skill') {
                    await writer.createSkill(node.id, '');
                } else {
                    await writer.createSubagent(node.id, '');
                }
            }
            await provider._sendData();
            vscode.window.showInformationMessage(`Harness: Scaffolded ${selected.length} file(s).`);
        })
    );

    // FEAT-033 T37: Sync agents from filesystem
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.syncFromFilesystem', async () => {
            if (await denied({ op: 'editing.createEntity', targets: 'workspace' })) return;
            const data = provider.getCachedData();
            const existingIds = new Set(data ? data.graph.nodes.map(n => n.id) : []);

            const [subagentUris, skillUris] = await Promise.all([
                vscode.workspace.findFiles(new vscode.RelativePattern(root, '.agents/subagents/**/SUBAGENT.md')),
                vscode.workspace.findFiles(new vscode.RelativePattern(root, '.agents/skills/**/SKILL.md')),
            ]);

            const candidates: Array<{ id: string; type: 'subagent' | 'skill'; filePath: string }> = [];
            for (const uri of subagentUris) {
                const parts = uri.path.split('/');
                const idx = parts.indexOf('subagents');
                const id = idx >= 0 ? parts[idx + 1] : undefined;
                if (id && !existingIds.has(id)) {
                    candidates.push({ id, type: 'subagent', filePath: vscode.workspace.asRelativePath(uri) });
                }
            }
            for (const uri of skillUris) {
                const parts = uri.path.split('/');
                const idx = parts.indexOf('skills');
                const id = idx >= 0 ? parts[idx + 1] : undefined;
                if (id && !existingIds.has(id)) {
                    candidates.push({ id, type: 'skill', filePath: vscode.workspace.asRelativePath(uri) });
                }
            }

            if (candidates.length === 0) {
                vscode.window.showInformationMessage('Harness: All filesystem agents are already in the whiteboard.');
                return;
            }

            const items = candidates.map(c => ({
                label: c.id,
                description: `${c.type} · ${c.filePath}`,
                picked: true,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                canPickMany: true,
                title: `Import agents from filesystem (${candidates.length} found)`,
                placeHolder: 'Select agents to import into whiteboard',
            });
            if (!selected || selected.length === 0) return;

            if (await denied({ op: 'editing.createEntity', targets: 'workspace' })) return;
            const writer = new (await import('../harnessWriter.js')).HarnessWriter(root);
            for (const item of selected) {
                const candidate = candidates.find(c => c.id === item.label);
                if (!candidate) continue;
                // registerNode only updates agentic.json — never touches existing SUBAGENT.md/SKILL.md
                await writer.registerNode(candidate.id, candidate.type);
            }
            await provider._sendData();
            scheduleScan();
            vscode.window.showInformationMessage(`Harness: Imported ${selected.length} agent(s) into whiteboard.`);
        })
    );
}
