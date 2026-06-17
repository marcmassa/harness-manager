// ============================================================================
// codeQualityRunner.ts — Spawns the KISS and DRY hooks in parallel and
// parses their JSON reports. Used by extension.ts on TS/TSX save.
//
// Implements FEAT-027 T8: `runCodeQualityHooks(filePath, root, options)`
// returns the merged list of hook reports. Each report has the same shape
// the python scripts emit (see hooks/kiss_check.py and hooks/dry_check.py).
// ============================================================================

import { spawn } from 'child_process';
import * as path from 'path';

export type CodeQualitySeverity = 'error' | 'warning';

export interface CodeQualityIssue {
    id: string;
    severity: CodeQualitySeverity;
    line: number;
    message: string;
}

export interface HookReport {
    hook: 'harness-kiss' | 'harness-dry';
    file: string;
    issues: CodeQualityIssue[];
}

export interface RunCodeQualityOptions {
    /** Run the KISS hook. */
    kissEnabled: boolean;
    /** Run the DRY hook. */
    dryEnabled: boolean;
    /** Promote all warnings to errors. */
    severity: 'warning' | 'error';
}

const HOOK_SCRIPTS = {
    'harness-kiss': 'hooks/on-file-saved-kiss-check.sh',
    'harness-dry': 'hooks/on-file-saved-dry-check.sh',
} as const;

type HookId = keyof typeof HOOK_SCRIPTS;

/**
 * Run the enabled hooks in parallel against the given file and return the
 * parsed reports. Hooks that fail to spawn, exit non-zero, or produce
 * non-JSON output are silently dropped — the function never throws.
 *
 * @param filePath Absolute or root-relative path to the TS/TSX file.
 * @param root     Workspace root.
 * @param options  Which hooks to run and the severity override.
 */
export async function runCodeQualityHooks(
    filePath: string,
    root: string,
    options: RunCodeQualityOptions,
): Promise<HookReport[]> {
    const enabled: HookId[] = [];
    if (options.kissEnabled) enabled.push('harness-kiss');
    if (options.dryEnabled) enabled.push('harness-dry');

    const reports = await Promise.all(
        enabled.map((hookId) => runOneHook(hookId, filePath, root, options.severity)),
    );
    return reports.filter((r): r is HookReport => r !== null);
}

/**
 * Internal helper: spawn a single hook script, parse its JSON output.
 * Returns null on any failure (timeout, non-zero exit, malformed JSON).
 * Visible for tests so they can swap out the spawner.
 */
export async function runOneHook(
    hookId: HookId,
    filePath: string,
    root: string,
    severity: 'warning' | 'error',
): Promise<HookReport | null> {
    const scriptRel = HOOK_SCRIPTS[hookId];
    const scriptAbs = path.join(root, scriptRel);
    const fileAbs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);

    const stdout = await spawnHook(scriptAbs, fileAbs, root);
    if (stdout === null) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(stdout);
    } catch {
        return null;
    }
    if (!isReportShape(parsed, hookId)) return null;

    // Apply severity override: when set to 'error', promote warnings to errors.
    const issues = severity === 'error'
        ? parsed.issues.map((i) => ({ ...i, severity: 'error' as const }))
        : parsed.issues;

    return { hook: hookId, file: parsed.file, issues };
}

/**
 * Spawn the hook script with FILE=... in the env. Returns stdout as a
 * string, or null on failure. Kept in a separate function so tests can
 * override it via vi.spyOn.
 */
async function spawnHook(scriptAbs: string, fileAbs: string, root: string): Promise<string | null> {
    return new Promise((resolve) => {
        const child = spawn('bash', [scriptAbs, fileAbs], {
            cwd: root,
            env: { ...process.env, FILE: fileAbs, ROOT_DIR: root },
            timeout: 5000,
        });
        let out = '';
        child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString('utf8'); });
        child.on('error', () => resolve(null));
        child.on('close', (code) => {
            // We accept any non-error exit. The python scripts always
            // exit 0 for "no issues" and non-zero (64/66) for usage
            // errors. We still try to parse stdout: a usage error may
            // emit a partial JSON or just a stderr message.
            //
            // We resolve with stdout regardless of code, and let the
            // shape check decide if the output is valid. Only `error`
            // events (spawn failures) resolve with null.
            resolve(out);
        });
    });
}

function isReportShape(value: unknown, expectedHook: HookId): value is { file: string; issues: CodeQualityIssue[] } {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    if (v.hook !== expectedHook) return false;
    if (typeof v.file !== 'string') return false;
    if (!Array.isArray(v.issues)) return false;
    for (const issue of v.issues) {
        if (typeof issue !== 'object' || issue === null) return false;
        const i = issue as Record<string, unknown>;
        if (typeof i.id !== 'string') return false;
        if (i.severity !== 'error' && i.severity !== 'warning') return false;
        if (typeof i.line !== 'number') return false;
        if (typeof i.message !== 'string') return false;
    }
    return true;
}
