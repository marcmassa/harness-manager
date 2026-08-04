import * as vscode from 'vscode';
import type { WebviewMessage } from '../types.js';
import { generateText } from '../lmUtils.js';
import { sendPromptToHostChat, detectChatHostName } from '../chatHandoffHost.js';
import { buildSpecDraftPrompt, buildFeatureDescriptionPrompt } from '../sdd/specPrompts.js';
import {
    getFallbackTemplate,
    buildAIPrompt,
    tryReadInWorkspace,
    resolveInWorkspace,
    detectSpecsBase,
    invalidateSpecsRootCache,
    discoverSpecsFromFilesystem,
} from '../sddManagerProvider.js';
import { openFileInEditor } from '../fileUtils.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;
type SendDataFn = (postMessage?: PostMessageFn) => Promise<void>;

/**
 * Handles SDD-panel message types: feature list, spec CRUD, AI generation,
 * feature creation/deletion, and in-editor navigation.
 */
export class SddCoordinator {
    private _scheduleScan?: () => void;

    constructor(
        private readonly _workspaceRoot: vscode.Uri,
        private readonly _log: vscode.LogOutputChannel,
    ) {}

    setScheduleScan(fn: () => void): void {
        this._scheduleScan = fn;
    }

    async handle(
        msg: WebviewMessage,
        postMessage: PostMessageFn,
        sendData: SendDataFn,
    ): Promise<boolean> {
        switch (msg.type) {
            case 'getFeatureList': {
                const jsonFeatures = await this._getFeatureList();
                const discoveredMap = await discoverSpecsFromFilesystem(this._workspaceRoot);

                const jsonNames = new Set(jsonFeatures.map((f: Record<string, unknown>) => f.name));
                const fsFeatures: Record<string, unknown>[] = [];
                let discCounter = 0;
                for (const [name, entry] of discoveredMap) {
                    if (jsonNames.has(name)) continue;
                    discCounter++;
                    fsFeatures.push({
                        id: `DISC-${String(discCounter).padStart(3, '0')}`,
                        name,
                        title: entry.title,
                        description: '',
                        type: 'feat',
                        status: 'discovered',
                        priority: 'P2',
                        agent: '',
                        sprint: '',
                        sdd: false,
                        source: 'filesystem',
                    });
                }

                const taggedJson = jsonFeatures.map((f: Record<string, unknown>) => ({ ...f, source: 'json' }));
                postMessage({ type: 'featureList', features: [...taggedJson, ...fsFeatures] });
                return true;
            }

            case 'getSpecFile': {
                const { featureName, file } = msg as unknown as { featureName: string; file: 'requirements' | 'design' | 'tasks' };
                const result = await this._getSpecFile(featureName, file);
                postMessage({ type: 'specFile', ...result, file, featureName });
                return true;
            }

            case 'saveSpecFile': {
                const { featureName, file, content } = msg as unknown as { featureName: string; file: 'requirements' | 'design' | 'tasks'; content: string };
                const result = await this._saveSpecFile(featureName, file, content);
                postMessage({ type: 'saveResult', ...result, featureName, file });
                this._scheduleScan?.();
                return true;
            }

            case 'generateWithAI': {
                const { featureName, file } = msg as unknown as { featureName: string; file: 'requirements' | 'design' | 'tasks' };
                const result = await this._generateWithAI(featureName, file);
                postMessage({ type: 'aiResult', ...result, file, featureName });
                return true;
            }

            case 'createSpecFile': {
                const { featureName, file } = msg as unknown as { featureName: string; file: 'requirements' | 'design' | 'tasks' };
                const tplFound = await tryReadInWorkspace(this._workspaceRoot, `specs/templates/${file}.md`);
                const templateContent = tplFound ? tplFound.content : getFallbackTemplate(file);
                const saveOk = await this._saveSpecFile(featureName, file, templateContent);
                if (saveOk.ok) {
                    const content = await this._getSpecFile(featureName, file);
                    postMessage({ type: 'specFile', ...content, file, featureName });
                } else {
                    postMessage({ type: 'saveResult', ok: false, error: saveOk.error || 'Could not create spec file', featureName, file });
                }
                return true;
            }

            case 'getAiCapabilities': {
                // The webview cannot probe the host, so it asks. Each panel then
                // renders the action it can actually perform rather than one that
                // will fail.
                let hasEditorModel = false;
                try {
                    hasEditorModel = (await vscode.lm.selectChatModels()).length > 0;
                } catch {
                    hasEditorModel = false;
                }
                const chatHostName = await detectChatHostName();
                const apiKey = vscode.workspace.getConfiguration('harness-dashboard').get<string>('ai.apiKey', '');
                postMessage({ type: 'aiCapabilities', hasEditorModel, chatHostName, hasApiKey: Boolean(apiKey) });
                return true;
            }

            case 'handoffSpecPrompt': {
                const kind = msg.kind as string;
                let prompt = '';
                if (kind === 'specDraft') {
                    const { featureName, file, userPrompt, contextContent } = msg as unknown as
                        { featureName: string; file: 'requirements' | 'design' | 'tasks'; userPrompt: string; contextContent?: string };
                    prompt = await this._buildSpecDraftPromptFor(featureName, file, userPrompt, contextContent);
                } else if (kind === 'generateWithAI') {
                    const { featureName, file } = msg as unknown as { featureName: string; file: 'requirements' | 'design' | 'tasks' };
                    prompt = await this._buildGenerateWithAiPromptFor(featureName, file);
                } else {
                    prompt = buildFeatureDescriptionPrompt({
                        title: (msg.title as string) || '',
                        mode: (msg.mode as string) || 'generate',
                        currentDescription: (msg.currentDescription as string) || '',
                        target: (msg.target as string) || 'createDescription',
                    });
                }

                postMessage({
                    type: 'handoffResult',
                    ...(await sendPromptToHostChat(prompt, { log: this._log, context: 'SDD' })),
                });
                return true;
            }

            case 'generateSpecDraft': {
                const { featureName, file, userPrompt, contextContent } = msg as unknown as { featureName: string; file: 'requirements' | 'design' | 'tasks'; userPrompt: string; contextContent?: string };
                const result = await this._generateSpecDraft(featureName, file, userPrompt, contextContent);
                postMessage({ type: 'specDraftResult', ...result, file, featureName });
                return true;
            }

            case 'openInEditor': {
                // FEAT-034 R42: optional 1-based line, used by optimizer findings.
                const line = typeof msg.line === 'number' ? msg.line : undefined;
                const resolved = await resolveInWorkspace(this._workspaceRoot, msg.filePath as string);
                if (resolved) {
                    await openFileInEditor(this._workspaceRoot, resolved.fsPath, line);
                } else {
                    await openFileInEditor(this._workspaceRoot, msg.filePath as string, line);
                }
                return true;
            }

            case 'createFeature': {
                const newFeat = await this._createFeature(msg.title as string, msg.description as string, (msg.priority as string) || 'P2', (msg.sprint as string) || '');
                postMessage({ type: 'featureCreated', feature: newFeat });
                this._scheduleScan?.();
                return true;
            }

            case 'generateFeatureDescription': {
                const title = (msg.title as string) || '';
                const mode = (msg.mode as string) || 'generate';
                const currentDescription = (msg.currentDescription as string) || '';
                const target = (msg.target as string) || 'createDescription';
                const prompt = buildFeatureDescriptionPrompt({ title, mode, currentDescription, target });
                const result = await generateText(prompt, this._log);
                postMessage({ type: 'featureDescriptionResult', ...result, target });
                return true;
            }

            case 'deleteFeature': {
                const featId = msg.featureId as string;
                const success = await this._deleteFeature(featId);
                postMessage({ type: 'featureDeleted', ok: success, featureId: featId });
                const features = await this._getFeatureList();
                postMessage({ type: 'featureList', features });
                this._scheduleScan?.();
                return true;
            }

            default:
                return false;
        }
    }

