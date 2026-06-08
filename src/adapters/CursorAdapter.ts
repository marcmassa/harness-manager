import * as vscode from 'vscode';
import matter from 'gray-matter';
import { ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
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

function hasGlobs(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'string' && value.trim().length > 0;
}

export class CursorAdapter implements IAgentAdapter {
    public id(): string {
        return 'cursor';
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        return ['.cursorrules', '.cursor/rules/**/*.mdc'];
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        if (await fileExists(root, '.cursorrules')) return true;
        const ruleFiles = await findFiles(root, '.cursor/rules/**/*.mdc');
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

        const ruleFiles = await findFiles(root, '.cursor/rules/**/*.mdc');
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

        return result;
    }
}
