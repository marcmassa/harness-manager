import * as vscode from 'vscode';
import { HarnessEdge, HarnessNode, Milestone, ParserError, ParserResult } from '../types.js';

export interface IAgentAdapter {
    id(): string;
    label(): string;
    detect(root: vscode.Uri): Promise<boolean>;
    parse(root: vscode.Uri): Promise<Partial<ParserResult>>;
    watchGlobs(): string[];

    /**
     * Returns true if the user can override this adapter's
     * detection path via
     * `harness-dashboard.adapters.<id>.path`.
     *
     * Adapters that opt in (return `true`) MUST use
     * `ConfigurationRegistry.getInstance().getPathFor(id())`
     * instead of hardcoded path strings in their
     * `detect`/`parse`/`watchGlobs` methods.
     *
     * Adapters that opt out (return `false`) have a canonical
     * path defined by the framework itself (e.g., Harness
     * SDD's `.agents/agentic.json`); no setting is registered
     * and the registry skips the id.
     */
    isPathConfigurable(): boolean;
}

export function mergeResults(results: Partial<ParserResult>[]): ParserResult {
    const mergedNodes: HarnessNode[] = [];
    const mergedEdges: HarnessEdge[] = [];
    const mergedMilestones: Milestone[] = [];
    const mergedErrors: ParserError[] = [];

    const nodeIds = new Set<string>();
    const edgeKeys = new Set<string>();
    const milestoneKeys = new Set<string>();

    for (const result of results) {
        const nodes = result.graph?.nodes ?? [];
        for (const node of nodes) {
            if (nodeIds.has(node.id)) continue;
            nodeIds.add(node.id);
            mergedNodes.push(node);
        }

        const edges = result.graph?.edges ?? [];
        for (const edge of edges) {
            const key = `${edge.source}::${edge.target}::${edge.label ?? ''}`;
            if (edgeKeys.has(key)) continue;
            edgeKeys.add(key);
            mergedEdges.push(edge);
        }

        const milestones = result.milestones ?? [];
        for (const milestone of milestones) {
            const key = `${milestone.featureId}::${milestone.status}::${milestone.date}`;
            if (milestoneKeys.has(key)) continue;
            milestoneKeys.add(key);
            mergedMilestones.push(milestone);
        }

        mergedErrors.push(...(result.errors ?? []));
    }

    return {
        graph: {
            nodes: mergedNodes,
            edges: mergedEdges,
        },
        milestones: mergedMilestones,
        errors: mergedErrors,
    };
}
