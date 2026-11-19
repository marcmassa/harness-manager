// FEAT-045 T3, FEAT-046 T3 — what the Sources and Findings views show.
// Pure: built from the cached scan, the Advisory profile, the Optimizer report
// and the FEAT-041 ownership decisions; text is formatted in treeText.ts.
import type { DashboardData } from '../types.js';
import type { ResourceOwnership } from '../operations/operationGate.js';
import type { OptimizerReport } from '../optimizer/types.js';
import type { AgenticProfile } from '../agentic-detector/types.js';

export interface ResourceItem {
    nodeId: string;
    /** R6: the resource's name. */
    label: string;
    type: string;
    nativePath?: string;
    sourceUri?: string;
    loadMode?: string;
    tokens?: number;
    score?: number;
    tier?: string;
    findingCount?: number;
    ownerLabel?: string;
    /** Capability levels (FEAT-041 R3). */
    capabilities?: { editing: string; agentRuns: string };
    /** Denied operations with their reasons (FEAT-041 R3). */
    denied: Array<{ label: string; reason: string }>;
}

export interface ProviderCost {
    evaluated: boolean;
    baseline: number;
    catalog: number;
    onDemand: number;
    unpriced: number;
    reason?: string;
}

export interface ProviderGroup {
    providerId: string;
    label: string;
    resources: ResourceItem[];
    /** R7: FEAT-044 session cost, when an Optimizer report covers the provider. */
    cost?: ProviderCost;
}

export type Severity = 'error' | 'warning' | 'info';

export interface FindingItem {
    id: string;
    /** R8: the finding title. */
    label: string;
    ruleId: string;
    severity: Severity;
    dimension?: string;
    detail: string;
    path?: string;
    sourceUri?: string;
    line?: number;
}

export interface FindingResource {
    key: string;
    label: string;
    type?: string;
    sourceUri?: string;
    findings: FindingItem[];
}

export interface FindingGroup {
    owner: string;
    label: string;
    resources: FindingResource[];
}

/** R9: resources by type in this order, then by name. */
const TYPE_ORDER = ['agent', 'subagent', 'skill', 'steering', 'hook'];
const typeRank = (type: string | undefined) => { const i = TYPE_ORDER.indexOf(type ?? ''); return i < 0 ? TYPE_ORDER.length : i; };
const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const worst = (r: FindingResource) => Math.min(...r.findings.map(f => SEVERITY_RANK[f.severity]));

export function buildSources(
    data: DashboardData | null,
    describe: (nodeId: string) => ResourceOwnership | undefined,
    providerLabel: (id: string) => string,
    report: OptimizerReport | null = null,
): ProviderGroup[] {
    const components = new Map((report?.ok ? report.components : []).map(c => [c.nodeId, c]));
    const costs = new Map((report?.cost?.owners ?? []).map(o => [o.owner, o]));
    const groups = new Map<string, ProviderGroup>();
    for (const node of data?.graph.nodes ?? []) {
        const providerId = node.source?.providerId;
        if (!providerId) continue;
        let group = groups.get(providerId);
        if (!group) {
            const c = costs.get(providerId);
            group = { providerId, label: providerLabel(providerId), resources: [], ...(c ? { cost: {
                evaluated: c.evaluated, baseline: c.baseline, catalog: c.catalog,
                onDemand: c.onDemand.reduce((n, r) => n + r.tokens, 0),
                unpriced: c.unpriced.reduce((n, r) => n + r.tokens, 0),
                ...(c.missingEvidence ? { reason: c.missingEvidence } : {}),
            } } : {}) };
            groups.set(providerId, group);
        }
        const owner = describe(node.id);
        const score = components.get(node.id);
        group.resources.push({
            nodeId: node.id, label: node.label, type: node.type,
            nativePath: (node.metadata._filePath as string | undefined) ?? owner?.nativePath,
            sourceUri: node.source?.sourceUri,
            loadMode: node.source?.loadMode,
            tokens: score?.tokenEstimate,
            score: score?.score ?? undefined,
            tier: score?.tier ?? undefined,
            findingCount: score?.findingCount,
            ownerLabel: owner?.providerLabel ?? group.label,
            capabilities: owner?.capabilities ? { editing: owner.capabilities.editing, agentRuns: owner.capabilities.agentRuns } : undefined,
            denied: (owner?.operations ?? []).filter(op => !op.available).map(op => ({ label: op.label, reason: op.reason ?? 'not available' })),
        });
    }
    for (const g of groups.values()) g.resources.sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.label.localeCompare(b.label));
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** A readable label from a source URI's last two segments, else the node id. */
function resourceLabel(sourceUri: string | undefined, nodeId: string): string {
    if (!sourceUri) return nodeId;
    const parts = decodeURIComponent(sourceUri.replace(/^[a-z]+:\/\/[^/]*/, '')).split('/').filter(Boolean);
    return parts.slice(-2).join('/') || nodeId;
}

