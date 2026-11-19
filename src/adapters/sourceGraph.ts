import * as vscode from 'vscode';
import { SUPPORTED_FRAMEWORKS } from '../frameworks.js';
import type { ParserResult } from '../types.js';
import { resolveLoadMode } from '../cost/loadMode.js';

export interface ProviderResult {
    providerId: string;
    result: Partial<ParserResult>;
}

// Existing adapters were merged in registration order. Retain the old winner's
// key for saved positions. Independently registered owners get separate keys.
const builtInIds = new Set(SUPPORTED_FRAMEWORKS.map(adapter => adapter.id));

function displayId(id: string, providerId: string, duplicates: Set<string>, reserved: Set<string>): string {
    if (!duplicates.has(id)) return id;
    let candidate = 'byoh:' + encodeURIComponent(JSON.stringify([providerId, id]));
    while (reserved.has(candidate)) candidate = ':' + candidate;
    return candidate;
}

export function attributeSources(root: vscode.Uri, providers: ProviderResult[]): Partial<ParserResult>[] {
    const legacyOwners = new Map<string, string>();
    const ids = new Set<string>();
    const duplicates = new Set<string>();
    const edgeIds = new Set<string>();
    const duplicateEdges = new Set<string>();
    for (const { providerId, result } of providers) {
        const local = new Set(result.graph?.nodes.map(node => node.id));
        for (const id of local) {
            if (builtInIds.has(providerId) && !legacyOwners.has(id)) legacyOwners.set(id, providerId);
            if (ids.has(id)) duplicates.add(id);
            ids.add(id);
        }
        for (const edge of result.graph?.edges ?? []) {
            if (edgeIds.has(edge.id)) duplicateEdges.add(edge.id);
            edgeIds.add(edge.id);
        }
    }

    const workspaceUri = root.toString();
    return providers.map(({ providerId, result }) => {
        if (!result.graph) return result;
        const nodeIds = new Map<string, string>();
        const nodes = result.graph.nodes.map(node => {
            const id = legacyOwners.get(node.id) === providerId ? node.id : displayId(node.id, providerId, duplicates, ids);
            nodeIds.set(node.id, id);
            const path = node.metadata._filePath ?? (providerId === 'harness-sdd' ? node.metadata._declarationPath : undefined);
            const sourceUri = resolveSourceUri(root, path)?.toString();
            const prefix = providerId + '::';
            const nativeId = node.id.startsWith(prefix) ? node.id.slice(prefix.length) : node.id;
            const loadMode = resolveLoadMode(providerId, node);
            return { ...node, id, source: { workspaceUri, providerId, nativeId, sourceUri, loadMode } };
        });
        const edges = result.graph.edges.map(edge => ({
            ...edge,
            id: displayId(edge.id, providerId, duplicateEdges, edgeIds),
            source: nodeIds.get(edge.source) ?? edge.source,
            target: nodeIds.get(edge.target) ?? edge.target,
        }));
        return { ...result, graph: { nodes, edges } };
    });
}

// Some legacy readers return an absolute path. Only resolve paths inside
// this workspace, preserving the scheme and authority of a remote root.
export function resolveSourceUri(root: vscode.Uri, value: unknown): vscode.Uri | undefined {
    if (typeof value !== 'string' || !value) return undefined;
    const base = root.fsPath.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
    const path = value.replace(/\\/g, '/');
    const relative = path.startsWith(base) ? path.slice(base.length) : path;
    if (!relative || /^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(relative) || relative.split('/').includes('..')) return undefined;
    return vscode.Uri.joinPath(root, relative);
}
