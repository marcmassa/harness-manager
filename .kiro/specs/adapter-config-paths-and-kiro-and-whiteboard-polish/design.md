# Design — Configurable adapter paths + Kiro adapter + whiteboard UX polish

> Technical decisions to implement feature FEAT-023. Three
> parts that share the spec and the commit but have
> largely independent code paths. The architectural
> contribution is Part A (the `ConfigurationRegistry`
> pattern), Parts B and C are its immediate payoffs.

## Summary

**Part A** (R1–R8) introduces a `ConfigurationRegistry` that
lets users override any adapter's detection path via VS
Code settings. The registry is the lasting contribution —
it is the **infrastructure for adapter extensibility** and
will be reused by every future adapter (not just Kiro).
The design follows the existing project's pattern of
declarative configuration (the `bootstrap.sh` CLI adapter
system already uses a JSON manifest, this is the
extension-side equivalent for runtime settings).

**Part B** (R9–R15) is the Kiro adapter itself. It is the
**first concrete consumer** of the registry: the user can
configure `harness-dashboard.adapters.kiro.path` to
override the default `.kiro/`. The Kiro adapter itself
follows the existing `IAgentAdapter` contract and is
implemented as a copy-paste-modify of the
`ClaudeCodeAdapter` (the closest sibling: Kiro is also a
single-file-per-agent Markdown system).

**Part C** (R16–R22) polishes the whiteboard UX. Two
long-standing gaps are closed: (1) **node overlap** — dagre
auto-layout can produce identical `(x, y)` for two nodes,
and the current code does not detect or fix this; (2)
**animation quality** — node transitions are either
instant or a single CSS dash, and the `fitView` camera
movement snaps instead of easing. The polish is
CSS-based (no new dependencies).

The three parts share the same `feature_list.json` entry
(FEAT-023) but produce largely independent code paths.
The **no-overlap** requirement (R16) is the hard one — it
introduces a deterministic offset algorithm and a new
`ParserError` emission.

## Affected Files (in all three branches)

| File | Action | Reason |
|---|---|---|
| `src/adapters/ConfigurationRegistry.ts` | **create** | The new registry (R1, R3, R4, R6) |
| `src/adapters/IAgentAdapter.ts` | modified | Add `isPathConfigurable(): boolean` (R4) |
| `src/adapters/index.ts` | modified | Register `ConfigurationRegistry` alongside the adapters (Part A) |
| `src/adapters/ClaudeCodeAdapter.ts` | modified | Set `isPathConfigurable() === true`, read setting in `detect/parse/watchGlobs` (Part A) |
| `src/adapters/CursorAdapter.ts` | modified | Same as Claude (Part A) |
| `src/adapters/GeminiCliAdapter.ts` | modified | Same (Part A) |
| `src/adapters/CopilotAdapter.ts` | modified | Same (Part A) |
| `src/adapters/WindsurfAdapter.ts` | modified | Same (Part A) |
| `src/adapters/HarnessSddAdapter.ts` | **unchanged** (per R5 — canonical, not configurable) |
| `src/adapters/KiroAdapter.ts` | **create** | The Kiro adapter (R9–R14) |
| `src/frameworks.ts` | modified | Add `kiro: 'Kiro'` (R14) |
| `src/adapters/adapterRegistry.test.ts` | modified | Add Kiro tests + ConfigurationRegistry tests (R8, R15) |
| `src/test/fixtures/kiro-minimal/.kiro/agents/demo-agent.md` | **create** | Kiro fixture (R15) |
| `src/test/fixtures/kiro-minimal/.kiro/skills/demo-skill/SKILL.md` | **create** | Kiro skill fixture (R15) |
| `src/test/fixtures/kiro-minimal/.kiro/.custom-path-test-config.md` | **create** | Marker for the custom-path test (R15) |
| `src/parserLogic.ts` | modified | Add `detectAndFixOverlaps()` (R17, R18) |
| `src/parserLogic.test.ts` | modified | Add 3 overlap tests (R22) |
| `src/webview/WhiteboardCanvas.tsx` | modified | `fitView` duration/ease (R20), call `detectAndFixOverlaps` after layout (R18) |
| `src/webview/components/CustomNode.tsx` | modified | Add CSS transitions for appear/disappear (R19) |
| Edge styles (likely `src/webview/index.tsx`) | modified | Add `transition` properties to edge classes (R21) |
| `package.json` | modified | Add `contributes.configuration.properties` block (R2, R7) |
| `README.md` | modified | Add Kiro to the "Supported project structures" table; add a new "Configuration" section documenting the registry (R14, R7) |
| `docs/configuration.md` | **create** | Long-form docs of the registry: which adapters are configurable, how to override, edge cases, examples (R1, R7) |
| `progress/impl_<feature>.md` | create | Implementation report (R↔T↔test) |
| `progress/progress.md` | modified | Append summary |
| `progress/current.md` | reset to template form |
| `feature_list.json` | modified | Add FEAT-023 entry (done) |

