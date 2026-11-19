// FEAT-041 T3 — operation catalog and the host decision (R3, R4).
// Pure: no vscode import. The host (operationGate.ts) supplies the current
// graph, trust and prerequisites; views render the same decisions.

import type { CapabilityKey } from '../adapters/capabilities.js';

export type OperationId =
    | 'editing.createEntity' | 'editing.deleteEntity' | 'editing.updateMetadata'
    | 'editing.linkSkill' | 'editing.unlinkSkill' | 'editing.relabelEdge'
    | 'editing.lifecycle' | 'editing.reviewedTextEdit'
    | 'agentRuns.launch' | 'agentRuns.delegate'
    | 'adoption.scaffold' | 'workspace.audit' | 'workspace.command' | 'view.localRelation';

interface OperationInfo {
    label: string;
    /** Capability a provider must cover to own this operation; undefined → not owner-bound. */
    capability?: CapabilityKey;
    /** Mutates files or launches a process: needs a trusted workspace. */
    needsTrust: boolean;
    /** Cross-owner fallback: keep the relation as view data instead of denying. */
    viewLocalFallback?: boolean;
}

export const OPERATIONS: Readonly<Record<OperationId, OperationInfo>> = {
    'editing.createEntity': { label: 'Create entities', capability: 'editing', needsTrust: true },
    'editing.deleteEntity': { label: 'Delete', capability: 'editing', needsTrust: true },
    'editing.updateMetadata': { label: 'Edit description', capability: 'editing', needsTrust: true },
    'editing.linkSkill': { label: 'Save skill links', capability: 'editing', needsTrust: true, viewLocalFallback: true },
    'editing.unlinkSkill': { label: 'Remove skill links', capability: 'editing', needsTrust: true, viewLocalFallback: true },
    'editing.relabelEdge': { label: 'Rename relationships', capability: 'editing', needsTrust: true },
    'editing.lifecycle': { label: 'Edit features and specs', capability: 'editing', needsTrust: true },
    'editing.reviewedTextEdit': { label: 'Apply reviewed fixes', capability: 'editing', needsTrust: true },
    'agentRuns.launch': { label: 'Run with its agent CLI', capability: 'agentRuns', needsTrust: true },
    'agentRuns.delegate': { label: 'Delegate to an agent CLI', needsTrust: true },
    'adoption.scaffold': { label: 'Scaffold a harness', needsTrust: true },
    'workspace.audit': { label: 'Run npm audit', needsTrust: true },
    'workspace.command': { label: 'Run a command in a terminal', needsTrust: true },
    'view.localRelation': { label: 'Edit view-only relationships', needsTrust: false },
};

/** Operations shown for a selected resource (R3). */
export const RESOURCE_OPERATIONS: readonly OperationId[] = [
    'editing.updateMetadata', 'editing.deleteEntity', 'editing.linkSkill',
    'editing.reviewedTextEdit', 'agentRuns.launch',
];

/**
 * Operations each built-in provider implements, from the source review in
 * docs/byoh/adapter-capabilities.md. The Harness SDD writer is the only
 * structural writer; file-based formats accept reviewed text edits (Optimizer
 * fixes shown as a diff before they land); Claude Code and Gemini CLI have
 * terminal runners. Profiles declare none (they describe reads only).
 */
export const BUILTIN_OPERATIONS: Readonly<Record<string, readonly OperationId[]>> = {
    'harness-sdd': [
        'editing.createEntity', 'editing.deleteEntity', 'editing.updateMetadata', 'editing.linkSkill',
        'editing.unlinkSkill', 'editing.relabelEdge', 'editing.lifecycle', 'editing.reviewedTextEdit',
    ],
    'claude-code': ['editing.reviewedTextEdit', 'agentRuns.launch'],
    'gemini-cli': ['editing.reviewedTextEdit', 'agentRuns.launch'],
    cursor: ['editing.reviewedTextEdit'],
    copilot: ['editing.reviewedTextEdit'],
    kiro: ['editing.reviewedTextEdit'],
    windsurf: ['editing.reviewedTextEdit'],
    opencode: [],
};

export function isOperationId(value: unknown): value is OperationId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(OPERATIONS, value);
}

export interface GateContext {
    /** Owner of every node in the current scan, by display ID. */
    owners: ReadonlyMap<string, string | undefined>;
    providerLabel(providerId: string): string;
    providerOperations(providerId: string): ReadonlySet<OperationId>;
    /** Providers detected in the current scan. */
    detected: readonly string[];
    trusted: boolean;
}

export interface Prerequisites {
    runnerId?: string;
    runnerAvailable?: boolean;
    /** Adoption: the provider format this operation would create. */
    format?: string;
    /**
     * FEAT-042: with no owner of the operation, an explicit adoption of this
     * format is allowed in a workspace that has no harness yet, never inside
     * another provider's harness.
     */
    adoptFormat?: string;
}

