import matter from 'gray-matter';
import { ParserResult } from './types.js';

export function parseAgenticJson(content: string, result: ParserResult) {
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
                    metadata: { description: sa.description, role_file: sa.role_file, skills: sa.skills }
                });
                if (data.default_agent) {
                    result.graph.edges.push({
                        id: `edge-${data.default_agent}-${sa.name}`,
                        source: data.default_agent,
                        target: sa.name,
                        label: 'manages'
                    });
                }
                // Add edges to skills
                if (sa.skills) {
                    for (const skill of sa.skills) {
                        result.graph.edges.push({
                            id: `edge-${sa.name}-${skill}`,
                            source: sa.name,
                            target: skill,
                            label: 'uses'
                        });
                    }
                }
            }
        }
    } catch (e: any) {
        result.errors.push({ file: '.agents/agentic.json', message: e.message });
    }
}

export function parseFeatureList(content: string, result: ParserResult) {
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

export function parseMarkdown(content: string, filePath: string, result: ParserResult) {
    try {
        const { data, content: body } = matter(content);
        const name = data.name || filePath.split('/').pop()?.replace('.md', '');
        
        // This function is generic for both subagents and skills for now
        // Subagent matching logic
        const node = result.graph.nodes.find(n => n.id === name || (n.metadata.role_file && filePath.endsWith(n.metadata.role_file)));
        
        if (node) {
            node.metadata = { ...node.metadata, ...data, body: body.substring(0, 200) };
            if (data.name) node.label = data.name;
        } else {
            // Treat as skill if not matched as subagent
            result.graph.nodes.push({
                id: name || 'unknown',
                type: 'skill',
                label: name || 'unknown',
                metadata: { ...data, body: body.substring(0, 200) }
            });
        }
    } catch (e: any) {
        result.errors.push({ file: filePath, message: e.message });
    }
}