**Not** modified: any file under `src/adapters/{HarnessSdd}Adapter.ts`
(R5 / scope discipline — Harness SDD is canonical). The CI
workflow (unchanged). The 6 existing adapter unit tests in
`adapterRegistry.test.ts` should not be modified (only
**appended** to).

## Part A: ConfigurationRegistry design (R1–R8)

### Architecture: where the registry lives

The `ConfigurationRegistry` is a **small, single-file
singleton** at `src/adapters/ConfigurationRegistry.ts`.
It is registered in `src/adapters/index.ts` alongside the
adapters (so its lifecycle is the same as theirs: created
on extension activation, disposed on deactivation).

```
┌────────────────────────────────────────────┐
│         Extension activation              │
│              (src/extension.ts)            │
└──────────────┬─────────────────────────────┘
               │ creates
               ▼
┌────────────────────────────────────────────┐
│   ConfigurationRegistry (singleton)        │
│   src/adapters/ConfigurationRegistry.ts    │
│                                            │
│   - getPathFor(adapterId): string          │
│   - isValidPath(path): boolean             │
│   - isPathConfigurable(adapterId): boolean │
└──────────────┬─────────────────────────────┘
               │ queried by
               ▼
┌────────────────────────────────────────────┐
│   Each adapter (when isPathConfigurable)    │
│   - ClaudeCodeAdapter                     │
│   - CursorAdapter                          │
│   - GeminiCliAdapter                       │
│   - CopilotAdapter                         │
│   - WindsurfAdapter                        │
│   - KiroAdapter (new in Part B)            │
└────────────────────────────────────────────┘
```

The registry is **lazy**: it reads the VS Code setting on
the first call and caches the value. If the user changes
the setting at runtime, VS Code fires a
`onDidChangeConfiguration` event, which the registry
listens to and updates its cache. So a runtime setting
change is reflected on the next parse (no restart needed).

### Registry API

