import * as vscode from 'vscode';
import { ParserResult, MarkdownFileContent } from './types.js';
import {
    reconcileSkillDiscovery,
    enrichWithIdoneity,
    addCrossRefEdges,
    addSemanticSuggestions,
    enrichSuggestedEdgesWithIdoneity,
    detectAndFixOverlaps,
} from './parserLogic.js';
import { AdapterRegistry } from './adapters/AdapterRegistry.js';
import { createDefaultAdapters } from './adapters/index.js';
import { normalizePath } from './adapters/adapterUtils.js';
import { selectFirstChatModel, sendChatRequest } from './lmUtils.js';

export interface ParseOptions {
    dismissedSuggestions?: Set<string>;
    disabledConnections?: Set<string>;
}

export class HarnessParser {
    private readonly _registry: AdapterRegistry;

    constructor(
        private readonly workspaceRoot: vscode.Uri,
        log?: vscode.LogOutputChannel
    ) {
        this._registry = new AdapterRegistry(createDefaultAdapters(), log);
    }

    public getWatchGlobs(): string[] {
        return this._registry.watchGlobs();
    }

    public async parse(options?: ParseOptions): Promise<ParserResult> {
        const result = await this._registry.parse(this.workspaceRoot);
        const { dismissedSuggestions, disabledConnections } = options ?? {};

        try {
            const primaryAgentId = result.graph.nodes.find((node) => node.type === 'agent')?.id || 'harness';
            reconcileSkillDiscovery(result, primaryAgentId);

            const idoneityMatrix = enrichWithIdoneity(result);
            addCrossRefEdges(result, dismissedSuggestions);

            const llmScorer = this._createLlmScorer();
            const config = vscode.workspace.getConfiguration('harness.semanticMatcher');
            addSemanticSuggestions(result, {
                threshold: config.get<number>('threshold', 0.35),
                llmScorer: config.get<boolean>('llm.enabled', false) ? llmScorer : undefined,
                llmTopK: config.get<number>('llm.topK', 5),
                maxSuggestionsPerSubagent: config.get<number>('maxSuggestionsPerSubagent', 2),
            }, dismissedSuggestions);

            enrichSuggestedEdgesWithIdoneity(result, idoneityMatrix);

            // No-overlap guarantee (FEAT-023, R16–R18). At parse
            // time no node has `metadata._position` set, so this
            // is a no-op pass. The same function is callable
            // from the webview after dagre layout, where
            // positions are set, to actually do the work.
            detectAndFixOverlaps(result);

            if (disabledConnections && disabledConnections.size > 0) {
                for (const edge of result.graph.edges) {
                    if (edge.label !== 'uses') continue;
                    const key = `${edge.source}::${edge.target}`;
                    if (!disabledConnections.has(key)) continue;
                    edge.metadata = { ...edge.metadata, disabled: true };
                }
            }
        } catch (error: any) {
            result.errors.push({ file: 'system', message: error?.message ?? String(error) });
        }

        return result;
    }

    public async getMarkdownContent(nodeId: string, nodeType: string, filePath?: string): Promise<MarkdownFileContent> {
        const resolvedPath = filePath
            ? this._toWorkspaceRelativePath(filePath)
            : this._defaultPathForNode(nodeId, nodeType);

        if (!resolvedPath) {
            return {
                nodeId,
                filePath: '',
                content: '',
                exists: false,
            };
        }

        const content = await this._safeReadFile(resolvedPath);
        return {
            nodeId,
            filePath: resolvedPath,
            content: content ?? '',
            exists: content !== null,
        };
    }

    private async _safeReadFile(path: string): Promise<string | null> {
        const normalizedPath = normalizePath(path);
        const uri = this._isAbsolutePath(normalizedPath)
            ? vscode.Uri.file(normalizedPath)
            : vscode.Uri.joinPath(this.workspaceRoot, normalizedPath);

        try {
            const content = await vscode.workspace.fs.readFile(uri);
            return content.toString();
        } catch {
            return null;
        }
    }

    private _defaultPathForNode(nodeId: string, nodeType: string): string | null {
        if (nodeType === 'skill') {
            return `.agents/skills/${nodeId}/SKILL.md`;
        }
        if (nodeType === 'subagent') {
            return `.agents/subagents/${nodeId}/SUBAGENT.md`;
        }
        return null;
    }

    private _toWorkspaceRelativePath(inputPath: string): string {
        const normalizedInput = normalizePath(inputPath);
        if (!this._isAbsolutePath(normalizedInput)) return normalizedInput;

        const normalizedRoot = normalizePath(this.workspaceRoot.fsPath).replace(/\/+$/, '');
        if (normalizedInput.startsWith(`${normalizedRoot}/`)) {
            return normalizedInput.slice(normalizedRoot.length + 1);
        }

        return normalizedInput;
    }

    private _isAbsolutePath(targetPath: string): boolean {
        return /^([a-zA-Z]:\/|\/)/.test(normalizePath(targetPath));
    }

    private _createLlmScorer(): (subagentDesc: string, skillDesc: string) => Promise<number> {
        return async (subagentDesc: string, skillDesc: string): Promise<number> => {
            try {
                const model = await selectFirstChatModel();
                if (!model) return 0;

                const prompt = `Rate the relevance between these two descriptions on a scale of 0 to 10, where 0 means completely unrelated and 10 means perfectly matched. Respond with ONLY a number between 0 and 10, nothing else.\n\nDescription A: ${subagentDesc}\n\nDescription B: ${skillDesc}`;
                const text = await sendChatRequest(model, prompt);
                if (text === undefined) return 0;

                const parsed = parseFloat(text.trim());
                return Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(1, parsed / 10));
            } catch {
                return 0;
            }
        };
    }
}