import * as vscode from 'vscode';
import matter from '../frontmatter.js';
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
    toRelativePath,
    withFrameworkMetadata,
} from './adapterUtils.js';
import { discover } from '../discovery/hooksAndSteering.js';
import { EMPTY_HARNESS_CONFIG, HarnessConfig } from '../config/harnessConfig.js';

/**
 * Extract skill names from a markdown body's `## Skills`
 * section. Returns an array of skill names (without the
 * leading `- ` or `* `).
 *
 * Mirrors the convention used by `parserLogic.parseMarkdown`
 * for Harness SDD subagents, so the same body-skill
 * relationship inference applies to Kiro.
 */
function extractSkillsFromBody(body: string): string[] {
    const match = body.match(/##\s+Skills\s*\n([\s\S]*?)(?:\n##|$)/i);
    if (!match) return [];
    return match[1]
        .split('\n')
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line) => line.length > 0);
}

export class KiroAdapter implements IAgentAdapter {
    private static readonly CONFIG_KEY = 'kiro';

    public id(): string {
        return KiroAdapter.CONFIG_KEY;
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        const path = ConfigurationRegistry.getInstance()
            .getPathFor(KiroAdapter.CONFIG_KEY);
        // FEAT-026 T8: include the resolved hook/steering globs so
        // changes to discovered files trigger a re-parse.
        return [
            `${path}/agents/**/*.md`,
            `${path}/skills/**/SKILL.md`,
            `${path}/hooks/**/*.{sh,js,ts}`,
            `${path}/steering/**/*.md`,
            'hooks/**/*.{sh,js,ts}',
            'steering/**/*.md',
        ];
    }

    public isPathConfigurable(): boolean {
        return true; // `.kiro/` path is overridable via harness-dashboard.adapters.kiro.path
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(KiroAdapter.CONFIG_KEY, root);
        return fileExists(root, path);
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();
        const adapterId = this.id();
        const adapterLabel = this.label();

        const path = await ConfigurationRegistry.getInstance()
            .resolvePath(KiroAdapter.CONFIG_KEY, root);
        const agentFiles = await findFiles(root, `${path}/agents/**/*.md`);
        const skillFiles = await findFiles(root, `${path}/skills/**/SKILL.md`);

        // Pass 1: discover all skill nodes (so the agents can
        // reference them by name in their `## Skills` section).
        const sortedSkills = [...skillFiles].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        const knownSkillIds = new Set<string>();

        for (const file of sortedSkills) {
            const content = await readTextFromUri(file);
            if (!content) continue;

            const { data, content: body } = matter(content);
            const relativePath = toRelativePath(root, file);
            const folder = relativePath.split('/').slice(-2, -1)[0] ?? 'skill';
            const skillName = (data.name as string | undefined) || folder;
            const nodeId = prefixedNodeId(adapterId, skillName);
            knownSkillIds.add(nodeId);

            result.graph.nodes.push(
                withFrameworkMetadata(
                    {
                        id: nodeId,
                        type: 'skill',
                        label: skillName,
                        metadata: {
                            ...data,
                            description: String(data.description ?? ''),
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

        // Pass 2: discover all agent nodes and create `manages`
        // edges from a root agent (one per file) to each agent.
        // Also infer `uses` edges by reading each agent's
        // `## Skills` section and matching against the known
        // skill ids.
        const rootNodeId = `${adapterId}::root`;
        result.graph.nodes.push(
            withFrameworkMetadata(
                {
                    id: rootNodeId,
                    type: 'agent',
                    label: 'Kiro workspace',
                    metadata: {
                        description: 'Kiro workspace',
                        body: '',
                        _fullBody: '',
                    },
                },
                adapterId,
                adapterLabel,
                path
            )
        );

        const sortedAgents = [...agentFiles].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        for (const file of sortedAgents) {
            const content = await readTextFromUri(file);
            if (!content) continue;

            const { data, content: body } = matter(content);
            const relativePath = toRelativePath(root, file);
            const fileName = relativePath.split('/').pop() ?? 'agent.md';
            const stem = fileName.replace(/\.md$/i, '');
            const rawName = (data.name as string | undefined) || stem;
            const nodeId = prefixedNodeId(adapterId, rawName);
            const description = (data.description as string | undefined) || extractMarkdownTitle(content, '');

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

            // R12: infer `uses` edges from the agent's `## Skills` section.
            for (const skillName of extractSkillsFromBody(body)) {
                const targetId = prefixedNodeId(adapterId, skillName);
                if (!knownSkillIds.has(targetId)) continue;
                result.graph.edges.push({
                    id: `${adapterId}::edge::${nodeId}::${targetId}::uses`,
                    source: nodeId,
                    target: targetId,
                    label: 'uses',
                });
            }
        }

        // FEAT-026 T7: append hook/steering nodes discovered under
        // `.kiro/hooks/`, `.kiro/steering/`, and (when enabled) the
        // project root. Honours the local config overrides/extras
        // and the kill switches.
        const harnessConfig = this._harnessConfig;
        const localConfig = harnessConfig
            ? await harnessConfig.read(root)
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
        // Per-adapter kill switch (R9). Default = true.
        return this._getBool(`adapters.${KiroAdapter.CONFIG_KEY}.discovery`, true);
    }

    private _isRootDiscoveryEnabled(): boolean {
        // Global project-root kill switch (R10). Default = true.
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
