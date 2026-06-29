import * as vscode from 'vscode';
import { HarnessWriter } from '../harnessWriter.js';
import { HarnessParser } from '../harnessParser.js';
import type { MarkdownFileContent, WebviewMessage } from '../types.js';
import { openFileInEditor } from '../fileUtils.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;
type SendDataFn = (postMessage?: PostMessageFn) => Promise<void>;
export type CustomUsesEdge = { source: string; target: string };

export const CUSTOM_USES_EDGES_KEY = 'harness-dashboard.customUsesEdges';

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

            case 'createEdge':
                try {
                    await this._writer.createEdge(msg.source as string, msg.target as string);
                } catch (error: unknown) {
                    if (this._shouldUseCustomEdgeFallback(error)) {
                        await this._upsertCustomUsesEdge(msg.source as string, msg.target as string);
                    } else {
                        throw error;
                    }
                }
                await sendData(postMessage);
                this._scheduleScan?.();
                return true;

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

    private async _deleteEdgeWithFallback(source: string, target: string, label: string): Promise<void> {
        if (label !== 'uses') {
            await this._writer.deleteEdge(source, target, label);
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
