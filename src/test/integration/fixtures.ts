// FEAT-048 R7 — helpers shared by the Extension Host suites.
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import type * as vscode from 'vscode';

/** Every file under `dir`, relative path → content. `skipGit` leaves out `.git/`. */
export async function snapshot(dir: string, options: { skipGit?: boolean } = {}): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const entry of await nodeFs.readdir(dir, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const file = path.join(entry.parentPath, entry.name);
        if (options.skipGit && file.includes(`${path.sep}.git${path.sep}`)) continue;
        out[path.relative(dir, file)] = await nodeFs.readFile(file, 'utf8');
    }
    return out;
}

/** An extension context whose workspace state lives in memory. */
export function fakeContext(): vscode.ExtensionContext {
    const state = new Map<string, unknown>();
    const workspaceState = {
        get: (key: string, fallback?: unknown) => (state.has(key) ? state.get(key) : fallback),
        update: async (key: string, value: unknown) => { state.set(key, value); },
        keys: () => [...state.keys()],
    };
    return { workspaceState, subscriptions: [] } as unknown as vscode.ExtensionContext;
}
