// FEAT-041 T2 — read-only provider built from one validated profile v1.

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import matter from '../frontmatter.js';
import type { HarnessEdge, ParserResult } from '../types.js';
import type { IAgentAdapter } from './IAgentAdapter.js';
import { DISCOVERY_ONLY, type HarnessCapabilities } from './capabilities.js';
import { PROFILE_SOURCE, type ProfileV1 } from './profileV1.js';
import { createEmptyResult, normalizePath, withFrameworkMetadata } from './adapterUtils.js';

export const MAX_PROFILE_FILES = 2000;
export const MAX_PROFILE_FILE_BYTES = 256 * 1024;

/** Resolves a URI to its real path, or undefined when that cannot be proven safe. */
export type RealPathResolver = (uri: vscode.Uri) => Promise<string | undefined>;

export const defaultRealPath: RealPathResolver = async uri => {
    try {
        if (uri.scheme === 'file') return normalizePath(await fs.realpath(uri.fsPath));
        // Without a realpath primitive on remote file systems, refuse links outright.
        const stat = await vscode.workspace.fs.stat(uri);
        return (stat.type & vscode.FileType.SymbolicLink) ? undefined : uri.path;
    } catch {
        return undefined;
    }
};

/**
 * Default native ID: the file name without extension, or the parent folder
 * for conventional fixed names (`skills/lint/SKILL.md` → `lint`).
 */
const FIXED_NAMES = /^(?:skill|subagent|agent|agents)$/i;
const stem = (path: string) => {
    const parts = path.split('/');
    const base = (parts.pop() ?? path).replace(/\.[^.]+$/, '');
    return FIXED_NAMES.test(base) && parts.length > 0 ? parts[parts.length - 1] : base;
};
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const within = (base: string, path: string) => path === base || path.startsWith(base.replace(/\/+$/, '') + '/');

export class ProfileAdapter implements IAgentAdapter {
    public constructor(
        private readonly profile: ProfileV1,
        private readonly realPath: RealPathResolver = defaultRealPath,
    ) {}

    public id(): string { return this.profile.id; }
    public label(): string { return this.profile.label; }
    public capabilities(): HarnessCapabilities { return { ...DISCOVERY_ONLY }; }
    public operations(): [] { return []; }
    public isPathConfigurable(): boolean { return false; }
    public setHarnessConfig(): void { /* profiles are already resolved from the config */ }

    public watchGlobs(): string[] {
        return [...this.profile.markers, ...this.profile.entities.map(e => e.glob)];
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        for (const marker of this.profile.markers) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, marker));
                return true;
            } catch { /* try the next marker */ }
        }
        return false;
    }

    public async parse(root: vscode.Uri, token?: vscode.CancellationToken): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const { id: providerId, label: providerLabel } = this.profile;
        const report = (file: string, message: string) => result.errors.push({ file, message: `[${providerId}] ${message}` });
        const rootReal = await this.realPath(root);
        if (!rootReal) {
            report(PROFILE_SOURCE, 'workspace root could not be resolved; profile skipped');
            return result;
        }

        // nativeId → node info, per type, for relationship resolution.
        const byType = new Map<string, Map<string, string>>();
        const owners = new Map<string, string>();
        const frontmatters = new Map<string, { type: string; data: Record<string, unknown>; uri: string }>();
        let budget = MAX_PROFILE_FILES;

        for (const entity of this.profile.entities) {
            if (token?.isCancellationRequested) return result;
            const files = (await vscode.workspace.findFiles(new vscode.RelativePattern(root, entity.glob), undefined, budget + 1, token))
                .sort((a, b) => a.path.localeCompare(b.path));
            if (files.length > budget) {
                report(PROFILE_SOURCE, `more than ${MAX_PROFILE_FILES} files matched; the rest were not read`);
                files.length = budget;
            }
            budget -= files.length;

            for (const file of files) {
                if (token?.isCancellationRequested) return result;
                const uri = file.toString();
                const real = await this.realPath(file);
                if (!real || !within(rootReal, real)) {
                    report(uri, 'resolves outside the workspace root; skipped');
                    continue;
                }
                let content: string;
                try {
                    const stat = await vscode.workspace.fs.stat(file);
                    if ((stat?.size ?? 0) > MAX_PROFILE_FILE_BYTES) {
                        report(uri, `larger than ${MAX_PROFILE_FILE_BYTES} bytes; skipped`);
                        continue;
                    }
                    content = Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf8');
                } catch (error) {
                    report(uri, `unreadable: ${String(error)}`);
                    continue;
                }

                const relativePath = normalizePath(file.path.slice(root.path.replace(/\/+$/, '').length + 1));
                const { data, content: body } = matter(content);
                const nativeId = text(entity.idField ? data[entity.idField] : undefined) ?? stem(relativePath);
                const nodeId = `${providerId}::${nativeId}`;
                const previous = owners.get(nodeId);
                if (previous) {
                    report(uri, `duplicate native ID "${nativeId}" (already declared by ${previous}); skipped`);
                    continue;
                }
                owners.set(nodeId, uri);
                (byType.get(entity.type) ?? byType.set(entity.type, new Map()).get(entity.type)!).set(nativeId, nodeId);
                frontmatters.set(nodeId, { type: entity.type, data, uri });

                const label = text(entity.labelField ? data[entity.labelField] : undefined)
                    ?? text(data.name) ?? text(data.title) ?? nativeId;
                const description = text(data.description) ?? body.split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'))?.trim() ?? '';
                result.graph.nodes.push(withFrameworkMetadata({
                    id: nodeId,
                    type: entity.type,
                    label,
                    metadata: {
                        ...data, description, body: body.slice(0, 500), _fullBody: body,
                        // FEAT-044: the profile declares the load mode, never the file's own frontmatter.
                        _loadMode: entity.loadMode ?? 'unknown',
                    },
                }, providerId, providerLabel, relativePath));
            }
        }

        for (const rel of this.profile.relationships) {
            const targets = byType.get(rel.toType) ?? new Map<string, string>();
            for (const [nodeId, fm] of frontmatters) {
                if (fm.type !== rel.fromType || fm.data[rel.field] === undefined) continue;
                const raw = fm.data[rel.field];
                for (const value of (Array.isArray(raw) ? raw : [raw])) {
                    const ref = text(value);
                    const target = ref ? targets.get(ref) : undefined;
                    if (!target) {
                        report(fm.uri, `${rel.field}: unresolved ${rel.toType} reference ${JSON.stringify(value)}`);
                        continue;
                    }
                    const edge: HarnessEdge = { id: `${providerId}::edge::${nodeId}::${target}::${rel.label}`, source: nodeId, target, label: rel.label };
                    result.graph.edges.push(edge);
                }
            }
        }
        return result;
    }
}
