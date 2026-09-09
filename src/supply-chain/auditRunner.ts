// FEAT-036 T12 — the ONLY child_process touchpoint in the supply-chain
// layer. A single, bounded `npm audit --json` run, launched exclusively in
// direct response to an explicit user action (command palette / panel
// button). Never from scan(), activation, or file watchers. (R6, R7)
//
// No HTTP is performed by extension code: `npm audit` is a local npm
// process the user invoked, mirroring src/verifier/codeQualitySetup.ts's
// on-demand local-tooling trust model. (R13)

import { execFile } from 'node:child_process';

export const DEFAULT_AUDIT_TIMEOUT_MS = 15_000;

export type AuditRunResult =
  | { ok: true; payload: unknown }
  | { ok: false; reason: 'spawn' | 'timeout' | 'parse' };

/** Subset of the execFile error shape (no @types/node in this project). */
interface ExecFileLikeError {
  code?: string | number;
  killed?: boolean;
  signal?: string | null;
}

/**
 * Run `npm audit --json` once in `cwd` with a hard timeout (default 15 s,
 * R7). Resolves — never rejects — with:
 *   - `{ ok: true, payload }`  valid JSON stdout (exit code 1 WITH JSON is
 *     a success payload: it means vulnerabilities exist),
 *   - `{ ok: false, reason: 'spawn' }`   npm not on PATH / spawn failure,
 *   - `{ ok: false, reason: 'timeout' }` the 15 s bound was hit,
 *   - `{ ok: false, reason: 'parse' }`   stdout was not parseable JSON.
 * (R8)
 */
export function runNpmAudit(cwd: string, timeoutMs: number = DEFAULT_AUDIT_TIMEOUT_MS): Promise<AuditRunResult> {
  return new Promise(resolve => {
    execFile(
      'npm',
      ['audit', '--json'],
      { cwd, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 },
      (error: ExecFileLikeError | null, stdout: string) => {
        const err = error;
        if (err && err.code === 'ENOENT') {
          resolve({ ok: false, reason: 'spawn' });
          return;
        }
        if (err && (err.killed === true || err.signal !== undefined && err.signal !== null)) {
          resolve({ ok: false, reason: 'timeout' });
          return;
        }
        // Exit ≠ 0 with valid JSON is a success payload; only non-JSON
        // output (or none) counts as a failure.
        if (typeof stdout !== 'string' || stdout.trim() === '') {
          resolve({ ok: false, reason: 'parse' });
          return;
        }
        try {
          const payload = JSON.parse(stdout) as unknown;
          resolve({ ok: true, payload });
        } catch {
          resolve({ ok: false, reason: 'parse' });
        }
      },
    );
  });
}
