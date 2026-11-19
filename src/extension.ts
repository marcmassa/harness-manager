import * as vscode from 'vscode';
import { AdapterRegistry } from './adapters/AdapterRegistry.js';
import { createCompanionApi, type HarnessDashboardApiV1 } from './adapters/companionApi.js';
import { OperationGate } from './operations/operationGate.js';
import { InferenceLedger, setInferenceRecorder, withInferenceAction } from './cost/inferenceLedger.js';
import { registerScaffoldCommands } from './commands/scaffoldCommands.js';
import { createStartup } from './startup/startupWiring.js';
import type { OperationRequest } from './operations/operations.js';
import { HarnessWriter } from './harnessWriter.js';
import { initConfigurationRegistry, disposeConfigurationRegistry, createDefaultAdapters } from './adapters/index.js';
import { HarnessConfig, HARNESS_CONFIG_DIR, HARNESS_CONFIG_RELATIVE_PATH } from './config/harnessConfig.js';
import { generateText, diagnoseLmAvailability } from './lmUtils.js';
import { AgenticDetector } from './agentic-detector/agenticDetector.js';
import type { AgenticProfile, GraphContext, ArchitectureSummary } from './agentic-detector/types.js';
import { RunCoordinator } from './coordinators/RunCoordinator.js';
import { OPTIMIZER_DIFF_SCHEME } from './coordinators/OptimizerCoordinator.js';
import { RunAdapterRegistry } from './run/runAdapterRegistry.js';
import { ClaudeCodeAdapter } from './run/adapters/claudeCodeAdapter.js';
import { GeminiCliAdapter } from './run/adapters/geminiCliAdapter.js';
import { GenericAdapter } from './run/adapters/genericAdapter.js';
import { HarnessDashboardProvider } from './HarnessDashboardProvider.js';

export function activate(context: vscode.ExtensionContext): HarnessDashboardApiV1 {
    const root = vscode.workspace.workspaceFolders?.[0].uri;
    if (!root) return createCompanionApi(undefined);

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
    const registry = new AdapterRegistry(createDefaultAdapters(harnessConfig), log);

    // FEAT-033: Run adapter registry (constructed early; wired to provider after provider creation)
    const runRegistry = new RunAdapterRegistry([
        new ClaudeCodeAdapter(),
        new GeminiCliAdapter(),
        new GenericAdapter(),
    ]);

    // T1 (R1, R4): pass context so provider can access workspaceState
    const provider = new HarnessDashboardProvider(context.extensionUri, root, context, log, registry);

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
    const agenticDetector = new AgenticDetector(root, log, context.workspaceState, registry);
    // FEAT-034 T42: the optimizer report rides the SAME debounce as the advisory
    // scan — no second timer. Any coordinator write that already calls
    // scheduleScan() therefore refreshes the optimizer too (R47).
    const scheduleScan = () => {
        agenticDetector.scheduleScan(buildGraphContext());
        void provider.optimizerCoordinator
            .refresh(msg => provider.postToWebview(msg))
            .catch((e: unknown) => log.error(`[Optimizer] refresh failed: ${String(e)}`));
    };
    agenticDetector.setGetGraphContext(() => {
        const data = provider.getCachedData();
        return data ? buildGraphContext() : undefined;
    });
    provider.setAgenticDetector(agenticDetector, scheduleScan);
    // FEAT-041 T2: one refresh path for config edits, profile changes and
    // companion registration/disposal — both panels rescan the same registry.
    // FEAT-045 R12–R16: activation registers only. The scheduler runs the first
    // scan when a surface is shown or a command needs data, then owns the watchers.
    const syncProfiles = () => harnessConfig.read(root)
        .then(config => registry.setProfiles(config.profiles))
        .catch((error: unknown) => log.error(`[Dashboard] Profile load failed: ${String(error)}`));
    const scheduler = createStartup({
        context, log, registry, provider, agenticDetector, syncProfiles,
        graphContext: buildGraphContext,
    });
    // FEAT-041 T2: config edits, profile changes and companion registration go through the scheduler.
    context.subscriptions.push(registry.onDidChange(() => scheduler.onProvidersChanged()));
    context.subscriptions.push(harnessConfig.onDidChange(() => scheduler.onChange()));

    // FEAT-033: Wire RunCoordinator into the provider
    const runCoordinator = new RunCoordinator(runRegistry, root, context.workspaceState, log);
    runCoordinator.activate(context);
    runCoordinator.setPostToWebview(msg => provider.postToWebview(msg));
    provider.setRunCoordinator(runCoordinator);

    // FEAT-041 T3 (R4): one host decision for webview messages and commands.
    const gate = new OperationGate(registry, () => provider.getCachedData() ?? undefined, runRegistry);
    // FEAT-044 R11, R12: counts of the Dashboard's own model calls, in workspace state only.
    const ledger = new InferenceLedger(context.workspaceState);
    setInferenceRecorder(entry => { void ledger.record(entry); });
    provider.optimizerCoordinator.setInferenceLedger(ledger);
    provider.setOperationGate(gate);
    context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => { void provider._sendData(); }));
    /** True (after telling the user why) when the operation is not available. */
    const denied = async (request: OperationRequest): Promise<boolean> => {
        const decision = await gate.authorize(request);
        if (decision.ok) return false;
        log.warn(`[Operations] Denied ${request.op}: ${decision.reason}`);
        void vscode.window.showWarningMessage(`Harness Dashboard: ${decision.reason}`);
        return true;
    };
    // FEAT-035 T16: the optimizer delegates to the same detected CLIs.
    provider.optimizerCoordinator.setRunRegistry(runRegistry);

    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.rescanAgentic', async () => {
            await scheduler.ensureScanned();
            await agenticDetector.scan(buildGraphContext());
        })
    );

    // FEAT-036 R6: user-triggered npm audit — palette counterpart of the
    // AdvisoryPanel button. Shares the coordinator's in-flight guard and
    // session cache; NEVER invoked from scan()/activation/watchers (R6).
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.runSupplyChainAudit', async () => {
            if (await denied({ op: 'workspace.audit', targets: 'workspace' })) return;
            await provider.runSupplyChainAudit();
        })
    );

    // FEAT-034 T41/T43: virtual document backing the quick-fix diff preview,
    // plus the user-facing "Optimize Components" command.
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            OPTIMIZER_DIFF_SCHEME,
            provider.optimizerCoordinator.diffProvider,
        ),
        vscode.commands.registerCommand('harness-dashboard.optimizeComponents', async () => {
            await vscode.commands.executeCommand('harness-dashboard.dashboard.focus');
            provider.postToWebview({ type: 'activateTab', tab: 'optimizer' });
            await scheduler.ensureScanned();
            const report = await provider.optimizerCoordinator.runScan();
            provider.postToWebview({ type: 'optimizerReport', report });
        }),
    );

    // FEAT-029: Open dashboard in a full-window editor panel
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.openInEditor', () => {
            provider.openFullWindowPanel();
        })
    );

    registerScaffoldCommands({ context, root, provider, gate, denied, scheduleScan, ensureScanned: () => scheduler.ensureScanned() });


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
            const result = await withInferenceAction('provider-check', () => generateText(
                'Say "OK" and nothing else.',
                log,
                { apiKey, endpoint, model },
            ));

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

    // FEAT-041 T2: versioned API for companion extensions (registerAdapter → Disposable).
    return createCompanionApi(registry);
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

export function deactivate() {
    disposeConfigurationRegistry();
}
