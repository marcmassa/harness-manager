// FEAT-044 T1 — when a resource enters a model's context (R1, R2, R3).
// Pure: no vscode import. The owning provider declares it: built-in adapters
// through this table, keyed by the native semantics the adapter already reads;
// profiles and companions through an optional field. Nothing is inferred
// from a product name or a file extension alone, so the fallback is `unknown`.

export type LoadMode = 'always' | 'on-trigger' | 'delegated' | 'on-event' | 'manual' | 'unknown';

export const LOAD_MODES: readonly LoadMode[] = ['always', 'on-trigger', 'delegated', 'on-event', 'manual', 'unknown'];

export const isLoadMode = (value: unknown): value is LoadMode =>
    typeof value === 'string' && (LOAD_MODES as readonly string[]).includes(value);

interface NodeLike {
    type: string;
    metadata: Record<string, unknown>;
}

const fileOf = (node: NodeLike) => String(node.metadata._filePath ?? '').replace(/\\/g, '/');
const base = (path: string) => path.split('/').pop() ?? path;
const present = (value: unknown) => (Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim() !== '' : value != null);

type Rule = (node: NodeLike, path: string) => LoadMode | undefined;

/**
 * Built-in providers' documented loading semantics. Each entry reads only what
 * that adapter parses from its own format; a resource it does not recognise
 * stays `unknown`.
 */
const BUILTIN: Readonly<Record<string, Rule>> = {
    'claude-code': (n, p) =>
        p === 'CLAUDE.md' ? 'always'
        : n.type === 'subagent' ? 'delegated'      // .claude/agents/*.md run in their own context
        : n.type === 'skill' ? 'on-trigger'
        : undefined,
    'harness-sdd': n =>
        n.type === 'subagent' ? 'delegated'
        : n.type === 'skill' ? 'on-trigger'
        : n.type === 'steering'
            ? (Array.isArray(n.metadata.applies_to) && n.metadata.applies_to.includes('*') ? 'always' : 'delegated')
            : undefined,
    'gemini-cli': (n, p) =>
        p === 'GEMINI.md' ? 'always'
        : p.endsWith('.toml') ? 'manual'           // custom commands run when invoked
        : undefined,
    copilot: (n, p) =>
        p === '.github/copilot-instructions.md' ? 'always'
        : p.endsWith('.instructions.md') ? (present(n.metadata.applyTo) ? 'on-trigger' : 'always')
        : p.endsWith('.prompt.md') ? 'manual'
        : undefined,
    cursor: (n, p) =>
        base(p) === '.cursorrules' ? 'always'
        : p.endsWith('.mdc')
            ? (n.metadata.alwaysApply === true ? 'always'
                : present(n.metadata.globs) || present(n.metadata.description) ? 'on-trigger'
                : 'manual')
            : undefined,
    kiro: n =>
        n.type === 'skill' ? 'on-trigger'
        : n.type === 'steering'
            ? (n.metadata.inclusion === 'fileMatch' ? 'on-trigger'
                : n.metadata.inclusion === 'manual' ? 'manual'
                : 'always')                         // Kiro's default inclusion
            : undefined,
    windsurf: (_n, p) => (base(p) === '.windsurfrules' ? 'always' : undefined),
    opencode: n => (n.type === 'subagent' ? 'delegated' : undefined),
};

export const BUILTIN_LOAD_PROVIDERS: ReadonlySet<string> = new Set(Object.keys(BUILTIN));

/**
 * The load mode of one resource. Hooks run scripts, not context (`on-event`).
 * A built-in provider's resources use its table only (a frontmatter field in
 * the file is the author's text, not the provider's declaration). Profile and
 * companion resources use their declared `_loadMode`.
 */
export function resolveLoadMode(providerId: string | undefined, node: NodeLike): LoadMode {
    if (node.type === 'hook') return 'on-event';
    if (!providerId) return 'unknown';
    const builtin = BUILTIN[providerId];
    if (builtin) return builtin(node, fileOf(node)) ?? 'unknown';
    return isLoadMode(node.metadata._loadMode) ? node.metadata._loadMode : 'unknown';
}
