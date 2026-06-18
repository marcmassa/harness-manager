import * as vscode from 'vscode';
import * as path from 'path';
import { HarnessParser } from './harnessParser.js';
import { HarnessWriter } from './harnessWriter.js';
import { initConfigurationRegistry, disposeConfigurationRegistry, createDefaultAdapters } from './adapters/index.js';
import { HarnessConfig, HARNESS_CONFIG_DIR, HARNESS_CONFIG_RELATIVE_PATH } from './config/harnessConfig.js';
import type { MarkdownFileContent } from './types.js';
import { openFileInEditor } from './fileUtils.js';
import { generateText, diagnoseLmAvailability } from './lmUtils.js';
import { getFallbackTemplate, buildAIPrompt, tryReadInWorkspace, resolveInWorkspace, detectSpecsBase, invalidateSpecsRootCache } from './sddManagerProvider.js';
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

    // FEAT-026 T2: per-workspace HarnessConfig instance, shared
    // across all configurable adapters. Reads
    // `<workspace>/.harness-dashboard/config.json` (R2) and caches
    // it until the file changes.
    const harnessConfig = new HarnessConfig(log);
    context.subscriptions.push(harnessConfig);
    configureAdaptersWithHarnessConfig(harnessConfig);

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
    private _parser: HarnessParser;
    private _writer: HarnessWriter;
    private readonly _log: vscode.LogOutputChannel;
    private readonly _harnessConfig: HarnessConfig;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _workspaceRoot: vscode.Uri,
        // T1 (R1, R4): context gives access to workspaceState
        private readonly _context: vscode.ExtensionContext,
        log: vscode.LogOutputChannel,
        harnessConfig: HarnessConfig,
    ) {
        this._log = log;
        this._harnessConfig = harnessConfig;
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
                        await openFileInEditor(this._workspaceRoot, relPath);
                        break;

                    // ===== SDD Manager handlers (merged into Dashboard) =====
                    case 'getFeatureList': {
                        const features = await this._getSDDFeatureList();
                        this._view?.webview.postMessage({ type: 'featureList', features });
                        break;
                    }
                    case 'getSpecFile': {
                        const sfg = data as { featureName: string; file: 'requirements' | 'design' | 'tasks' };
                        const sfgResult = await this._getSDDSpecFile(sfg.featureName, sfg.file);
                        this._view?.webview.postMessage({
                            type: 'specFile',
                            ...sfgResult,
                            file: sfg.file,
                            featureName: sfg.featureName,
                        });
                        break;
                    }
                    case 'saveSpecFile': {
                        const sfs = data as { featureName: string; file: 'requirements' | 'design' | 'tasks'; content: string };
                        const sfsResult = await this._saveSDDSpecFile(sfs.featureName, sfs.file, sfs.content);
                        this._view?.webview.postMessage({ type: 'saveResult', ...sfsResult, featureName: sfs.featureName, file: sfs.file });
                        break;
                    }
                    case 'generateWithAI': {
                        const gen = data as { featureName: string; file: 'requirements' | 'design' | 'tasks' };
                        const genResult = await this._generateSDDWithAI(gen.featureName, gen.file);
                        this._view?.webview.postMessage({
                            type: 'aiResult',
                            ...genResult,
                            file: gen.file,
                            featureName: gen.featureName,
                        });
                        break;
                    }
                    case 'createSpecFile': {
                        const cr = data as { featureName: string; file: 'requirements' | 'design' | 'tasks' };
                        // Read template (multi-base), create file, respond with specFile
                        const tplPath = `specs/templates/${cr.file}.md`;
                        const tplFound = await tryReadInWorkspace(this._workspaceRoot, tplPath);
                        const templateContent = tplFound ? tplFound.content : getFallbackTemplate(cr.file);
                        const saveOk = await this._saveSDDSpecFile(cr.featureName, cr.file, templateContent);
                        if (saveOk.ok) {
                            const content = await this._getSDDSpecFile(cr.featureName, cr.file);
                            this._view?.webview.postMessage({
                                type: 'specFile',
                                ...content,
                                file: cr.file,
                                featureName: cr.featureName,
                            });
                        } else {
                            this._view?.webview.postMessage({
                                type: 'saveResult',
                                ok: false,
                                error: saveOk.error || 'Could not create spec file',
                                featureName: cr.featureName,
                                file: cr.file,
                            });
                        }
                        break;
                    }
                    case 'generateSpecDraft': {
                        const gd = data as { featureName: string; file: 'requirements' | 'design' | 'tasks'; userPrompt: string; contextContent?: string };
                        const gdResult = await this._generateSDDSpecDraft(gd.featureName, gd.file, gd.userPrompt, gd.contextContent);
                        this._view?.webview.postMessage({
                            type: 'specDraftResult',
                            ...gdResult,
                            file: gd.file,
                            featureName: gd.featureName,
                        });
                        break;
                    }
                    case 'openInEditor': {
                        const resolved = await resolveInWorkspace(this._workspaceRoot, data.filePath);
                        if (resolved) {
                            await openFileInEditor(this._workspaceRoot, resolved.fsPath);
                        } else {
                            await openFileInEditor(this._workspaceRoot, data.filePath);
                        }
                        break;
                    }
                    case 'createFeature': {
                        const newFeat = await this._createSDDFeature(data.title, data.description, data.priority || 'P2', data.sprint || '');
                        this._view?.webview.postMessage({ type: 'featureCreated', feature: newFeat });
                        break;
                    }
                    case 'generateFeatureDescription': {
                        const title = data.title || '';
                        const mode = data.mode || 'generate';
                        const currentDescription = data.currentDescription || '';
                        const target = data.target || 'createDescription';
                        let prompt: string;
                        if (mode === 'refine' && currentDescription) {
                            prompt = `Refine and improve the following text. Keep it concise and professional.\n\nTitle: ${title}\n\nCurrent text:\n${currentDescription}\n\nReturn only the refined text, no preamble.`;
                        } else if (target === 'wizardPrompt' && title) {
                            prompt = `Write a detailed prompt (2-4 sentences) describing what to generate for a software feature titled "${title}". The prompt should describe the feature's purpose, key functionality, and expected outcomes. Return only the prompt text, no preamble.`;
                        } else if (target === 'editContent' && currentDescription) {
                            prompt = `Refine and improve the following specification content. Maintain the structure and markdown formatting. Improve clarity and completeness.\n\nTitle: ${title}\n\nCurrent content:\n${currentDescription}\n\nReturn only the refined content, no preamble.`;
                        } else {
                            prompt = `Write a concise, one-paragraph description (2-3 sentences) for a software feature titled "${title}". Return only the description text, no preamble.`;
                        }
                        const result = await generateText(prompt, this._log);
                        this._view?.webview.postMessage({ type: 'featureDescriptionResult', ok: result.ok, text: result.text, error: result.error, target });
                        break;
                    }
                    case 'deleteFeature': {
                        const featId = data.featureId;
                        const success = await this._deleteSDDFeature(featId);
                        this._view?.webview.postMessage({ type: 'featureDeleted', ok: success, featureId: featId });
                        // Refresh the feature list regardless
                        const features = await this._getSDDFeatureList();
                        this._view?.webview.postMessage({ type: 'featureList', features });
                        break;
                    }
                    // FEAT-028: open VS Code settings filtered to the extension
                    case 'openSettings': {
                        const query = (data as { query?: string }).query ?? '@ext:marcmassacapo.harness-dashboard-vscode';
                        vscode.commands.executeCommand('workbench.action.openSettings', query);
                        break;
                    }
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

    // ===== SDD Manager helpers (merged into Dashboard) =====

    private async _deleteSDDFeature(featureId: string): Promise<boolean> {
        const found = await tryReadInWorkspace(this._workspaceRoot, 'feature_list.json');
        if (!found) return false;
        try {
            const parsed = JSON.parse(found.content);
            const features: any[] = parsed.features || [];
            const idx = features.findIndex((f: any) => f.id === featureId);
            if (idx === -1) return false;
            features.splice(idx, 1);
            parsed.features = features;
            const uri = found.base === '.'
                ? vscode.Uri.joinPath(this._workspaceRoot, 'feature_list.json')
                : vscode.Uri.joinPath(this._workspaceRoot, found.base, 'feature_list.json');
            await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(parsed, null, 2), 'utf8'));
            this._sendData();
            return true;
        } catch {
            return false;
        }
    }

    private async _getSDDFeatureList(): Promise<any[]> {
        const found = await tryReadInWorkspace(this._workspaceRoot, 'feature_list.json');
        if (found) {
            try {
                const parsed = JSON.parse(found.content);
                return parsed.features ?? [];
            } catch {
                // invalid JSON — fall through
            }
        }
        this._log.warn('[SDD] Could not read feature_list.json in any workspace base');
        return [];
    }

    private async _createSDDFeature(
        title: string,
        description: string,
        priority: string,
        sprint: string,
    ): Promise<any> {
        const found = await tryReadInWorkspace(this._workspaceRoot, 'feature_list.json');
        if (!found) {
            throw new Error('feature_list.json not found');
        }
        const parsed = JSON.parse(found.content);
        const features: any[] = parsed.features || [];

        // Generate next FEAT-XXX id
        let maxNum = 0;
        const idPattern = /^FEAT-0*(\d+)$/i;
        for (const f of features) {
            const match = f.id?.match(idPattern);
            if (match) {
                maxNum = Math.max(maxNum, parseInt(match[1], 10));
            }
        }
        const nextNum = maxNum + 1;
        const newId = `FEAT-${String(nextNum).padStart(3, '0')}`;

        // Generate kebab-case name from title
        const name = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const newFeature = {
            id: newId,
            name,
            title,
            description: description || '',
            type: 'feat',
            status: 'pending',
            sdd: true,
            priority: priority || 'P2',
            agent: 'harness-vscode',
            sprint: sprint || 'Next',
        };

        features.push(newFeature);
        parsed.features = features;

        // Write back to the file
        const uri = found.base === '.'
            ? vscode.Uri.joinPath(this._workspaceRoot, 'feature_list.json')
            : vscode.Uri.joinPath(this._workspaceRoot, found.base, 'feature_list.json');
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(parsed, null, 2), 'utf8'));

        // Refresh the dashboard graph
        this._sendData();

        return newFeature;
    }

    private async _getSDDSpecFile(
        featureName: string,
        file: 'requirements' | 'design' | 'tasks',
    ): Promise<{ exists: boolean; content: string }> {
        const specPath = `specs/${featureName}/${file}.md`;
        const found = await tryReadInWorkspace(this._workspaceRoot, specPath);
        if (found) return { exists: true, content: found.content };
        return { exists: false, content: '' };
    }

    private async _saveSDDSpecFile(
        featureName: string,
        file: 'requirements' | 'design' | 'tasks',
        content: string,
    ): Promise<{ ok: boolean; error?: string }> {
        // detectSpecsBase returns a path relative to workspaceRoot (e.g. '.' or '.kiro')
        // or the result of the recursive discovery.  We join it to build the final URI.
        const baseRel = await detectSpecsBase(this._workspaceRoot);
        const baseUri = baseRel === '.'
            ? this._workspaceRoot
            : vscode.Uri.joinPath(this._workspaceRoot, baseRel);
        const specPath = `specs/${featureName}/${file}.md`;
        const uri = vscode.Uri.joinPath(baseUri, specPath);
        try {
            const dir = vscode.Uri.joinPath(baseUri, 'specs', featureName);
            await vscode.workspace.fs.createDirectory(dir);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            // Invalidate the cache so the next read picks up the newly created specs/
            invalidateSpecsRootCache(this._workspaceRoot);
            return { ok: true };
        } catch (e: any) {
            return { ok: false, error: e?.message ?? String(e) };
        }
    }

    private async _generateSDDWithAI(
        featureName: string,
        file: 'requirements' | 'design' | 'tasks',
    ): Promise<{ ok: boolean; text?: string; error?: string }> {
        const features = await this._getSDDFeatureList();
        const feature = features.find((f: any) => f.name === featureName);
        if (!feature) {
            return { ok: false, error: `Feature "${featureName}" not found in feature_list.json` };
        }

        // Read the template (specs/templates/ or fallback) — multi-base
        const templatePath = `specs/templates/${file}.md`;
        const templateFound = await tryReadInWorkspace(this._workspaceRoot, templatePath);
        const templateContent = templateFound ? templateFound.content : getFallbackTemplate(file);

        const existing = await this._getSDDSpecFile(featureName, file);
        const prompt = buildAIPrompt(feature, file, templateContent, existing.content);

        return await generateText(prompt, this._log);
    }

    private async _generateSDDSpecDraft(
        featureName: string,
        file: 'requirements' | 'design' | 'tasks',
        userPrompt: string,
        contextContent?: string,
    ): Promise<{ ok: boolean; text?: string; error?: string }> {
        const features = await this._getSDDFeatureList();
        const feature = features.find((f: any) => f.name === featureName);

        const templatePath = `specs/templates/${file}.md`;
        const templateFound = await tryReadInWorkspace(this._workspaceRoot, templatePath);
        const templateContent = templateFound ? templateFound.content : getFallbackTemplate(file);

        const fileLabel = file === 'requirements' ? 'requirements' : file === 'design' ? 'design' : 'tasks';

        // Build a prompt that incorporates the user's description as the primary input
        let prompt = `You are writing a ${fileLabel} file for a software feature.

## User's Feature Description
${userPrompt}

## Template (follow this structure)
${templateContent}
`;
        if (contextContent) {
            prompt += `
## Previously Approved Content (use this as context)
${contextContent.slice(0, 4096)}
`;
        }

        if (feature) {
            prompt += `
## Feature Metadata
- ID: ${feature.id}
- Title: ${feature.title}
- Description: ${feature.description}
- Priority: ${feature.priority}
`;
        }

        prompt += `
## Output
Return only the markdown body, no preamble. Follow the template's structure exactly.`;

        if (prompt.length > 8192) {
            prompt = prompt.slice(0, 8192) + '\n\n[... truncated ...]';
        }

        const result = await generateText(prompt, this._log);

        // If generation succeeded, auto-save the file
        if (result.ok && result.text) {
            const saveResult = await this._saveSDDSpecFile(featureName, file, result.text);
            if (!saveResult.ok) {
                return { ok: true, text: result.text, error: `Generated but save failed: ${saveResult.error}` };
            }
        }

        return result;
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

// ============================================================================
// FEAT-027 — Code Quality Verifier (KISS + DRY hooks on save)
// ============================================================================

import { runCodeQualityHooks, type HookReport, type CodeQualityIssue } from './verifier/codeQualityRunner.js';

interface CodeQualitySetup {
    disposable: vscode.Disposable;
    runManual: (uri?: vscode.Uri) => Promise<void>;
}

const TS_SOURCE_GLOB_SUFFIX = /(^|\/)src\/.+\.(ts|tsx)$/;

/**
 * Wire the KISS and DRY hooks into the extension lifecycle:
 *  - onWillSaveTextDocument: if `blockOnSave: true`, cancel the save on error
 *  - onDidSaveTextDocument:  run the hooks and surface issues in the Problems
 *    panel and the OutputChannel
 *  - `harness-dashboard.verifyCodeQuality` command: manual run on a chosen file
 *
 * The verifier can be disabled globally with `harness-dashboard.codeQuality.verifyOnSave`.
 * Each hook can be disabled independently with `.kissEnabled` / `.dryEnabled`.
 */
function setupCodeQualityVerifier(root: vscode.Uri, log: vscode.LogOutputChannel): CodeQualitySetup | null {
    const cfg = () => vscode.workspace.getConfiguration('harness-dashboard.codeQuality');
    const diagnostics = vscode.languages.createDiagnosticCollection('harness-code-quality');
    log.info('[codeQuality] verifier initialised');

    function shouldVerify(doc: vscode.TextDocument): boolean {
        if (!cfg().get<boolean>('verifyOnSave', true)) return false;
        if (doc.languageId !== 'typescript' && doc.languageId !== 'typescriptreact') return false;
        const rel = vscode.workspace.asRelativePath(doc.uri, false);
        return TS_SOURCE_GLOB_SUFFIX.test(rel.replace(/\\/g, '/'));
    }

    function readOptions() {
        return {
            kissEnabled: cfg().get<boolean>('kissEnabled', true),
            dryEnabled: cfg().get<boolean>('dryEnabled', true),
            severity: cfg().get<'warning' | 'error'>('severity', 'warning'),
        };
    }

    async function runAndReport(doc: vscode.TextDocument): Promise<HookReport[]> {
        const rel = vscode.workspace.asRelativePath(doc.uri, false);
        const reports = await runCodeQualityHooks(rel, root.fsPath, readOptions());
        const allIssues: Array<CodeQualityIssue & { hook: 'harness-kiss' | 'harness-dry' }> = [];
        for (const r of reports) {
            for (const issue of r.issues) {
                allIssues.push({ ...issue, hook: r.hook });
            }
        }
        diagnostics.set(doc.uri, allIssues.map(toDiagnostic));
        if (reports.length > 0) {
            const summary = reports.map(r =>
                `${r.hook}: ${r.issues.length} issue${r.issues.length === 1 ? '' : 's'}`).join(', ');
            log.info(`[codeQuality] ${rel} — ${summary}`);
        }
        return reports;
    }

    const willSave = vscode.workspace.onWillSaveTextDocument(async (event) => {
        if (!shouldVerify(event.document)) return;
        if (!cfg().get<boolean>('blockOnSave', false)) return;
        const reports = await runAndReport(event.document);
        const hasError = reports.some(r => r.issues.some(i => i.severity === 'error'));
        if (hasError) {
            vscode.window.showWarningMessage(
                `Harness Dashboard: code quality errors detected in ${event.document.fileName.split('/').pop()}. Save cancelled.`
            );
            event.waitUntil(Promise.resolve([]));
        }
    });

    const didSave = vscode.workspace.onDidSaveTextDocument(async (doc) => {
        if (!shouldVerify(doc)) return;
        await runAndReport(doc);
    });

    return {
        disposable: vscode.Disposable.from(willSave, didSave, diagnostics),
        runManual: async (uri?: vscode.Uri) => {
            const target = uri ?? await pickTsFile();
            if (!target) return;
            const doc = await vscode.workspace.openTextDocument(target);
            await runAndReport(doc);
            log.show(true);
        },
    };
}

async function pickTsFile(): Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles('src/**/*.{ts,tsx}', '**/node_modules/**');
    if (files.length === 0) return undefined;
    const picks = files.map(f => ({ label: vscode.workspace.asRelativePath(f), uri: f }));
    const selected = await vscode.window.showQuickPick(picks, { placeHolder: 'Pick a TS/TSX file to verify' });
    return selected?.uri;
}

function toDiagnostic(issue: CodeQualityIssue & { hook: 'harness-kiss' | 'harness-dry' }): vscode.Diagnostic {
    const range = new vscode.Range(
        Math.max(0, issue.line - 1), 0,
        Math.max(0, issue.line - 1), Number.MAX_SAFE_INTEGER,
    );
    const severity = issue.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
    const diag = new vscode.Diagnostic(range, `[${issue.hook}] ${issue.message}`, severity);
    diag.source = issue.hook;
    diag.code = issue.id;
    return diag;
}
