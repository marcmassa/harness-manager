import * as vscode from 'vscode';
import { generateText } from './lmUtils.js';
import { openFileInEditor } from './fileUtils.js';

/**
 * Feature entry shape from feature_list.json.
 */
export interface FeatureEntry {
    id: string;
    name: string;
    title: string;
    description: string;
    type: string;
    status: string;
    priority: string;
    agent: string;
    sprint: string;
    sdd: boolean;
}

interface GetFeatureListResponse {
    features: FeatureEntry[];
}

interface GetSpecFileRequest {
    featureName: string;
    file: 'requirements' | 'design' | 'tasks';
}

interface GetSpecFileResponse {
    exists: boolean;
    content: string;
}

interface SaveSpecFileRequest {
    featureName: string;
    file: 'requirements' | 'design' | 'tasks';
    content: string;
}

interface SaveSpecFileResponse {
    ok: boolean;
    error?: string;
}

interface GenerateWithAIRequest {
    featureName: string;
    file: 'requirements' | 'design' | 'tasks';
}

interface GenerateWithAIResponse {
    ok: boolean;
    text?: string;
    error?: string;
}

interface OpenInEditorRequest {
    filePath: string;
}

// ===== Templates (hard-coded fallback) =====

const FALLBACK_REQUIREMENTS_TEMPLATE = `# Requirements — {Feature Name}

> Feature {id} from \`feature_list.json\`.

## Requirements

### R1 — {short title}
- **Pattern:** Ubiquitous
- The system SHALL {describe the ubiquitous behaviour}.
`;

const FALLBACK_DESIGN_TEMPLATE = `# Design — {Feature Name}

> Technical decisions to implement feature {id}.

## Summary

{1-2 paragraphs explaining what this functionality does and why it is necessary}

## Affected Files

| File | Action | Reason |
|------|--------|--------|
| \`path/to/file.ts\` | create | {reason} |
`;

const FALLBACK_TASKS_TEMPLATE = `# Tasks — {Feature Name}

> Discrete steps in order.

## Implementation

- [ ] **T1** — {brief description} _(R1)_
`;

/** Exported for testing (T11) */
export function getFallbackTemplate(file: 'requirements' | 'design' | 'tasks'): string {
    switch (file) {
        case 'requirements': return FALLBACK_REQUIREMENTS_TEMPLATE;
        case 'design': return FALLBACK_DESIGN_TEMPLATE;
        case 'tasks': return FALLBACK_TASKS_TEMPLATE;
    }
}

// ===== Prompt builder =====

/** Exported for testing (T11) */
export function buildAIPrompt(
    feature: FeatureEntry,
    file: 'requirements' | 'design' | 'tasks',
    templateContent: string,
    existingContent: string,
): string {
    const fileLabel = file === 'requirements' ? 'requirements' : file === 'design' ? 'design' : 'tasks';
    const cap = 4096;
    const truncated = existingContent.length > cap
        ? existingContent.slice(0, cap) + '\n\n[... truncated ...]'
        : existingContent || '(none)';

    let prompt = `You are writing a ${fileLabel} file for a Harness SDD feature.

## Feature
- Title: ${feature.title}
- Description: ${feature.description}

## Template (follow this structure)
${templateContent}

## Existing content (if any, capped at 4 096 chars)
${truncated}

## Output
Return only the markdown body, no preamble. Follow the template's structure exactly.`;

    // Enforce 8 192 char total cap
    if (prompt.length > 8192) {
        prompt = prompt.slice(0, 8192) + '\n\n[... truncated ...]';
    }

    return prompt;
}

// ===== Multi-base file resolution =====

/** Known workspace-relative base directories to search for project files. */
export const WORKSPACE_BASES = ['.', '.kiro'];

/**
 * Try to read a file relative to the workspace root, searching across
 * multiple known base directories (root, .kiro/, etc.).
 * Returns the content + the base where it was found, or null.
 */
