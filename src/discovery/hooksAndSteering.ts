// ============================================================================
// hooksAndSteering.ts — FEAT-026 T5/T6
//
// Auto-discover hook scripts and steering markdown files for one
// configurable adapter. R5–R17 are implemented here; the per-adapter
// adapters (Kiro, Claude Code, Cursor, Gemini, Copilot, Windsurf) call
// `discover()` at the end of their `parse()` to merge the discovered
// nodes/edges into their own result.
//
// R19 (non-configurable adapters) is enforced at the call site: the
// adapter's `isPathConfigurable()` must return true before `discover()`
// is called. R18 (Harness SDD's `agentic.json` parser) is untouched.
// ============================================================================

import * as vscode from 'vscode';
import matter from '../frontmatter.js';
import { HarnessEdge, HarnessNode } from '../types.js';
import { ConfigurationRegistry } from '../adapters/ConfigurationRegistry.js';
import {
    findFiles,
    normalizePath,
    readTextFromUri,
    toRelativePath,
    withFrameworkMetadata,
} from '../adapters/adapterUtils.js';
import { frameworkLabel } from '../frameworks.js';
import type { HarnessDashboardConfig } from '../config/harnessConfig.js';

const HOOK_EXTENSIONS = '{sh,js,ts}';
const STEERING_EXTENSION = 'md';

export interface DiscoveryResult {
    nodes: HarnessNode[];
    edges: HarnessEdge[];
    /** Resolved globs that were actually scanned (for watchGlobs wiring). */
    resolvedGlobs: { hooks: string[]; steering: string[] };
}

/**
 * Auto-discover hook scripts and steering markdown files for one
 * adapter. Returns the nodes and edges that should be merged into the
 * adapter's result.
 *
 * @param adapterId              the framework's config key (e.g., 'kiro')
 * @param root                   workspace root
 * @param config                 the local `.harness-dashboard/config.json`
 *                               (empty is fine)
 * @param discoveryEnabled       per-adapter kill switch (R9)
 * @param rootDiscoveryEnabled   global kill switch for project-root scan
 *                               (R10)
 * @param rootAgentId            the adapter's root agent node id; hooks
 *                               are linked to it (R14)
 * @param subagentIds            subagent node ids the adapter has
 *                               created; steering uses this for
 *                               `applies_to` inference (R15)
 */
