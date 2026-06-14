import * as vscode from 'vscode';
import * as path from 'path';
import { HarnessParser } from './harnessParser.js';
import { HarnessWriter } from './harnessWriter.js';
import { initConfigurationRegistry, disposeConfigurationRegistry } from './adapters/index.js';
import type { MarkdownFileContent } from './types.js';
type CustomUsesEdge = { source: string; target: string };
const CUSTOM_USES_EDGES_KEY = 'harness-dashboard.customUsesEdges';

export function activate(context: vscode.ExtensionContext) {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    if (!root) return;

    // OutputChannel with log:true — visible in Output > Harness Dashboard, supports severity filtering
    const log = vscode.window.createOutputChannel('Harness Dashboard', { log: true });
    context.subscriptions.push(log);

    // Eagerly construct the ConfigurationRegistry singleton with
    // the OutputChannel so R6 warnings land in the same channel
    // as the rest of the extension's diagnostics.
    initConfigurationRegistry(log);

    // T1 (R1, R4): pass context so provider can access workspaceState
    const provider = new HarnessDashboardProvider(context.extensionUri, root, context, log);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            HarnessDashboardProvider.viewType,
            provider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.openDashboard', () => {
            vscode.commands.executeCommand('workbench.view.extension.harness-dashboard');
        })
    );
}

class HarnessDashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'harness-dashboard.dashboard';
    private _view?: vscode.WebviewView;
    private _parser: HarnessParser;
    private _writer: HarnessWriter;
    private readonly _log: vscode.LogOutputChannel;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _workspaceRoot: vscode.Uri,
        // T1 (R1, R4): context gives access to workspaceState
        private readonly _context: vscode.ExtensionContext,
        log: vscode.LogOutputChannel,
    ) {
        this._log = log;
        this._parser = new HarnessParser(this._workspaceRoot, this._log);
        this._writer = new HarnessWriter(this._workspaceRoot);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
            // Explicitly configure sandbox to ensure compatibility
            // Note: VS Code manages the default sandbox; we only add restrictions if needed
            sandbox: 'allow-scripts allow-same-origin allow-forms'
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            try {
                switch (data.type) {
                    case 'ready':
                    case 'getData':
                        this._sendData();
                        break;
                    case 'createNode':
                        if (data.nodeType === 'subagent') {
                            await this._writer.createSubagent(data.name, data.description);
                        } else {
                            await this._writer.createSkill(
                                data.name, 
                                data.description,
                                {
                                    license: data.license,
                                    compatibility: data.compatibility,
                                    author: data.author,
                                    version: data.version,
                                }
                            );
                        }
                        this._sendData();
                        break;
                    case 'deleteNode':
                        await this._writer.deleteNode(data.id, data.nodeType);
                        this._sendData();
                        break;
                    case 'updateMetadata':
                        await this._writer.updateMetadata(data.id, data.nodeType, data.metadata);
                        this._sendData();
                        break;
                    case 'createEdge':
                        try {
                            await this._writer.createEdge(data.source, data.target);
                        } catch (error: any) {
                            if (this._shouldUseCustomEdgeFallback(error)) {
                                await this._upsertCustomUsesEdge(data.source, data.target);
                            } else {
                                throw error;
                            }
                        }
                        this._sendData();
                        break;
                    case 'getMarkdownContent':
                        const mdContent: MarkdownFileContent = await this._parser.getMarkdownContent(data.nodeId, data.nodeType, data.filePath);
                        this._view?.webview.postMessage({ type: 'markdownContent', content: mdContent });
                        break;
                    case 'deleteEdge':
                        await this._deleteEdgeWithFallback(data.source, data.target, data.label || 'uses');
                        this._sendData();
                        break;
                    case 'confirmAndDeleteEdge':
                        const result = await vscode.window.showWarningMessage(
                            `Delete this relationship?`,
                            { modal: true, detail: `This will remove the "${data.label || 'uses'}" connection between "${data.source}" and "${data.target}".` },
                            'Yes, Delete'
                        );
                        if (result === 'Yes, Delete') {
                            await this._deleteEdgeWithFallback(data.source, data.target, data.label || 'uses');
                            this._sendData();
                        }
                        break;
                    case 'acceptSuggestion':
                        await this._writer.acceptSuggestion(data.subagentId, data.skillId);
                        this._sendData();
                        break;
                    case 'reassignSkill':
                        await this._writer.reassignSkill(data.skillId, data.newOwner);
                        this._sendData();
                        break;
                    case 'updateEdgeLabel':
                        await this._writer.updateEdgeLabel(data.source, data.target, data.label);
                        this._sendData();
                        break;
                    // T7 (R1): Persist dismissed suggestion pair to workspaceState
                    case 'dismissSuggestion': {
                        const saId = data.subagentId;
                        const skId = data.skillId;
                        if (saId && skId && typeof saId === 'string' && typeof skId === 'string') {
                            const key = `${saId}::${skId}`;
                            const current = this._context.workspaceState.get<string[]>('harness-dashboard.dismissedSuggestions', []);
                            if (!current.includes(key)) {
                                await this._context.workspaceState.update('harness-dashboard.dismissedSuggestions', [...current, key]);
                            }
                        }
                        this._sendData();
                        break;
                    }
                    // T7 (R4, R6): Toggle disabled state of a uses connection
                    case 'toggleSkillConnection': {
                        const src = data.source;
                        const tgt = data.target;
                        const disable = data.disabled;
                        if (src && tgt && typeof src === 'string' && typeof tgt === 'string') {
                            const key = `${src}::${tgt}`;
                            const current = this._context.workspaceState.get<string[]>('harness-dashboard.disabledConnections', []);
                            let updated: string[];
                            if (disable) {
                                updated = current.includes(key) ? current : [...current, key];
                            } else {
                                updated = current.filter(k => k !== key);
                            }
                            await this._context.workspaceState.update('harness-dashboard.disabledConnections', updated);
                        }
                        this._sendData();
                        break;
                    }
                    case 'openMarkdownFile':
                        // Resolve the file path the same way as getMarkdownContent, then open in editor
                        let relPath: string;
                        if (typeof data.filePath === 'string' && data.filePath.trim().length > 0) {
                            relPath = data.filePath;
                        } else if (data.nodeType === 'skill') {
                            relPath = `.agents/skills/${data.nodeId}/SKILL.md`;
                        } else {
                            relPath = `.agents/subagents/${data.nodeId}/SUBAGENT.md`;
                        }
                        const normalizedPath = relPath.replace(/\\/g, '/');
                        const fileUri = /^([a-zA-Z]:\/|\/)/.test(normalizedPath)
                            ? vscode.Uri.file(normalizedPath)
                            : vscode.Uri.joinPath(this._workspaceRoot, normalizedPath);
                        try {
                            await vscode.workspace.fs.stat(fileUri);
                            const doc = await vscode.workspace.openTextDocument(fileUri);
                            await vscode.window.showTextDocument(doc, { preserveFocus: true });
                        } catch {
                            vscode.window.showWarningMessage(`File not found: ${relPath}`);
                        }
                        break;
                }
            } catch (e: any) {
                vscode.window.showErrorMessage(`Harness Error: ${e.message}`);
            }
        });

        const watchGlobs = this._parser.getWatchGlobs();
        const watcherPatterns = Array.from(new Set(watchGlobs));
        const watchers = watcherPatterns.map((glob) =>
            vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(this._workspaceRoot, glob)
            )
        );

        for (const watcher of watchers) {
            watcher.onDidChange(() => this._sendData());
            watcher.onDidCreate(() => this._sendData());
            watcher.onDidDelete(() => this._sendData());
        }

        webviewView.onDidDispose(() => {
            for (const watcher of watchers) {
                watcher.dispose();
            }
        });
    }

    private _shouldUseCustomEdgeFallback(error: unknown): boolean {
        const message = String((error as any)?.message || '');
        return (
            message.includes('not recognized') ||
            message.includes('not found in agentic.json#subagents[]')
        );
    }

    private async _upsertCustomUsesEdge(source: string, target: string): Promise<void> {
        if (!source || !target || source === target) return;
        const current = this._context.workspaceState.get<CustomUsesEdge[]>(CUSTOM_USES_EDGES_KEY, []);
        if (current.some((edge) => edge.source === source && edge.target === target)) return;
        await this._context.workspaceState.update(CUSTOM_USES_EDGES_KEY, [...current, { source, target }]);
    }

    private async _removeCustomUsesEdge(source: string, target: string): Promise<void> {
        const current = this._context.workspaceState.get<CustomUsesEdge[]>(CUSTOM_USES_EDGES_KEY, []);
        const updated = current.filter((edge) =>
            !(
                (edge.source === source && edge.target === target) ||
                (edge.source === target && edge.target === source)
            )
        );
        if (updated.length !== current.length) {
            await this._context.workspaceState.update(CUSTOM_USES_EDGES_KEY, updated);
        }
    }

    private async _deleteEdgeWithFallback(source: string, target: string, label: string): Promise<void> {
        if (label !== 'uses') {
            await this._writer.deleteEdge(source, target, label);
            return;
        }

        try {
            await this._writer.deleteEdge(source, target, label);
        } catch (error: any) {
            if (!this._shouldUseCustomEdgeFallback(error)) {
                throw error;
            }
        }

        await this._removeCustomUsesEdge(source, target);
    }
    private async _sendData() {
        if (this._view) {
            this._log.info('Parsing project data…');
            // T2 (R2): Read persisted state and pass to parser
            const dismissedRaw = this._context.workspaceState.get<string[]>('harness-dashboard.dismissedSuggestions', []);
            const disabledRaw = this._context.workspaceState.get<string[]>('harness-dashboard.disabledConnections', []);
            const result = await this._parser.parse({
                dismissedSuggestions: new Set(dismissedRaw),
                disabledConnections: new Set(disabledRaw),
            });
            const customUsesEdges = this._context.workspaceState.get<CustomUsesEdge[]>(CUSTOM_USES_EDGES_KEY, []);
            if (customUsesEdges.length > 0) {
                const nodeIds = new Set(result.graph.nodes.map((node) => node.id));
                const existingUses = new Set(
                    result.graph.edges
                        .filter((edge) => edge.label === 'uses')
                        .map((edge) => `${edge.source}::${edge.target}`)
                );
                for (const edge of customUsesEdges) {
                    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
                    const key = `${edge.source}::${edge.target}`;
                    if (existingUses.has(key)) continue;
                    result.graph.edges.push({
                        id: `custom-edge-${edge.source}-${edge.target}-uses`,
                        source: edge.source,
                        target: edge.target,
                        label: 'uses',
                        metadata: { custom: true },
                    });
                    existingUses.add(key);
                }
            }

            const nodeTypeCounts = result.graph.nodes.reduce((acc: Record<string, number>, n) => {
                acc[n.type] = (acc[n.type] || 0) + 1; // T6 (R11): explicit type, no implicit any
                return acc;
            }, {});

            this._log.info(`Sending data to Webview — nodes: ${JSON.stringify(nodeTypeCounts)}, milestones: ${result.milestones.length}`);

            this._view.webview.postMessage({ type: 'init', data: result });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Harness Dashboard</title>
            </head>
            <body>
                <div id="root"></div>
                <script type="module" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

export function deactivate() {
    disposeConfigurationRegistry();
}
