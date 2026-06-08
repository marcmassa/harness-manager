import * as vscode from 'vscode';
import matter from 'gray-matter';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
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

function describeApplyTo(applyTo: unknown): string {
    if (Array.isArray(applyTo)) return applyTo.join(', ');
    if (typeof applyTo === 'string') return applyTo;
    return '';
}

export class CopilotAdapter implements IAgentAdapter {
    public id(): string {
        return 'copilot';
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        return [
            '.github/copilot-instructions.md',
            '.github/instructions/**/*.instructions.md',
            '.vscode/prompts/**/*.prompt.md',
        ];
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        if (await fileExists(root, '.github/copilot-instructions.md')) return true;
        const instructionFiles = await findFiles(root, '.github/instructions/**/*.instructions.md');
        if (instructionFiles.length > 0) return true;
        const promptFiles = await findFiles(root, '.vscode/prompts/**/*.prompt.md');
        return promptFiles.length > 0;
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const rootInstructions = await readTextIfExists(root, '.github/copilot-instructions.md');
        const instructionFiles = await findFiles(root, '.github/instructions/**/*.instructions.md');
        const promptFiles = await findFiles(root, '.vscode/prompts/**/*.prompt.md');

        const rootNodeId = `${adapterId}::root`;
        const rootLabel = rootInstructions
            ? extractMarkdownTitle(rootInstructions, 'GitHub Copilot')
            : `${workspaceName(root)} Copilot`;

        result.graph.nodes.push(
            withFrameworkMetadata(
                {
                    id: rootNodeId,
                    type: 'agent',
                    label: rootLabel,
                    metadata: {
                        description: rootInstructions
                            ? rootInstructions.split(/\r?\n/).slice(0, 6).join(' ').trim()
                            : 'GitHub Copilot workspace',
                        body: rootInstructions ? rootInstructions.slice(0, 500) : '',
                        _fullBody: rootInstructions ?? '',
                    },
                },
                adapterId,
                adapterLabel,
                rootInstructions ? '.github/copilot-instructions.md' : undefined
            )
        );

        const sortedInstructionFiles = [...instructionFiles].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        for (const file of sortedInstructionFiles) {
            const content = await readTextFromUri(file);
            if (!content) continue;
            const { data, content: body } = matter(content);
            const relativePath = toRelativePath(root, file);
            const stem = (relativePath.split('/').pop() ?? 'instruction').replace(/\.instructions\.md$/i, '');
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
                            description: describeApplyTo(data.applyTo) || String(data.description ?? ''),
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

        const sortedPromptFiles = [...promptFiles].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        for (const file of sortedPromptFiles) {
            const content = await readTextFromUri(file);
            if (!content) continue;
            const { data, content: body } = matter(content);
            const relativePath = toRelativePath(root, file);
            const stem = (relativePath.split('/').pop() ?? 'prompt').replace(/\.prompt\.md$/i, '');
            const rawName = String(data.name ?? stem);
            const nodeId = prefixedNodeId(adapterId, rawName);

            result.graph.nodes.push(
                withFrameworkMetadata(
                    {
                        id: nodeId,
                        type: 'skill',
                        label: rawName,
                        metadata: {
                            ...data,
                            description: String(data.description ?? body.split(/\r?\n/).find(Boolean) ?? ''),
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
                id: `${adapterId}::edge::${rootNodeId}::${nodeId}::uses`,
                source: rootNodeId,
                target: nodeId,
                label: 'uses',
            });
        }

        return result;
    }
}
