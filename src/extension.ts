import * as vscode from 'vscode';
import { HarnessParser } from './harnessParser.js';
import { HarnessWriter } from './harnessWriter.js';
import { initConfigurationRegistry, disposeConfigurationRegistry, createDefaultAdapters } from './adapters/index.js';
import { HarnessConfig, HARNESS_CONFIG_DIR, HARNESS_CONFIG_RELATIVE_PATH } from './config/harnessConfig.js';
import { isKnownWebviewMessage } from './types.js';
import { generateText, diagnoseLmAvailability } from './lmUtils.js';
import { AgenticDetector } from './agentic-detector/agenticDetector.js';
import type { AgenticProfile, GraphContext, ArchitectureSummary } from './agentic-detector/types.js';
import { WhiteboardCoordinator, CustomUsesEdge, CustomEdge, CUSTOM_USES_EDGES_KEY, CUSTOM_EDGES_KEY } from './coordinators/WhiteboardCoordinator.js';
import { SddCoordinator } from './coordinators/SddCoordinator.js';
import { AdvisoryCoordinator } from './coordinators/AdvisoryCoordinator.js';
// FEAT-033: Agent Run Panel
import { RunCoordinator } from './coordinators/RunCoordinator.js';
import { RunAdapterRegistry } from './run/runAdapterRegistry.js';
import { ClaudeCodeAdapter } from './run/adapters/claudeCodeAdapter.js';
import { GeminiCliAdapter } from './run/adapters/geminiCliAdapter.js';
import { GenericAdapter } from './run/adapters/genericAdapter.js';

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

    // FEAT-026 T2: per-workspace HarnessConfig instance, shared
    // across all configurable adapters. Reads
    // `<workspace>/.harness-dashboard/config.json` (R2) and caches
    // it until the file changes.
    const harnessConfig = new HarnessConfig(log);
    context.subscriptions.push(harnessConfig);
    configureAdaptersWithHarnessConfig(harnessConfig);

    // FEAT-033: Run adapter registry (constructed early; wired to provider after provider creation)
    const runRegistry = new RunAdapterRegistry([
        new ClaudeCodeAdapter(),
        new GeminiCliAdapter(),
        new GenericAdapter(),
    ]);

    // T1 (R1, R4): pass context so provider can access workspaceState
    const provider = new HarnessDashboardProvider(context.extensionUri, root, context, log, harnessConfig);

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

    // FEAT-026 T3: open or create the local config file
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.openLocalConfig', () => openLocalConfig(root, log))
    );

    // FEAT-027 T10/T11/T13/T14: code-quality verifier on save + manual command
    const codeQualitySetup = setupCodeQualityVerifier(root, log);
    if (codeQualitySetup) {
        context.subscriptions.push(codeQualitySetup.disposable);
        context.subscriptions.push(
            vscode.commands.registerCommand('harness-dashboard.verifyCodeQuality', async (uri?: vscode.Uri) => {
                await codeQualitySetup.runManual(uri);
            })
        );
    }

    // FEAT-031: Build GraphContext from in-memory parsed data for graph-aware suggestions
    const buildGraphContext = (): GraphContext => {
        const data = provider.getCachedData();
        if (!data) return { nodeCount: 0, nodesByType: {}, edgeCount: 0, featureCount: 0, featuresByStatus: {} };
        const nodesByType: Record<string, number> = {};
        for (const n of data.graph.nodes) {
            nodesByType[n.type] = (nodesByType[n.type] ?? 0) + 1;
        }
        const featuresByStatus: Record<string, number> = {};
        for (const node of data.graph.nodes.filter(n => n.type === 'feature')) {
            const status = (node.metadata as Record<string, unknown>)?.status as string | undefined;
            if (status) featuresByStatus[status] = (featuresByStatus[status] ?? 0) + 1;
        }
        const featureCount = nodesByType['feature'] ?? 0;
        return { nodeCount: data.graph.nodes.length, nodesByType, edgeCount: data.graph.edges.length, featureCount, featuresByStatus };
    };

    // FEAT-029 Phase 4: Agentic Architecture Detector singleton
    const agenticDetector = new AgenticDetector(root, log, context.workspaceState);
    const scheduleScan = () => agenticDetector.scheduleScan(buildGraphContext());
    agenticDetector.setGetGraphContext(() => {
        const data = provider.getCachedData();
        return data ? buildGraphContext() : undefined;
    });
    provider.setAgenticDetector(agenticDetector, scheduleScan);

    // FEAT-033: Wire RunCoordinator into the provider
    const runCoordinator = new RunCoordinator(runRegistry, root, context.workspaceState, log);
    runCoordinator.activate(context);
    runCoordinator.setPostToWebview(msg => provider.postToWebview(msg));
    provider.setRunCoordinator(runCoordinator);

    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.rescanAgentic', async () => {
            await agenticDetector.scan(buildGraphContext());
        })
    );

    // FEAT-029: Open dashboard in a full-window editor panel
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.openInEditor', () => {
            provider.openFullWindowPanel();
        })
    );

    // FEAT-033 T36: Scaffold missing agent files
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.scaffoldMissing', async () => {
            const data = provider.getCachedData();
            if (!data) {
                vscode.window.showWarningMessage('Harness: No data loaded yet. Open the Dashboard first.');
                return;
            }
            const missing: Array<{ id: string; type: string; filePath?: string }> = [];
            for (const node of data.graph.nodes) {
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
            const writer = new (await import('./harnessWriter.js')).HarnessWriter(root);
            for (const item of selected) {
                const node = missing.find(n => n.id === item.label);
                if (!node) continue;
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

            const writer = new (await import('./harnessWriter.js')).HarnessWriter(root);
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

    // Start watching for file changes
    agenticDetector.startWatching();

    const buildArchitectureSummary = (profile: AgenticProfile): ArchitectureSummary => ({
        maturityLevel: profile.maturity.level,
        maturityLabel: profile.maturity.label,
        maturityColor: profile.maturity.color,
        activeSuggestions: profile.suggestions.filter(s => !profile.dismissedSuggestionIds.includes(s.id)).length,
        scanTimestamp: profile.scanTimestamp,
        isScanning: false,
    });

    // FEAT-031: Forward scan results + architecture summary to the webview
    agenticDetector.on('scanComplete', (profile: AgenticProfile) => {
        provider.sendAdvisoryProfile(profile);
        provider.postToWebview({ type: 'architectureSummary', ...buildArchitectureSummary(profile) });
    });

    // Run initial scan (don't await — let it complete in background)
    provider.postToWebview({ type: 'architectureSummary', maturityLevel: null, maturityLabel: '', maturityColor: '', activeSuggestions: 0, scanTimestamp: 0, isScanning: true });
    agenticDetector.scan(buildGraphContext()).catch(err => log.warn(`[AgenticDetector] Initial scan: ${err}`));

    context.subscriptions.push({ dispose: () => agenticDetector.dispose() });

    // FEAT-028 T5: checkLM command — diagnostics + quick AI ping
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.checkLM', async () => {
            const config = vscode.workspace.getConfiguration('harness-dashboard');
            const apiKey = config.get<string>('ai.apiKey', '');
            const endpoint = config.get<string>('ai.endpoint', 'https://api.openai.com/v1/chat/completions');
            const model = config.get<string>('ai.model', 'gpt-4o-mini');

            // Run diagnostics first
            const diagSummary = await diagnoseLmAvailability(log);

            // Then try a simple generation
            const result = await generateText(
                'Say "OK" and nothing else.',
                log,
                { apiKey, endpoint, model },
            );

            // Log full results
            const lines = [
                '--- LM Diagnostics ---',
                diagSummary,
                '--- AI Generation Test ---',
                result.ok
                    ? `✓ Response: ${result.text.slice(0, 200)}`
                    : `✗ Failed: ${result.error}`,
            ];
            log.info('[checkLM]\n' + lines.join('\n'));

            // Surface a notification
            if (result.ok) {
                const text = result.text.slice(0, 100);
                vscode.window.showInformationMessage(
                    `Harness Dashboard: AI is working (${text})`,
                    'View Output',
                ).then((selection) => {
                    if (selection === 'View Output') log.show();
                });
            } else {
                vscode.window.showWarningMessage(
                    `Harness Dashboard: AI check failed — ${result.error}`,
                    'View Output',
                ).then((selection) => {
                    if (selection === 'View Output') log.show();
                });
            }
        })
    );

}

class HarnessDashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'harness-dashboard.dashboard';
    private _view?: vscode.WebviewView;
    private _panel?: vscode.WebviewPanel;
    private _parser: HarnessParser;
    private _writer: HarnessWriter;
    private readonly _log: vscode.LogOutputChannel;
    private readonly _harnessConfig: HarnessConfig;
    private _agenticDetector?: AgenticDetector;
    private readonly _whiteboardCoordinator: WhiteboardCoordinator;
    private readonly _sddCoordinator: SddCoordinator;
    private readonly _advisoryCoordinator: AdvisoryCoordinator;
    // FEAT-033
    private _runCoordinator?: RunCoordinator;
    private _cachedData: import('./types.js').DashboardData | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _workspaceRoot: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        log: vscode.LogOutputChannel,
        harnessConfig: HarnessConfig,
    ) {
        this._log = log;
        this._harnessConfig = harnessConfig;
        this._parser = new HarnessParser(this._workspaceRoot, this._log);
        this._writer = new HarnessWriter(this._workspaceRoot);
        // scheduleScan is set after the provider is constructed (via setAgenticDetector)
        this._whiteboardCoordinator = new WhiteboardCoordinator(this._writer, this._parser, this._context, this._workspaceRoot, this._log);
        this._sddCoordinator = new SddCoordinator(this._workspaceRoot, this._log);
        this._advisoryCoordinator = new AdvisoryCoordinator(this._context, this._workspaceRoot, this._log);
    }

    /** Return the last parsed DashboardData for GraphContext building (FEAT-031). */
    public getCachedData(): import('./types.js').DashboardData | null {
        return this._cachedData;
    }

    /** Post a message to whichever view is currently active (FEAT-031). */
    public postToWebview(msg: unknown): void {
        this._view?.webview.postMessage(msg);
        this._panel?.webview.postMessage(msg);
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
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Attach the shared message handler, routing responses to the sidebar webview
        const sendToSidebar = (msg: unknown) => this._view?.webview.postMessage(msg);
        webviewView.webview.onDidReceiveMessage(async data => {
            await this._handleWebviewMessage(data, sendToSidebar);
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

    /** Backward-compatible: send data to the sidebar webview. */
    public async _sendData(): Promise<void> {
        return this._sendDataTo();
    }

    public sendAdvisoryProfile(profile: AgenticProfile): void {
        this.postToWebview({ type: 'advisoryProfile', profile });
    }

    public setAgenticDetector(detector: AgenticDetector, scheduleScan: () => void): void {
        this._agenticDetector = detector;
        this._advisoryCoordinator.setAgenticDetector(detector);
        // FEAT-031 T17: inject scheduleScan callback into mutating coordinators
        this._whiteboardCoordinator.setScheduleScan(scheduleScan);
        this._sddCoordinator.setScheduleScan(scheduleScan);
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
                    await vscode.commands.executeCommand((data as any).command as string);
                    break;
                default: {
                    const handled =
                        await this._whiteboardCoordinator.handle(data, postMessage, sendData) ||
                        await this._sddCoordinator.handle(data, postMessage, sendData) ||
                        await this._advisoryCoordinator.handle(data, postMessage, sendData) ||
                        // FEAT-033: RunCoordinator only needs postMessage (no sendData)
                        (this._runCoordinator ? await this._runCoordinator.handle(data, postMessage) : false);
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

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return HarnessDashboardProvider._getWebviewHtml(this._extensionUri, webview, false);
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
        panel.webview.html = HarnessDashboardProvider._getWebviewHtml(this._extensionUri, panel.webview, true);

        // Route responses to the new panel (shared message handler already handles ready/getData)
        const sendToPanel = (msg: unknown) => panel.webview.postMessage(msg);
        panel.webview.onDidReceiveMessage(async data => {
            await this._handleWebviewMessage(data, sendToPanel);
        });

        panel.onDidDispose(() => {
            if (this._panel === panel) this._panel = undefined;
        });

        this._log.info('[Dashboard] Full-window panel opened');
    }

}

// ============================================================================
// FEAT-026 — Local config + adapter wiring helpers
// ============================================================================

const EMPTY_CONFIG_TEMPLATE = '{\n    "adapters": {},\n    "extraPaths": {}\n}\n';

/**
 * Open (or create) the local config file and reveal it in the editor.
 * Creates `.harness-dashboard/` and `config.json` with the empty schema
 * the first time the user invokes the command.
 */
async function openLocalConfig(root: vscode.Uri, log: vscode.LogOutputChannel): Promise<void> {
    const dir = vscode.Uri.joinPath(root, HARNESS_CONFIG_DIR);
    const file = vscode.Uri.joinPath(root, HARNESS_CONFIG_RELATIVE_PATH);
    try {
        await vscode.workspace.fs.stat(file);
    } catch {
        try {
            await vscode.workspace.fs.createDirectory(dir);
        } catch (e: any) {
            // Directory may already exist; ignore the "already exists" error
            // but surface anything else on the log channel.
            if (!/exist/i.test(String(e?.message ?? ''))) {
                log.warn(`[openLocalConfig] createDirectory failed: ${e?.message ?? e}`);
            }
        }
        try {
            await vscode.workspace.fs.writeFile(
                file,
                Buffer.from(EMPTY_CONFIG_TEMPLATE, 'utf8'),
            );
        } catch (e: any) {
            log.warn(`[openLocalConfig] writeFile failed: ${e?.message ?? e}`);
            vscode.window.showErrorMessage(
                `Harness Dashboard: could not create ${HARNESS_CONFIG_RELATIVE_PATH}: ${e?.message ?? e}`
            );
            return;
        }
    }
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc, { preview: false });
}

/**
 * Plumb the per-extension HarnessConfig into every adapter that uses
 * it. Adapters that opt-in (isPathConfigurable() === true) implement
 * `setHarnessConfig(config)`; adapters that opt-out are silently
 * skipped — they don't read this file anyway.
 */
function configureAdaptersWithHarnessConfig(harnessConfig: HarnessConfig): void {
    for (const adapter of createDefaultAdapters()) {
        if (typeof (adapter as { setHarnessConfig?: unknown }).setHarnessConfig === 'function') {
            (adapter as unknown as { setHarnessConfig: (c: HarnessConfig) => void }).setHarnessConfig(harnessConfig);
        }
    }
}

export function deactivate() {
    disposeConfigurationRegistry();
}

import { setupCodeQualityVerifier, type CodeQualitySetup } from './verifier/codeQualitySetup.js';
