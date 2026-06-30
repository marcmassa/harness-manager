// FEAT-033: ClaudeCodeAdapter — launches Claude Code CLI sessions
import type { RunAdapter, RunNode, RunOptions } from '../types.js';
import { exec } from 'child_process';

export class ClaudeCodeAdapter implements RunAdapter {
    readonly id = 'claude-code';
    readonly name = 'Claude Code';
    readonly cliCommand = 'claude';

    async isAvailable(): Promise<boolean> {
        return new Promise(resolve => {
            exec('which claude', (err) => resolve(!err));
        });
    }

    buildCommand(node: RunNode, opts: RunOptions): string {
        const parts: string[] = ['claude'];
        const interactive = opts.interactive ?? true;

        if (!interactive) {
            // One-shot: non-interactive, prints response and exits
            const task = this._buildTaskString(node, opts);
            parts.push('--print', JSON.stringify(task));
        }
        // Interactive: just `claude` — no pre-fill flag exists in Claude Code CLI.
        // The task text is visible in the Run Panel so the user can reference it.

        if (opts.model) {
            parts.push('--model', opts.model);
        }
        if (opts.extraArgs) {
            parts.push(opts.extraArgs);
        }

        return parts.join(' ');
    }

    private _buildTaskString(node: RunNode, opts: RunOptions): string {
        let task = '';
        if (node.filePath) {
            task += `[Context: ${node.filePath}]\n`;
        }
        task += opts.task;
        if (opts.featureContext) {
            task += `\n\n---\nFeature context:\n${opts.featureContext}`;
        }
        return task;
    }
}
