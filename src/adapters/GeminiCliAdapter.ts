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
import { discover } from '../discovery/hooksAndSteering.js';
import { EMPTY_HARNESS_CONFIG, HarnessConfig } from '../config/harnessConfig.js';

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

        // FEAT-026 T7: append hook/steering nodes discovered under
        // `.gemini/hooks/`, `.gemini/steering/`, and (when enabled)
        // the project root.
        const localConfig = this._harnessConfig
            ? await this._harnessConfig.read(root)
            : EMPTY_HARNESS_CONFIG;
        const subagentIds = result.graph.nodes
            .filter((n) => n.type === 'subagent')
            .map((n) => n.id);
        const discovery = await discover(
            adapterId,
            root,
            localConfig,
            this._isAdapterDiscoveryEnabled(),
            this._isRootDiscoveryEnabled(),
            rootNodeId,
            subagentIds,
        );
        result.graph.nodes.push(...discovery.nodes);
        result.graph.edges.push(...discovery.edges);

        return result;
    }

    // ----- FEAT-026 wiring helpers -----

    private _harnessConfig?: HarnessConfig;

    public setHarnessConfig(config: HarnessConfig | undefined): void {
        this._harnessConfig = config;
    }

    private _isAdapterDiscoveryEnabled(): boolean {
        return this._getBool(`adapters.${GeminiCliAdapter.CONFIG_KEY}.discovery`, true);
    }

    private _isRootDiscoveryEnabled(): boolean {
        return this._getBool('discovery.root', true);
    }

    private _getBool(key: string, fallback: boolean): boolean {
        try {
            return vscode.workspace
                .getConfiguration('harness-dashboard')
                .get<boolean>(key, fallback);
        } catch {
            return fallback;
        }
    }
}