```typescript
// src/adapters/ConfigurationRegistry.ts
import * as vscode from 'vscode';

const DEFAULT_PATHS: Record<string, string> = {
    'claude-code': '.claude',
    'cursor':      '.cursor',
    'gemini-cli':  '.gemini',
    'copilot':     '.github',
    'windsurf':    '.windsurf',
    'kiro':        '.kiro',
    // harness-sdd intentionally absent: not configurable per R5.
};

const FALLBACK = ''; // sentinel: use the framework's own default

export class ConfigurationRegistry {
    private _cache = new Map<string, string>();
    private _disposable: vscode.Disposable | undefined;

    public constructor() {
        // Listen to setting changes at runtime; refresh the cache.
        this._disposable = vscode.workspace.onDidChangeConfiguration(
            (e) => {
                if (e.affectsConfiguration('harness-dashboard.adapters')) {
                    this._cache.clear();
                }
            }
        );
    }

    public dispose(): void {
        this._disposable?.dispose();
    }

    public isPathConfigurable(adapterId: string): boolean {
        return adapterId in DEFAULT_PATHS;
    }

    /**
     * Return the configured detection path for an adapter,
     * falling back to the framework's default if the user has
     * not configured it or if the configured value is empty.
     */
    public getPathFor(adapterId: string): string {
        if (this._cache.has(adapterId)) {
            return this._cache.get(adapterId)!;
        }
        const configured = vscode.workspace
            .getConfiguration('harness-dashboard')
            .get<string>(`adapters.${adapterId}.path`, FALLBACK)
            .trim();
        const value = configured === '' || configured === FALLBACK
            ? DEFAULT_PATHS[adapterId] ?? FALLBACK
            : configured;
        this._cache.set(adapterId, value);
        return value;
    }

    /**
     * Return true iff the path exists on disk and is a directory.
     * Used by adapters' detect() to gracefully skip a
     * misconfigured path (R6).
     */
    public async isValidPath(uri: vscode.Uri, path: string): Promise<boolean> {
        if (path === '') return false;
        const target = vscode.Uri.joinPath(uri, path);
        try {
            const stat = await vscode.workspace.fs.stat(target);
            return stat.type === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }
}
```

### IAgentAdapter interface change

```typescript
// src/adapters/IAgentAdapter.ts (extended, not breaking)
export interface IAgentAdapter {
    id(): string;
    label(): string;
    detect(root: vscode.Uri): Promise<boolean>;
    parse(root: vscode.Uri): Promise<Partial<ParserResult>>;
    watchGlobs(): string[];

    /**
     * Returns true if the user can override this adapter's
     * detection path via `harness-dashboard.adapters.<id>.path`.
     * Adapters that opt in MUST use ConfigurationRegistry.getPathFor(id())
     * instead of hardcoded path strings in their detect/parse/watchGlobs.
     */
    isPathConfigurable(): boolean;
}
```

### Adapter modification pattern (applied to ClaudeCode, Cursor, etc.)

```typescript
// src/adapters/ClaudeCodeAdapter.ts (modified, pattern)
export class ClaudeCodeAdapter implements IAgentAdapter {
    private static readonly DEFAULT_PATH = '.claude';
    private static readonly CONFIG_KEY = 'claude-code';

    public isPathConfigurable(): boolean { return true; }

    public async detect(root: vscode.Uri): Promise<boolean> {
        const path = ConfigurationRegistry.getInstance()
            .getPathFor(ClaudeCodeAdapter.CONFIG_KEY);
        if (await fileExists(root, 'CLAUDE.md')) return true;
        const agentFiles = await findFiles(root, `${path}/agents/**/*.md`);
        return agentFiles.length > 0;
    }

    public watchGlobs(): string[] {
        const path = ConfigurationRegistry.getInstance()
            .getPathFor(ClaudeCodeAdapter.CONFIG_KEY);
        return ['CLAUDE.md', `${path}/agents/**/*.md`];
    }
    // parse() uses path/agents/**/*.md similarly
}
```

The `ConfigurationRegistry.getInstance()` is a process-wide
singleton (created in `index.ts` at extension activation).
The first call constructs it, subsequent calls return the
same instance. This is a deliberate design choice over
constructor-injection because VS Code extensions have a
tree of ad-hoc initializers and a singleton avoids
"who constructs the registry" plumbing.

### package.json `contributes.configuration` block

