# Design — Steering & Hooks Observability

> Feature FEAT-024. Adds `steering` and `hook` node types to the whiteboard, parsing their definitions from `.agents/agentic.json` and their file content from `.agents/steering/` and `.agents/hooks/`.

## 1. New Types

### 1.1 NodeType extension

Add two new values to the existing `NodeType` union in `src/types.ts`:

```typescript
export type NodeType = 'agent' | 'subagent' | 'skill' | 'feature' | 'steering' | 'hook';
```

### 1.2 EdgeLabel extension

Add two new edge labels for the new relationship types:

```typescript
export type EdgeLabel = 'manages' | 'uses' | 'executing' | 'discovered' | 'suggested' | 'governs' | 'triggers';
```

### 1.3 Visual mapping

| Node type | Shape | Border colour | Icon | Background |
|-----------|-------|---------------|------|------------|
| `steering` | Square with slight right skew | `#d4a84a` (amber) | `⚙️` (gear) | `linear-gradient(135deg, #d4a84a22, #d4a84a08)` |
| `hook` | Rounded rectangle with dashed border | `#6c6c8a` (muted purple) | `🔌` (plug/trigger) | `linear-gradient(135deg, #6c6c8a22, #6c6c8a08)` |

The existing `NODE_STYLES` in `src/webview/styles.ts` will gain two new entries:
- `NODE_STYLES['steering']`
- `NODE_STYLES['hook']`

The `HANDLE_ACCENT` mapping will also gain entries (both muted, since steering/hook are infrastructure, not actors):
- `steering: '#d4a84a'`
- `hook: '#6c6c8a'`

### 1.4 Edge glow colours

New entries in `EDGE_GLOW_RGB`:
- `governs: '212, 168, 74'` (amber, same as steering accent)
- `triggers: '108, 108, 138'` (muted purple, same as hook accent)

## 2. Parser changes

### 2.1 `parseAgenticJson` extension

The existing `parseAgenticJson()` function in `src/parserLogic.ts` already reads `data.subagents` and creates nodes + edges. This function will be extended to also read:

```typescript
if (data.steering) {
    for (const entry of data.steering) {
        // Create steering node
        // Create 'governs' edges to matching subagents
        // Queue file reading via adapter
    }
}

if (data.hooks) {
    for (const entry of data.hooks) {
        // Create hook node
        // Create 'triggers' edge to primary agent
        // Queue file reading via adapter
    }
}
```

### 2.2 New function: `parseSteeringContent()`

Reads the steering Markdown file and enriches the steering node's metadata with:
- `_body`: full file content
- `_fileMissing`: boolean if file doesn't exist
- `_filePath`: relative path for the "Open in editor" action

### 2.3 New function: `parseHookContent()`

Reads the hook shell script and enriches the hook node's metadata with:
- `_preview`: first 500 chars
- `_filePath`: relative path for "Open in editor"

### 2.4 Adapter changes (`HarnessSddAdapter.ts`)

1. After calling `logic.parseAgenticJson()`, iterate over the created steering and hook nodes
2. For each steering node, call `parseSteeringContent()` passing the root URI and the file path from metadata
3. For each hook node, call `parseHookContent()` similarly
4. Update `watchGlobs()` to include all steering and hook file paths

## 3. Whiteboard view changes

### 3.1 Node rendering

The `CustomNode.tsx` component already handles multiple node types via `NODE_STYLES[type]`. The new types will be handled automatically once `NODE_STYLES` is extended. Additionally:

- Steering nodes display the `⚙️` icon in the header area
- Hook nodes display the `🔌` icon in the header area
- Both show their `description` from metadata in the node body

### 3.2 Detail panel

The existing detail panel in `index.tsx` shows `description` and `Markdown File` tabs. For steering and hook nodes:

- The `description` tab shows the `description` metadata plus `applies_to` (steering) or `event`/`on_failure` (hook)
- The `Markdown File` tab shows the file content preview for steering, or the script preview for hook

Both get the "✏ Edit File" button as per FEAT-009.

### 3.3 Edge style

- `governs` edges: amber, solid line, smoothstep routing
- `triggers` edges: muted purple, dashed line, smoothstep routing

## 4. Testing strategy

| Area | Approach |
|------|----------|
| Unit: parser | Test `parseAgenticJson` with a fixture that includes `steering[]` and `hooks[]` |
| Unit: helper | Test `parseSteeringContent` and `parseHookContent` with real markdown and shell files |
| Unit: adapter | Test `HarnessSddAdapter.parse()` on a fixture that has steering/hooks in agentic.json |
| Unit: visual | Test `NODE_STYLES` and `HANDLE_ACCENT` have the new entries |
| Integration | Open the whiteboard on a workspace with steering/hooks and verify nodes appear |

## 5. Discarded alternatives

### 5.1 Embed steering/hooks in existing node types

Discarded because steering files and hook scripts are conceptually distinct:
- Steering files **govern** subagents (they constrain behavior), they are not subagents themselves
- Hook scripts **trigger** on events, they are not skills or features
Giving them distinct visual types makes the graph more informative

### 5.2 Parse steering from a separate file (not agentic.json)

Discarded because `agentic.json` is already the canonical manifest. The Harness SDD framework declares steering and hooks in the same manifest; using a separate file would be redundant.

### 5.3 Show hook → steering edges

Discarded because hooks are triggered by framework events (spec_created, feature_done, check_pass), not by steering files. The relationship is hook → framework lifecycle, not hook → steering.
