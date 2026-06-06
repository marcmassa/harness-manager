import * as vscode from 'vscode';
import * as path from 'path';
import { HarnessParser } from './harnessParser.js';
import { HarnessWriter } from './harnessWriter.js';

export function activate(context: vscode.ExtensionContext) {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    if (!root) return;

    const provider = new HarnessDashboardProvider(context.extensionUri, root);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            HarnessDashboardProvider.viewType,
            provider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('harness-manager.openDashboard', () => {
            vscode.commands.executeCommand('workbench.view.extension.harness-manager');
        })
    );
}

class HarnessDashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'harness-manager.dashboard';
    private _view?: vscode.WebviewView;
    private _parser: HarnessParser;
    private _writer: HarnessWriter;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _workspaceRoot: vscode.Uri
    ) {
        this._parser = new HarnessParser(this._workspaceRoot);
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
            localResourceRoots: [this._extensionUri]
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
                            await this._writer.createSkill(data.name, data.description);
                        }
                        break;
                    case 'deleteNode':
                        await this._writer.deleteNode(data.id, data.nodeType);
                        break;
                    case 'updateMetadata':
                        await this._writer.updateMetadata(data.id, data.nodeType, data.metadata);
                        break;
                    case 'createEdge':
                        await this._writer.createEdge(data.source, data.target);
                        break;
                }
            } catch (e: any) {
                vscode.window.showErrorMessage(`Harness Error: ${e.message}`);
            }
        });

        // T7: Setup Watcher
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this._workspaceRoot, '{.agents/**,feature_list.json}')
        );
        watcher.onDidChange(() => this._sendData());
        watcher.onDidCreate(() => this._sendData());
        watcher.onDidDelete(() => this._sendData());
    }

    private async _sendData() {
        if (this._view) {
            const result = await this._parser.parse();
            this._view.webview.postMessage({ type: 'init', data: result.graph });
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
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
