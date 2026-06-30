// FEAT-033: RunCoordinator — handles agent run messages from the webview
import * as vscode from 'vscode';
import type { WebviewMessage } from '../types.js';
import type { RunAdapterRegistry } from '../run/runAdapterRegistry.js';
import type { RunHistoryEntry, RunNode, RunOptions } from '../run/types.js';
import { RUN_HISTORY_KEY } from '../run/types.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;

interface RunAgentPayload {
    nodeId: string;
    nodeName: string;
    nodeFilePath: string;
    nodeType: string;
    adapterId: string;
    task: string;
    featureName?: string;
    model?: string;
    interactive?: boolean;
    extraArgs?: string;
}

/**
 * Handles run-related webview messages: adapter detection, agent execution,
 * terminal lifecycle, and run history persistence.
 */
export class RunCoordinator {
    private _terminals = new Map<string, vscode.Terminal>(); // nodeId → terminal
    private _startTimes = new Map<string, number>();
    private _postToWebview: (msg: unknown) => void = () => {};

    constructor(
        private readonly _registry: RunAdapterRegistry,
        private readonly _root: vscode.Uri,
        private readonly _workspaceState: vscode.Memento,
        private readonly _log: vscode.LogOutputChannel,
    ) {}

    setPostToWebview(fn: (msg: unknown) => void): void {
        this._postToWebview = fn;
    }

    /** Register terminal lifecycle listener. Call once after construction. */
    activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.window.onDidCloseTerminal(t => this._onTerminalClose(t))
        );
    }

    async handle(
        msg: WebviewMessage,
        postMessage: PostMessageFn,
    ): Promise<boolean> {
        switch (msg.type) {
            case 'getRunAdapters': {
                const available = await this._registry.detect();
                const onlyGeneric = available.length === 1 && available[0].id === 'generic';
                postMessage({
                    type: 'runAdapters',
                    adapters: available.map(a => ({ id: a.id, name: a.name })),
                    noCliDetected: onlyGeneric,
                });
                return true;
            }

            case 'runAgent': {
                const payload = msg as unknown as RunAgentPayload & WebviewMessage;
                await this._runAgent(payload, postMessage);
                return true;
            }

            case 'getRunHistory': {
                const history = this._workspaceState.get<RunHistoryEntry[]>(RUN_HISTORY_KEY, []);
                postMessage({ type: 'runHistory', history });
                return true;
            }

            default:
                return false;
        }
    }

    private async _runAgent(params: RunAgentPayload, postMessage: PostMessageFn): Promise<void> {
        const adapter = this._registry.getById(params.adapterId);
        if (!adapter) {
            postMessage({ type: 'agentRunError', nodeId: params.nodeId, error: `Adapter '${params.adapterId}' not found` });
            return;
        }

        // Generic adapter → open file in editor instead of creating a terminal
        if (params.adapterId === 'generic') {
            try {
                const uri = vscode.Uri.joinPath(this._root, params.nodeFilePath);
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch (e: unknown) {
                postMessage({
                    type: 'agentRunError',
                    nodeId: params.nodeId,
                    error: (e as { message?: string })?.message ?? String(e),
                });
            }
            return;
        }

        // Fetch feature context if a feature name was provided
        let featureContext: string | undefined;
        if (params.featureName) {
            featureContext = await this._readFeatureContext(params.featureName);
        }

        const node: RunNode = {
            id: params.nodeId,
            type: params.nodeType as RunNode['type'],
            name: params.nodeName,
            filePath: params.nodeFilePath,
        };
        const opts: RunOptions = {
            task: params.task,
            featureContext,
            model: params.model,
            interactive: params.interactive ?? true,
            extraArgs: params.extraArgs,
        };

        const cmd = adapter.buildCommand(node, opts);
        const termName = `⚡ ${params.nodeName}`;

        // Reuse terminal if still open, otherwise create a new one
        let terminal = this._terminals.get(params.nodeId);
        if (!terminal || terminal.exitStatus !== undefined) {
            terminal = vscode.window.createTerminal({
                name: termName,
                cwd: this._root,
            });
            this._terminals.set(params.nodeId, terminal);
        }

        this._startTimes.set(params.nodeId, Date.now());
        terminal.sendText(cmd);
        terminal.show();

        // Persist run history entry
        const entry: RunHistoryEntry = {
            nodeId: params.nodeId,
            nodeName: params.nodeName,
            adapterId: params.adapterId,
            taskSnippet: params.task.slice(0, 80),
            timestamp: Date.now(),
        };
        this._appendHistory(entry);

        postMessage({ type: 'agentRunStarted', nodeId: params.nodeId });
        this._postToWebview({ type: 'agentRunStarted', nodeId: params.nodeId });
    }

    private _onTerminalClose(terminal: vscode.Terminal): void {
        for (const [nodeId, t] of this._terminals) {
            if (t === terminal) {
                const start = this._startTimes.get(nodeId);
                const durationMs = start ? Date.now() - start : undefined;
                this._updateHistoryDuration(nodeId, durationMs);
                this._terminals.delete(nodeId);
                this._startTimes.delete(nodeId);
                this._postToWebview({ type: 'agentRunEnded', nodeId });
                break;
            }
        }
    }

    private async _readFeatureContext(featureName: string): Promise<string> {
        try {
            const uri = vscode.Uri.joinPath(this._root, `.kiro/specs/${featureName}/requirements.md`);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(bytes).toString('utf8');
            return text.slice(0, 800);
        } catch {
            return '';
        }
    }

    private _appendHistory(entry: RunHistoryEntry): void {
        const history = this._workspaceState.get<RunHistoryEntry[]>(RUN_HISTORY_KEY, []);
        history.unshift(entry);
        void this._workspaceState.update(RUN_HISTORY_KEY, history.slice(0, 20));
    }

    private _updateHistoryDuration(nodeId: string, durationMs?: number): void {
        if (!durationMs) return;
        const history = this._workspaceState.get<RunHistoryEntry[]>(RUN_HISTORY_KEY, []);
        const entry = history.find(e => e.nodeId === nodeId && !e.durationMs);
        if (entry) {
            entry.durationMs = durationMs;
            void this._workspaceState.update(RUN_HISTORY_KEY, history);
        }
    }
}
