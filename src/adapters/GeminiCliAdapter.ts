import * as vscode from 'vscode';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { IAgentAdapter } from './IAgentAdapter.js';
import {
    createEmptyResult,
    extractMarkdownTitle,
    fileExists,
    findFiles,
    parseSimpleToml,
    prefixedNodeId,
    readTextFromUri,
    readTextIfExists,
    toRelativePath,
    workspaceName,
    withFrameworkMetadata,
} from './adapterUtils.js';

export class GeminiCliAdapter implements IAgentAdapter {
    public id(): string {
        return 'gemini-cli';
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        return ['GEMINI.md', '.gemini/commands/**/*.toml'];
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        if (await fileExists(root, 'GEMINI.md')) return true;
        const commandFiles = await findFiles(root, '.gemini/commands/**/*.toml');
        return commandFiles.length > 0;
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const geminiMd = await readTextIfExists(root, 'GEMINI.md');
        const commandFiles = await findFiles(root, '.gemini/commands/**/*.toml');

        const rootLabel = geminiMd
            ? extractMarkdownTitle(geminiMd, 'Gemini CLI')
            : `${workspaceName(root)} Gemini CLI`;

        const rootNodeId = `${adapterId}::root`;
        result.graph.nodes.push(
            withFrameworkMetadata(
                {
                    id: rootNodeId,
                    type: 'agent',
                    label: rootLabel,
                    metadata: {
                        description: geminiMd ? geminiMd.split(/\r?\n/).slice(0, 6).join(' ').trim() : 'Gemini CLI workspace',
                        body: geminiMd ? geminiMd.slice(0, 500) : '',
                        _fullBody: geminiMd ?? '',
                    },
                },
                adapterId,
                adapterLabel,
                geminiMd ? 'GEMINI.md' : undefined
            )
        );

        const sortedFiles = [...commandFiles].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        for (const file of sortedFiles) {
            const content = await readTextFromUri(file);
            if (!content) continue;

            const relativePath = toRelativePath(root, file);
            const fileName = relativePath.split('/').pop() ?? 'command.toml';
            const stem = fileName.replace(/\.toml$/i, '');
            const parsedToml = parseSimpleToml(content);

            const rawName = String(parsedToml.name ?? parsedToml.title ?? stem);
            const description = String(parsedToml.description ?? parsedToml.prompt ?? '');
            const nodeId = prefixedNodeId(adapterId, rawName);

            result.graph.nodes.push(
                withFrameworkMetadata(
                    {
                        id: nodeId,
                        type: 'skill',
                        label: rawName,
                        metadata: {
                            ...parsedToml,
                            description,
                            body: content.slice(0, 500),
                            _fullBody: content,
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
