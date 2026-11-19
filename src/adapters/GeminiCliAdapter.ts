import * as vscode from 'vscode';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { ConfigurationRegistry } from './ConfigurationRegistry.js';
import { IAgentAdapter } from './IAgentAdapter.js';
import {
    appendDiscovery,
    bodyMetadata,
    createEmptyResult,
    fileExists,
    findFiles,
    parseSimpleToml,
    prefixedNodeId,
    readTextFromUri,
    readTextIfExists,
    rootAgentNode,
    toRelativePath,
    withFrameworkMetadata,
} from './adapterUtils.js';
import { HarnessConfig } from '../config/harnessConfig.js';

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
        // FEAT-026 T8: include the resolved hook/steering globs.
        return [
            'GEMINI.md',
            `${path}/commands/**/*.toml`,
            `${path}/hooks/**/*.{sh,js,ts}`,
            `${path}/steering/**/*.md`,
            'hooks/**/*.{sh,js,ts}',
            'steering/**/*.md',
        ];
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

        const rootNodeId = `${adapterId}::root`;
        result.graph.nodes.push(rootAgentNode(root, adapterId, adapterLabel, geminiMd, 'GEMINI.md', {
            title: 'Gemini CLI',
            workspaceSuffix: 'Gemini CLI',
            description: 'Gemini CLI workspace',
        }));

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
                            ...bodyMetadata(content),
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

        // FEAT-026 T7: append hook/steering nodes discovered under
        // `.gemini/hooks/`, `.gemini/steering/`, and (when enabled)
        // the project root.
        await appendDiscovery(result, adapterId, GeminiCliAdapter.CONFIG_KEY, root, rootNodeId, this._harnessConfig);

        return result;
    }

    // ----- FEAT-026 wiring helpers -----

    private _harnessConfig?: HarnessConfig;

    public setHarnessConfig(config: HarnessConfig | undefined): void {
        this._harnessConfig = config;
    }

}
