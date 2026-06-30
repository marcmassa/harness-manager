import * as vscode from 'vscode';
import matter from './frontmatter.js';

export class HarnessWriter {
    constructor(private readonly workspaceRoot: vscode.Uri) {}

    /** Imports an existing SUBAGENT.md/SKILL.md from disk into agentic.json without touching the file. */
    public async registerNode(name: string, type: 'subagent' | 'skill', description = ''): Promise<void> {
        const agenticUri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'agentic.json');
        const content = await vscode.workspace.fs.readFile(agenticUri);
        const data = JSON.parse(content.toString());

        if (type === 'subagent') {
            if (!data.subagents) data.subagents = [];
            if (data.subagents.find((sa: { name: string }) => sa.name === name)) return;
            const roleFile = `.agents/subagents/${name}/SUBAGENT.md`;
            // Try to read description from existing SUBAGENT.md frontmatter
            let desc = description;
            if (!desc) {
                try {
                    const mdUri = vscode.Uri.joinPath(this.workspaceRoot, roleFile);
                    const md = Buffer.from(await vscode.workspace.fs.readFile(mdUri)).toString('utf8');
                    const parsed = matter(md);
                    desc = (parsed.data as { description?: string }).description ?? '';
                } catch { /* file may not have frontmatter */ }
            }
            data.subagents.push({ name, mode: 'subagent', description: desc, role_file: roleFile,
                permission: { edit: { 'progress/**': 'allow', 'feature_list.json': 'allow', '*': 'deny' } } });
        } else {
            if (!data.skills) data.skills = [];
            if (data.skills.find((s: { name: string }) => s.name === name)) return;
            data.skills.push({ name, description });
        }
        await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(data, null, 2)));
    }

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

    /**
     * Like createSubagent but writes `mdContent` verbatim as SUBAGENT.md
     * instead of the default matter.stringify template.
     * Used by the Agent Builder Wizard Step 4 (FEAT-033 Phase 2).
     */
    public async createSubagentWithContent(name: string, description: string, mdContent: string): Promise<void> {
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
            mode: 'subagent',
            description,
            role_file: roleFile,
            permission: {
                edit: {
                    'progress/**': 'allow',
                    'feature_list.json': 'allow',
                    '*': 'deny',
                },
            },
        });

        await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(data, null, 2)));

        const subagentDir = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'subagents', name);
        await vscode.workspace.fs.createDirectory(subagentDir);
        await vscode.workspace.fs.writeFile(
            vscode.Uri.joinPath(subagentDir, 'SUBAGENT.md'),
            Buffer.from(mdContent),
        );
    }

    public async createSkill(
        name: string,
        description: string,
    ): Promise<void> {
        const skillDir = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'skills', name);
        await vscode.workspace.fs.createDirectory(skillDir);

        // Plain-text header block (Pocock style) + opinionated body with phases & anti-patterns
        const mdContent = [
            `name\n\n${name}\n\ndescription\n\n${description || `A reusable ${name} skill.`}`,
            '',
            `# ${name}`,
            '',
            '## Philosophy',
            '',
            description || `A reusable ${name} skill.`,
            '',
            'The goal is to [state the single clear outcome this skill produces].',
            '',
            '## When to use this skill',
            '',
            '- Use when you need to [primary trigger]',
            '- Use when [secondary trigger]',
            '- **Do NOT use** when [counter-indication]',
            '',
            '## Phases',
            '',
            '### Phase 1: Understand the context',
            '',
            '1. Read the relevant files and understand the current state',
            '2. Identify the specific goal and any constraints',
            '3. Clarify ambiguities before proceeding',
            '',
            '**Completion criteria:** You can state in one sentence what needs to happen and why.',
            '',
            '### Phase 2: Execute',
            '',
            '1. [Step 1 — concrete action]',
            '2. [Step 2 — concrete action]',
            '3. [Step 3 — concrete action]',
            '',
            '**Completion criteria:** [What must be true before moving on]',
            '',
            '### Phase 3: Verify',
            '',
            '1. Confirm the output meets the original goal',
            '2. Check for side-effects or regressions',
            '3. Clean up any temporary state',
            '',
            '**Completion criteria:** The outcome matches what was stated in Phase 1.',
            '',
            '## Anti-patterns',
            '',
            '- **DO NOT** skip Phase 1 — acting on assumptions causes rework',
            '- **DO NOT** [specific pitfall for this skill]',
            '',
            '## Checklist',
            '',
            '- [ ] Phase 1 complete — goal clearly stated',
            '- [ ] Phase 2 complete — execution done',
            '- [ ] Phase 3 complete — verified and clean',
        ].join('\n');

        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(skillDir, 'SKILL.md'), Buffer.from(mdContent));
    }

    /** Creates a steering .md file at .claude/steering/<name>.md */
    public async createSteering(name: string, content: string, appliesTo = '*'): Promise<void> {
        const dir = vscode.Uri.joinPath(this.workspaceRoot, '.claude', 'steering');
        await vscode.workspace.fs.createDirectory(dir);
        const file = vscode.Uri.joinPath(dir, `${name}.md`);
        const md = `---\napplies_to:\n  - "${appliesTo}"\n---\n\n${content}\n`;
        await vscode.workspace.fs.writeFile(file, Buffer.from(md));
    }

    /** Creates a hook script at .claude/hooks/<name>.sh */
    public async createHook(name: string, triggerEvent: string, scriptContent: string): Promise<void> {
        const dir = vscode.Uri.joinPath(this.workspaceRoot, '.claude', 'hooks');
        await vscode.workspace.fs.createDirectory(dir);
        const file = vscode.Uri.joinPath(dir, `${name}.sh`);
        const header = `#!/bin/bash\n# Hook: ${name}\n# Trigger: ${triggerEvent}\n\n`;
        await vscode.workspace.fs.writeFile(file, Buffer.from(header + scriptContent));
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

    public async acceptSuggestion(subagentId: string, skillId: string): Promise<void> {
        // Accepting a suggestion is semantically identical to creating a uses edge:
        // updates agentic.json skills[] array + SUBAGENT.md ## Skills section
        await this.createEdge(subagentId, skillId);
    }

    public async createEdge(source: string, target: string): Promise<void> {
        const agenticUri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'agentic.json');
        const content = await vscode.workspace.fs.readFile(agenticUri);
        const data = JSON.parse(content.toString());
        const primaryAgentName = typeof data.default_agent === 'string' ? data.default_agent : null;
        if (!Array.isArray(data.subagents)) data.subagents = [];
        const normalizeNodeId = (value: string): string => {
            const trimmed = String(value || '').trim();
            if (!trimmed.includes('::')) return trimmed;
            const parts = trimmed.split('::').filter(Boolean);
            return parts.length > 0 ? parts[parts.length - 1] : trimmed;
        };
        const normalizedSource = normalizeNodeId(source);
        const normalizedTarget = normalizeNodeId(target);

        const findOwnerEntry = (name: string) => data.subagents.find((sa: any) => sa.name === name);
        const isKnownOwner = (name: string) =>
            Boolean(findOwnerEntry(name)) || (primaryAgentName !== null && name === primaryAgentName);
        const skillExists = async (name: string): Promise<boolean> => {
            const skillUri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'skills', name, 'SKILL.md');
            try {
                await vscode.workspace.fs.stat(skillUri);
                return true;
            } catch {
                return false;
            }
        };

        // Determine owner (agent/subagent) and skill, regardless of drag direction.
        let ownerName: string | null = null;
        let skillName: string | null = null;
        const sourceIsOwner = isKnownOwner(normalizedSource);
        const targetIsOwner = isKnownOwner(normalizedTarget);

        if (sourceIsOwner && !targetIsOwner) {
            ownerName = normalizedSource;
            skillName = normalizedTarget;
        } else if (targetIsOwner && !sourceIsOwner) {
            ownerName = normalizedTarget;
            skillName = normalizedSource;
        } else if (sourceIsOwner && targetIsOwner) {
            throw new Error(`Edge requires one owner (agent/subagent) and one skill. '${normalizedSource}' and '${normalizedTarget}' are both owners.`);
        } else {
            const sourceIsSkill = await skillExists(normalizedSource);
            const targetIsSkill = await skillExists(normalizedTarget);

            if (sourceIsSkill && !targetIsSkill) {
                ownerName = normalizedTarget;
                skillName = normalizedSource;
            } else if (targetIsSkill && !sourceIsSkill) {
                ownerName = normalizedSource;
                skillName = normalizedTarget;
            } else if (sourceIsSkill && targetIsSkill) {
                throw new Error(`Edge requires one owner (agent/subagent) and one skill. '${normalizedSource}' and '${normalizedTarget}' are both skills.`);
            }
        }

        if (!ownerName || !skillName) {
            throw new Error(`Edge requires one owner (agent/subagent) and one skill. '${normalizedSource}' and '${normalizedTarget}' not recognized.`);
        }
        let ownerEntry = findOwnerEntry(ownerName);
        // If primary agent is not represented in subagents[], add a minimal entry
        // so skills[] relations can still be persisted.
        if (!ownerEntry && ownerName === primaryAgentName) {
            ownerEntry = {
                name: ownerName,
                mode: 'primary',
                description: data.description || '',
                role_file: `.agents/subagents/${ownerName}/SUBAGENT.md`,
                permission: {
                    edit: {
                        '*': 'deny'
                    }
                }
            };
            data.subagents.push(ownerEntry);
        }
        if (!ownerEntry) {
            throw new Error(`Owner '${ownerName}' not found in agentic.json#subagents[]`);
        }

        // 1. Update agentic.json
        if (!ownerEntry.skills) ownerEntry.skills = [];
        if (!ownerEntry.skills.includes(skillName)) {
            ownerEntry.skills.push(skillName);
        }
        await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(data, null, 2)));

        // 2. Update SUBAGENT.md — add ## Skills section if missing, or append to it
        const ownerMdUri = vscode.Uri.joinPath(
            this.workspaceRoot, '.agents', 'subagents', ownerName, 'SUBAGENT.md'
        );
        try {
            const mdContent = (await vscode.workspace.fs.readFile(ownerMdUri)).toString();
            const parsed = matter(mdContent);
            let body = parsed.content;

            // Check if ## Skills section already exists
            const skillsSectionRegex = /##\s+Skills\s*\n([\s\S]*?)(?=\n##|\n*$)/i;
            const match = body.match(skillsSectionRegex);

            if (match) {
                // Append to existing ## Skills section if skill not already listed
                const existingSkills = match[1].split('\n')
                    .map(s => s.replace(/^[-*\s]*/, '').trim())
                    .filter(s => s.length > 0);
                if (!existingSkills.some(s => s === skillName)) {
                    const newSection = `## Skills\n${match[1].trimEnd()}\n- ${skillName}\n`;
                    body = body.replace(/##\s+Skills\s*\n[\s\S]*?(?=\n##|\n*$)/i, newSection);
                }
            } else {
                // No ## Skills section exists — add it before first ## section or at end
                const firstSectionMatch = body.match(/\n(?=##)/);
                if (firstSectionMatch) {
                    body = body.replace(firstSectionMatch, `\n## Skills\n- ${skillName}\n\n`);
                } else {
                    body += `\n\n## Skills\n- ${skillName}\n`;
                }
            }

            if (body !== parsed.content) {
                const newContent = matter.stringify(body, parsed.data);
                await vscode.workspace.fs.writeFile(ownerMdUri, Buffer.from(newContent));
            }
        } catch {
            // SUBAGENT.md might not exist yet — silently skip markdown update
            console.warn(`SUBAGENT.md not found for '${ownerName}', skipped markdown update`);
        }
    }

    public async deleteEdge(source: string, target: string, label: string): Promise<void> {
        const agenticUri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'agentic.json');
        const agenticContent = await vscode.workspace.fs.readFile(agenticUri);
        const agentic = JSON.parse(agenticContent.toString());

        if (label === 'uses') {
            if (!Array.isArray(agentic.subagents)) agentic.subagents = [];
            const primaryAgentName = typeof agentic.default_agent === 'string' ? agentic.default_agent : null;
            const normalizeNodeId = (value: string): string => {
                const trimmed = String(value || '').trim();
                if (!trimmed.includes('::')) return trimmed;
                const parts = trimmed.split('::').filter(Boolean);
                return parts.length > 0 ? parts[parts.length - 1] : trimmed;
            };
            const normalizedSource = normalizeNodeId(source);
            const normalizedTarget = normalizeNodeId(target);

            const sourceIsOwner = Boolean(agentic.subagents.find((sa: any) => sa.name === normalizedSource)) || normalizedSource === primaryAgentName;
            const targetIsOwner = Boolean(agentic.subagents.find((sa: any) => sa.name === normalizedTarget)) || normalizedTarget === primaryAgentName;

            const ownerName = sourceIsOwner ? normalizedSource : targetIsOwner ? normalizedTarget : null;
            const skillName = ownerName === normalizedSource ? normalizedTarget : normalizedSource;

            if (ownerName) {
                const ownerEntry = agentic.subagents.find((s: any) => s.name === ownerName);
                if (ownerEntry && ownerEntry.skills) {
                    ownerEntry.skills = ownerEntry.skills.filter((s: string) => s !== skillName);
                }

                // Persist agentic.json
                await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(agentic, null, 2)));

                // Remove from SUBAGENT.md ## Skills section
                const ownerMdUri = vscode.Uri.joinPath(
                    this.workspaceRoot, '.agents', 'subagents', ownerName, 'SUBAGENT.md'
                );
                try {
                    const mdContent = (await vscode.workspace.fs.readFile(ownerMdUri)).toString();
                    const parsed = matter(mdContent);
                    let body = parsed.content;

                    // Remove skill from ## Skills section
                    const skillsSectionRegex = /##\s+Skills\s*\n([\s\S]*?)(?=\n##|\n*$)/i;
                    const match = body.match(skillsSectionRegex);
                    if (match) {
                        const remainingLines = match[1].split('\n')
                            .filter(line => {
                                const trimmed = line.replace(/^[-*\s]*/, '').trim();
                                return trimmed.length === 0 || trimmed !== skillName;
                            });
                        
                        if (remainingLines.some(l => l.trim().length > 0)) {
                            // Keep section with remaining skills
                            const newSection = `## Skills\n${remainingLines.join('\n')}\n`;
                            body = body.replace(/##\s+Skills\s*\n[\s\S]*?(?=\n##|\n*$)/i, newSection);
                        } else {
                            // Remove entire ## Skills section (no skills left)
                            body = body.replace(/\n*##\s+Skills\s*\n[\s\S]*?(?=\n##|\n*$)/i, '\n');
                        }

                        if (body !== parsed.content) {
                            const newContent = matter.stringify(body.trimStart(), parsed.data);
                            await vscode.workspace.fs.writeFile(ownerMdUri, Buffer.from(newContent));
                        }
                    }
                } catch {
                    console.warn(`SUBAGENT.md not found for '${ownerName}', skipped markdown update`);
                }
            }
        } else if (label === 'manages') {
            // Remove subagent from agentic.json subagents[] array
            // source is the primary agent, target is the subagent to remove
            const subagentName = target;
            agentic.subagents = agentic.subagents.filter((sa: any) => sa.name !== subagentName);
            await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(agentic, null, 2)));
        } else if (label === 'executing') {
            // Remove agent assignment from feature_list.json
            const featureListUri = vscode.Uri.joinPath(this.workspaceRoot, 'feature_list.json');
            try {
                const flContent = await vscode.workspace.fs.readFile(featureListUri);
                const flData = JSON.parse(flContent.toString());
                if (flData.features) {
                    // target is the feature ID
                    const feature = flData.features.find((f: any) => f.id === target);
                    if (feature && feature.agent) {
                        delete feature.agent;
                    }
                    await vscode.workspace.fs.writeFile(featureListUri, Buffer.from(JSON.stringify(flData, null, 2)));
                }
            } catch {
                console.warn(`feature_list.json not found or invalid`);
            }
        }
    }

    public async reassignSkill(skillId: string, newOwner: string): Promise<void> {
        // 1. Find and delete ALL uses edges pointing to this skill
        const agenticUri = vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'agentic.json');
        const content = await vscode.workspace.fs.readFile(agenticUri);
        const data = JSON.parse(content.toString());

        const oldOwners: string[] = [];

        if (data.subagents) {
            for (const sa of data.subagents) {
                if (sa.skills && sa.skills.includes(skillId)) {
                    oldOwners.push(sa.name);
                    sa.skills = sa.skills.filter((s: string) => s !== skillId);
                }
            }
        }

        // 2. Persist agentic.json with old owners removed
        await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(data, null, 2)));

        // 3. Remove from each old owner's SUBAGENT.md ## Skills section
        for (const oldOwner of oldOwners) {
            const subagentMdUri = vscode.Uri.joinPath(
                this.workspaceRoot, '.agents', 'subagents', oldOwner, 'SUBAGENT.md'
            );
            try {
                const mdContent = (await vscode.workspace.fs.readFile(subagentMdUri)).toString();
                const parsed = matter(mdContent);
                let body = parsed.content;

                const skillsSectionRegex = /##\s+Skills\s*\n([\s\S]*?)(?=\n##|\n*$)/i;
                const match = body.match(skillsSectionRegex);
                if (match) {
                    const remainingLines = match[1].split('\n')
                        .filter(line => {
                            const trimmed = line.replace(/^[-*\s]*/, '').trim();
                            return trimmed.length === 0 || trimmed !== skillId;
                        });

                    if (remainingLines.some(l => l.trim().length > 0)) {
                        const newSection = `## Skills\n${remainingLines.join('\n')}\n`;
                        body = body.replace(/##\s+Skills\s*\n[\s\S]*?(?=\n##|\n*$)/i, newSection);
                    } else {
                        body = body.replace(/\n*##\s+Skills\s*\n[\s\S]*?(?=\n##|\n*$)/i, '\n');
                    }

                    if (body !== parsed.content) {
                        const newContent = matter.stringify(body.trimStart(), parsed.data);
                        await vscode.workspace.fs.writeFile(subagentMdUri, Buffer.from(newContent));
                    }
                }
            } catch {
                console.warn(`SUBAGENT.md not found for '${oldOwner}', skipped markdown update`);
            }
        }

        // 4. Ensure newOwner exists in agentic.json (it may be an orphan subagent detected from disk)
        const newOwnerExists = data.subagents?.some((sa: any) => sa.name === newOwner);
        if (!newOwnerExists) {
            if (!data.subagents) data.subagents = [];
            data.subagents.push({
                name: newOwner,
                mode: 'subagent',
                description: '',  // will be populated from SUBAGENT.md on next parse
                role_file: `.agents/subagents/${newOwner}/SUBAGENT.md`,
                permission: {
                    edit: {
                        '*': 'deny'
                    }
                }
            });
            await vscode.workspace.fs.writeFile(agenticUri, Buffer.from(JSON.stringify(data, null, 2)));
        }

        // 5. Create new uses edge from newOwner to skillId
        await this.createEdge(newOwner, skillId);
    }

    public async updateEdgeLabel(source: string, target: string, newLabel: string): Promise<void> {
        // For 'uses' edges: no label is persisted separately — the relationship
        // is stored in subagent.skills[] and the label is always 'uses'.
        // For 'manages' and 'executing' edges, the label is derived from the data structure.
        // This method handles the data restructuring needed for label changes.
        
        if (newLabel === 'uses') {
            // If changing to 'uses', ensure the skill link exists in subagent.skills[]
            await this.createEdge(source, target);
        }
        // Other label transitions are structural changes that require re-parsing;
        // the local graph update handles the visual change.
    }
}
