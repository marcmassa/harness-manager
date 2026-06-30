import * as vscode from 'vscode';
import { HarnessWriter } from '../harnessWriter.js';
import { HarnessParser } from '../harnessParser.js';
import type { MarkdownFileContent, WebviewMessage } from '../types.js';
import { openFileInEditor } from '../fileUtils.js';
import { generateText } from '../lmUtils.js';
import { ARCHITECTURE_TEMPLATES } from '../whiteboard/architectureTemplates.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;
type SendDataFn = (postMessage?: PostMessageFn) => Promise<void>;
export type CustomUsesEdge = { source: string; target: string };
export type CustomEdge = { source: string; target: string; label: string };

export const CUSTOM_USES_EDGES_KEY = 'harness-dashboard.customUsesEdges';
export const CUSTOM_EDGES_KEY = 'harness-dashboard.customEdges';

/**
 * Handles whiteboard/graph message types: node CRUD, edge CRUD, suggestion
 * actions, markdown file viewing, and skill connection toggles.
 */
export class WhiteboardCoordinator {
    private _scheduleScan?: () => void;

    constructor(
        private readonly _writer: HarnessWriter,
        private readonly _parser: HarnessParser,
        private readonly _context: vscode.ExtensionContext,
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
            case 'createNode':
                if (msg.nodeType === 'subagent') {
                    await this._writer.createSubagent(msg.name as string, msg.description as string);
                } else {
                    await this._writer.createSkill(
                        msg.name as string,
                        msg.description as string,
                        {
                            license: msg.license as string | undefined,
                            compatibility: msg.compatibility as string | undefined,
                            author: msg.author as string | undefined,
                            version: msg.version as string | undefined,
                        }
                    );
                }
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;

            case 'createSteering':
                await this._writer.createSteering(
                    msg.name as string,
                    (msg.content as string) || '',
                    (msg.appliesTo as string) || '*',
                );
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;

            case 'createHook':
                await this._writer.createHook(
                    msg.name as string,
                    (msg.triggerEvent as string) || '',
                    (msg.scriptContent as string) || '',
                );
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;

            case 'deleteNode':
                await this._writer.deleteNode(msg.id as string, msg.nodeType as string);
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;

            case 'updateMetadata':
                await this._writer.updateMetadata(msg.id as string, msg.nodeType as string, msg.metadata as Record<string, unknown>);
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;

            case 'createEdge': {
                const edgeLabel = (msg.label as string) || 'uses';
                if (edgeLabel !== 'uses') {
                    // Non-uses edges (manages/governs/triggers) are stored in workspaceState
                    await this._upsertCustomEdge(msg.source as string, msg.target as string, edgeLabel);
                } else {
                    try {
                        await this._writer.createEdge(msg.source as string, msg.target as string);
                    } catch (error: unknown) {
                        if (this._shouldUseCustomEdgeFallback(error)) {
                            await this._upsertCustomUsesEdge(msg.source as string, msg.target as string);
                        } else {
                            throw error;
                        }
                    }
                }
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;
            }

            case 'deleteEdge':
                await this._deleteEdgeWithFallback(msg.source as string, msg.target as string, (msg.label as string) || 'uses');
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;

            case 'confirmAndDeleteEdge': {
                const result = await vscode.window.showWarningMessage(
                    `Delete this relationship?`,
                    { modal: true, detail: `This will remove the "${(msg.label as string) || 'uses'}" connection between "${msg.source as string}" and "${msg.target as string}".` },
                    'Yes, Delete'
                );
                if (result === 'Yes, Delete') {
                    await this._deleteEdgeWithFallback(msg.source as string, msg.target as string, (msg.label as string) || 'uses');
                    await sendData(postMessage);
                    this._scheduleScan?.();
                }
                return true;
            }

            case 'getMarkdownContent': {
                const mdContent: MarkdownFileContent = await this._parser.getMarkdownContent(msg.nodeId as string, msg.nodeType as string, msg.filePath as string);
                postMessage({ type: 'markdownContent', content: mdContent });
                return true;
            }

            case 'openMarkdownFile': {
                let relPath: string;
                if (typeof msg.filePath === 'string' && msg.filePath.trim().length > 0) {
                    relPath = msg.filePath;
                } else if (msg.nodeType === 'skill') {
                    relPath = `.agents/skills/${msg.nodeId as string}/SKILL.md`;
                } else {
                    relPath = `.agents/subagents/${msg.nodeId as string}/SUBAGENT.md`;
                }
                await openFileInEditor(this._workspaceRoot, relPath);
                return true;
            }

            case 'acceptSuggestion':
                await this._writer.acceptSuggestion(msg.subagentId as string, msg.skillId as string);
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;

            case 'dismissSuggestion': {
                const saId = msg.subagentId;
                const skId = msg.skillId;
                if (saId && skId && typeof saId === 'string' && typeof skId === 'string') {
                    const key = `${saId}::${skId}`;
                    const current = this._context.workspaceState.get<string[]>('harness-dashboard.dismissedSuggestions', []);
                    if (!current.includes(key)) {
                        await this._context.workspaceState.update('harness-dashboard.dismissedSuggestions', [...current, key]);
                    }
                }
                await sendData(postMessage);
                return true;
            }

            case 'reassignSkill':
                await this._writer.reassignSkill(msg.skillId as string, msg.newOwner as string);
                await sendData(postMessage);
                return true;

            case 'updateEdgeLabel':
                await this._writer.updateEdgeLabel(msg.source as string, msg.target as string, msg.label as string);
                await sendData(postMessage);
                return true;

            case 'toggleSkillConnection': {
                const src = msg.source;
                const tgt = msg.target;
                const disable = msg.disabled;
                if (src && tgt && typeof src === 'string' && typeof tgt === 'string') {
                    const key = `${src}::${tgt}`;
                    const current = this._context.workspaceState.get<string[]>('harness-dashboard.disabledConnections', []);
                    const updated = disable
                        ? current.includes(key) ? current : [...current, key]
                        : current.filter(k => k !== key);
                    await this._context.workspaceState.update('harness-dashboard.disabledConnections', updated);
                }
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;
            }

            // FEAT-033 Provider selector: list available vscode.lm models
            case 'getLmModels': {
                try {
                    const models = await vscode.lm.selectChatModels();
                    const modelList = (models ?? []).map(m => ({
                        family: m.family,
                        name: m.name,
                        vendor: m.vendor,
                    }));
                    postMessage({ type: 'lmModels', models: modelList });
                } catch {
                    postMessage({ type: 'lmModels', models: [] });
                }
                return true;
            }

            // FEAT-033 Phase 2: Agent Builder Wizard — AI description generation
            case 'generateAgentDescription': {
                const { name, role, nodeType, modelFamily } = msg as any;
                try {
                    const config = vscode.workspace.getConfiguration('harness-dashboard');
                    const apiKey = config.get<string>('ai.apiKey', '');
                    const endpoint = config.get<string>('ai.endpoint', 'https://api.openai.com/v1/chat/completions');
                    // modelFamily from wizard overrides workspace config (lets user pick Copilot/Kiro/etc.)
                    const model = (modelFamily as string | undefined) || config.get<string>('ai.model', 'gpt-4o-mini');
                    const prompt = `You are helping design an AI agent named "${name}".\nRole: ${role}\nNode type: ${nodeType}\n\nGenerate 5 specific capabilities for this agent. Reply with ONLY a JSON array of strings, no markdown, no explanation.\nExample: ["Analyzes TypeScript code", "Generates test cases", "Reviews PRs for correctness"]`;
                    const result = await generateText(prompt, this._log, { apiKey, endpoint, model });
                    if (result.ok) {
                        const text = result.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
                        const capabilities = JSON.parse(text);
                        postMessage({ type: 'agentDescriptionResult', capabilities });
                    }
                    // If generation fails, silently drop — wizard has a 10s timeout
                } catch {
                    // Silencioso — el wizard hace timeout sin error
                }
                return true;
            }

            // FEAT-033 Phase 2: Agent Builder Wizard — create node from wizard
            case 'createNodeFromWizard': {
                const { nodeType, name, displayName, description, capabilities, connectSkillIds, previewContent } = msg as any;
                if (nodeType === 'skill') {
                    await this._writer.createSkill(name as string, (description as string) || '');
                } else {
                    const content = (previewContent as string) || '';
                    if (content.trim().length > 0) {
                        await this._writer.createSubagentWithContent(name as string, (description as string) || '', content);
                    } else {
                        await this._writer.createSubagent(name as string, (description as string) || '');
                    }
                }
                // Create edges for connected skills
                for (const skillId of ((connectSkillIds as string[]) ?? [])) {
                    try {
                        await this._writer.createEdge(name as string, skillId);
                    } catch {
                        // Skip if edge creation fails (e.g., skill doesn't exist yet)
                    }
                }
                void displayName; // acknowledged — used in preview content written above
                void capabilities; // acknowledged — used in preview content written above
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;
            }

            // FEAT-033 Phase 2: Architecture Templates — list
            case 'getArchitectureTemplates': {
                postMessage({ type: 'architectureTemplates', templates: ARCHITECTURE_TEMPLATES });
                return true;
            }

            // FEAT-033 Phase 2: Architecture Templates — apply
            case 'applyArchitectureTemplate': {
                const templateId = (msg as any).templateId as string;
                const template = ARCHITECTURE_TEMPLATES.find(t => t.id === templateId);
                if (!template) return true;

                // Map template node ID → actual name for edge resolution
                const nodeMap: Record<string, string> = {};
                for (const node of template.nodes) {
                    nodeMap[node.id] = node.name;
                    try {
                        if (node.type === 'skill') {
                            await this._writer.createSkill(node.name, node.description);
                        } else {
                            await this._writer.createSubagent(node.name, node.description);
                        }
                    } catch {
                        // Skip — node already exists
                    }
                }

                for (const edge of template.edges) {
                    const sourceName = nodeMap[edge.source];
                    const targetName = nodeMap[edge.target];
                    if (sourceName && targetName) {
                        try {
                            await this._writer.createEdge(sourceName, targetName);
                        } catch (error: unknown) {
                            if (this._shouldUseCustomEdgeFallback(error)) {
                                await this._upsertCustomUsesEdge(sourceName, targetName);
                            }
                            // Otherwise skip silently
                        }
                    }
                }

                await sendData(postMessage);
                this._scheduleScan?.();
                return true;
            }

            default:
                return false;
        }
    }

    private _shouldUseCustomEdgeFallback(error: unknown): boolean {
        const message = String((error as { message?: string })?.message || '');
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

    private async _upsertCustomEdge(source: string, target: string, label: string): Promise<void> {
        if (!source || !target || source === target) return;
        const current = this._context.workspaceState.get<CustomEdge[]>(CUSTOM_EDGES_KEY, []);
        if (current.some(e => e.source === source && e.target === target && e.label === label)) return;
        await this._context.workspaceState.update(CUSTOM_EDGES_KEY, [...current, { source, target, label }]);
    }

    private async _removeCustomUsesEdge(source: string, target: string): Promise<void> {
        const current = this._context.workspaceState.get<CustomUsesEdge[]>(CUSTOM_USES_EDGES_KEY, []);
        const updated = current.filter(
            (edge) => !((edge.source === source && edge.target === target) ||
                        (edge.source === target && edge.target === source))
        );
        if (updated.length !== current.length) {
            await this._context.workspaceState.update(CUSTOM_USES_EDGES_KEY, updated);
        }
    }

    private async _removeCustomEdge(source: string, target: string, label: string): Promise<void> {
        const current = this._context.workspaceState.get<CustomEdge[]>(CUSTOM_EDGES_KEY, []);
        const updated = current.filter(
            e => !((e.source === source && e.target === target && e.label === label) ||
                   (e.source === target && e.target === source && e.label === label))
        );
        if (updated.length !== current.length) {
            await this._context.workspaceState.update(CUSTOM_EDGES_KEY, updated);
        }
    }

    private async _deleteEdgeWithFallback(source: string, target: string, label: string): Promise<void> {
        // Non-uses edges are only in workspaceState
        if (label !== 'uses') {
            await this._removeCustomEdge(source, target, label);
            // Also attempt to delete from any writer storage (graceful fail)
            try { await this._writer.deleteEdge(source, target, label); } catch { /* no-op */ }
            return;
        }
        try {
            await this._writer.deleteEdge(source, target, label);
        } catch (error: unknown) {
            if (!this._shouldUseCustomEdgeFallback(error)) throw error;
        }
        await this._removeCustomUsesEdge(source, target);
    }
}
