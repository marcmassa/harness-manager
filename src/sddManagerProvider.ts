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
    /** Indicates where this feature entry was sourced from. */
    source: 'json' | 'filesystem';
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

// ===== Specs root discovery =====

/**
 * Find the directory that contains the specs/ folder by scanning the
 * workspace recursively. Uses a glob anchor (specs/FEATURE/requirements.md)
 * to locate any existing spec, then extracts the parent path.
 *
 * The result is cached per workspaceRoot for the lifetime of the process
 * so repeated calls within a session are free.
 *
 * Returns the URI of the specs/ parent directory (i.e. the base from
 * which specs/<feature>/file.md paths are resolved), or null when no
 * specs exist yet (first creation).
 */
const _specsRootCache = new Map<string, vscode.Uri | null>();

export async function findSpecsRoot(workspaceRoot: vscode.Uri): Promise<vscode.Uri | null> {
    const cacheKey = workspaceRoot.toString();
    if (_specsRootCache.has(cacheKey)) {
        return _specsRootCache.get(cacheKey)!;
    }

    // Search for any requirements.md inside any specs/<feature>/ subtree,
    // regardless of where specs/ lives (root, .kiro/, etc.)
    const pattern = new vscode.RelativePattern(workspaceRoot, '**/specs/*/requirements.md');
    const hits = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);

    let result: vscode.Uri | null = null;
    if (hits.length > 0) {
        // hits[0] is  <root>/[prefix/]specs/<feature>/requirements.md
        // Walk up 3 levels: requirements.md → <feature>/ → specs/ → base
        const featureDir = vscode.Uri.joinPath(hits[0], '..'); // <feature>/
        const specsDir   = vscode.Uri.joinPath(featureDir, '..'); // specs/
        result           = vscode.Uri.joinPath(specsDir, '..'); // base (parent of specs/)
    }

    _specsRootCache.set(cacheKey, result);
    return result;
}

/**
 * Invalidate the specs-root cache for a workspace. Call this after a spec
 * is created for the first time so the next read picks up the new location.
 */
export function invalidateSpecsRootCache(workspaceRoot: vscode.Uri): void {
    _specsRootCache.delete(workspaceRoot.toString());
}

// ===== Filesystem specs discovery =====

/**
 * A feature-like entry discovered from the filesystem (specs/<name>/ directory)
 * rather than from feature_list.json.
 */
export interface DiscoveredSpecEntry {
    name: string;
    title: string;
    hasRequirements: boolean;
    hasDesign: boolean;
    hasTasks: boolean;
    /** Relative path from workspace root to the specs/ base directory. */
    specsBaseRel: string;
}

/**
 * Discover spec directories on the filesystem by finding all
 * specs/<name>/requirements.md patterns anywhere in the workspace
 * (using findSpecsRoot), then enumerating subdirectories.
 *
 * Returns a map of feature-name → DiscoveredSpecEntry for every
 * directory under specs/ that contains at least one spec file.
 */
export async function discoverSpecsFromFilesystem(
    workspaceRoot: vscode.Uri,
): Promise<Map<string, DiscoveredSpecEntry>> {
    const result = new Map<string, DiscoveredSpecEntry>();

    const base = await findSpecsRoot(workspaceRoot);
    if (!base) return result; // No specs/ directory exists yet

    const specsDir = vscode.Uri.joinPath(base, 'specs');
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(specsDir);
    } catch {
        return result; // specs/ doesn't exist or isn't readable
    }

    for (const [name, fileType] of entries) {
        if (fileType !== vscode.FileType.Directory) continue;
        // Skip hidden directories and templates/
        if (name.startsWith('.') || name === 'templates') continue;

        const featureDir = vscode.Uri.joinPath(specsDir, name);

        const reqExists = await fileExists(vscode.Uri.joinPath(featureDir, 'requirements.md'));
        const desExists = await fileExists(vscode.Uri.joinPath(featureDir, 'design.md'));
        const tskExists = await fileExists(vscode.Uri.joinPath(featureDir, 'tasks.md'));

        if (!reqExists && !desExists && !tskExists) continue; // Empty directory

        // Convert kebab-case to Title Case for display
        const title = name
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

        const baseRel = vscode.workspace.asRelativePath(base, false) || '.';

        result.set(name, {
            name,
            title,
            hasRequirements: reqExists,
            hasDesign: desExists,
            hasTasks: tskExists,
            specsBaseRel: baseRel,
        });
    }

    return result;
}

/**
 * Check whether a file exists at the given URI.
 */
async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/**
 * Resolve a specs-relative path (specs/<feature>/<file>.md) against the
 * discovered specs root. Falls back to the workspace root if no specs
 * directory has been found yet.
 */
async function resolveSpecUri(
    workspaceRoot: vscode.Uri,
    specRelPath: string,
): Promise<vscode.Uri> {
    const base = await findSpecsRoot(workspaceRoot) ?? workspaceRoot;
    return vscode.Uri.joinPath(base, specRelPath);
}

/**
 * Try to read a workspace file using the discovered specs root for
 * specs/... paths, and a fixed fallback list for everything else
 * (feature_list.json, progress/, templates/).
 *
 * Returns { content, base } on success, null on failure.
 */
export async function tryReadInWorkspace(
    workspaceRoot: vscode.Uri,
    relativePath: string,
): Promise<{ content: string; base: string } | null> {
    // For specs paths, use the discovered root
    if (relativePath.startsWith('specs/')) {
        const uri = await resolveSpecUri(workspaceRoot, relativePath);
        try {
            const buf = await vscode.workspace.fs.readFile(uri);
            const base = vscode.workspace.asRelativePath(
                vscode.Uri.joinPath(uri, '..', '..', '..'),
                false,
            );
            return { content: buf.toString(), base };
        } catch {
            return null;
        }
    }

    // For everything else search in root then .kiro/
    for (const base of ['.', '.kiro']) {
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
 * Resolve the full URI for a workspace-relative path.
 * Uses specs-root discovery for specs/... paths.
 */
export async function resolveInWorkspace(
    workspaceRoot: vscode.Uri,
    relativePath: string,
): Promise<vscode.Uri | null> {
    if (relativePath.startsWith('specs/')) {
        const uri = await resolveSpecUri(workspaceRoot, relativePath);
        try {
            await vscode.workspace.fs.stat(uri);
            return uri;
        } catch {
            return null;
        }
    }

    for (const base of ['.', '.kiro']) {
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
 * Return the base URI under which specs/ should be written.
 * Uses the discovered specs root when it already exists; falls back
 * to the workspace root (creates at root on first write).
 */
export async function detectSpecsBase(workspaceRoot: vscode.Uri): Promise<string> {
    const base = await findSpecsRoot(workspaceRoot);
    if (base) {
        // Return path relative to workspaceRoot so callers can use it as-is
        const rel = vscode.workspace.asRelativePath(base, false);
        return rel === '' ? '.' : rel;
    }
    return '.'; // no specs yet — create at root
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
