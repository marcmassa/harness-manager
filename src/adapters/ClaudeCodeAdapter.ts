import * as vscode from 'vscode';
import matter from '../frontmatter.js';
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
    prefixedNodeId,
    readTextFromUri,
    readTextIfExists,
    rootAgentNode,
    toRelativePath,
    withFrameworkMetadata,
} from './adapterUtils.js';
import { HarnessConfig } from '../config/harnessConfig.js';

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
        // FEAT-026 T8: include the resolved hook/steering globs.
        return [
            'CLAUDE.md',
            `${path}/agents/**/*.md`,
            `${path}/hooks/**/*.{sh,js,ts}`,
            `${path}/steering/**/*.md`,
            'hooks/**/*.{sh,js,ts}',
            'steering/**/*.md',
        ];
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

        const rootNodeId = `${adapterId}::root`;
        result.graph.nodes.push(rootAgentNode(root, adapterId, adapterLabel, claudeMd, 'CLAUDE.md', {
            title: 'Claude Code',
            workspaceSuffix: 'Claude Code',
            description: 'Claude Code workspace',
        }));

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
                            ...bodyMetadata(body),
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
        // `.claude/hooks/`, `.claude/steering/`, and (when enabled) the
        // project root. Honours the local config overrides/extras and
        // the kill switches.
        await appendDiscovery(result, adapterId, ClaudeCodeAdapter.CONFIG_KEY, root, rootNodeId, this._harnessConfig);

        return result;
    }

    // ----- FEAT-026 wiring helpers -----

    private _harnessConfig?: HarnessConfig;

    public setHarnessConfig(config: HarnessConfig | undefined): void {
        this._harnessConfig = config;
    }

}
