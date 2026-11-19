// FEAT-044 T5 — run read-only git commands in the workspace (no shell, bounded).
import { spawn } from 'child_process';
import type { GitRunner } from './baselineDiff.js';

const MAX_OUTPUT = 512 * 1024;

export function createGitRunner(cwd: string): GitRunner {
    return args => new Promise((resolve, reject) => {
        try {
            const child = spawn('git', args, { cwd, timeout: 5000, shell: false });
            let stdout = '';
            child.stdout.on('data', (chunk: Buffer) => { if (stdout.length < MAX_OUTPUT) stdout += chunk.toString('utf8'); });
            child.on('error', reject);
            child.on('close', (code: number | null) => resolve({ code: code ?? 1, stdout }));
        } catch (e) {
            reject(e);
        }
    });
}
