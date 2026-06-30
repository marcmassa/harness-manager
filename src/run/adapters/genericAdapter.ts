// FEAT-033: GenericAdapter — fallback that opens the agent file in VS Code editor
import type { RunAdapter, RunNode, RunOptions } from '../types.js';

export class GenericAdapter implements RunAdapter {
    readonly id = 'generic';
    readonly name = 'Open in Editor';
    readonly cliCommand = '';

    async isAvailable(): Promise<boolean> {
        return true;
    }

    buildCommand(node: RunNode, _opts: RunOptions): string {
        // RunCoordinator handles 'generic' specially — it calls
        // vscode.window.showTextDocument() instead of creating a terminal.
        return node.filePath;
    }
}
