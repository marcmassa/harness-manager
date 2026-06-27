import * as vscode from 'vscode';
import matter from '../frontmatter.js';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { ConfigurationRegistry } from './ConfigurationRegistry.js';
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
import { discover } from '../discovery/hooksAndSteering.js';
import { EMPTY_HARNESS_CONFIG, HarnessConfig } from '../config/harnessConfig.js';

export class WindsurfAdapter implements IAgentAdapter {
    private static readonly CONFIG_KEY = 'windsurf';

    public id(): string {
        return WindsurfAdapter.CONFIG_KEY;
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        const path = ConfigurationRegistry.getInstance()
            .getPathFor(WindsurfAdapter.CONFIG_KEY);
        // FEAT-026 T8: include the resolved hook/steering globs.
        return [
            '.windsurfrc',
            `${path}/rules/**/*.md`,
            `${path}/hooks/**/*.{sh,js,ts}`,
            `${path}/steering/**/*.md`,
            'hooks/**/*.{sh,js,ts}',
            'steering/**/*.md',
        ];
    }

    public isPathConfigurable(): boolean {
        return true; // `.windsurf/` path is overridable via harness-dashboard.adapters.windsurf.path
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        if (await fileExists(root, '.windsurfrc')) return true;
        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(WindsurfAdapter.CONFIG_KEY, root);
        const ruleFiles = await findFiles(root, `${path}/rules/**/*.md`);
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

        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(WindsurfAdapter.CONFIG_KEY, root);
        const ruleFiles = await findFiles(root, `${path}/rules/**/*.md`);
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

        // FEAT-026 T7: append hook/steering nodes discovered under
        // `.windsurf/hooks/`, `.windsurf/steering/`, and (when
        // enabled) the project root.
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
        return this._getBool(`adapters.${WindsurfAdapter.CONFIG_KEY}.discovery`, true);
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
