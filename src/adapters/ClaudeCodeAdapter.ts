import * as vscode from 'vscode';
import matter from 'gray-matter';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { ConfigurationRegistry } from './ConfigurationRegistry.js';
import { IAgentAdapter } from './IAgentAdapter.js';
import {
    createEmptyResult,
    extractMarkdownTitle,
    fileExists,
    findFiles,
    prefixedNodeId,
    readTextFromUri,
    readTextIfExists,
    toRelativePath,
    workspaceName,
    withFrameworkMetadata,
} from './adapterUtils.js';

export class ClaudeCodeAdapter implements IAgentAdapter {
    private static readonly CONFIG_KEY = 'claude-code';

    public id(): string {
        return ClaudeCodeAdapter.CONFIG_KEY;
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        const path = ConfigurationRegistry.getInstance()
            .getPathFor(ClaudeCodeAdapter.CONFIG_KEY);
        return ['CLAUDE.md', `${path}/agents/**/*.md`];
    }

    public isPathConfigurable(): boolean {
        return true; // `.claude/` path is overridable via harness-dashboard.adapters.claude-code.path
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        if (await fileExists(root, 'CLAUDE.md')) return true;
        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(ClaudeCodeAdapter.CONFIG_KEY, root);
        const agentFiles = await findFiles(root, `${path}/agents/**/*.md`);
        return agentFiles.length > 0;
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const claudeMd = await readTextIfExists(root, 'CLAUDE.md');
        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(ClaudeCodeAdapter.CONFIG_KEY, root);
        const agentFiles = await findFiles(root, `${path}/agents/**/*.md`);

        const rootLabel = claudeMd
            ? extractMarkdownTitle(claudeMd, 'Claude Code')
            : `${workspaceName(root)} Claude Code`;

        const rootNodeId = `${adapterId}::root`;
        result.graph.nodes.push(
            withFrameworkMetadata(
                {
                    id: rootNodeId,
                    type: 'agent',
                    label: rootLabel,
                    metadata: {
                        description: claudeMd ? claudeMd.split(/\r?\n/).slice(0, 6).join(' ').trim() : 'Claude Code workspace',
                        body: claudeMd ? claudeMd.slice(0, 500) : '',
                        _fullBody: claudeMd ?? '',
                    },
                },
                adapterId,
                adapterLabel,
                claudeMd ? 'CLAUDE.md' : undefined
            )
        );

        const sortedFiles = [...agentFiles].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        for (const file of sortedFiles) {
            const content = await readTextFromUri(file);
            if (!content) continue;

            const { data, content: body } = matter(content);
            const relativePath = toRelativePath(root, file);
            const fileName = relativePath.split('/').pop() ?? 'agent.md';
            const stem = fileName.replace(/\.md$/i, '');
            const rawName = (data.name as string | undefined) || stem;
            const nodeId = prefixedNodeId(adapterId, rawName);
            const description = (data.description as string | undefined) || body.split(/\r?\n/).find(Boolean) || '';

            result.graph.nodes.push(
                withFrameworkMetadata(
                    {
                        id: nodeId,
                        type: 'subagent',
                        label: rawName,
                        metadata: {
                            ...data,
                            description,
                            body: body.slice(0, 500),
                            _fullBody: body,
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