    async getFeatureList(): Promise<Record<string, unknown>[]> {
        return this._getFeatureList();
    }

    private async _getFeatureList(): Promise<Record<string, unknown>[]> {
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

    private async _getSpecFile(featureName: string, file: 'requirements' | 'design' | 'tasks'): Promise<{ exists: boolean; content: string }> {
        const found = await tryReadInWorkspace(this._workspaceRoot, `specs/${featureName}/${file}.md`);
        if (found) return { exists: true, content: found.content };
        return { exists: false, content: '' };
    }

    private async _saveSpecFile(featureName: string, file: 'requirements' | 'design' | 'tasks', content: string): Promise<{ ok: boolean; error?: string }> {
        const baseRel = await detectSpecsBase(this._workspaceRoot);
        const baseUri = baseRel === '.' ? this._workspaceRoot : vscode.Uri.joinPath(this._workspaceRoot, baseRel);
        const uri = vscode.Uri.joinPath(baseUri, `specs/${featureName}/${file}.md`);
        try {
            const dir = vscode.Uri.joinPath(baseUri, 'specs', featureName);
            await vscode.workspace.fs.createDirectory(dir);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            invalidateSpecsRootCache(this._workspaceRoot);
            return { ok: true };
        } catch (e: unknown) {
            return { ok: false, error: (e as { message?: string })?.message ?? String(e) };
        }
    }

    /**
     * The prompt `_generateWithAI` would send. Shared with the handoff path so
     * both routes carry byte-identical text — a prompt that differed by button
     * would silently produce different specs.
     */
    private async _buildGenerateWithAiPromptFor(featureName: string, file: 'requirements' | 'design' | 'tasks'): Promise<string> {
        const features = await this._getFeatureList();
        const feature = features.find((f) => f.name === featureName);
        if (!feature) return '';
        const tplFound = await tryReadInWorkspace(this._workspaceRoot, `specs/templates/${file}.md`);
        const templateContent = tplFound ? tplFound.content : getFallbackTemplate(file);
        const existing = await this._getSpecFile(featureName, file);
        return buildAIPrompt(feature, file, templateContent, existing.content);
    }

    /** Same contract as above, for the draft path. */
    private async _buildSpecDraftPromptFor(
        featureName: string,
        file: 'requirements' | 'design' | 'tasks',
        userPrompt: string,
        contextContent?: string,
    ): Promise<string> {
        const features = await this._getFeatureList();
        const feature = features.find((f) => f.name === featureName);
        const tplFound = await tryReadInWorkspace(this._workspaceRoot, `specs/templates/${file}.md`);
        const templateContent = tplFound ? tplFound.content : getFallbackTemplate(file);
        return buildSpecDraftPrompt({ file, userPrompt, templateContent, contextContent, feature });
    }

    private async _generateWithAI(featureName: string, file: 'requirements' | 'design' | 'tasks'): Promise<{ ok: boolean; text?: string; error?: string }> {
        const features = await this._getFeatureList();
        const feature = features.find((f) => f.name === featureName);
        if (!feature) return { ok: false, error: `Feature "${featureName}" not found in feature_list.json` };

        const tplFound = await tryReadInWorkspace(this._workspaceRoot, `specs/templates/${file}.md`);
        const templateContent = tplFound ? tplFound.content : getFallbackTemplate(file);
        const existing = await this._getSpecFile(featureName, file);
        const prompt = buildAIPrompt(feature, file, templateContent, existing.content);
        return generateText(prompt, this._log);
    }

    private async _generateSpecDraft(featureName: string, file: 'requirements' | 'design' | 'tasks', userPrompt: string, contextContent?: string): Promise<{ ok: boolean; text?: string; error?: string }> {
        const features = await this._getFeatureList();
        const feature = features.find((f) => f.name === featureName);

        const tplFound = await tryReadInWorkspace(this._workspaceRoot, `specs/templates/${file}.md`);
        const templateContent = tplFound ? tplFound.content : getFallbackTemplate(file);

        const prompt = buildSpecDraftPrompt({ file, userPrompt, templateContent, contextContent, feature });

        const result = await generateText(prompt, this._log);
        if (result.ok && result.text) {
            const saveResult = await this._saveSpecFile(featureName, file, result.text);
            if (!saveResult.ok) return { ok: true, text: result.text, error: `Generated but save failed: ${saveResult.error}` };
        }
        return result;
    }

    private async _createFeature(title: string, description: string, priority: string, sprint: string): Promise<Record<string, unknown>> {
        const found = await tryReadInWorkspace(this._workspaceRoot, 'feature_list.json');
        if (!found) throw new Error('feature_list.json not found');

        const parsed = JSON.parse(found.content);
        const features: Record<string, unknown>[] = parsed.features || [];

        let maxNum = 0;
        const idPattern = /^FEAT-0*(\d+)$/i;
        for (const f of features) {
            const match = (f.id as string | undefined)?.match(idPattern);
            if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
        }
        const newId = `FEAT-${String(maxNum + 1).padStart(3, '0')}`;
        const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        const newFeature = { id: newId, name, title, description: description || '', type: 'feat', status: 'pending', sdd: true, priority: priority || 'P2', agent: 'harness-vscode', sprint: sprint || 'Next' };
        features.push(newFeature);
        parsed.features = features;

        const uri = found.base === '.'
            ? vscode.Uri.joinPath(this._workspaceRoot, 'feature_list.json')
            : vscode.Uri.joinPath(this._workspaceRoot, found.base, 'feature_list.json');
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(parsed, null, 2), 'utf8'));
        return newFeature;
    }

    private async _deleteFeature(featureId: string): Promise<boolean> {
        const found = await tryReadInWorkspace(this._workspaceRoot, 'feature_list.json');
        if (!found) return false;
        try {
            const parsed = JSON.parse(found.content);
            const features: Record<string, unknown>[] = parsed.features || [];
            const idx = features.findIndex((f) => f.id === featureId);
            if (idx === -1) return false;
            features.splice(idx, 1);
            parsed.features = features;
            const uri = found.base === '.'
                ? vscode.Uri.joinPath(this._workspaceRoot, 'feature_list.json')
                : vscode.Uri.joinPath(this._workspaceRoot, found.base, 'feature_list.json');
            await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(parsed, null, 2), 'utf8'));
            return true;
        } catch {
            return false;
        }
    }
}
