import * as vscode from 'vscode';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { IAgentAdapter } from './IAgentAdapter.js';
import {
    createEmptyResult,
    fileExists,
    parseJsonWithComments,
    prefixedNodeId,
    readTextIfExists,
    workspaceName,
    withFrameworkMetadata,
} from './adapterUtils.js';

export class OpenCodeAdapter implements IAgentAdapter {
    public id(): string {
        return 'opencode';
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        return ['opencode.json', 'opencode.jsonc'];
    }

    public isPathConfigurable(): boolean {
        return false; // canonical config file for the opencode CLI itself
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        return (await fileExists(root, 'opencode.json')) || (await fileExists(root, 'opencode.jsonc'));
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const [path, content] = await this.readConfig(root);
        if (!content || !path) return result;

        const parsed = parseJsonWithComments(content) as Record<string, any>;
        const projectName = parsed.project?.name ?? parsed.name ?? workspaceName(root);
        const rootNodeId = `${adapterId}::root`;

        result.graph.nodes.push(
            withFrameworkMetadata(
                {
                    id: rootNodeId,
                    type: 'agent',
                    label: String(projectName),
                    metadata: {
                        description: String(parsed.description ?? parsed.project?.description ?? 'OpenCode workspace'),
                        body: content.slice(0, 500),
                        _fullBody: content,
                    },
                },
                adapterId,
                adapterLabel,
                path
            )
        );

        const subagents = Array.isArray(parsed.subagents) ? parsed.subagents : [];
        subagents.forEach((subagent: unknown, index: number) => {
            const subagentData = typeof subagent === 'string' ? { name: subagent } : (subagent as Record<string, unknown>);
            const rawName = String(subagentData.name ?? `subagent-${index + 1}`);
            const nodeId = prefixedNodeId(adapterId, rawName);

            result.graph.nodes.push(
                withFrameworkMetadata(
                    {
                        id: nodeId,
                        type: 'subagent',
                        label: rawName,
                        metadata: {
                            ...subagentData,
                            description: String(subagentData.description ?? ''),
                        },
                    },
                    adapterId,
                    adapterLabel,
                    path
                )
            );

            result.graph.edges.push({
                id: `${adapterId}::edge::${rootNodeId}::${nodeId}::manages`,
                source: rootNodeId,
                target: nodeId,
                label: 'manages',
            });
        });

        return result;
    }

    private async readConfig(root: vscode.Uri): Promise<[string | null, string | null]> {
        const json = await readTextIfExists(root, 'opencode.json');
        if (json) return ['opencode.json', json];

        const jsonc = await readTextIfExists(root, 'opencode.jsonc');
        if (jsonc) return ['opencode.jsonc', jsonc];

        return [null, null];
    }
}
