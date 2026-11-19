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
    toRelativePath,
    withFrameworkMetadata,
} from './adapterUtils.js';
import { HarnessConfig } from '../config/harnessConfig.js';

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
                            ...bodyMetadata(cursorRulesFile),
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
                            // FEAT-044: an agent-requested rule declares a description; the fallback above is display text.
                            _declaredDescription: typeof data.description === 'string' ? data.description : '',
                            ...bodyMetadata(body),
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
        await appendDiscovery(result, adapterId, CursorAdapter.CONFIG_KEY, root, rootNodeId, this._harnessConfig);

        return result;
    }

    // ----- FEAT-026 wiring helpers -----

    private _harnessConfig?: HarnessConfig;

    public setHarnessConfig(config: HarnessConfig | undefined): void {
        this._harnessConfig = config;
    }

}