export type Decision =
    | { ok: true; mode: 'persist' | 'view-local'; owners: string[] }
    | { ok: false; reason: string };

const deny = (reason: string): Decision => ({ ok: false, reason });

/**
 * The single host decision. `targets` are display node IDs, or 'workspace'
 * for operations that act on the workspace rather than an existing resource.
 */
export function decide(op: OperationId, targets: readonly string[] | 'workspace', ctx: GateContext, pre: Prerequisites = {}): Decision {
    const info = OPERATIONS[op];
    if (info.needsTrust && !ctx.trusted) return deny('This workspace is not trusted.');

    if (targets === 'workspace') {
        if (op === 'agentRuns.delegate' && !pre.runnerAvailable) return deny('No agent CLI is installed for delegation.');
        if (op === 'adoption.scaffold' && pre.format && ctx.detected.includes(pre.format)) {
            return deny(`${ctx.providerLabel(pre.format)} is already set up in this workspace; scaffolding it again would overwrite it.`);
        }
        if (op === 'adoption.scaffold' && pre.adoptFormat && ctx.detected.length > 0 && !ctx.detected.includes(pre.adoptFormat)) {
            return deny(`This would add ${ctx.providerLabel(pre.adoptFormat)} files to a ${ctx.detected.map(ctx.providerLabel).join(', ')} harness. Adopt ${ctx.providerLabel(pre.adoptFormat)} explicitly first.`);
        }
        if (!info.capability) return { ok: true, mode: 'persist', owners: [] };
        const able = ctx.detected.filter(id => ctx.providerOperations(id).has(op));
        if (able.length === 0 && pre.adoptFormat) {
            if (ctx.detected.length === 0) return { ok: true, mode: 'persist', owners: [] };
            return deny(`This would add ${ctx.providerLabel(pre.adoptFormat)} files to a ${ctx.detected.map(ctx.providerLabel).join(', ')} harness. Adopt ${ctx.providerLabel(pre.adoptFormat)} explicitly first.`);
        }
        if (able.length === 0) return deny(`No detected provider supports "${info.label}".`);
        if (able.length > 1) return deny(`More than one provider could own "${info.label}" (${able.map(ctx.providerLabel).join(', ')}).`);
        return { ok: true, mode: 'persist', owners: able };
    }

    if (targets.length === 0) return deny('No target was given.');
    const owners: string[] = [];
    for (const id of targets) {
        if (!ctx.owners.has(id)) return deny(`"${id}" is no longer in the current scan. Refresh and try again.`);
        const owner = ctx.owners.get(id);
        if (!owner) return deny(`"${id}" has no known owner.`);
        if (!owners.includes(owner)) owners.push(owner);
    }
    if (!info.capability) {
        if (op === 'agentRuns.delegate' && !pre.runnerAvailable) return deny('No agent CLI is installed for delegation.');
        return { ok: true, mode: op === 'view.localRelation' ? 'view-local' : 'persist', owners };
    }

    const unable = owners.filter(owner => !ctx.providerOperations(owner).has(op));
    if (unable.length > 0) {
        if (info.viewLocalFallback) return { ok: true, mode: 'view-local', owners };
        if (owners.length > 1) return deny(`Targets belong to different owners (${owners.map(ctx.providerLabel).join(', ')}); ${unable.map(ctx.providerLabel).join(', ')} cannot "${info.label}".`);
        return deny(`${ctx.providerLabel(owners[0])} resources are read-only for "${info.label}".`);
    }
    if (op === 'agentRuns.launch') {
        if (pre.runnerId !== owners[0]) return deny(`Only the ${ctx.providerLabel(owners[0])} runner can launch this resource.`);
        if (!pre.runnerAvailable) return deny(`The ${ctx.providerLabel(owners[0])} CLI is not installed.`);
    }
    return { ok: true, mode: 'persist', owners };
}

/**
 * Bind a run request to the scanned node: the command is built from the
 * host's own record of the resource, never from client-sent path or name.
 */
export function bindRunTarget(msg: Record<string, unknown>, node: { label: string; type: string; metadata: Record<string, unknown> } | undefined): boolean {
    if (!node) return false;
    msg.nodeFilePath = String(node.metadata._filePath ?? '');
    msg.nodeName = node.label;
    msg.nodeType = node.type;
    return true;
}

