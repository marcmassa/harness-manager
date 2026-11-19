// FEAT-045 T3 — what the Sources and Findings views show (R2, R3, R4).
// Pure: built from the cached scan, the Advisory profile, the Optimizer report
// and the FEAT-041 ownership decisions; the tree providers only render it.
import type { DashboardData } from '../types.js';
import type { ResourceOwnership } from '../operations/operationGate.js';
import type { OptimizerReport } from '../optimizer/types.js';
import type { AgenticProfile } from '../agentic-detector/types.js';

export interface ResourceItem {
    nodeId: string;
    label: string;
    type: string;
    nativePath?: string;
    sourceUri?: string;
    loadMode?: string;
    /** Capability levels and denied operations with reasons (FEAT-041 R3). */
    tooltip: string;
}

export interface ProviderGroup {
    providerId: string;
    label: string;
    resources: ResourceItem[];
}

export interface FindingItem {
    id: string;
    label: string;
    severity: 'error' | 'warning' | 'info';
    detail: string;
    sourceUri?: string;
    line?: number;
}

export interface FindingGroup {
    owner: string;
    label: string;
    resources: Array<{ key: string; label: string; sourceUri?: string; findings: FindingItem[] }>;
}

const describeOwnership = (o: ResourceOwnership | undefined): string => {
    if (!o) return 'Owner unknown';
    const caps = o.capabilities ? `Editing ${o.capabilities.editing} · Agent runs ${o.capabilities.agentRuns}` : '';
    const denied = o.operations.filter(op => !op.available).map(op => `${op.label}: ${op.reason ?? 'not available'}`);
    return [`${o.providerLabel ?? o.providerId ?? 'Unknown owner'} — ${o.nativePath ?? 'not file-backed'}`, caps, ...denied].filter(Boolean).join('\n');
};

export function buildSources(
    data: DashboardData | null,
    describe: (nodeId: string) => ResourceOwnership | undefined,
    providerLabel: (id: string) => string,
): ProviderGroup[] {
    const groups = new Map<string, ProviderGroup>();
    for (const node of data?.graph.nodes ?? []) {
        const providerId = node.source?.providerId;
        if (!providerId) continue;
        const group = groups.get(providerId) ?? { providerId, label: providerLabel(providerId), resources: [] };
        group.resources.push({
            nodeId: node.id, label: node.label, type: node.type,
            nativePath: node.metadata._filePath as string | undefined,
            sourceUri: node.source?.sourceUri,
            loadMode: node.source?.loadMode,
            tooltip: describeOwnership(describe(node.id)),
        });
        groups.set(providerId, group);
    }
    for (const g of groups.values()) g.resources.sort((a, b) => (a.nativePath ?? a.label).localeCompare(b.nativePath ?? b.label));
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** A readable label from a source URI's last two segments, else the node id. */
function resourceLabel(sourceUri: string | undefined, nodeId: string): string {
    if (!sourceUri) return nodeId;
    const parts = decodeURIComponent(sourceUri.replace(/^[a-z]+:\/\/[^/]*/, '')).split('/').filter(Boolean);
    return parts.slice(-2).join('/') || nodeId;
}

const IMPACT: Record<string, FindingItem['severity']> = { high: 'warning', medium: 'info', low: 'info' };

export function buildFindings(
    report: OptimizerReport | null,
    profile: AgenticProfile | null,
    providerLabel: (id: string) => string,
): FindingGroup[] {
    const groups = new Map<string, FindingGroup>();
    const add = (owner: string, key: string, label: string, sourceUri: string | undefined, item: FindingItem) => {
        const g = groups.get(owner) ?? { owner, label: owner === 'workspace' ? 'Workspace-wide' : providerLabel(owner), resources: [] };
        let r = g.resources.find(x => x.key === key);
        if (!r) { r = { key, label, sourceUri, findings: [] }; g.resources.push(r); }
        r.findings.push(item);
        groups.set(owner, g);
    };
    for (const f of report?.ok ? report.findings : []) {
        const owner = f.source?.providerId ?? 'workspace';
        add(owner, f.nodeId, f.filePath || f.nodeId, f.source?.sourceUri,
            { id: `${f.ruleId}::${f.nodeId}`, label: `${f.ruleId} ${f.title}`, severity: f.severity, detail: f.detail, sourceUri: f.source?.sourceUri, line: f.line });
    }
    for (const s of profile?.suggestions ?? []) {
        if (profile?.dismissedSuggestionIds.includes(s.id)) continue;
        const owner = s.scope?.kind === 'provider' ? s.scope.providerId : 'workspace';
        const evidence = s.evidence?.[0];
        // R3: by the resource the suggestion is evidenced on (merging with its Optimizer
        // findings); a suggestion with no supporting resource sits under the owner itself.
        const key = evidence?.nodeId ?? `advisory:${owner}`;
        const label = evidence ? resourceLabel(evidence.sourceUri, evidence.nodeId) : '(no single resource)';
        add(owner, key, label, evidence?.sourceUri,
            { id: `advisory::${s.id}`, label: s.title, severity: IMPACT[s.impact] ?? 'info', detail: s.description, sourceUri: evidence?.sourceUri });
    }
    return [...groups.values()].sort((a, b) => (a.owner === 'workspace' ? 1 : b.owner === 'workspace' ? -1 : a.label.localeCompare(b.label)));
}

/** R3: the view badge counts error findings; no badge at zero. */
export function errorCount(groups: readonly FindingGroup[]): number {
    return groups.reduce((n, g) => n + g.resources.reduce((m, r) => m + r.findings.filter(f => f.severity === 'error').length, 0), 0);
}
