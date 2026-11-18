import * as vscode from 'vscode';
import type { AdapterRegistry } from './adapters/AdapterRegistry.js';
import { HarnessParser } from './harnessParser.js';
import { HarnessWriter } from './harnessWriter.js';
import { isKnownWebviewMessage, isWhiteboardToolbarCommand, type DashboardData } from './types.js';
import { AgenticDetector } from './agentic-detector/agenticDetector.js';
import type { AgenticProfile } from './agentic-detector/types.js';
import { WhiteboardCoordinator, CustomUsesEdge, CustomEdge, CUSTOM_USES_EDGES_KEY, CUSTOM_EDGES_KEY } from './coordinators/WhiteboardCoordinator.js';
import { SddCoordinator } from './coordinators/SddCoordinator.js';
import { AdvisoryCoordinator } from './coordinators/AdvisoryCoordinator.js';
import { RunCoordinator } from './coordinators/RunCoordinator.js';
import { OptimizerCoordinator } from './coordinators/OptimizerCoordinator.js';

export class HarnessDashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'harness-dashboard.dashboard';
    private _view?: vscode.WebviewView;
    private _watchers: vscode.FileSystemWatcher[] = [];
    private _panel?: vscode.WebviewPanel;
    private readonly _parser: HarnessParser;
    private _agenticDetector?: AgenticDetector;
    private readonly _whiteboardCoordinator: WhiteboardCoordinator;
    private readonly _sddCoordinator: SddCoordinator;
    private readonly _advisoryCoordinator: AdvisoryCoordinator;
    // FEAT-034
    private readonly _optimizerCoordinator: OptimizerCoordinator;
    // FEAT-033
    private _runCoordinator?: RunCoordinator;
    private _cachedData: DashboardData | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _workspaceRoot: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        private readonly _log: vscode.LogOutputChannel,
        registry: AdapterRegistry,
    ) {
        this._parser = new HarnessParser(this._workspaceRoot, this._log, registry);
        const writer = new HarnessWriter(this._workspaceRoot);
        // scheduleScan is set after the provider is constructed (via setAgenticDetector)
        this._whiteboardCoordinator = new WhiteboardCoordinator(writer, this._parser, this._context, this._workspaceRoot, this._log);
        this._sddCoordinator = new SddCoordinator(this._workspaceRoot, this._log);
        this._advisoryCoordinator = new AdvisoryCoordinator(this._context, this._workspaceRoot, this._log);
        // FEAT-034: reads the graph through getCachedData() so it always scores
        // the same model the whiteboard is showing.
        this._optimizerCoordinator = new OptimizerCoordinator(
            writer, this._context, this._workspaceRoot, this._log,
            () => this._cachedData,
        );
    }

    /** FEAT-034: exposed so activate() can register the diff provider and the command. */
    public get optimizerCoordinator(): OptimizerCoordinator {
        return this._optimizerCoordinator;
    }

    /** Return the last parsed DashboardData for GraphContext building (FEAT-031). */
    public getCachedData(): DashboardData | null {
        return this._cachedData;
    }

    /** Post a message to whichever view is currently active (FEAT-031). */
    public postToWebview(msg: unknown): void {
        this._view?.webview.postMessage(msg);
        this._panel?.webview.postMessage(msg);
    }

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        this._attachWebview(webviewView.webview, false);

        this.refreshWatchers();

        webviewView.onDidDispose(() => {
            if (this._view === webviewView) this._view = undefined;
            this._disposeWatchers();
        });
    }

    /**
     * (Re)create file watchers from the registry's current watch globs.
     * Called when the sidebar view resolves and whenever providers register,
     * dispose or profiles change (FEAT-041 R6). No-op without a visible view.
     */
    public refreshWatchers(): void {
        this._disposeWatchers();
        if (!this._view) return;
        for (const glob of new Set(this._parser.getWatchGlobs())) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(this._workspaceRoot, glob)
            );
            watcher.onDidChange(() => this._sendData());
            watcher.onDidCreate(() => this._sendData());
            watcher.onDidDelete(() => this._sendData());
            this._watchers.push(watcher);
        }
    }

    private _disposeWatchers(): void {
        for (const watcher of this._watchers) watcher.dispose();
        this._watchers = [];
    }

    /**
     * Send dashboard data to a specific webview target.
     * @param postMessage  Optional send function; defaults to the sidebar webview.
     */
    private async _sendDataTo(postMessage?: (msg: unknown) => Thenable<boolean> | void): Promise<void> {
        const send = postMessage || this._view?.webview.postMessage.bind(this._view?.webview);
        if (!send) return;

        this._log.info('Parsing project data…');
        // T2 (R2): Read persisted state and pass to parser
        const dismissedRaw = this._context.workspaceState.get<string[]>('harness-dashboard.dismissedSuggestions', []);
        const disabledRaw = this._context.workspaceState.get<string[]>('harness-dashboard.disabledConnections', []);
        const result = await this._parser.parse({
            dismissedSuggestions: new Set(dismissedRaw),
            disabledConnections: new Set(disabledRaw),
        });
        const customUsesEdges = this._context.workspaceState.get<CustomUsesEdge[]>(CUSTOM_USES_EDGES_KEY, []);
        const nodeIds = new Set(result.graph.nodes.map((node) => node.id));
        if (customUsesEdges.length > 0) {
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
        const customEdges = this._context.workspaceState.get<CustomEdge[]>(CUSTOM_EDGES_KEY, []);
        if (customEdges.length > 0) {
            const existingKeys = new Set(result.graph.edges.map(e => `${e.source}::${e.target}::${e.label}`));
            for (const edge of customEdges) {
                if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
                const key = `${edge.source}::${edge.target}::${edge.label}`;
                if (existingKeys.has(key)) continue;
                result.graph.edges.push({
                    id: `custom-edge-${edge.source}-${edge.target}-${edge.label}`,
                    source: edge.source,
                    target: edge.target,
                    label: edge.label,
                    metadata: { custom: true },
                });
                existingKeys.add(key);
            }
        }

        const nodeTypeCounts = result.graph.nodes.reduce((acc: Record<string, number>, n) => {
            acc[n.type] = (acc[n.type] || 0) + 1; // T6 (R11): explicit type, no implicit any
            return acc;
        }, {});

        this._log.info(`Sending data to Webview — nodes: ${JSON.stringify(nodeTypeCounts)}, milestones: ${result.milestones.length}`);

        this._cachedData = result;
        send({ type: 'init', data: result });
    }

    /** Refresh the active dashboard surfaces and their shared graph. */
    public async _sendData(): Promise<void> {
        if (this._view || this._panel) await this._sendDataTo(message => this.postToWebview(message));
    }

    public sendAdvisoryProfile(profile: AgenticProfile): void {
        this.postToWebview({ type: 'advisoryProfile', profile });
    }

    /** FEAT-036 R6/R7: palette entry point for the user-triggered npm audit. */
    public async runSupplyChainAudit(): Promise<void> {
        await this._advisoryCoordinator.runAuditAndRescan(msg => this.postToWebview(msg));
    }

    public setAgenticDetector(detector: AgenticDetector, scheduleScan: () => void): void {
        this._agenticDetector = detector;
        this._advisoryCoordinator.setAgenticDetector(detector);
        // FEAT-031 T17: inject scheduleScan callback into mutating coordinators
        this._whiteboardCoordinator.setScheduleScan(scheduleScan);
        this._sddCoordinator.setScheduleScan(scheduleScan);
        this._optimizerCoordinator.setScheduleScan(scheduleScan);
    }

    // FEAT-033: inject RunCoordinator (setter pattern matching other coordinators)
    public setRunCoordinator(coordinator: RunCoordinator): void {
        this._runCoordinator = coordinator;
    }

    /** Shared webview message handler — used by both sidebar and full-window panel. */
    private async _handleWebviewMessage(
        data: unknown,
        postMessage: (msg: unknown) => Thenable<boolean> | void,
    ): Promise<void> {
        if (!isKnownWebviewMessage(data)) {
            this._log.warn(`[Webview] Unknown or malformed message type: ${String((data as Record<string, unknown>)?.type ?? '<none>')}`);
            return;
        }
        try {
            const sendData = (pm?: (msg: unknown) => Thenable<boolean> | void) =>
                this._sendDataTo(pm ?? postMessage);

            switch (data.type) {
                case 'ready':
                case 'getData':
                    await this._sendDataTo(postMessage);
                    if (this._agenticDetector) {
                        const profile = this._agenticDetector.getProfile();
                        if (profile) {
                            postMessage({ type: 'advisoryProfile', profile });
                            postMessage({
                                type: 'architectureSummary',
                                maturityLevel: profile.maturity.level,
                                maturityLabel: profile.maturity.label,
                                maturityColor: profile.maturity.color,
                                activeSuggestions: profile.suggestions.filter(s => !profile.dismissedSuggestionIds.includes(s.id)).length,
                                scanTimestamp: profile.scanTimestamp,
                                isScanning: false,
                            });
                        }
                    }
                    break;
                case 'openFullWindow':
                    this.openFullWindowPanel();
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', (data.query as string) ?? '@ext:marcmassacapo.harness-dashboard-vscode');
                    break;
                // FEAT-033 Phase 2: Toolbar ⚙ menu — execute a VS Code command from the webview
                case 'executeVSCodeCommand':
                    if (isWhiteboardToolbarCommand(data.command)) {
                        await vscode.commands.executeCommand(data.command);
                    } else {
                        this._log.warn('[Webview] Rejected unknown toolbar command');
                    }
                    break;
                default: {
                    const handled =
                        await this._whiteboardCoordinator.handle(data, postMessage, sendData) ||
                        await this._sddCoordinator.handle(data, postMessage, sendData) ||
                        await this._advisoryCoordinator.handle(data, postMessage, sendData) ||
                        // FEAT-033: RunCoordinator only needs postMessage (no sendData)
                        (this._runCoordinator ? await this._runCoordinator.handle(data, postMessage) : false) ||
                        // FEAT-034
                        await this._optimizerCoordinator.handle(data, postMessage, sendData);
                    if (!handled) {
                        this._log.warn(`[Webview] Unhandled known message type: ${data.type}`);
                    }
                }
            }
        } catch (e: unknown) {
            vscode.window.showErrorMessage(`Harness Error: ${(e as { message?: string })?.message ?? String(e)}`);
        }
    }

    /**
     * Generate the HTML for a Harness Dashboard webview (used by both sidebar and full-window panel).
     * A fresh cryptographic nonce is generated on every call so the CSP is unforgeable.
     */
    private static _getWebviewHtml(extensionUri: vscode.Uri, webview: vscode.Webview, isFullWindow = false): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'));
        const nonceBytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(nonceBytes);
        const nonce = btoa(Array.from(nonceBytes).map(b => String.fromCharCode(b)).join(''));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy"
                      content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:;">
                <link href="${styleUri}" rel="stylesheet">
                <title>Harness Dashboard</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}">window.__harness_is_full_window = ${isFullWindow};</script>
                <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private _attachWebview(webview: vscode.Webview, isFullWindow: boolean): void {
        const reply = (message: unknown) => webview.postMessage(message);
        webview.onDidReceiveMessage(data => this._handleWebviewMessage(data, reply));
        webview.html = HarnessDashboardProvider._getWebviewHtml(this._extensionUri, webview, isFullWindow);
    }

    /**
     * Open the dashboard in a full-window editor panel (detached from the sidebar).
     * The panel reuses the same data source (HarnessParser) and shares the full
     * message-handling logic so all interactions work identically to the sidebar.
     */
    public async openFullWindowPanel(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'harness-dashboard.fullDashboard',
            'Harness Dashboard',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
            },
        );

        this._panel = panel;
        this._attachWebview(panel.webview, true);

        panel.onDidDispose(() => {
            if (this._panel === panel) this._panel = undefined;
        });

        this._log.info('[Dashboard] Full-window panel opened');
    }

}
