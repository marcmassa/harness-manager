// FEAT-033: GeminiCliAdapter — launches Gemini CLI sessions
import type { RunAdapter, RunNode, RunOptions } from '../types.js';
import { exec } from 'child_process';

export class GeminiCliAdapter implements RunAdapter {
    readonly id = 'gemini-cli';
    readonly name = 'Gemini CLI';
    readonly cliCommand = 'gemini';

    async isAvailable(): Promise<boolean> {
        return new Promise(resolve => {
            exec('which gemini', (err) => resolve(!err));
        });
    }

    buildCommand(node: RunNode, opts: RunOptions): string {
        const parts: string[] = ['gemini'];

        if (node.filePath) {
            parts.push('--file', `"${node.filePath}"`);
        }

        const task = opts.featureContext
            ? `${opts.task}\n\nFeature context:\n${opts.featureContext}`
            : opts.task;

        parts.push('--prompt', JSON.stringify(task));

        if (opts.model) {
            parts.push('--model', opts.model);
        }
        if (opts.extraArgs) {
            parts.push(opts.extraArgs);
        }

        return parts.join(' ');
    }
}
