import * as vscode from 'vscode';
import { HarnessNode, ParserResult } from '../types.js';

export function createEmptyResult(): ParserResult {
    return {
        graph: { nodes: [], edges: [] },
        milestones: [],
        errors: [],
    };
}

export function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

export function workspaceName(root: vscode.Uri): string {
    const normalized = normalizePath(root.fsPath);
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'workspace';
}

export async function fileExists(root: vscode.Uri, relativePath: string): Promise<boolean> {
    const uri = vscode.Uri.joinPath(root, relativePath);
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

export async function readTextIfExists(root: vscode.Uri, relativePath: string): Promise<string | null> {
    const uri = vscode.Uri.joinPath(root, relativePath);
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf8');
    } catch {
        return null;
    }
}

/**
 * Like readTextIfExists but searches multiple base directories in order:
 * root first, then .kiro/. Returns the content of the first match, or null.
 * Used by adapters that need to find files that may live at the project root
 * or inside a IDE-specific subdirectory (e.g. Kiro places files in .kiro/).
 */
export async function readTextMultiBase(
    root: vscode.Uri,
    relativePath: string,
    bases: string[] = ['.', '.kiro'],
): Promise<string | null> {
    for (const base of bases) {
        const uri = base === '.'
            ? vscode.Uri.joinPath(root, relativePath)
            : vscode.Uri.joinPath(root, base, relativePath);
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(bytes).toString('utf8');
        } catch {
            // try next base
        }
    }
    return null;
}

export async function readTextFromUri(file: vscode.Uri): Promise<string | null> {
    try {
        const bytes = await vscode.workspace.fs.readFile(file);
        return Buffer.from(bytes).toString('utf8');
    } catch {
        return null;
    }
}

export async function findFiles(root: vscode.Uri, glob: string): Promise<vscode.Uri[]> {
    const pattern = new vscode.RelativePattern(root, glob);
    return vscode.workspace.findFiles(pattern);
}

export function toRelativePath(root: vscode.Uri, file: vscode.Uri): string {
    const relative = vscode.workspace.asRelativePath(file, false);
    if (relative.startsWith('../')) {
        return normalizePath(file.fsPath);
    }
    return normalizePath(relative);
}

export function extractMarkdownTitle(content: string, fallback: string): string {
    const line = content.split(/\r?\n/).find((candidate) => candidate.trim().startsWith('# '));
    if (!line) return fallback;
    return line.replace(/^#\s+/, '').trim() || fallback;
}

export function slugify(value: string): string {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    return slug || 'node';
}

export function prefixedNodeId(adapterId: string, rawId: string): string {
    return `${adapterId}::${slugify(rawId)}`;
}

export function withFrameworkMetadata(
    node: HarnessNode,
    frameworkId: string,
    frameworkLabel: string,
    filePath?: string
): HarnessNode {
    const metadata = {
        ...(node.metadata ?? {}),
        _framework: frameworkId,
        _frameworkLabel: frameworkLabel,
    };

    if (filePath) {
        metadata._filePath = normalizePath(filePath);
    }

    return {
        ...node,
        metadata,
    };
}

export function applyFrameworkMetadata(result: ParserResult, frameworkId: string, frameworkLabel: string): ParserResult {
    result.graph.nodes = result.graph.nodes.map((node) =>
        withFrameworkMetadata(node, frameworkId, frameworkLabel, node.metadata?._filePath as string | undefined)
    );
    return result;
}

export function parseSimpleToml(content: string): Record<string, unknown> {
    const parsed: Record<string, unknown> = {};
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue;
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex <= 0) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        let rawValue = trimmed.slice(separatorIndex + 1).trim();

        if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith('\'') && rawValue.endsWith('\''))) {
            parsed[key] = rawValue.slice(1, -1);
            continue;
        }

        if (rawValue === 'true' || rawValue === 'false') {
            parsed[key] = rawValue === 'true';
            continue;
        }

        const numeric = Number(rawValue);
        if (!Number.isNaN(numeric) && rawValue !== '') {
            parsed[key] = numeric;
            continue;
        }

        if (rawValue.includes('#')) {
            rawValue = rawValue.split('#')[0].trim();
        }
        parsed[key] = rawValue;
    }

    return parsed;
}

function stripJsonComments(content: string): string {
    let output = '';
    let inString = false;
    let escaped = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < content.length; i += 1) {
        const current = content[i];
        const next = content[i + 1];

        if (inLineComment) {
            if (current === '\n') {
                inLineComment = false;
                output += current;
            }
            continue;
        }

        if (inBlockComment) {
            if (current === '*' && next === '/') {
                inBlockComment = false;
                i += 1;
            }
            continue;
        }

        if (!inString && current === '/' && next === '/') {
            inLineComment = true;
            i += 1;
            continue;
        }

        if (!inString && current === '/' && next === '*') {
            inBlockComment = true;
            i += 1;
            continue;
        }

        output += current;

        if (escaped) {
            escaped = false;
            continue;
        }

        if (current === '\\') {
            escaped = true;
            continue;
        }

        if (current === '"') {
            inString = !inString;
        }
    }

    return output;
}

export function parseJsonWithComments(content: string): unknown {
    return JSON.parse(stripJsonComments(content));
}