export interface OperationRequest {
    op: OperationId;
    targets: string[] | 'workspace';
    runnerId?: string;
    format?: string;
    adoptFormat?: string;
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const ids = (...values: unknown[]) => values.map(str);

/**
 * Webview messages that mutate files, workspace state shared with files, or
 * launch processes. Any message absent here is a read, a proposal or a
 * view preference and needs no decision.
 */
export function operationForMessage(msg: { type: string; [key: string]: unknown }): OperationRequest | null {
    switch (msg.type) {
        case 'createNode': case 'createSteering': case 'createHook': case 'createNodeFromWizard':
            return { op: 'editing.createEntity', targets: 'workspace' };
        case 'saveSpecFile': case 'createSpecFile': case 'createFeature': case 'deleteFeature':
            return { op: 'editing.lifecycle', targets: 'workspace' };
        case 'deleteNode':
            return { op: 'editing.deleteEntity', targets: ids(msg.id) };
        case 'updateMetadata':
            return { op: 'editing.updateMetadata', targets: ids(msg.id) };
        case 'createEdge': case 'deleteEdge': case 'confirmAndDeleteEdge': {
            const uses = !msg.label || msg.label === 'uses';
            const op = !uses ? 'view.localRelation' : msg.type === 'createEdge' ? 'editing.linkSkill' : 'editing.unlinkSkill';
            return { op, targets: ids(msg.source, msg.target) };
        }
        case 'toggleSkillConnection':
            return { op: 'view.localRelation', targets: ids(msg.source, msg.target) };
        case 'acceptSuggestion':
            return { op: 'editing.linkSkill', targets: ids(msg.subagentId, msg.skillId) };
        case 'reassignSkill':
            return { op: 'editing.relabelEdge', targets: ids(msg.skillId, msg.newOwner) };
        case 'updateEdgeLabel':
            return { op: 'editing.relabelEdge', targets: ids(msg.source, msg.target) };
        case 'applyQuickFix': case 'aiRefineFinding':
            return { op: 'editing.reviewedTextEdit', targets: ids(msg.nodeId) };
        case 'delegateFinding':
            // A rule-wide delegation names no node: the coordinator decides again
            // with `nodeIds`, the components its scope resolved to.
            if (Array.isArray(msg.nodeIds)) return { op: 'agentRuns.delegate', targets: msg.nodeIds.map(str) };
            return { op: 'agentRuns.delegate', targets: str(msg.nodeId) ? ids(msg.nodeId) : 'workspace' };
        case 'runAgent': {
            const runnerId = str(msg.adapterId);
            // The generic runner only opens the file in the editor: not agent execution.
            if (runnerId === 'generic') return null;
            return { op: 'agentRuns.launch', targets: ids(msg.nodeId), runnerId };
        }
        case 'applyHarnessSDD':
            return { op: 'adoption.scaffold', targets: 'workspace', format: 'harness-sdd' };
        case 'applyArchitectureTemplate':
            // Templates write Harness SDD entities through the SDD writer.
            return { op: 'editing.createEntity', targets: 'workspace', adoptFormat: 'harness-sdd' };
        case 'executeAdvisoryAction':
            // First line only: the coordinator decides the resolved action (requestForAction).
            return { op: 'adoption.scaffold', targets: 'workspace' };
        case 'runSupplyChainAudit':
            return { op: 'workspace.audit', targets: 'workspace' };
        default:
            return null;
    }
}

/** Provider format a scaffolded file belongs to, when it is one provider's entry point. */
export function formatOfPath(relPath: string): string | undefined {
    const path = relPath.replace(/\\/g, '/');
    if (path === 'CLAUDE.md' || path.startsWith('.claude/')) return 'claude-code';
    if (path === 'GEMINI.md' || path.startsWith('.gemini/')) return 'gemini-cli';
    if (path.startsWith('.agents/')) return 'harness-sdd';
    return undefined;
}

/**
 * FEAT-042 R6: the decision an Advisory action needs, resolved from the
 * action itself (never from the message). `null`: a read (open a file).
 */
export function requestForAction(action: { type: string; payload: Record<string, string> }): OperationRequest | null {
    switch (action.type) {
        case 'open-file':
            return null;
        case 'create-directory': case 'create-file': {
            // Never overwrites (ActionExecutor opens an existing file). A provider's
            // entry point belongs to that format: native where the format is present,
            // an adoption where no harness exists, refused inside another harness.
            // Other files (AGENTS.md, prompts/, dependabot.yml) are format-neutral.
            const adoptFormat = formatOfPath(action.payload.relPath ?? '');
            return { op: 'adoption.scaffold', targets: 'workspace', ...(adoptFormat ? { adoptFormat } : {}) };
        }
        case 'scaffold-agent': case 'scaffold-skill':
            // Writes `.agents/**`: a Harness SDD entity, or an explicit adoption in an empty workspace.
            return { op: 'editing.createEntity', targets: 'workspace', adoptFormat: 'harness-sdd' };
        case 'run-command':
            return { op: 'workspace.command', targets: 'workspace' };
        default:
            return { op: 'adoption.scaffold', targets: 'workspace' };
    }
}
