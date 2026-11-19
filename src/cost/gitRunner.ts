// FEAT-044 T5 — run read-only git commands in the workspace (no shell, bounded).
import { spawn } from 'child_process';
import type { GitRunner } from './baselineDiff.js';

const MAX_OUTPUT = 512 * 1024;

export function createGitRunner(cwd: string): GitRunner {
    return args => new Promise((resolve, reject) => {
        try {
            // core.fsmonitor=false: a repository's config must never start a hook-like process (R15).
            const child = spawn('git', ['-c', 'core.fsmonitor=false', ...args], { cwd, timeout: 5000, shell: false });
            let stdout = '';
            let truncated = false;
            child.stdout.on('data', (chunk: Buffer) => {
                if (stdout.length + chunk.length > MAX_OUTPUT) truncated = true;
                else stdout += chunk.toString('utf8');
            });
            child.on('error', reject);
            child.on('close', (code: number | null, signal: string | null) =>
                resolve({ code: code ?? 1, stdout, ...(signal ? { timedOut: true } : {}), ...(truncated ? { truncated: true } : {}) }));
        } catch (e) {
            reject(e);
        }
    });
}