export async function discover(
    adapterId: string,
    root: vscode.Uri,
    config: HarnessDashboardConfig,
    discoveryEnabled: boolean,
    rootDiscoveryEnabled: boolean,
    rootAgentId: string,
    subagentIds: string[],
): Promise<DiscoveryResult> {
    if (!discoveryEnabled) {
        return { nodes: [], edges: [], resolvedGlobs: { hooks: [], steering: [] } };
    }

    const basePath = ConfigurationRegistry.getInstance().getPathFor(adapterId);
    if (!basePath) {
        // Non-configurable adapter — R19 says we should not be called,
        // but defend against it anyway.
        return { nodes: [], edges: [], resolvedGlobs: { hooks: [], steering: [] } };
    }

    const adapterCfg = config.adapters?.[adapterId];
    const extras = config.extraPaths?.[adapterId];

    const hooksGlobs: string[] = [
        adapterCfg?.hooksPath ?? `${basePath}/hooks`,
        ...(extras?.hooks ?? []),
    ];
    const steeringGlobs: string[] = [
        adapterCfg?.steeringPath ?? `${basePath}/steering`,
        ...(extras?.steering ?? []),
    ];
    if (rootDiscoveryEnabled) {
        hooksGlobs.push('hooks');
        steeringGlobs.push('steering');
    }

    const nodes: HarnessNode[] = [];
    const edges: HarnessEdge[] = [];
    const seen = new Set<string>();
    const label = frameworkLabel(adapterId);

    // R11, R14, R16: hook scripts.
    for (const hookGlob of hooksGlobs) {
        const pattern = `${hookGlob}/**/*.${HOOK_EXTENSIONS}`;
        const files = await findFiles(root, pattern);
        for (const file of files) {
            const absolute = normalizePath(file.fsPath);
            if (seen.has(absolute)) continue;
            seen.add(absolute);

            const relativePath = toRelativePath(root, file);
            const fileName = relativePath.split('/').pop() ?? '';
            const stem = fileName.replace(/\.(sh|js|ts)$/i, '');
            const content = await readTextFromUri(file);
            const frontmatter = parseFrontmatter(content, fileName);
            // R11: frontmatter `event` if present, else strip extension
            // and normalise hyphens to underscores.
            const event = (typeof frontmatter.event === 'string' && frontmatter.event)
                ? frontmatter.event
                : stem.replace(/-/g, '_');
            const nodeId = `hook-${adapterId}-${event}`;

            const metadata: Record<string, any> = {
                event,
                script: relativePath,
                description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
                _discovery: 'discovered',
            };
            if (content !== null) {
                metadata._preview = content.substring(0, 500);
            } else {
                metadata._fileMissing = true;
            }

            const node = withFrameworkMetadata(
                {
                    id: nodeId,
                    type: 'hook',
                    label: event,
                    metadata,
                },
                adapterId,
                label,
                relativePath,
            );
            nodes.push(node);

            // R14: triggers edge to the adapter's root agent.
            if (rootAgentId) {
                edges.push({
                    id: `edge-${nodeId}-${rootAgentId}-triggers`,
                    source: nodeId,
                    target: rootAgentId,
                    label: 'triggers',
                });
            }
        }
    }

    // R12, R15, R16: steering markdown files.
    for (const steeringGlob of steeringGlobs) {
        const pattern = `${steeringGlob}/**/*.${STEERING_EXTENSION}`;
        const files = await findFiles(root, pattern);
        for (const file of files) {
            const absolute = normalizePath(file.fsPath);
            if (seen.has(absolute)) continue;
            seen.add(absolute);

            const relativePath = toRelativePath(root, file);
            const fileName = relativePath.split('/').pop() ?? '';
            const stem = fileName.replace(/\.md$/i, '');
            const content = await readTextFromUri(file);
            const frontmatter = parseFrontmatter(content, fileName);
            // R12: frontmatter `description` if present, else first `# H1`.
            const description = (typeof frontmatter.description === 'string' && frontmatter.description)
                ? frontmatter.description
                : extractH1(content, '');
            // R15: if filename matches a subagent id, applies_to = that id;
            // else wildcard (governs all subagents of this adapter).
            const inferredAppliesTo = inferAppliesTo(stem, subagentIds);
            const appliesTo = (Array.isArray(frontmatter.applies_to) && frontmatter.applies_to.length > 0)
                ? frontmatter.applies_to
                : inferredAppliesTo;
            const nodeId = `steering-${adapterId}-${stem}`;

            const metadata: Record<string, any> = {
                name: stem,
                file: relativePath,
                description,
                applies_to: appliesTo,
                _discovery: 'discovered',
            };
            if (content !== null) {
                metadata._body = content;
            } else {
                metadata._fileMissing = true;
            }

            const node = withFrameworkMetadata(
                {
                    id: nodeId,
                    type: 'steering',
                    label: stem,
                    metadata,
                },
                adapterId,
                label,
                relativePath,
            );
            nodes.push(node);

            // R15: create governs edges to matching subagents.
            for (const target of appliesTo) {
                if (target === '*') {
                    for (const saId of subagentIds) {
                        edges.push({
                            id: `edge-${nodeId}-${saId}-governs`,
                            source: nodeId,
                            target: saId,
                            label: 'governs',
                        });
                    }
                } else if (subagentIds.includes(target)) {
                    edges.push({
                        id: `edge-${nodeId}-${target}-governs`,
                        source: nodeId,
                        target,
                        label: 'governs',
                    });
                }
            }
        }
    }

    return { nodes, edges, resolvedGlobs: { hooks: hooksGlobs, steering: steeringGlobs } };
}

// ----- helpers -----

/**
 * Try to parse YAML/JSON frontmatter. For .md files, the standard
 * gray-matter rules apply. For .sh/.js/.ts, gray-matter still works if
 * the file happens to start with a `---` block; we return whatever
 * frontmatter we find or `{}` if there is none.
 */
function parseFrontmatter(content: string | null, _fileName: string): Record<string, any> {
    if (!content) return {};
    try {
        const parsed = matter(content);
        return parsed.data ?? {};
    } catch {
        return {};
    }
}

/**
 * Extract the first `# H1` heading line (text after `# `, trimmed).
 * Returns `fallback` when the file is null or has no H1.
 */
function extractH1(content: string | null, fallback: string): string {
    if (!content) return fallback;
    const line = content.split(/\r?\n/).find((candidate) => candidate.trim().startsWith('# '));
    if (!line) return fallback;
    return line.replace(/^#\s+/, '').trim() || fallback;
}

/**
 * R15: filename-based applies_to inference. The user names a
 * steering file after the subagent it should govern (e.g.,
 * `typescript-implementer.md`). We compare the filename stem to
 * the **name** of each subagent (the segment after `<adapter>::`),
 * not the full prefixed id, so the user does not need to type the
 * adapter prefix. If no match, we fall back to the wildcard
 * behaviour (governs all subagents of the adapter).
 */
function inferAppliesTo(stem: string, subagentIds: string[]): string[] {
    for (const id of subagentIds) {
        const sepIndex = id.lastIndexOf('::');
        const name = sepIndex >= 0 ? id.slice(sepIndex + 2) : id;
        if (name === stem) return [id];
    }
    return ['*'];
}
