import * as vscode from 'vscode';
import matter from 'gray-matter';
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
    withFrameworkMetadata,
} from './adapterUtils.js';
import { discover } from '../discovery/hooksAndSteering.js';
import { EMPTY_HARNESS_CONFIG, HarnessConfig } from '../config/harnessConfig.js';

function hasGlobs(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'string' && value.trim().length > 0;
}

export class CursorAdapter implements IAgentAdapter {
    private static readonly CONFIG_KEY = 'cursor';

    public id(): string {
        return CursorAdapter.CONFIG_KEY;
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        const path = ConfigurationRegistry.getInstance()
            .getPathFor(CursorAdapter.CONFIG_KEY);
        // FEAT-026 T8: include the resolved hook/steering globs.
        return [
            '.cursorrules',
            `${path}/rules/**/*.mdc`,
            `${path}/hooks/**/*.{sh,js,ts}`,
            `${path}/steering/**/*.md`,
            'hooks/**/*.{sh,js,ts}',
            'steering/**/*.md',
        ];
    }

    public isPathConfigurable(): boolean {
        return true; // `.cursor/` path is overridable via harness-dashboard.adapters.cursor.path
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        if (await fileExists(root, '.cursorrules')) return true;
        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(CursorAdapter.CONFIG_KEY, root);
        const ruleFiles = await findFiles(root, `${path}/rules/**/*.mdc`);
        return ruleFiles.length > 0;
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const cursorRulesFile = await readTextIfExists(root, '.cursorrules');
        if (cursorRulesFile) {
            result.graph.nodes.push(
                withFrameworkMetadata(
                    {
                        id: `${adapterId}::cursorrules`,
                        type: 'agent',
                        label: 'Cursor Rules',
                        metadata: {
                            description: cursorRulesFile.split(/\r?\n/).find((line) => line.trim().length > 0) || '',
                            body: cursorRulesFile.slice(0, 500),
                            _fullBody: cursorRulesFile,
                        },
                    },
                    adapterId,
                    adapterLabel,
                    '.cursorrules'
                )
            );
        }

        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(CursorAdapter.CONFIG_KEY, root);
        const ruleFiles = await findFiles(root, `${path}/rules/**/*.mdc`);
        const sortedRules = [...ruleFiles].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        for (const file of sortedRules) {
            const content = await readTextFromUri(file);
            if (!content) continue;

            const { data, content: body } = matter(content);
            const relativePath = toRelativePath(root, file);
            const fileName = relativePath.split('/').pop() ?? 'rule.mdc';
            const stem = fileName.replace(/\.mdc$/i, '');
            const rawName = String(data.name ?? stem);
            const alwaysApply = data.alwaysApply === true;
            const globs = data.globs;
            const nodeType = alwaysApply || !hasGlobs(globs) ? 'agent' : 'subagent';

            result.graph.nodes.push(
                withFrameworkMetadata(
                    {
                        id: prefixedNodeId(adapterId, rawName),
                        type: nodeType,
                        label: rawName,
                        metadata: {
                            ...data,
                            description: String(data.description ?? (hasGlobs(globs) ? `Applies to ${JSON.stringify(globs)}` : 'Global Cursor rule')),
                            body: body.slice(0, 500),
                            _fullBody: body,
                        },
                    },
                    adapterId,
                    adapterLabel,
                    relativePath
                )
            );
        }

        // FEAT-026 T7: append hook/steering nodes discovered under
        // `.cursor/hooks/`, `.cursor/steering/`, and (when enabled)
        // the project root.
        const rootNodeId = `${adapterId}::root`;
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
        return this._getBool(`adapters.${CursorAdapter.CONFIG_KEY}.discovery`, true);
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
