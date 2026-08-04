// FEAT-034 — Component Optimizer — Node → ComponentSource (design.md §C, R1, R2, R3)
//
// The only I/O in the whole src/optimizer/ module is the injected `readFile`
// callback below. This keeps the module testable without a vscode mock:
// extension.ts (Group E, out of this module's scope) passes a
// vscode.workspace.fs-backed reader; tests pass a Map lookup.
//
// DEVIATION FROM design.md §C: the design's signature is
//   loadComponents(nodes, root: vscode.Uri, readFile) => Promise<ComponentSource[]>
// `root: vscode.Uri` would require importing 'vscode' types into this module,
// which is a hard, non-negotiable constraint against. `root` is not otherwise
// used inside this function — reading is fully delegated to `readFile`, and
// `metadata._filePath` is already workspace-relative (see parserLogic.ts).
// `root` is kept as a plain `string` parameter for signature/call-site parity
// with the design (Group E's extension.ts can still pass the workspace root
// path), but it is inert here.

import matter from '../frontmatter.js';
import type { HarnessNode, NodeMetadata } from '../types.js';
import { estimateTokens } from './tokenEstimator.js';
import type { ComponentSource, OptimizableType, PathKind } from './types.js';

const OPTIMIZABLE_TYPES: ReadonlySet<string> = new Set<OptimizableType>([
    'agent', 'subagent', 'skill', 'steering', 'hook',
]);

function isOptimizableType(type: string): type is OptimizableType {
    return OPTIMIZABLE_TYPES.has(type);
}

function readFilePath(metadata: NodeMetadata): string {
    const raw = (metadata as Record<string, unknown>)._filePath;
    return typeof raw === 'string' ? raw : '';
}

/**
 * Plain (non-internal) fields off the graph node's own metadata, used as a
 * base layer for ComponentSource.frontmatter (see DEVIATION note below).
 */
function manifestPlainFields(metadata: NodeMetadata): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
        if (key.startsWith('_') || key === 'body') continue;
        out[key] = value;
    }
    return out;
}

function emptySource(
    node: HarnessNode,
    nodeType: OptimizableType,
    filePath: string,
    pathKind: PathKind,
): ComponentSource {
    return {
        nodeId: node.id,
        nodeType,
        label: node.label,
        filePath,
        raw: '',
        frontmatter: {},
        body: '',
        exists: false,
        pathKind,
        tokenEstimate: 0,
    };
}

async function loadOne(
    node: HarnessNode,
    readFile: (rel: string) => Promise<string | null>,
    statPath?: (rel: string) => Promise<'file' | 'directory' | 'missing'>,
): Promise<ComponentSource> {
    const nodeType = node.type as OptimizableType;
    const filePath = readFilePath(node.metadata);

    // R3: absent/empty _filePath → exists:false, never throw.
    if (!filePath) {
        return emptySource(node, nodeType, '', 'unresolved');
    }

    // A node rooted at a directory has no file to analyse. That is a different
    // fact from "the declared file is gone", and only the second is drift.
    if (statPath) {
        let kind: 'file' | 'directory' | 'missing';
        try {
            kind = await statPath(filePath);
        } catch {
            kind = 'missing';
        }
        if (kind !== 'file') {
            return emptySource(node, nodeType, filePath, kind);
        }
    }

    let raw: string | null;
    try {
        raw = await readFile(filePath);
    } catch {
        // R3: unreadable file → exists:false, never throw.
        raw = null;
    }

    // R3: file could not be read (readFile returned null).
    if (raw === null) {
        return emptySource(node, nodeType, filePath, 'missing');
    }

    // R2: raw is read from disk (via the injected reader), NOT from
    // metadata.body / _fullBody / _preview — those are truncated or
    // type-dependent (see design.md §C discussion).
    const { data, content } = matter(raw);

    // DEVIATION from design.md §C: `frontmatter` is a shallow merge of the
    // graph node's own manifest metadata (excluding `_`-prefixed internal
    // fields and the truncated `body` preview) overlaid with the freshly
    // parsed YAML frontmatter from disk. A literal "parse only the raw file
    // text" implementation leaves hook and manifest-declared steering rules
    // unable to see `metadata.event` / `metadata.script` / `applies_to`,
    // because those live in `.agents/agentic.json`, not in a `---` YAML
    // block inside the hook script or (necessarily) the steering file —
    // OPT-S06 (R18) is otherwise unsatisfiable for hooks. Fresh file
    // frontmatter wins on key collisions since it reflects the current
    // on-disk state rather than a possibly-stale manifest cache.
    const frontmatter: Record<string, unknown> = {
        ...manifestPlainFields(node.metadata),
        ...data,
    };

    return {
        nodeId: node.id,
        nodeType,
        label: node.label,
        filePath,
        raw,
        frontmatter,
        body: content,
        exists: true,
        pathKind: 'file' as PathKind,
        tokenEstimate: estimateTokens(raw),
    };
}

/**
 * Node → ComponentSource for every optimizable node (R1, R2, R3).
 *
 * Filters to exactly the five optimizable NodeType values (R1); never
 * produces a ComponentSource for `feature`, `discovered-*` or `cli-install`
 * nodes.
 */
export async function loadComponents(
    nodes: HarnessNode[],
    root: string,
    readFile: (rel: string) => Promise<string | null>,
    /**
     * Optional probe distinguishing a directory from a genuinely absent path.
     * Without it a directory is indistinguishable from a missing file, which is
     * what made OPT-D01 report a populated `.kiro/` as "missing on disk".
     * Callers with filesystem access (extension.ts) should always supply it.
     */
    statPath?: (rel: string) => Promise<'file' | 'directory' | 'missing'>,
): Promise<ComponentSource[]> {
    void root; // see DEVIATION note above — reserved for call-site parity only
    const optimizable = nodes.filter(n => isOptimizableType(n.type));
    const sources: ComponentSource[] = [];
    for (const node of optimizable) {
        sources.push(await loadOne(node, readFile, statPath));
    }
    return sources;
}
