import * as vscode from 'vscode';
import matter from 'gray-matter';

export class HarnessWriter {
    constructor(private readonly workspaceRoot: vscode.Uri) {}

    public async createSubagent(name: string, description: string): Promise<void> {
        const agenticUri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'agentic.json');
        const content = await vscode.workspace.fs.readFile(agenticUri);
        const data = JSON.parse(content.toString());

        if (!data.subagents) data.subagents = [];
        
        if (data.subagents.find((sa: any) => sa.name === name)) {
            throw new Error(`Sub-agent "${name}" already exists.`);
        }

        const roleFile = `.agents/subagents/${name}/SUBAGENT.md`;
        data.subagents.push({
            name,
            mode: "subagent",
            description,
            role_file: roleFile,
            permission: {
                edit: {
                    "progress/**": "allow",
                    "feature_list.json": "allow",
                    "*": "deny"
                }
            }
        });

        // Write agentic.json
        await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(data, null, 2)));

        // Create SUBAGENT.md
        const subagentDir = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'subagents', name);
        await vscode.workspace.fs.createDirectory(subagentDir);
        
        const mdContent = matter.stringify(`## Mission\n${description}\n\n## Main tasks\n1. [Task 1]`, {
            name,
            type: 'subagent',
            mode: 'subagent'
        });

        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(subagentDir, 'SUBAGENT.md'), Buffer.from(mdContent));
    }

    public async createSkill(name: string, description: string): Promise<void> {
        const skillDir = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'skills', name);
        await vscode.workspace.fs.createDirectory(skillDir);

        const mdContent = matter.stringify(`\n${description}`, {
            name,
            type: 'skill'
        });

        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(skillDir, 'SKILL.md'), Buffer.from(mdContent));
    }

    public async deleteNode(id: string, type: string): Promise<void> {
        if (type === 'subagent') {
            const agenticUri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'agentic.json');
            const content = await vscode.workspace.fs.readFile(agenticUri);
            const data = JSON.parse(content.toString());

            data.subagents = data.subagents.filter((sa: any) => sa.name !== id);
            await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(data, null, 2)));
            
            // Note: We are not deleting the Markdown files automatically for safety, 
            // but we could archive them.
        }
    }

    public async updateMetadata(id: string, type: string, metadata: any): Promise<void> {
        let folder = type === 'skill' ? 'skills' : 'subagents';
        let fileName = type === 'skill' ? 'SKILL.md' : 'SUBAGENT.md';
        
        const uri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', folder, id, fileName);
        try {
            const content = await vscode.workspace.fs.readFile(uri);
            const parsed = matter(content.toString());
            const newContent = matter.stringify(parsed.content, { ...parsed.data, ...metadata });
            await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent));
        } catch (e) {
            console.error(`Failed to update metadata for ${id}`, e);
        }
    }

    public async createEdge(source: string, target: string): Promise<void> {
        // Logic: if source is subagent and target is skill, update subagent metadata
        const agenticUri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'agentic.json');
        const content = await vscode.workspace.fs.readFile(agenticUri);
        const data = JSON.parse(content.toString());

        const subagent = data.subagents?.find((sa: any) => sa.name === source);
        if (subagent) {
            if (!subagent.skills) subagent.skills = [];
            if (!subagent.skills.includes(target)) {
                subagent.skills.push(target);
                await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(data, null, 2)));
            }
        }
    }
}
