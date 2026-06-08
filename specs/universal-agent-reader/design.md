# Design — Universal Agent Architecture Reader (FEAT-015)

> Architectural decisions, component model, data flow, and implementation risks for the Universal
> Agent Reader feature. All decisions must align with the principles in `DESIGN.md`.

---

## 1. Problem Statement

The plugin currently hardcodes the Harness SDD format (`.agents/agentic.json` + SUBAGENT.md/SKILL.md).
Any workspace that does not use Harness SDD appears empty. All major agentic tools share structurally
similar concepts: a root "agent" config, sub-roles (agents, rules, personas), and reusable skills
(commands, prompts, tools). The plugin should become format-agnostic by normalizing these concepts
into its existing `HarnessGraph` model.

---

## 2. Architectural Approach

### Chosen: Adapter Pattern with Registry

Each supported tool is encapsulated in a single TypeScript class implementing `IAgentAdapter`.
A `AdapterRegistry` holds all adapters and is the single entry point for the parser.

```
Extension Host
  └─ AdapterRegistry.parse(root)
       ├─ HarnessSddAdapter.detect() → true  → .parse() → ParserResult
       ├─ ClaudeCodeAdapter.detect() → false → skip
       ├─ GeminiCliAdapter.detect()  → true  → .parse() → ParserResult
       ├─ CursorAdapter.detect()     → false → skip
       ├─ CopilotAdapter.detect()    → false → skip
       ├─ OpenCodeAdapter.detect()   → false → skip
       └─ WindsurfAdapter.detect()   → false → skip
            │
            ▼
       mergeResults([HarnessSddResult, GeminiCliResult])
            │
            ▼
       ParserResult → Webview
```

### Discarded Alternative: Single-File Mega-Parser

A single `universalParser.ts` with `if/else` chains for each format.
**Discarded** because: impossible to test formats in isolation, impossible to add new formats
without modifying existing code (violates OCP), and makes it impossible to enable/disable
adapters at runtime.

### Discarded Alternative: Dynamic `require()` per Adapter

Lazy-load each adapter only when `detect()` returns true.
**Discarded** because: the performance gain is negligible (all adapters are pure TS, no heavy deps),
and it complicates the esbuild bundle configuration with dynamic chunk splitting.

---

## 3. Interface & Type Signatures

```typescript
// src/adapters/IAgentAdapter.ts
export interface IAgentAdapter {
    /** Stable identifier used in node metadata and framework badge. */
    id(): string;
    /** Returns true if this adapter can parse the given workspace root. */
    detect(root: vscode.Uri): Promise<boolean>;
    /** Parses the workspace and returns a partial ParserResult to be merged. */
    parse(root: vscode.Uri): Promise<Partial<ParserResult>>;
}

// src/adapters/AdapterRegistry.ts
export class AdapterRegistry {
    constructor(private readonly adapters: IAgentAdapter[]) {}
    async parse(root: vscode.Uri): Promise<ParserResult>;
    async detect(root: vscode.Uri): Promise<string[]>; // returns adapter ids found
}
```

`ParserResult` is the existing interface from `parserLogic.ts`. The `merge()` helper
concatenates `graph.nodes`, `graph.edges`, and `milestones`, deduplicating by `id`.

---

## 4. Node Metadata Extension

Each node produced by a non-Harness adapter SHALL carry:

```typescript
metadata._framework: string;   // adapter id, e.g. "claude-code"
metadata._frameworkLabel: string; // display name, e.g. "Claude Code"
```

The `CustomNode` component will read `_framework` to apply a per-framework border-left color accent
(4px colored stripe) while keeping the existing type-based background. This is additive—no existing
node styles are changed.

---

## 5. Adapter File Signatures

| Adapter id | `detect()` file check | Main node source |
|------------|----------------------|-----------------|
| `harness-sdd` | `.agents/agentic.json` | `subagents[]`, `skills[]` in JSON |
| `claude-code` | `CLAUDE.md` OR `.claude/agents/*.md` | `.claude/agents/*.md` YAML frontmatter |
| `gemini-cli` | `GEMINI.md` | `GEMINI.md` H1 + `.gemini/commands/*.toml` |
| `cursor` | `.cursor/rules/` OR `.cursorrules` | `.cursor/rules/*.mdc` YAML frontmatter |
| `copilot` | `.github/copilot-instructions.md` OR `.github/instructions/*.instructions.md` OR `.vscode/prompts/*.prompt.md` | `.instructions.md` → subagent, `.prompt.md` → skill |
| `opencode` | `opencode.json` OR `opencode.jsonc` | `subagents[]` JSON array |
| `windsurf` | `.windsurf/rules/*.md` OR `.windsurfrc` | `.windsurf/rules/*.md` |

---

## 6. Merge Strategy

```typescript
function mergeResults(results: Partial<ParserResult>[]): ParserResult {
    const nodeIds = new Set<string>();
    const nodes: HarnessNode[] = [];
    const edges: HarnessEdge[] = [];
    const milestones: Milestone[] = [];

    for (const r of results) {
        for (const n of r.graph?.nodes ?? []) {
            if (!nodeIds.has(n.id)) { nodeIds.add(n.id); nodes.push(n); }
        }
        edges.push(...(r.graph?.edges ?? []));
        milestones.push(...(r.milestones ?? []));
    }
    return { graph: { nodes, edges }, milestones };
}
```

Deduplication by `id` ensures that if both Harness and Claude Code define the same subagent
(e.g. `.agents/subagents/implementer/SUBAGENT.md` and `.claude/agents/implementer.md`), only
the Harness SDD version is kept (first-wins, since Harness is first in the registry).

---

## 7. Framework Badge Component

A small readonly `<div>` injected into the existing dashboard toolbar row, between
"Suggestions ✓" and "Add Entity". It receives a `frameworks: string[]` prop from `index.tsx`.
Rendered as pill-shaped labels: `· Harness · Claude Code ·`.

No new VS Code API needed — the badge is populated from `ParserResult.detectedFrameworks: string[]`
(new field added to `ParserResult`).

---

## 8. File Watcher Extension

The existing `vscode.workspace.createFileSystemWatcher` in `extension.ts` currently watches:
`**/.agents/**`, `**/agentic.json`.

It will be extended by collecting watch globs from all registered adapters:

```typescript
interface IAgentAdapter {
    watchGlobs(): string[]; // new method
}
```

`activate()` unions all globs and creates a single watcher with a `RelativePattern` array.

---

## 9. Empty State

A new `EmptyState` React component rendered in `index.tsx` when `data.graph.nodes.length === 0`.
Shows a list of supported frameworks with their required file. Uses existing CSS variables.
No new dependencies.

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| TOML parsing for Gemini commands | Medium | Use `@ltd/j-toml` (already available) or a minimal hand-rolled parser; TOML structure is simple (flat key-value) |
| YAML frontmatter parsing for `.mdc` / `.instructions.md` | Low | `gray-matter` already imported |
| Multi-framework node ID collision | Medium | Prefix non-Harness node IDs with adapter id: `claude-code::implementer` |
| Large workspaces with many rule files | Low | Each `parse()` is I/O-bound; registry is awaited sequentially to avoid file descriptor spikes |
| `.windsurfrc` is undocumented format | High | Implement WindsurfAdapter as a best-effort; mark nodes with `_discovery: "windsurf-heuristic"` |
