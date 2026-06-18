import * as vscode from 'vscode';
import * as logic from '../parserLogic.js';
import { DiscoveryMethod, ParserResult } from '../types.js';
import { frameworkLabel } from '../frameworks.js';
import { IAgentAdapter } from './IAgentAdapter.js';
import type { HarnessConfig } from '../config/harnessConfig.js';
import {
    createEmptyResult,
    fileExists,
    findFiles,
    readTextFromUri,
    readTextIfExists,
    readTextMultiBase,
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
        const globs = ['.agents/**', 'feature_list.json', 'progress/progress.md'];
        // R10: Include steering and hook file paths from agentic.json
        if (this._steeringPaths) {
            globs.push(...this._steeringPaths);
        }
        if (this._hookPaths) {
            globs.push(...this._hookPaths);
        }
        return globs;
    }

    // FEAT-026 R18: HarnessSddAdapter is NOT affected by the new
    // discovery layer. Its `agentic.json` parser is the source of
    // truth for steering/hook resources; the HarnessConfig is
    // accepted but ignored.
    public setHarnessConfig(_config: HarnessConfig | undefined): void {
        // no-op
    }

    // Cache for file paths discovered during parse (for watchGlobs R10)
    private _steeringPaths: string[] | null = null;
    private _hookPaths: string[] | null = null;

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

        // T11: Read steering file content (R3, R4) and hook script preview (R5)
        await this.parseSteeringFiles(root, result, agenticJson);
        await this.parseHookFiles(root, result, agenticJson);

        const featureList = await readTextMultiBase(root, 'feature_list.json');
        if (featureList) {
            logic.parseFeatureList(featureList, result);
        }

        const progressMd = await readTextMultiBase(root, 'progress/progress.md');
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

    private async parseSteeringFiles(root: vscode.Uri, result: ParserResult, agenticJsonRaw: string): Promise<void> {
        const data = JSON.parse(agenticJsonRaw);
        if (!data.steering) return;

        const paths: string[] = [];
        for (const entry of data.steering) {
            const steeringId = `steering-${entry.name}`;
            const steeringNode = result.graph.nodes.find(n => n.id === steeringId);
            if (!steeringNode) continue;

            const filePath = typeof entry.file === 'string' ? entry.file : '';
            if (!filePath) continue;

            paths.push(filePath);
            const content = await readTextIfExists(root, filePath);
            logic.parseSteeringFile(filePath, content, steeringNode, result);
        }
        this._steeringPaths = paths.length > 0 ? paths : null;
    }

    private async parseHookFiles(root: vscode.Uri, result: ParserResult, agenticJsonRaw: string): Promise<void> {
        const data = JSON.parse(agenticJsonRaw);
        if (!data.hooks) return;

        const paths: string[] = [];
        for (const entry of data.hooks) {
            const hookId = `hook-${entry.event}`;
            const hookNode = result.graph.nodes.find(n => n.id === hookId);
            if (!hookNode) continue;

            const scriptPath = typeof entry.script === 'string' ? entry.script : '';
            if (!scriptPath) continue;

            paths.push(scriptPath);
            const content = await readTextIfExists(root, scriptPath);
            logic.parseHookFile(scriptPath, content, hookNode);
        }
        this._hookPaths = paths.length > 0 ? paths : null;
    }
}