```json
{
  "contributes": {
    "configuration": {
      "title": "Harness Dashboard",
      "properties": {
        "harness-dashboard.adapters.claude-code.path": {
          "type": "string",
          "default": ".claude",
          "description": "Path to the Claude Code agent configuration directory (relative to workspace root)."
        },
        "harness-dashboard.adapters.cursor.path": {
          "type": "string",
          "default": ".cursor",
          "description": "Path to the Cursor agent configuration directory (relative to workspace root)."
        },
        "harness-dashboard.adapters.gemini-cli.path": {
          "type": "string",
          "default": ".gemini",
          "description": "Path to the Gemini CLI agent configuration directory (relative to workspace root)."
        },
        "harness-dashboard.adapters.copilot.path": {
          "type": "string",
          "default": ".github",
          "description": "Path to the GitHub Copilot instructions directory (relative to workspace root)."
        },
        "harness-dashboard.adapters.windsurf.path": {
          "type": "string",
          "default": ".windsurf",
          "description": "Path to the Windsurf rules directory (relative to workspace root)."
        },
        "harness-dashboard.adapters.kiro.path": {
          "type": "string",
          "default": ".kiro",
          "description": "Path to the Kiro agent configuration directory (relative to workspace root)."
        }
      }
    }
  }
}
```

VS Code's settings UI auto-completes based on these
declarations, so the user can type
`Harness-Dashboard: Adapters › Kiro: Path` in the settings
search and edit it. No additional UX work needed.

## Part B: Kiro adapter design (R9–R15)

The Kiro adapter follows the same pattern as Part A's
adapters. It opts in to `isPathConfigurable() === true` and
reads the path via the registry. The actual `parse()` body
is copy-paste-modify from `ClaudeCodeAdapter.ts` (both are
single-file-per-agent Markdown systems). The only
Kiro-specific bits are the glob patterns and the "Skills"
section keyword (Kiro uses a slightly different convention
than Harness SDD — details in the impl).

The Kiro fixture workspace at
`src/test/fixtures/kiro-minimal/.kiro/` includes a special
marker file `.custom-path-test-config.md` that is detected
**only** when the path is configured to a non-default value
(per the R15 custom-path test). This is the canonical
pattern for "this fixture has multiple modes depending on
config" and avoids creating 2 separate fixture workspaces.

## Part C: Whiteboard UX polish design (R16–R22)

### C.1 No-overlap guarantee (R16, R17, R18, R22)

**The problem** is in `src/webview/layoutUtils.ts` and
`src/webview/nodePositionUtils.ts`. The dagre auto-layout
produces positions for each node independently; two
similar-width nodes can end up at the exact same `(x, y)`.
The manual-position merge in `nodePositionUtils.ts` then
applies overrides on top, but if two manual positions are
the same (e.g., a user accidentally set them both to the
center), the merge produces overlapping nodes.

**The fix** is a new `detectAndFixOverlaps()` function in
`src/parserLogic.ts` (so it runs at parse time, not at
runtime layout time). The function:

1. Computes a `Map<positionKey, nodeId[]>` where
   `positionKey = `${Math.round(x / 4)}:${Math.round(y / 4)}``
   (4-px bins).
2. For each bucket with `> 1` entries, emits a `ParserError`
   with the colliding IDs and the position.
3. For each colliding node (except the first), applies an
   offset: `(x + N × 8, y + N × 8)` where N is the
   collision index (1, 2, 3, ...). The first colliding node
   stays put.
4. Returns the de-overlapped positions back to the caller,
   which passes them to dagre or to the manual-position
   merge as if they were the original layout.

The 4-px tolerance and 8-px offset stride are constants at
the top of the function, easy to tune:

```typescript
const OVERLAP_TOLERANCE_PX = 4;
const OVERLAP_OFFSET_STRIDE_PX = 8;
const MAX_ITERATIONS = 5; // safety bound for iterative offset
```

**Where it runs**: in `parserLogic.ts`, after
`enrichWithIdoneity()` and before
`reconcileSkillDiscovery()`. The OutputChannel
(`Harness Dashboard`) shows the warning to the user.

### C.2 Animations (R19, R20, R21)

All animation polish is **CSS-only**, no new dependencies.
The CSS lives in:
- `src/webview/components/CustomNode.tsx` (inline `style`
  block + a new `nodeAppear` keyframe for R19)
- The edge CSS file (R21) — likely in
  `src/webview/index.tsx`'s `<style>` block
