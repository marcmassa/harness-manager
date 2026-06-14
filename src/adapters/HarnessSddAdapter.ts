import * as vscode from 'vscode';
import * as logic from '../parserLogic.js';
import { DiscoveryMethod, ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { IAgentAdapter } from './IAgentAdapter.js';
import {
    createEmptyResult,
    fileExists,
    findFiles,
    readTextFromUri,
    readTextIfExists,
    toRelativePath,
    withFrameworkMetadata,
} from './adapterUtils.js';

export class HarnessSddAdapter implements IAgentAdapter {
    public id(): string {
        return 'harness-sdd';
    }

    public label(): string {
        return frameworkLabel(this.id());
    }

    public watchGlobs(): string[] {
        return ['.agents/**', 'feature_list.json', 'progress/progress.md'];
    }

    public isPathConfigurable(): boolean {
        return false; // canonical framework entry point (`.agents/agentic.json`)
    }

    public async detect(root: vscode.Uri): Promise<boolean> {
        return fileExists(root, '.agents/agentic.json');
    }

    public async parse(root: vscode.Uri): Promise<Partial<ParserResult>> {
        const result = createEmptyResult();

        const agenticJson = await readTextIfExists(root, '.agents/agentic.json');
        if (!agenticJson) {
            return result;
        }

        logic.parseAgenticJson(agenticJson, result);

        const featureList = await readTextIfExists(root, 'feature_list.json');
        if (featureList) {
            logic.parseFeatureList(featureList, result);
        }

        const progressMd = await readTextIfExists(root, 'progress/progress.md');
        if (progressMd) {
            logic.parseProgressMd(progressMd, result);
        }

        await this.parseSkills(root, result);
        await this.parseSubagents(root, result);

        result.graph.nodes = result.graph.nodes.map((node) => {
            const filePath = typeof node.metadata?._filePath === 'string'
                ? node.metadata._filePath
                : undefined;
            return withFrameworkMetadata(node, this.id(), this.label(), filePath);
        });

        return result;
    }

    private async parseSkills(root: vscode.Uri, result: ParserResult): Promise<void> {
        const files = await findFiles(root, '.agents/skills/**/SKILL.md');
        for (const file of files) {
            const content = await readTextFromUri(file);
            if (!content) continue;
            const relativePath = toRelativePath(root, file);
            logic.parseMarkdown(content, relativePath, result);
        }
    }

    private async parseSubagents(root: vscode.Uri, result: ParserResult): Promise<void> {
        const registeredSubagents = new Set(
            result.graph.nodes
                .filter((node) => node.type === 'subagent')
                .map((node) => node.id)
        );

        const files = await findFiles(root, '.agents/subagents/**/SUBAGENT.md');
        for (const file of files) {
            if (file.fsPath.replace(/\\/g, '/').includes('/agent-template/')) continue;
            const content = await readTextFromUri(file);
            if (!content) continue;
            const relativePath = toRelativePath(root, file);
            logic.parseMarkdown(content, relativePath, result);
        }

        for (const node of result.graph.nodes) {
            if (node.type !== 'subagent') continue;
            if (node.metadata._orphan) continue;
            if (registeredSubagents.has(node.id)) continue;

            node.metadata._orphan = true;
            node.metadata._discovery = (node.metadata._discovery as DiscoveryMethod) || 'scanned';

            result.errors.push({
                file: String(node.metadata._filePath || `.agents/subagents/${node.id}/SUBAGENT.md`),
                message: `Subagent '${node.id}' found on disk but not registered in agentic.json#subagents[] (orphan)`,
            });
        }
    }
}