const IMPACT: Record<string, Severity> = { high: 'warning', medium: 'info', low: 'info' };

export function buildFindings(
    report: OptimizerReport | null,
    profile: AgenticProfile | null,
    providerLabel: (id: string) => string,
    /** The resource's name and type in the scan, when it is there. */
    lookup: (nodeId: string) => { name: string; type: string } | undefined = () => undefined,
): FindingGroup[] {
    const groups = new Map<string, FindingGroup>();
    const add = (owner: string, key: string, fallback: string, sourceUri: string | undefined, item: FindingItem, type?: string) => {
        const g = groups.get(owner) ?? { owner, label: owner === 'workspace' ? 'Workspace-wide' : providerLabel(owner), resources: [] };
        let r = g.resources.find(x => x.key === key);
        if (!r) {
            const known = lookup(key);
            r = { key, label: known?.name ?? fallback, type: known?.type ?? type, sourceUri, findings: [] };
            g.resources.push(r);
        }
        r.findings.push(item);
        groups.set(owner, g);
    };
    for (const f of report?.ok ? report.findings : []) {
        const owner = f.source?.providerId ?? 'workspace';
        add(owner, f.nodeId, f.filePath || f.nodeId, f.source?.sourceUri, {
            id: `${f.ruleId}::${f.nodeId}`, label: f.title, ruleId: f.ruleId, severity: f.severity, dimension: f.dimension,
            detail: f.detail, path: f.filePath || undefined, sourceUri: f.source?.sourceUri, line: f.line,
        }, f.nodeType);
    }
    for (const s of profile?.suggestions ?? []) {
        if (profile?.dismissedSuggestionIds.includes(s.id)) continue;
        const owner = s.scope?.kind === 'provider' ? s.scope.providerId : 'workspace';
        const evidence = s.evidence?.[0];
        // FEAT-045 R3: by the resource the suggestion is evidenced on (merging with its Optimizer
        // findings); a suggestion with no supporting resource sits under the owner itself.
        const key = evidence?.nodeId ?? `advisory:${owner}`;
        const label = evidence ? resourceLabel(evidence.sourceUri, evidence.nodeId) : '(no single resource)';
        add(owner, key, label, evidence?.sourceUri, {
            id: `advisory::${s.id}`, label: s.title, ruleId: s.ruleId ?? s.id, severity: IMPACT[s.impact] ?? 'info',
            detail: s.description, sourceUri: evidence?.sourceUri,
        });
    }
    for (const g of groups.values()) {
        for (const r of g.resources) r.findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.label.localeCompare(b.label));
        g.resources.sort((a, b) => worst(a) - worst(b) || a.label.localeCompare(b.label));    // R9
    }
    return [...groups.values()].sort((a, b) => (a.owner === 'workspace' ? 1 : b.owner === 'workspace' ? -1 : a.label.localeCompare(b.label)));
}

/** FEAT-045 R3: the view badge counts error findings; no badge at zero. */
export function errorCount(groups: readonly FindingGroup[]): number {
    return groups.reduce((n, g) => n + g.resources.reduce((m, r) => m + r.findings.filter(f => f.severity === 'error').length, 0), 0);
}
