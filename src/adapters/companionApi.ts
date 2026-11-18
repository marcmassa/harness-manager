// FEAT-041 T2 — versioned companion extension API (docs/byoh/adapter-capabilities.md).
//
//   const api = vscode.extensions.getExtension('marcmassa.harness-dashboard-vscode')?.exports;
//   if (api?.apiVersion === 1) context.subscriptions.push(api.registerAdapter(provider));
//
// A companion is installed code the user chose; it can read and report, never
// gain a write or run operation through this contract.

import * as vscode from 'vscode';
import type { ParserResult } from '../types.js';
import type { AdapterRegistry, Disposable } from './AdapterRegistry.js';
import type { IAgentAdapter } from './IAgentAdapter.js';
import { isHarnessCapabilities, type HarnessCapabilities } from './capabilities.js';
import { createEmptyResult } from './adapterUtils.js';
import { isOperationId, OPERATIONS, type OperationId } from '../operations/operations.js';

export const COMPANION_API_VERSION = 1;

export interface CompanionAdapterV1 {
    id: string;
    label: string;
    capabilities: HarnessCapabilities;
    /** Operations the provider implements; each must belong to a supported or partial capability. Default: none. */
    operations?: OperationId[];
    detect(root: vscode.Uri): Promise<boolean> | boolean;
    parse(root: vscode.Uri, token?: vscode.CancellationToken): Promise<Partial<ParserResult>> | Partial<ParserResult>;
    watchGlobs(): string[];
}

export interface HarnessDashboardApiV1 {
    readonly apiVersion: 1;
    registerAdapter(provider: CompanionAdapterV1): Disposable;
}

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Keep only well-formed nodes and edges, so one provider cannot break the merged graph. */
function sanitize(providerId: string, raw: Partial<ParserResult> | undefined): ParserResult {
    const result = createEmptyResult();
    const nodes = Array.isArray(raw?.graph?.nodes) ? raw!.graph!.nodes : [];
    for (const node of nodes) {
        if (node && typeof node.id === 'string' && typeof node.type === 'string' && typeof node.label === 'string') {
            result.graph.nodes.push({
                ...node,
                metadata: { ...(node.metadata ?? {}), _framework: providerId, _frameworkLabel: node.metadata?._frameworkLabel ?? providerId },
            });
        } else {
            result.errors.push({ file: providerId, message: `[${providerId}] dropped a malformed node` });
        }
    }
    const ids = new Set(result.graph.nodes.map(n => n.id));
    for (const edge of Array.isArray(raw?.graph?.edges) ? raw!.graph!.edges : []) {
        if (edge && typeof edge.id === 'string' && ids.has(edge.source) && ids.has(edge.target)) result.graph.edges.push(edge);
        else result.errors.push({ file: providerId, message: `[${providerId}] dropped an edge with unknown endpoints` });
    }
    result.errors.push(...(Array.isArray(raw?.errors) ? raw!.errors! : []));
    return result;
}

export function toAdapter(provider: CompanionAdapterV1): IAgentAdapter {
    const { id, label } = provider;
    const capabilities = { ...provider.capabilities };
    const operations = [...(provider.operations ?? [])];
    return {
        id: () => id,
        label: () => label,
        capabilities: () => ({ ...capabilities }),
        operations: () => [...operations],
        isPathConfigurable: () => false,
        setHarnessConfig: () => { /* companions read their own configuration */ },
        watchGlobs: () => {
            const globs = provider.watchGlobs();
            return Array.isArray(globs) ? globs.filter((g): g is string => typeof g === 'string') : [];
        },
        detect: async root => (await provider.detect(root)) === true,
        parse: async (root, token) => {
            const raw = await provider.parse(root, token);
            const result = sanitize(id, raw);
            for (const node of result.graph.nodes) node.metadata._frameworkLabel = label;
            return result;
        },
    };
}

export function validateCompanion(provider: unknown): asserts provider is CompanionAdapterV1 {
    const p = provider as Partial<CompanionAdapterV1> | undefined;
    if (!p || typeof p !== 'object') throw new Error('Harness Dashboard: provider must be an object');
    if (typeof p.id !== 'string' || !ID_RE.test(p.id)) throw new Error(`Harness Dashboard: provider id must match ${ID_RE.source}`);
    if (typeof p.label !== 'string' || !p.label.trim()) throw new Error(`Harness Dashboard: provider "${p.id}" needs a label`);
    if (!isHarnessCapabilities(p.capabilities)) throw new Error(`Harness Dashboard: provider "${p.id}" must declare all seven capability levels`);
    if (p.operations !== undefined && !Array.isArray(p.operations)) throw new Error(`Harness Dashboard: provider "${p.id}" operations must be an array`);
    for (const op of p.operations ?? []) {
        if (!isOperationId(op)) throw new Error(`Harness Dashboard: provider "${p.id}" declares unknown operation ${JSON.stringify(op)}`);
        const capability = OPERATIONS[op].capability;
        if (!capability || p.capabilities[capability] === 'unsupported') {
            throw new Error(`Harness Dashboard: provider "${p.id}" declares ${op} without that capability`);
        }
    }
    for (const fn of ['detect', 'parse', 'watchGlobs'] as const) {
        if (typeof p[fn] !== 'function') throw new Error(`Harness Dashboard: provider "${p.id}" must implement ${fn}()`);
    }
}

export function createCompanionApi(registry: AdapterRegistry | undefined): HarnessDashboardApiV1 {
    return Object.freeze({
        apiVersion: COMPANION_API_VERSION,
        registerAdapter(provider: CompanionAdapterV1): Disposable {
            validateCompanion(provider);
            // No workspace folder: accept the call so companions need no special case.
            if (!registry) return { dispose: () => { /* nothing registered */ } };
            return registry.register(toAdapter(provider));
        },
    } as const);
}
