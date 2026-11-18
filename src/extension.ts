import * as vscode from 'vscode';
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
    const agenticDetector = new AgenticDetector(root, log, context.workspaceState);
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

    // FEAT-033: Wire RunCoordinator into the provider
    const runCoordinator = new RunCoordinator(runRegistry, root, context.workspaceState, log);
    runCoordinator.activate(context);
    runCoordinator.setPostToWebview(msg => provider.postToWebview(msg));
    provider.setRunCoordinator(runCoordinator);
    // FEAT-035 T16: the optimizer delegates to the same detected CLIs.
    provider.optimizerCoordinator.setRunRegistry(runRegistry);

    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.rescanAgentic', async () => {
            await agenticDetector.scan(buildGraphContext());
        })
    );

    // FEAT-036 R6: user-triggered npm audit — palette counterpart of the
    // AdvisoryPanel button. Shares the coordinator's in-flight guard and
    // session cache; NEVER invoked from scan()/activation/watchers (R6).
    context.subscriptions.push(
        vscode.commands.registerCommand('harness-dashboard.runSupplyChainAudit', async () => {
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
