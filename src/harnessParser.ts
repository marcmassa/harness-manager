import * as vscode from 'vscode';
import * as matter from 'gray-matter';

export type NodeType = 'agent' | 'subagent' | 'skill' | 'feature';

export interface HarnessNode {
    id: string;
    type: NodeType;
    label: string;
    metadata: Record<string, any>;
}

export interface HarnessEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
}

export interface HarnessGraph {
    nodes: HarnessNode[];
    edges: HarnessEdge[];
}

export interface ParserError {
    file: string;
    message: string;
}

export interface ParserResult {
    graph: HarnessGraph;
    errors: ParserError[];
}

export class HarnessParser {
    constructor(private readonly workspaceRoot: vscode.Uri) {}

    public async parse(): Promise<ParserResult> {
        const result: ParserResult = {
            graph: { nodes: [], edges: [] },
            errors: []
        };

        try {
            const agenticJson = await this._safeReadFile('.agents/agentic.json');
            if (agenticJson) this.parseAgenticJson(agenticJson, result);

            const featureList = await this._safeReadFile('feature_list.json');
            if (featureList) this.parseFeatureList(featureList, result);

            await this._parseSubagents(result);
            await this._parseSkills(result);
        } catch (e: any) {
            result.errors.push({ file: 'system', message: e.message });
        }

        return result;
    }

    public parseAgenticJson(content: string, result: ParserResult) {
        try {
            const data = JSON.parse(content);
            if (data.default_agent) {
                result.graph.nodes.push({
                    id: data.default_agent,
                    type: 'agent',
                    label: data.default_agent,
                    metadata: { description: data.description }
                });
            }
            if (data.subagents) {
                for (const sa of data.subagents) {
                    result.graph.nodes.push({
                        id: sa.name,
                        type: 'subagent',
                        label: sa.name,
                        metadata: { description: sa.description, role_file: sa.role_file }
                    });
                    if (data.default_agent) {
                        result.graph.edges.push({
                            id: `edge-${data.default_agent}-${sa.name}`,
                            source: data.default_agent,
                            target: sa.name,
                            label: 'manages'
                        });
                    }
                }
            }
        } catch (e: any) {
            result.errors.push({ file: '.agents/agentic.json', message: e.message });
        }
    }

    public parseFeatureList(content: string, result: ParserResult) {
        try {
            const data = JSON.parse(content);
            if (data.features) {
                for (const f of data.features) {
                    result.graph.nodes.push({
                        id: f.id,
                        type: 'feature',
                        label: f.title,
                        metadata: { ...f }
                    });
                }
            }
        } catch (e: any) {
            result.errors.push({ file: 'feature_list.json', message: e.message });
        }
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
            if (file.fsPath.includes('agent-template')) continue; // Filter out template (R10)
            
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const { data } = matter(content.toString());
                
                const node = result.graph.nodes.find(n => n.id === data.name || (n.metadata.role_file && file.fsPath.endsWith(n.metadata.role_file)));
                if (node) {
                    node.metadata = { ...node.metadata, ...data };
                    if (data.name) node.label = data.name;
                }
            } catch (e: any) {
                result.errors.push({ file: file.fsPath, message: e.message });
            }
        }
    }

    private async _parseSkills(result: ParserResult) {
        const pattern = new vscode.RelativePattern(vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'skills'), '**/SKILL.md');
        const files = await vscode.workspace.findFiles(pattern);

        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const { data, content: body } = matter(content.toString());
                const id = data.name || file.fsPath.split('/').slice(-2, -1)[0];

                result.graph.nodes.push({
                    id: id,
                    type: 'skill',
                    label: id,
                    metadata: { ...data, body: body.substring(0, 200) }
                });

                // Simple linking: if a skill is in a subdirectory named after a subagent, link them
                // Or if agentic.json has a 'skills' field (not currently standard, but we can look for skill_paths)
            } catch (e: any) {
                result.errors.push({ file: file.fsPath, message: e.message });
            }
        }
    }
}
