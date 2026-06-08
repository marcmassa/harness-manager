import * as vscode from 'vscode';
import matter from 'gray-matter';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { IAgentAdapter } from './IAgentAdapter.js';
import {
    createEmptyResult,
    fileExists,
    findFiles,
    prefixedNodeId,
    readTextFromUri,
    readTextIfExists,
    toRelativePath,
    workspaceName,
    withFrameworkMetadata,
} from './adapterUtils.js';

export class WindsurfAdapter implements IAgentAdapter {
    public id(): string {
        return 'windsurf';
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        return ['.windsurfrc', '.windsurf/rules/**/*.md'];
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        if (await fileExists(root, '.windsurfrc')) return true;
        const ruleFiles = await findFiles(root, '.windsurf/rules/**/*.md');
        return ruleFiles.length > 0;
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const rcContent = await readTextIfExists(root, '.windsurfrc');
        const workspace = workspaceName(root);
        const rootNodeId = `${adapterId}::root`;

        result.graph.nodes.push(
            withFrameworkMetadata(
                {
                    id: rootNodeId,
                    type: 'agent',
                    label: workspace,
                    metadata: {
                        description: rcContent
                            ? rcContent.split(/\r?\n/).find((line) => line.trim().length > 0) || 'Windsurf workspace'
                            : 'Windsurf workspace',
                        body: rcContent ? rcContent.slice(0, 500) : '',
                        _fullBody: rcContent ?? '',
                    },
                },
                adapterId,
                adapterLabel,
                rcContent ? '.windsurfrc' : undefined
            )
        );

        const ruleFiles = await findFiles(root, '.windsurf/rules/**/*.md');
        const sortedRules = [...ruleFiles].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        for (const file of sortedRules) {
            const content = await readTextFromUri(file);
            if (!content) continue;

            const { data, content: body } = matter(content);
            const relativePath = toRelativePath(root, file);
            const fileName = relativePath.split('/').pop() ?? 'rule.md';
            const stem = fileName.replace(/\.md$/i, '');
            const rawName = String(data.name ?? stem);
            const nodeId = prefixedNodeId(adapterId, rawName);

            result.graph.nodes.push(
                withFrameworkMetadata(
                    {
                        id: nodeId,
                        type: 'subagent',
                        label: rawName,
                        metadata: {
                            ...data,
                            description: String(data.description ?? body.split(/\r?\n/).find(Boolean) ?? ''),
                            body: body.slice(0, 500),
                            _fullBody: body,
                            _discovery: 'windsurf-heuristic',
                        },
                    },
                    adapterId,
                    adapterLabel,
                    relativePath
                )
            );

            result.graph.edges.push({
                id: `${adapterId}::edge::${rootNodeId}::${nodeId}::manages`,
                source: rootNodeId,
                target: nodeId,
                label: 'manages',
            });
        }

        return result;
    }
}
