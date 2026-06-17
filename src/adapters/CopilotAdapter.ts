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
import { discover } from '../discovery/hooksAndSteering.js';
import { EMPTY_HARNESS_CONFIG, HarnessConfig } from '../config/harnessConfig.js';

function describeApplyTo(applyTo: unknown): string {
    if (Array.isArray(applyTo)) return applyTo.join(', ');
    if (typeof applyTo === 'string') return applyTo;
    return '';
}

export class CopilotAdapter implements IAgentAdapter {
    private static readonly CONFIG_KEY = 'copilot';

    public id(): string {
        return CopilotAdapter.CONFIG_KEY;
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        const path = ConfigurationRegistry.getInstance()
            .getPathFor(CopilotAdapter.CONFIG_KEY);
        // FEAT-026 T8: include the resolved hook/steering globs.
        return [
            `${path}/copilot-instructions.md`,
            `${path}/instructions/**/*.instructions.md`,
            '.vscode/prompts/**/*.prompt.md',
            `${path}/hooks/**/*.{sh,js,ts}`,
            `${path}/steering/**/*.md`,
            'hooks/**/*.{sh,js,ts}',
            'steering/**/*.md',
        ];
    }

    public isPathConfigurable(): boolean {
        return true; // `.github/` path is overridable; `.vscode/prompts/` stays fixed
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(CopilotAdapter.CONFIG_KEY, root);
        if (await fileExists(root, `${path}/copilot-instructions.md`)) return true;
        const instructionFiles = await findFiles(root, `${path}/instructions/**/*.instructions.md`);
        if (instructionFiles.length > 0) return true;
        const promptFiles = await findFiles(root, '.vscode/prompts/**/*.prompt.md');
        return promptFiles.length > 0;
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(CopilotAdapter.CONFIG_KEY, root);
        const rootInstructions = await readTextIfExists(root, `${path}/copilot-instructions.md`);
        const instructionFiles = await findFiles(root, `${path}/instructions/**/*.instructions.md`);
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
                rootInstructions ? `${path}/copilot-instructions.md` : undefined
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

        // FEAT-026 T7: append hook/steering nodes discovered under
        // `.github/hooks/`, `.github/steering/`, and (when enabled)
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
        return this._getBool(`adapters.${CopilotAdapter.CONFIG_KEY}.discovery`, true);
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
