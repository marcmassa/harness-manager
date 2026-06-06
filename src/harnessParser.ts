import * as vscode from 'vscode';
import { ParserResult } from './types.js';
import * as logic from './parserLogic.js';

export class HarnessParser {
    constructor(private readonly workspaceRoot: vscode.Uri) {}

    public async parse(): Promise<ParserResult> {
        const result: ParserResult = {
            graph: { nodes: [], edges: [] },
            milestones: [],
            errors: []
        };

        try {
            const agenticJson = await this._safeReadFile('.agents/agentic.json');
            if (agenticJson) logic.parseAgenticJson(agenticJson, result);

            const featureList = await this._safeReadFile('feature_list.json');
            if (featureList) logic.parseFeatureList(featureList, result);

            const progressMd = await this._safeReadFile('progress/progress.md');
            if (progressMd) logic.parseProgressMd(progressMd, result);

            await this._parseSubagents(result);
            await this._parseSkills(result);
        } catch (e: any) {
            result.errors.push({ file: 'system', message: e.message });
        }

        return result;
    }

    private async _safeReadFile(relativePath: string): Promise<string | null> {
        const uri = vscode.Uri.joinPath(this.workspaceRoot, relativePath);
        try {
            const content = await vscode.workspace.fs.readFile(uri);
            return content.toString();
        } catch {
            return null;
        }
    }

    private async _parseSubagents(result: ParserResult) {
        const pattern = new vscode.RelativePattern(vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'subagents'), '**/SUBAGENT.md');
        const files = await vscode.workspace.findFiles(pattern);

        for (const file of files) {
            if (file.fsPath.includes('agent-template')) continue;
            const content = await this._safeReadFile(vscode.workspace.asRelativePath(file));
            if (content) logic.parseMarkdown(content, file.fsPath, result);
        }
    }

    private async _parseSkills(result: ParserResult) {
        const pattern = new vscode.RelativePattern(vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'skills'), '**/SKILL.md');
        const files = await vscode.workspace.findFiles(pattern);

        for (const file of files) {
            const content = await this._safeReadFile(vscode.workspace.asRelativePath(file));
            if (content) logic.parseMarkdown(content, file.fsPath, result);
        }
    }
}