- `src/webview/WhiteboardCanvas.tsx` (R20 — `fitView`
  options)

**R19 (node appear/disappear)** uses React Flow's lifecycle
hooks: when a node ID enters the `nodes` state, the
`CustomNode` mounts with an `opacity: 0` initial style, then
a CSS class triggers the `nodeAppear` keyframe:

```css
@keyframes nodeAppear {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
}
.node-enter {
    animation: nodeAppear 200ms ease-out forwards;
}
```

Disappear is the reverse, triggered by React Flow's
`onNodesDelete` callback setting a per-node `is-exiting`
class for the last 200 ms before unmounting. The
implementation is **not** a custom `requestAnimationFrame`
loop (which has caused past flakiness — see FEAT-022's T12
limitation).

**R20 (fitView easing)** is a one-line change:

```typescript
fitView({ padding: 0.2, duration: 400, ease: 'ease-in-out' });
```

(React Flow's `fitView` accepts a `duration` and an `ease`
string.)

**R21 (edge style transitions)** adds `transition:
stroke 150ms ease, stroke-width 150ms ease, opacity
150ms ease, stroke-dasharray 150ms ease;` to the base
edge class. When React Flow re-renders the edge with new
`style` props (e.g., from `manages` to `uses`), the browser
animates the change. No JavaScript work needed.

All three animation polish features include
`@media (prefers-reduced-motion: reduce) { ... }` blocks
that disable the animation. This is standard CSS hygiene
(per WCAG 2.1) and applies unconditionally.

### Discarded alternative (for R1)

**Allow `path` overrides via `package.json#contributes.configuration`
ONLY** (no runtime VS Code settings UI).

Discarded because:
1. `package.json` is fixed at extension install time; the
   user would have to edit and reinstall to change paths.
2. VS Code settings are the canonical extension user
   surface for runtime configurability (per VS Code
   extension guidelines).
3. The implementation cost is the same either way
   (single `contributes.configuration` block).

### Discarded alternative (for R5)

**Make ALL 8 adapters configurable, including Harness SDD.**

Discarded because:
1. Harness SDD's `.agents/agentic.json` is the **canonical
   entry point** of the framework itself. Changing the path
   would break the framework's own tooling (e.g., a Kiro
   plugin that reads `.agents/agentic.json` would fail if
   the path is configured to a non-standard location).
2. The other 6 frameworks (Claude, Cursor, etc.) are more
   forgiving about path conventions (their CLI tools accept
   `--config-dir` flags that the project already knows about).
3. If a future maintainer wants to make Harness SDD
   configurable, the R1 + R4 infrastructure makes that a
   one-line change (`isPathConfigurable() === true` + add
   to `DEFAULT_PATHS`). No need to speculatively enable
   it now.

### Discarded alternative (for R16)

**Detect-and-fix overlap at runtime (in the webview
layout code), not at parse time.**

Discarded because:
1. Runtime detection means the user sees overlapping nodes
   briefly before they snap apart — bad UX.
2. Runtime fixes happen on every re-layout (e.g., on a
   node move), which means a potential flash of
   "overlapping then correct" on every drag.
3. Parse-time is once per parse, which is the natural
   cadence for layout correctness.

### Discarded alternative (for R20)

**Use a third-party animation library** (e.g., Framer
Motion, React Spring, GSAP).

Discarded because:
1. All three libraries add 30–80 KB to the webview bundle
   (the entire extension is 261 KB, so +30 KB is a 10%
   size increase for animations on a non-animation-critical
   surface).
2. The whiteboard is not a high-frequency animation
   surface — `fitView` happens once per refresh, node
   appear/disappear happens once per parse. The 400 ms
   CSS transition is plenty.
3. CSS `transition` and `@keyframes` are sufficient and
   have zero bundle cost.

## Algorithm / Flow

### Part A flow (ConfigurationRegistry activation)

