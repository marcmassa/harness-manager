import * as vscode from 'vscode';
import { dashboardHtml } from './dashboardHtml.js';
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
import type { OperationGate } from './operations/operationGate.js';
import { bindRunTarget } from './operations/operations.js';

export class HarnessDashboardProvider {
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
    private _gate?: OperationGate;
    private readonly _readyTabs = new Set<string>();
    /** FEAT-045: tabs whose code has loaded in a Dashboard webview (Extension Host evidence). */
    public get readyTabs(): ReadonlySet<string> { return this._readyTabs; }
    /** FEAT-041: only the newest scan may replace the cached ownership. */
    private _scanGeneration = 0;

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
        this._panel?.webview.postMessage(msg);
    }

    private _onVisibility?: (surface: string, visible: boolean) => void;

    /** FEAT-045: tell the scan scheduler when a Dashboard surface is shown or hidden. */
    public setVisibilityListener(fn: (surface: string, visible: boolean) => void): void {
        this._onVisibility = fn;
    }

    /** FEAT-045: parse and cache the graph even when no webview is open (tree views read it). */
    public async refresh(): Promise<DashboardData | null> {
        let latest = this._sendDataTo(msg => this.postToWebview(msg));
        // A newer parse (a webview's `ready`) may supersede this one: wait for the latest.
        while (latest) { const current = latest; await current; latest = this._lastParse !== current ? this._lastParse : null; }
        return this._cachedData;
    }

    private _lastParse: Promise<void> | null = null;
    private readonly _resultListeners: Array<() => void> = [];
    /** FEAT-045 R3: the graph or a report changed; the tree views refresh. */
    public onResultsChanged(fn: () => void): void { this._resultListeners.push(fn); }
    public notifyResultsChanged(): void { for (const fn of this._resultListeners) fn(); }


    /**
     * Send dashboard data to a specific webview target.
     * @param postMessage  Optional send function; defaults to the sidebar webview.
     */
    private _sendDataTo(postMessage?: (msg: unknown) => Thenable<boolean> | void): Promise<void> {
        const parse = this._parseAndSend(postMessage);
        this._lastParse = parse;
        return parse;
    }

    private async _parseAndSend(postMessage?: (msg: unknown) => Thenable<boolean> | void): Promise<void> {
        const send = postMessage;
        if (!send) return;

        this._log.info('Parsing project data…');
        // T2 (R2): Read persisted state and pass to parser
        const dismissedRaw = this._context.workspaceState.get<string[]>('harness-dashboard.dismissedSuggestions', []);
        const disabledRaw = this._context.workspaceState.get<string[]>('harness-dashboard.disabledConnections', []);
        const generation = ++this._scanGeneration;
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

        if (generation !== this._scanGeneration) {
            this._log.info('[Dashboard] Dropped a scan superseded by a newer one');
            return;
        }
        this._cachedData = result;
        this.notifyResultsChanged();
        // FEAT-041 T3 (R3): owner, native path and operation availability per resource,
        // computed by the same decision the host applies at dispatch.
        await this._gate?.refreshRunners();
        const gate = this._gate;
        const ownership = gate ? Object.fromEntries(result.graph.nodes.map(node => [node.id, gate.describe(node)])) : {};
        send({ type: 'init', data: result, ownership });
    }

    /** FEAT-045 R15: a reloaded webview gets the cached graph; no second parse. */
    private async _sendCachedTo(postMessage: (msg: unknown) => Thenable<boolean> | void): Promise<void> {
        const data = this._cachedData;
        if (!data) return this._sendDataTo(postMessage);
        await this._gate?.refreshRunners();
        const gate = this._gate;
        const ownership = gate ? Object.fromEntries(data.graph.nodes.map(node => [node.id, gate.describe(node)])) : {};
        postMessage({ type: 'init', data, ownership });
    }

    /** Refresh the active dashboard surfaces and their shared graph. */
    public async _sendData(): Promise<void> {
        if (this._panel) await this._sendDataTo(message => this.postToWebview(message));
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

    /** FEAT-041 T3 (R4): the host decision for every mutating message and command. */
    public setOperationGate(gate: OperationGate): void {
        this._gate = gate;
        const recheck = (msg: { type: string; [key: string]: unknown }) => gate.authorizeMessage(msg)
            .then(result => result?.decision ?? { ok: true as const, mode: 'persist' as const, owners: [] });
        this._whiteboardCoordinator.setAuthorize(recheck);
        this._optimizerCoordinator.setAuthorize(recheck);
        this._advisoryCoordinator.setAuthorizeRequest(request => gate.authorize(request));
    }

    public get operationGate(): OperationGate | undefined {
        return this._gate;
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
                    // FEAT-045 R5: a tab requested while the panel's webview was reloading.
                    if (data.type === 'ready' && this._pendingTab) { postMessage({ type: 'activateTab', tab: this._pendingTab }); this._pendingTab = undefined; }
                    if (data.type === 'ready') await this._sendCachedTo(postMessage);
                    else await this._sendDataTo(postMessage);
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
                case 'tabReady':
                    // FEAT-045 R19: a tab's chunk loaded under the CSP and mounted.
                    if (typeof data.tab === 'string') this._readyTabs.add(data.tab);
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
                    // FEAT-041 T3 (R4): decide before any effect. The mode is host-owned:
                    // a client-supplied value is discarded, never trusted.
                    delete (data as Record<string, unknown>).operationMode;
                    const gated = await this._gate?.authorizeMessage(data);
                    if (gated && !gated.decision.ok) {
                        this._log.warn(`[Operations] Denied ${gated.request.op} for ${data.type}: ${gated.decision.reason}`);
                        postMessage({ type: 'operationDenied', requestType: data.type, operation: gated.request.op, reason: gated.decision.reason });
                        void vscode.window.showWarningMessage(`Harness Dashboard: ${gated.decision.reason}`);
                        break;
                    }
                    if (data.type === 'runAgent') {
                        const node = this._cachedData?.graph.nodes.find(n => n.id === data.nodeId);
                        bindRunTarget(data as Record<string, unknown>, node as never);
                    }
                    if (gated?.decision.ok && gated.decision.mode === 'view-local') {
                        (data as Record<string, unknown>).operationMode = 'view-local';
                    }
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

    private _attachWebview(webview: vscode.Webview, isFullWindow: boolean, tab?: string): void {
        const reply = (message: unknown) => webview.postMessage(message);
        webview.onDidReceiveMessage(data => this._handleWebviewMessage(data, reply));
        webview.html = dashboardHtml(this._extensionUri, webview, isFullWindow, tab);
    }

    /**
     * Open the dashboard in a full-window editor panel (detached from the sidebar).
     * The panel reuses the same data source (HarnessParser) and shares the full
     * message-handling logic so all interactions work identically to the sidebar.
     */
    /** FEAT-045 R5, R6: the one editor panel's view type, also its serializer key. */
    public static readonly panelType = 'harness-dashboard.fullDashboard';
    private _pendingTab?: string;

    /**
     * Open the Dashboard in the editor, or reveal it on `tab` when it is
     * already open: one panel, never a second one (FEAT-045 R5).
     */
    public async openFullWindowPanel(tab?: string): Promise<void> {
        if (this._panel) {
            // A hidden panel's webview reloads on reveal: keep the tab until it says `ready`.
            if (tab && !this._panel.visible) this._pendingTab = tab;
            this._panel.reveal(undefined, false);
            if (tab) this._panel.webview.postMessage({ type: 'activateTab', tab });
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            HarnessDashboardProvider.panelType,
            'Harness Dashboard',
            vscode.ViewColumn.Beside,
            HarnessDashboardProvider.panelOptions(this._extensionUri),
        );
        this.adoptPanel(panel, tab);
        this._log.info('[Dashboard] Editor panel opened');
    }

    /** Options shared by new and restored panels. No `retainContextWhenHidden`: state lives in setState (R6). */
    public static panelOptions(extensionUri: vscode.Uri): vscode.WebviewPanelOptions & vscode.WebviewOptions {
        return { enableScripts: true, localResourceRoots: [extensionUri] };
    }

    /** Attach a new or restored panel; `tab` is the panel's saved or requested tab. */
    public adoptPanel(panel: vscode.WebviewPanel, tab?: string): void {
        // R5: one panel. Releases before 0.9 opened several; restore only the first.
        if (this._panel && this._panel !== panel) { panel.dispose(); return; }
        this._panel = panel;
        panel.webview.options = HarnessDashboardProvider.panelOptions(this._extensionUri);
        this._attachWebview(panel.webview, true, tab);
        this._onVisibility?.('panel', panel.visible);
        panel.onDidChangeViewState(e => this._onVisibility?.('panel', e.webviewPanel.visible));
        panel.onDidDispose(() => {
            this._onVisibility?.('panel', false);
            if (this._panel === panel) this._panel = undefined;
        });
    }

}