export async function tryReadInWorkspace(
    workspaceRoot: vscode.Uri,
    relativePath: string,
): Promise<{ content: string; base: string } | null> {
    for (const base of WORKSPACE_BASES) {
        const uri = base === '.'
            ? vscode.Uri.joinPath(workspaceRoot, relativePath)
            : vscode.Uri.joinPath(workspaceRoot, base, relativePath);
        try {
            const buf = await vscode.workspace.fs.readFile(uri);
            return { content: buf.toString(), base };
        } catch {
            // try next base
        }
    }
    return null;
}

/**
 * Resolve the full URI for a workspace-relative path, searching across
 * multiple known base directories. Returns the first that exists.
 */
export async function resolveInWorkspace(
    workspaceRoot: vscode.Uri,
    relativePath: string,
): Promise<vscode.Uri | null> {
    for (const base of WORKSPACE_BASES) {
        const uri = base === '.'
            ? vscode.Uri.joinPath(workspaceRoot, relativePath)
            : vscode.Uri.joinPath(workspaceRoot, base, relativePath);
        try {
            await vscode.workspace.fs.stat(uri);
            return uri;
        } catch {
            // try next base
        }
    }
    return null;
}

/**
 * Detect which base directory has a `specs/` folder (for writes).
 * Prefers .kiro/ if both exist, finally falls back to root.
 */
export async function detectSpecsBase(workspaceRoot: vscode.Uri): Promise<string> {
    for (const base of WORKSPACE_BASES) {
        const uri = base === '.'
            ? vscode.Uri.joinPath(workspaceRoot, 'specs')
            : vscode.Uri.joinPath(workspaceRoot, base, 'specs');
        try {
            await vscode.workspace.fs.stat(uri);
            return base;
        } catch {
            // try next base
        }
    }
    return '.'; // fallback — create at root
}

// ===== Spec template reader =====

async function readSpecTemplate(
    workspaceRoot: vscode.Uri,
    file: 'requirements' | 'design' | 'tasks',
): Promise<string> {
    const templatePath = `specs/templates/${file}.md`;
    const found = await tryReadInWorkspace(workspaceRoot, templatePath);
    if (found) return found.content;
    return getFallbackTemplate(file);
}

// ===== SDD Manager Provider =====

