import * as vscode from 'vscode';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { ConfigurationRegistry } from './ConfigurationRegistry.js';
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
    private static readonly CONFIG_KEY = 'gemini-cli';

    public id(): string {
        return GeminiCliAdapter.CONFIG_KEY;
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        const path = ConfigurationRegistry.getInstance()
            .getPathFor(GeminiCliAdapter.CONFIG_KEY);
        return ['GEMINI.md', `${path}/commands/**/*.toml`];
    }

    public isPathConfigurable(): boolean {
        return true; // `.gemini/` path is overridable via harness-dashboard.adapters.gemini-cli.path
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        if (await fileExists(root, 'GEMINI.md')) return true;
        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(GeminiCliAdapter.CONFIG_KEY, root);
        const commandFiles = await findFiles(root, `${path}/commands/**/*.toml`);
        return commandFiles.length > 0;
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const geminiMd = await readTextIfExists(root, 'GEMINI.md');
        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(GeminiCliAdapter.CONFIG_KEY, root);
        const commandFiles = await findFiles(root, `${path}/commands/**/*.toml`);

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
