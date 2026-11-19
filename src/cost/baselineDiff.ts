// FEAT-044 T5 — session cost against git HEAD (R13, R14, R15).
// `compareWithHead` is pure; `readHeadVersions` only runs `git show` and
// `git rev-parse` (read-only, no workspace script, no write).

import matter from '../frontmatter.js';
import type { ComponentSource } from '../optimizer/types.js';
import { estimateTokens } from '../optimizer/tokenEstimator.js';
import { resolveLoadMode } from './loadMode.js';

/** HEAD content per path: a string, null when the path is not in HEAD (new or untracked). */
export type HeadVersions = { available: false; reason: string } | { available: true; files: ReadonlyMap<string, string | null> };

export interface ResourceChange {
    owner: string;
    nodeId: string;
    filePath: string;
    status: 'changed' | 'new' | 'deleted' | 'unchanged';
    /** Session cost (always body or on-trigger description) now and at HEAD. */
    sessionNow: number;
    sessionAtHead: number;
    delta: number;
}

export type CostComparison =
    | { available: false; reason: string }
    | { available: true; owners: Array<{ owner: string; sessionNow: number; sessionAtHead: number; delta: number }>; resources: ResourceChange[] };

/** What one resource costs every session: its body when always, its description when on-trigger. */
function sessionCost(owner: string, source: Pick<ComponentSource, 'nodeType' | 'filePath'>, raw: string): number {
    const { data } = matter(raw);
    const mode = resolveLoadMode(owner, { type: source.nodeType, metadata: { ...data, _filePath: source.filePath } });
    if (mode === 'always') return estimateTokens(raw);
    if (mode === 'on-trigger') return estimateTokens(typeof data.description === 'string' ? data.description : '');
    return 0;
}

export function compareWithHead(sources: readonly ComponentSource[], head: HeadVersions): CostComparison {
    if (!head.available) return { available: false, reason: head.reason };
    const resources: ResourceChange[] = [];
    for (const s of sources) {
        const owner = s.source?.providerId;
        if (!owner || !s.filePath || s.pathKind === 'directory') continue;
        const previous = head.files.get(s.filePath) ?? null;
        const now = s.exists ? sessionCost(owner, s, s.raw) : 0;
        const before = previous === null ? 0 : sessionCost(owner, s, previous);
        const status: ResourceChange['status'] = !s.exists && previous !== null ? 'deleted'
            : previous === null ? 'new'
            : previous === s.raw ? 'unchanged' : 'changed';
        if (!s.exists && previous === null) continue;
        resources.push({ owner, nodeId: s.nodeId, filePath: s.filePath, status, sessionNow: now, sessionAtHead: before, delta: now - before });
    }
    const byOwner = new Map<string, { owner: string; sessionNow: number; sessionAtHead: number; delta: number }>();
    for (const r of resources) {
        const o = byOwner.get(r.owner) ?? { owner: r.owner, sessionNow: 0, sessionAtHead: 0, delta: 0 };
        o.sessionNow += r.sessionNow; o.sessionAtHead += r.sessionAtHead; o.delta += r.delta;
        byOwner.set(r.owner, o);
    }
    return { available: true, owners: [...byOwner.values()].sort((a, b) => a.owner.localeCompare(b.owner)), resources: resources.filter(r => r.status !== 'unchanged') };
}

/** Runs `git` with arguments only (no shell); resolves stdout and the exit code. */
export type GitRunner = (args: string[]) => Promise<{ code: number; stdout: string }>;

export async function readHeadVersions(paths: readonly string[], git: GitRunner): Promise<HeadVersions> {
    const repo = await git(['rev-parse', '--is-inside-work-tree']).catch(() => ({ code: 1, stdout: '' }));
    if (repo.code !== 0 || repo.stdout.trim() !== 'true') return { available: false, reason: 'This workspace is not a git repository, so there is no HEAD to compare with.' };
    const head = await git(['rev-parse', '--verify', 'HEAD']).catch(() => ({ code: 1, stdout: '' }));
    if (head.code !== 0) return { available: false, reason: 'The repository has no commit yet, so there is no HEAD to compare with.' };
    const files = new Map<string, string | null>();
    for (const path of new Set(paths)) {
        // One `HEAD:<path>` argument (it starts with HEAD, so it is never read as an option);
        // no shell is involved. Untracked or new paths exit non-zero.
        const shown = await git(['show', `HEAD:${path}`]).catch(() => ({ code: 1, stdout: '' }));
        files.set(path, shown.code === 0 ? shown.stdout : null);
    }
    return { available: true, files };
}
