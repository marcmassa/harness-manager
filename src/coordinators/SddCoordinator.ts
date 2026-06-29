import * as vscode from 'vscode';
import type { WebviewMessage } from '../types.js';
import { generateText } from '../lmUtils.js';
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

            case 'generateSpecDraft': {
                const { featureName, file, userPrompt, contextContent } = msg as unknown as { featureName: string; file: 'requirements' | 'design' | 'tasks'; userPrompt: string; contextContent?: string };
                const result = await this._generateSpecDraft(featureName, file, userPrompt, contextContent);
                postMessage({ type: 'specDraftResult', ...result, file, featureName });
                return true;
            }

            case 'openInEditor': {
                const resolved = await resolveInWorkspace(this._workspaceRoot, msg.filePath as string);
                if (resolved) {
                    await openFileInEditor(this._workspaceRoot, resolved.fsPath);
                } else {
                    await openFileInEditor(this._workspaceRoot, msg.filePath as string);
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

        let prompt = `You are writing a ${file} file for a software feature.\n\n## User's Feature Description\n${userPrompt}\n\n## Template (follow this structure)\n${templateContent}\n`;
        if (contextContent) prompt += `\n## Previously Approved Content (use this as context)\n${contextContent.slice(0, 4096)}\n`;
        if (feature) prompt += `\n## Feature Metadata\n- ID: ${feature.id}\n- Title: ${feature.title}\n- Description: ${feature.description}\n- Priority: ${feature.priority}\n`;
        prompt += '\n## Output\nReturn only the markdown body, no preamble. Follow the template\'s structure exactly.';
        if (prompt.length > 8192) prompt = prompt.slice(0, 8192) + '\n\n[... truncated ...]';

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
