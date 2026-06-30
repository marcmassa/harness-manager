import * as vscode from 'vscode';
import type { WebviewMessage } from '../types.js';
import { AgenticDetector } from '../agentic-detector/agenticDetector.js';
import { scaffoldAgenticJson, scaffoldFeatureListJson } from '../agentic-detector/scaffold.js';
import { ActionExecutor } from '../agentic-detector/actionExecutor.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;
type SendDataFn = (postMessage?: PostMessageFn) => Promise<void>;

/**
 * Handles advisory/detection message types: dismissing agentic suggestions
 * and applying the Harness+SDD scaffold.
 */
export class AdvisoryCoordinator {
    private _actionExecutor?: ActionExecutor;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _workspaceRoot: vscode.Uri,
        private readonly _log: vscode.LogOutputChannel,
        private _agenticDetector?: AgenticDetector,
    ) {}

    setAgenticDetector(detector: AgenticDetector): void {
        this._agenticDetector = detector;
        this._actionExecutor = new ActionExecutor(this._workspaceRoot, detector, this._log);
    }

    async handle(
        msg: WebviewMessage,
        _postMessage: PostMessageFn,
        _sendData: SendDataFn,
    ): Promise<boolean> {
        switch (msg.type) {
            case 'dismissAgenticSuggestion': {
                const sugId = msg.suggestionId;
                if (sugId && typeof sugId === 'string' && this._agenticDetector) {
                    // Delegate to AgenticDetector — single authoritative path (FEAT-031 T20)
                    await this._agenticDetector.dismissSuggestion(sugId);
                }
                return true;
            }

            case 'applyHarnessSDD': {
                await this._applyHarnessSDD();
                return true;
            }

            case 'rescanAgentic': {
                if (this._agenticDetector) {
                    this._agenticDetector.scan().catch((err: unknown) => {
                        this._log.error(`[AdvisoryCoordinator] rescanAgentic failed: ${err}`);
                    });
                }
                return true;
            }

            case 'executeAdvisoryAction': {
                const { suggestionId, actionId } = msg as unknown as { suggestionId: string; actionId: string };
                const profile = this._agenticDetector?.getProfile();
                const suggestion = profile?.suggestions.find(s => s.id === suggestionId);
                const action = suggestion?.actions?.find(a => a.id === actionId);
                if (!action || !this._actionExecutor) {
                    _postMessage({ type: 'advisoryActionResult', suggestionId, actionId, ok: false, error: 'Action not found' });
                    return true;
                }
                const result = await this._actionExecutor.execute(action);
                _postMessage({ type: 'advisoryActionResult', suggestionId, actionId, ...result });
                return true;
            }

            default:
                return false;
        }
    }

    private async _applyHarnessSDD(): Promise<void> {
        const agentsDir = vscode.Uri.joinPath(this._workspaceRoot, '.agents');
        await vscode.workspace.fs.createDirectory(agentsDir);

        const cliInstalls = this._agenticDetector?.getProfile()?.layers['1'].cliInstalls ?? [];
        const detectedCLI = cliInstalls.length > 0 ? cliInstalls[0].cliId : null;
        const content = scaffoldAgenticJson(detectedCLI);

        await vscode.workspace.fs.writeFile(
            vscode.Uri.joinPath(this._workspaceRoot, '.agents', 'agentic.json'),
            Buffer.from(content, 'utf8'),
        );

        const flUri = vscode.Uri.joinPath(this._workspaceRoot, 'feature_list.json');
        try {
            await vscode.workspace.fs.stat(flUri);
        } catch {
            await vscode.workspace.fs.writeFile(flUri, Buffer.from(scaffoldFeatureListJson(), 'utf8'));
        }

        this._log.info('[ApplyHarnessSDD] Scaffold written. Triggering re-scan…');
        if (this._agenticDetector) {
            await this._agenticDetector.scan();
        }
    }
}
