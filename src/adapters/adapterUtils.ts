import * as vscode from 'vscode';
import { HarnessNode, ParserResult } from '../types.js';
import { discover } from '../discovery/hooksAndSteering.js';
import { EMPTY_HARNESS_CONFIG, HarnessConfig } from '../config/harnessConfig.js';

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
 * root first, then .kiro/. Returns the path and content of the first match, or null.
 * Used by adapters that need to find files that may live at the project root
 * or inside a IDE-specific subdirectory (e.g. Kiro places files in .kiro/).
 */
export async function readTextMultiBase(
    root: vscode.Uri,
    relativePath: string,
    bases: string[] = ['.', '.kiro'],
): Promise<{ path: string; text: string } | null> {
    for (const base of bases) {
        const path = base === '.' ? relativePath : base + '/' + relativePath;
        const text = await readTextIfExists(root, path);
        if (text !== null) return { path, text };
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

/** Characters of a file body shown as the node preview (R4). */
export const BODY_PREVIEW_CHARS = 500;

export function bodyMetadata(text: string): { body: string; _fullBody: string } {
    return { body: text.slice(0, BODY_PREVIEW_CHARS), _fullBody: text };
}

export interface RootAgentLabels {
    /** Fallback for `extractMarkdownTitle` when the file has no `# ` heading. */
    title: string;
    /** Appended to the workspace name when the file is absent. */
    workspaceSuffix: string;
    /** Description when the file is absent. */
    description: string;
}

/**
 * The `<adapterId>::root` agent node built from an instructions file
 * (CLAUDE.md, copilot-instructions.md, GEMINI.md). `text` is null when
 * the file is absent: the node then has no source file.
 */
export function rootAgentNode(
    root: vscode.Uri,
    adapterId: string,
    adapterLabel: string,
    text: string | null,
    filePath: string,
    labels: RootAgentLabels,
): HarnessNode {
    return withFrameworkMetadata(
        {
            id: `${adapterId}::root`,
            type: 'agent',
            label: text
                ? extractMarkdownTitle(text, labels.title)
                : `${workspaceName(root)} ${labels.workspaceSuffix}`,
            metadata: {
                description: text ? text.split(/\r?\n/).slice(0, 6).join(' ').trim() : labels.description,
                ...bodyMetadata(text ?? ''),
            },
        },
        adapterId,
        adapterLabel,
        text ? filePath : undefined
    );
}

function settingEnabled(key: string): boolean {
    try {
        return vscode.workspace.getConfiguration('harness-dashboard').get<boolean>(key, true);
    } catch {
        return true;
    }
}

/** FEAT-026 kill switches: per-adapter discovery (R9) and project-root discovery (R10). Default true. */
export function discoveryFlags(configKey: string): { adapter: boolean; root: boolean } {
    return {
        adapter: settingEnabled(`adapters.${configKey}.discovery`),
        root: settingEnabled('discovery.root'),
    };
}

/**
 * FEAT-026 T7: append the hook/steering nodes discovered under the
 * adapter's folder and (when enabled) the project root. Honours the
 * local config overrides/extras and the kill switches.
 */
export async function appendDiscovery(
    result: ParserResult,
    adapterId: string,
    configKey: string,
    root: vscode.Uri,
    rootNodeId: string,
    harnessConfig?: HarnessConfig,
): Promise<void> {
    const localConfig = harnessConfig ? await harnessConfig.read(root) : EMPTY_HARNESS_CONFIG;
    const subagentIds = result.graph.nodes
        .filter((n) => n.type === 'subagent')
        .map((n) => n.id);
    const flags = discoveryFlags(configKey);
    const discovery = await discover(
        adapterId,
        root,
        localConfig,
        flags.adapter,
        flags.root,
        rootNodeId,
        subagentIds,
    );
    result.graph.nodes.push(...discovery.nodes);
    result.graph.edges.push(...discovery.edges);
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