```
1. Extension activation creates ConfigurationRegistry singleton
2. Registry constructor registers onDidChangeConfiguration listener
3. Each adapter's first call to getPathFor(id) reads the setting
   and caches the value
4. Runtime setting change → onDidChangeConfiguration fires
   → cache cleared → next getPathFor(id) reads the new value
5. Adapter's detect() reads registry.getPathFor(id) instead of
   the hardcoded default → no further changes needed in detect()
```

### Part B flow (Kiro detection with custom path)

```
1. AdapterRegistry.runAll() iterates 8 adapters
2. KiroAdapter.isPathConfigurable() === true
3. KiroAdapter.detect():
   a. path = ConfigurationRegistry.getPathFor('kiro')
      → returns '.kiro' by default, or the user-configured value
   b. fileExists(root, path) → true if directory exists
   c. findFiles(root, `${path}/agents/**/*.md`) → subagent files
4. KiroAdapter.parse():
   a. discover agents + skills under the configured path
   b. infer uses edges
5. Return ParserResult with framework='kiro' on all nodes
```

### Part C flow (overlap + animations)

```
1. parserLogic.parse() runs all adapters
2. enrichWithIdoneity() runs the TF-IDF idoneity matrix
3. detectAndFixOverlaps() (NEW):
   a. Build a Map<positionKey, nodeId[]> with 4-px bins
   b. For each bucket with > 1 entries, emit ParserError
      and apply (x + N*8, y + N*8) offset
   c. Iterate up to MAX_ITERATIONS to resolve cascading overlaps
4. reconcileSkillDiscovery() marks orphan skills
5. UI layer:
   a. When nodes state changes, React Flow's
      applyNodeChanges applies the changes; the
      CustomNode component mounts with the node-enter
      class, triggering the 200 ms animation
   b. When user calls fitView (initial mount, Cmd+0,
      graph refresh), the 400 ms ease-in-out transition
      is used
   c. When an edge style changes, the CSS transition
      animates the visual change
   d. When prefers-reduced-motion: reduce is set, all
      animations are disabled via @media blocks
```

## Error Handling

| Condition | Response |
|---|---|
| User sets path to empty string or whitespace | Registry returns the framework default (R3) |
| User sets path to a non-existent directory | Adapter's detect() returns false; OutputChannel warning emitted (R6) |
| User sets path to a file (not a directory) | Same as above (R6 — `isValidPath` checks `FileType.Directory`) |
| User sets path to a value that the adapter cannot parse | Adapter returns empty ParserResult (no error) — the user can fix the path or wait for the adapter to be updated |
| User sets 2 adapters' paths to the same value | Both adapters detect independently — no conflict. The OutputChannel will report the same path twice in the watchGlobs (cosmetic, not a bug) |
| `.kiro/agents/x.md` is malformed (no H1) | Adapter skips the file, logs warning, no error |
| Node overlap detected at parse time | ParserError emitted to OutputChannel, deterministic offset applied, parse continues |
| 2 nodes claim the same `(x, y)` after the offset | Second-offset iteration runs (N×8, then 2N×8) until all overlap is resolved. Bounded by MAX_ITERATIONS = 5 |
| `fitView` called on a 0-node graph | No-op (React Flow handles this natively) |
| Edge transition with no CSS support (very old browsers) | Falls back to instant change (graceful degradation) |
| `prefers-reduced-motion: reduce` is set | All animations disabled via @media blocks (R19, R20, R21) |

## Risks and Edge Cases

- **ConfigurationRegistry as a singleton** — creates a
  single shared instance across the extension. If a
  future feature wants multiple registries (e.g., for
  testing), the constructor must be made injectable. The
  current design is the simplest possible; the cost of
  refactoring later is low (1 file, ~50 lines).
- **Setting conflicts with future framework conventions** —
  if a framework publishes a new convention (e.g., Claude
  Code v3 moves agents to `.claude/agents-v2/`), the user
  can migrate without waiting for an extension update.
  This is the **primary value proposition** of the
  registry.
