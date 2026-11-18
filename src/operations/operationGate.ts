// FEAT-041 T3 — host side of the operation decision (R3, R4).
// Every mutating webview message and command asks the gate first, against
// the latest scan; coordinators ask again after a modal confirmation.

import * as vscode from 'vscode';
import type { DashboardData, HarnessNode } from '../types.js';
import type { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import type { HarnessCapabilities } from '../adapters/capabilities.js';
import type { RunAdapterRegistry } from '../run/runAdapterRegistry.js';
import {
    decide, OPERATIONS, operationForMessage, RESOURCE_OPERATIONS,
    type Decision, type GateContext, type OperationId, type OperationRequest,
} from './operations.js';

export interface OperationAvailability {
    op: OperationId;
    label: string;
    available: boolean;
    /** View-local: available, but kept as Dashboard view data rather than written to a file. */
    viewLocal?: boolean;
    reason?: string;
}

export interface ResourceOwnership {
    providerId?: string;
    providerLabel?: string;
    nativePath?: string;
    capabilities?: HarnessCapabilities;
    operations: OperationAvailability[];
}

export class OperationGate {
    private runnerIds: ReadonlySet<string> = new Set();

    public constructor(
        private readonly registry: AdapterRegistry,
        private readonly getData: () => DashboardData | undefined,
        private readonly runners?: RunAdapterRegistry,
        private readonly isTrusted: () => boolean = () => vscode.workspace.isTrusted,
    ) {}

    /** Re-check installed agent CLIs (cached by the run registry). */
    public async refreshRunners(): Promise<void> {
        this.runnerIds = new Set(((await this.runners?.detect()) ?? []).map(runner => runner.id));
    }

    private context(): GateContext {
        const data = this.getData();
        const nodes = data?.graph.nodes ?? [];
        const owners = new Map(nodes.map(node => [node.id, node.source?.providerId ?? (node.metadata._framework as string | undefined)]));
        // A provider can be detected and own no node yet (an empty manifest).
        const detected = data?.detectedProviders
            ?? [...new Set([...owners.values()].filter((id): id is string => !!id))];
        return {
            owners,
            detected,
            trusted: this.isTrusted(),
            providerLabel: id => this.registry.providerLabel(id),
            providerOperations: id => this.registry.providerOperations(id),
        };
    }

    private decideNow(request: OperationRequest): Decision {
        const runnerAvailable = request.op === 'agentRuns.delegate'
            ? this.runnerIds.size > 0 && [...this.runnerIds].some(id => id !== 'generic')
            : request.runnerId ? this.runnerIds.has(request.runnerId) : undefined;
        return decide(request.op, request.targets, this.context(), {
            runnerId: request.runnerId, runnerAvailable, format: request.format, adoptFormat: request.adoptFormat,
        });
    }

    public async authorize(request: OperationRequest): Promise<Decision> {
        if (request.op.startsWith('agentRuns.')) await this.refreshRunners();
        return this.decideNow(request);
    }

    /** null when the message needs no decision (reads, proposals, view preferences). */
    public async authorizeMessage(msg: { type: string; [key: string]: unknown }): Promise<{ request: OperationRequest; decision: Decision } | null> {
        const request = operationForMessage(msg);
        if (!request) return null;
        return { request, decision: await this.authorize(request) };
    }

    /** What the Dashboard shows for a selected resource (R3). Synchronous: uses the last runner check. */
    public describe(node: HarnessNode): ResourceOwnership {
        const providerId = node.source?.providerId ?? (node.metadata._framework as string | undefined);
        const operations = RESOURCE_OPERATIONS.map(op => {
            const runnerId = op === 'agentRuns.launch' ? providerId : undefined;
            const decision = this.decideNow({ op, targets: [node.id], runnerId });
            return decision.ok
                ? { op, label: OPERATIONS[op].label, available: true, ...(decision.mode === 'view-local' ? { viewLocal: true } : {}) }
                : { op, label: OPERATIONS[op].label, available: false, reason: decision.reason };
        });
        return {
            providerId,
            providerLabel: providerId ? this.registry.providerLabel(providerId) : undefined,
            nativePath: node.metadata._filePath as string | undefined,
            capabilities: providerId ? this.registry.providerCapabilities(providerId) : undefined,
            operations,
        };
    }
}
