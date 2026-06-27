import * as vscode from 'vscode';
import type { WebviewMessage } from '../types.js';
import { AgenticDetector } from '../agentic-detector/agenticDetector.js';
import { scaffoldAgenticJson, scaffoldFeatureListJson } from '../agentic-detector/scaffold.js';

type PostMessageFn = (msg: unknown) => Thenable<boolean> | void;
type SendDataFn = (postMessage?: PostMessageFn) => Promise<void>;

/**
 * Handles advisory/detection message types: dismissing agentic suggestions
 * and applying the Harness+SDD scaffold.
 */
export class AdvisoryCoordinator {
    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _workspaceRoot: vscode.Uri,
        private readonly _log: vscode.LogOutputChannel,
        private _agenticDetector?: AgenticDetector,
    ) {}

    setAgenticDetector(detector: AgenticDetector): void {
        this._agenticDetector = detector;
    }

    async handle(
        msg: WebviewMessage,
        _postMessage: PostMessageFn,
        _sendData: SendDataFn,
    ): Promise<boolean> {
        switch (msg.type) {
            case 'dismissAgenticSuggestion': {
                const sugId = msg.suggestionId;
                if (sugId && typeof sugId === 'string') {
                    const current = this._context.workspaceState.get<string[]>('agenticDetector.dismissedSuggestionIds', []);
                    if (!current.includes(sugId)) {
                        await this._context.workspaceState.update('agenticDetector.dismissedSuggestionIds', [...current, sugId]);
                    }
                }
                return true;
            }

            case 'applyHarnessSDD': {
                await this._applyHarnessSDD();
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
