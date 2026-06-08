import * as vscode from 'vscode';
import { ParserResult, MarkdownFileContent } from './types.js';
import * as logic from './parserLogic.js';
import { reconcileSkillDiscovery, enrichWithIdoneity, addCrossRefEdges, addSemanticSuggestions, enrichSuggestedEdgesWithIdoneity } from './parserLogic.js';

// T2: Options for parse() to support persistent dismissal and disabled connections (R1, R4)
export interface ParseOptions {
    dismissedSuggestions?: Set<string>;  // "subagentId::skillId"
    disabledConnections?: Set<string>;   // "source::target"
}

export class HarnessParser {
    constructor(private readonly workspaceRoot: vscode.Uri) {}

    public async parse(options?: ParseOptions): Promise<ParserResult> {
        const result: ParserResult = {
            graph: { nodes: [], edges: [] },
            milestones: [],
            errors: []
        };

        const { dismissedSuggestions, disabledConnections } = options ?? {};

        try {
            const agenticJson = await this._safeReadFile('.agents/agentic.json');
            if (agenticJson) logic.parseAgenticJson(agenticJson, result);

            const featureList = await this._safeReadFile('feature_list.json');
            if (featureList) logic.parseFeatureList(featureList, result);

            const progressMd = await this._safeReadFile('progress/progress.md');
            if (progressMd) logic.parseProgressMd(progressMd, result);

            // Parse skills FIRST so skill nodes exist when subagents reference them
            await this._parseSkills(result);
            await this._parseSubagents(result);

            // Progressive Disclosure reconciliation:
            // Skills that were scanned but never linked → 'orphan' + 'discovered' edges
            const primaryAgentId = result.graph.nodes.find(n => n.type === 'agent')?.id || 'harness';
            reconcileSkillDiscovery(result, primaryAgentId);

            // FEAT-011: Agent-Skill Idoneity & Semantic Ownership
            // Compute bidirectional idoneity matrix, enrich nodes/edges, detect mismatches
            // T5 (R10): enrichWithIdoneity now returns the matrix to avoid re-computation
            const idoneityMatrix = enrichWithIdoneity(result);

            // FEAT-012 R3: Cross-reference edge suggestion (T3 R1: pass dismissedSuggestions)
            addCrossRefEdges(result, dismissedSuggestions);

            // FEAT-010: Semantic Skill Discovery (T3 R1: pass dismissedSuggestions)
            const llmScorer = this._createLlmScorer();
            const config = vscode.workspace.getConfiguration('harness.semanticMatcher');
            await addSemanticSuggestions(result, {
                threshold: config.get<number>('threshold', 0.25),
                llmScorer: config.get<boolean>('llm.enabled', false) ? llmScorer : undefined,
                llmTopK: config.get<number>('llm.topK', 5),
            }, dismissedSuggestions);

            // T5 (R10): Pass the pre-computed matrix — no second computeIdoneityMatrix call
            enrichSuggestedEdgesWithIdoneity(result, idoneityMatrix);

            // T4 (R4, R5): Mark disabled connections
            if (disabledConnections && disabledConnections.size > 0) {
                for (const edge of result.graph.edges) {
                    if (edge.label !== 'uses') continue;
                    const key = `${edge.source}::${edge.target}`;
                    if (disabledConnections.has(key)) {
                        edge.metadata = { ...edge.metadata, disabled: true };
                    }
                }
            }
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
        // Build a set of subagent names already registered from agentic.json
        const registeredSubagents = new Set(
            result.graph.nodes
                .filter(n => n.type === 'subagent')
                .map(n => n.id)
        );

        const pattern = new vscode.RelativePattern(vscode.Uri.joinPath(this.workspaceRoot, '.agents', 'subagents'), '**/SUBAGENT.md');
        const files = await vscode.workspace.findFiles(pattern);

        for (const file of files) {
            if (file.fsPath.includes('agent-template')) continue;
            const content = await this._safeReadFile(vscode.workspace.asRelativePath(file));
            if (content) logic.parseMarkdown(content, file.fsPath, result);
        }

        // R6: Detect orphan subagents — SUBAGENT.md exists but agent NOT in agentic.json
        // After parseMarkdown, check which subagent nodes were NOT registered before
        for (const node of result.graph.nodes) {
            if (node.type !== 'subagent') continue;
            if (node.metadata._orphan) continue; // already marked
            if (!registeredSubagents.has(node.id)) {
                // Node was created by parseMarkdown but not in agentic.json → orphan
                node.metadata._orphan = true;
                if (!node.metadata._discovery) {
                    node.metadata._discovery = 'scanned' as DiscoveryMethod;
                }
                result.errors.push({
                    file: `.agents/subagents/${node.id}/SUBAGENT.md`,
                    message: `Subagent '${node.id}' found on disk but not registered in agentic.json#subagents[] (orphan)`,
                });
            }
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

    /**
     * Creates an LLM scorer callback using vscode.lm (R8, R9).
     * Returns a dummy scorer that always returns 0 if vscode.lm is unavailable.
     */
    private _createLlmScorer(): (subagentDesc: string, skillDesc: string) => Promise<number> {
        return async (subagentDesc: string, skillDesc: string): Promise<number> => {
            try {
                const models = await vscode.lm.selectChatModels();
                if (!models || models.length === 0) return 0;

                const model = models[0];
                const messages = [
                    vscode.LanguageModelChatMessage.User(
                        `Rate the relevance between these two descriptions on a scale of 0 to 10, where 0 means completely unrelated and 10 means perfectly matched. Respond with ONLY a number between 0 and 10, nothing else.\n\nDescription A: ${subagentDesc}\n\nDescription B: ${skillDesc}`
                    ),
                ];
                const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
                let result = '';
                for await (const chunk of response.text) {
                    result += chunk;
                }
                const parsed = parseFloat(result.trim());
                return isNaN(parsed) ? 0 : Math.max(0, Math.min(1, parsed / 10));
            } catch {
                // LLM failed — return 0 (fallback to pure TF-IDF)
                return 0;
            }
        };
    }

    public async getMarkdownContent(nodeId: string, nodeType: string): Promise<MarkdownFileContent> {
        let relativePath: string;

        if (nodeType === 'skill') {
            relativePath = `.agents/skills/${nodeId}/SKILL.md`;
        } else {
            // agent or subagent
            relativePath = `.agents/subagents/${nodeId}/SUBAGENT.md`;
        }

        const content = await this._safeReadFile(relativePath);

        return {
            nodeId,
            filePath: relativePath,
            content: content ?? '',
            exists: content !== null
        };
    }
}