- **Parse-time overlap detection on large graphs** — the
  `Map<positionKey, nodeId[]>` is O(N) and the
  collision resolution is O(N) for the first pass, O(N)
  in the worst case for the iterative pass (max 5
  iterations by default). A 100-node graph completes
  in < 1 ms; a 1000-node graph in < 50 ms. Well within
  the 100 ms parse budget.
- **Reduced-motion user preference** —
  `prefers-reduced-motion: reduce` is respected via
  `@media` blocks. Standard CSS hygiene.
- **The 4-px tolerance** is a magic number. The
  CustomNode's visual half-width is ~80 px (skill
  nodes are the smallest at 160×40 px). The 4-px
  tolerance is intentionally tight — it catches true
  collisions without false-positives on
  sub-pixel-rounding-different positions.
- **Edge animations on 50+ edges** — the CSS transition
  is hardware-accelerated (no JS), so 50 simultaneous
  edge style changes are not a perf concern. The
  `requestAnimationFrame` removal avoids the past
  flakiness (per FEAT-022's T12 limitation note).
- **The Kiro fixture's `.custom-path-test-config.md`
  marker file** is a slight smell (a fixture file
  conditioned on test logic). It is preferable to 2
  separate fixture workspaces because it halves the
  fixture maintenance surface. The marker file is
  named to make its purpose clear.

## Test Plan

| Req | How verified |
|---|---|
| R1 | Unit: `ConfigurationRegistry.getPathFor('kiro')` returns '.kiro' by default |
| R2 | Static: `package.json#contributes.configuration.properties` has the 6 settings (one per configurable adapter) |
| R3 | Unit: with VS Code setting `adapters.kiro.path = '.custom-kiro'`, `getPathFor('kiro')` returns '.custom-kiro' |
| R4 | Unit: ClaudeCodeAdapter.isPathConfigurable() === true; HarnessSddAdapter.isPathConfigurable() === false |
| R5 | Unit: 6 adapters return true, 1 returns false |
| R6 | Unit: setting path to non-existent directory → detect() returns false, OutputChannel warns |
| R7 | Static: `package.json#contributes.configuration.properties` has the correct `type`, `default`, `description` for each |
| R8 | The 5 ConfigurationRegistry unit tests pass on a clean main |
| R9 | Unit: KiroAdapter.detect() returns true with default path; returns true with custom path; returns false with no path |
| R10 | Unit: KiroAdapter.parse() creates N subagent nodes for N `.kiro/agents/*.md` files; each node has H1 as label |
| R11 | Unit: KiroAdapter.parse() creates N skill nodes for N `.kiro/skills/*/SKILL.md` files; frontmatter parsed correctly |
| R12 | Unit: a subagent with body containing `Skills: my-skill` creates a `uses` edge to `my-skill` |
| R13 | Unit: KiroAdapter is in `AdapterRegistry.runAll()` result list when `.kiro/` exists; isPathConfigurable() === true |
| R14 | Unit: frameworkLabel('kiro') returns 'Kiro'; static check on README.md for the row |
| R15 | The 6 Kiro unit tests above all pass on a clean main |
| R16 | Static: `detectAndFixOverlaps()` post-condition — no two adjacent nodes share a position; the 3 unit tests in R22 cover this |
| R17 | Unit: a deliberately-constructed ParserResult with 2 overlapping nodes emits exactly 1 ParserError |
| R18 | Unit: after `detectAndFixOverlaps()`, the 2 overlapping nodes are at different positions |
| R19 | Static: `CustomNode.tsx` has the `node-enter` class with the `nodeAppear` keyframe; visual integration test asserts the animation runs |
| R20 | Static: `WhiteboardCanvas.tsx` calls `fitView({ padding: 0.2, duration: 400, ease: 'ease-in-out' })` |
| R21 | Static: edge CSS has the `transition: stroke 150ms ease, ...` declaration |
| R22 | The 3 overlap tests in `parserLogic.test.ts` all pass on a clean main |