export class SDDManagerProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'harness-dashboard.sddManager';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _workspaceRoot: vscode.Uri,
        private readonly _log: vscode.LogOutputChannel,
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
            sandbox: 'allow-scripts allow-same-origin allow-forms',
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            try {
                switch (data.type) {
                    case 'ready': {
                        this._view?.webview.postMessage({ type: 'ready', ok: true });
                        break;
                    }
                    case 'getFeatureList': {
                        const features = await this._getFeatureList();
                        this._view?.webview.postMessage({ type: 'featureList', features });
                        break;
                    }
                    case 'getSpecFile': {
                        const req = data as unknown as GetSpecFileRequest;
                        const result = await this._getSpecFile(req.featureName, req.file);
                        this._view?.webview.postMessage({
                            type: 'specFile',
                            ...result,
                            file: req.file,
                            featureName: req.featureName,
                        });
                        break;
                    }
                    case 'saveSpecFile': {
                        const req = data as unknown as SaveSpecFileRequest;
                        const result = await this._saveSpecFile(req.featureName, req.file, req.content);
                        this._view?.webview.postMessage({ type: 'saveResult', ...result, featureName: req.featureName, file: req.file });
                        break;
                    }
                    case 'generateWithAI': {
                        const req = data as unknown as GenerateWithAIRequest;
                        const result = await this._generateWithAI(req.featureName, req.file);
                        this._view?.webview.postMessage({
                            type: 'aiResult',
                            ...result,
                            file: req.file,
                            featureName: req.featureName,
                        });
                        break;
                    }
                    case 'createSpecFile': {
                        const req = data as unknown as GetSpecFileRequest;
                        const tplPath = `specs/templates/${req.file}.md`;
                        const tplFound = await tryReadInWorkspace(this._workspaceRoot, tplPath);
                        const templateContent = tplFound ? tplFound.content : getFallbackTemplate(req.file);
                        const saveOk = await this._saveSpecFile(req.featureName, req.file, templateContent);
                        if (saveOk.ok) {
                            const content = await this._getSpecFile(req.featureName, req.file);
                            this._view?.webview.postMessage({
                                type: 'specFile',
                                ...content,
                                file: req.file,
                                featureName: req.featureName,
                            });
                        } else {
                            this._view?.webview.postMessage({
                                type: 'saveResult',
                                ok: false,
                                error: saveOk.error || 'Could not create spec file',
                                featureName: req.featureName,
                                file: req.file,
                            });
                        }
                        break;
                    }
                    case 'openInEditor': {
                        const req = data as unknown as OpenInEditorRequest;
                        // Try multi-base resolution first
                        const resolvedUri = await resolveInWorkspace(this._workspaceRoot, req.filePath);
                        if (resolvedUri) {
                            await openFileInEditor(this._workspaceRoot, resolvedUri.fsPath);
                        } else {
                            // Fall back to original behaviour (may show "not found")
                            await openFileInEditor(this._workspaceRoot, req.filePath);
                        }
                        break;
                    }
                }
            } catch (e: any) {
                this._log.error(`[SDDManager] ${e?.message ?? String(e)}`);
                vscode.window.showErrorMessage(`SDD Manager Error: ${e?.message ?? String(e)}`);
            }
        });
    }

    // ===== Message handlers =====

    private async _getFeatureList(): Promise<FeatureEntry[]> {
        const found = await tryReadInWorkspace(this._workspaceRoot, 'feature_list.json');
        if (found) {
            try {
                const parsed = JSON.parse(found.content);
                return parsed.features ?? [];
            } catch {
                // invalid JSON — fall through
            }
        }
        this._log.warn('[SDDManager] Could not read feature_list.json in any workspace base');
        return [];
    }

    private async _getSpecFile(
        featureName: string,
        file: 'requirements' | 'design' | 'tasks',
    ): Promise<{ exists: boolean; content: string }> {
        const specPath = `specs/${featureName}/${file}.md`;
        const found = await tryReadInWorkspace(this._workspaceRoot, specPath);
        if (found) return { exists: true, content: found.content };
        return { exists: false, content: '' };
    }

    private async _saveSpecFile(
        featureName: string,
        file: 'requirements' | 'design' | 'tasks',
        content: string,
    ): Promise<{ ok: boolean; error?: string }> {
        // Write to the base where specs/ already exists, or root as fallback
        const base = await detectSpecsBase(this._workspaceRoot);
        const specPath = `specs/${featureName}/${file}.md`;
        const uri = base === '.'
            ? vscode.Uri.joinPath(this._workspaceRoot, specPath)
            : vscode.Uri.joinPath(this._workspaceRoot, base, specPath);
        try {
            // Ensure the directory exists
            const dir = base === '.'
                ? vscode.Uri.joinPath(this._workspaceRoot, 'specs', featureName)
                : vscode.Uri.joinPath(this._workspaceRoot, base, 'specs', featureName);
            await vscode.workspace.fs.createDirectory(dir);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            return { ok: true };
        } catch (e: any) {
            return { ok: false, error: e?.message ?? String(e) };
        }
    }

    private async _generateWithAI(
        featureName: string,
        file: 'requirements' | 'design' | 'tasks',
    ): Promise<{ ok: boolean; text?: string; error?: string }> {
        const features = await this._getFeatureList();
        const feature = features.find((f) => f.name === featureName);
        if (!feature) {
            return { ok: false, error: `Feature "${featureName}" not found in feature_list.json` };
        }

        const templateContent = await readSpecTemplate(this._workspaceRoot, file);
        const existing = await this._getSpecFile(featureName, file);
        const prompt = buildAIPrompt(feature, file, templateContent, existing.content);

        return await generateText(prompt);
    }

    // ===== HTML =====

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'sddManager.js'),
        );

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SDD Manager</title>
        </head>
        <body>
            <div id="root"></div>
            <script type="module" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}
