# Design — Skill Toggle & Suggestion Visibility Control

> Feature FEAT-013. Technical design for persistent suggestion dismissal, skill connection toggle, and six bug fixes identified by static analysis.

---

## 1. Architecture Overview

```
Extension Host (extension.ts)
│
├── HarnessDashboardProvider
│   ├── workspaceState.get('harness-manager.dismissedSuggestions') → Set<string>
│   ├── workspaceState.get('harness-manager.disabledConnections')  → Set<string>
│   │
│   └── _sendData()
│       └── HarnessParser.parse({ dismissedSuggestions, disabledConnections })
│           ├── addSemanticSuggestions()  — skips dismissed pairs
│           ├── addCrossRefEdges()        — skips dismissed pairs
│           └── marks uses edges as metadata.disabled = true if in disabledConnections
│
├── Message handlers (new)
│   ├── 'dismissSuggestion' { subagentId, skillId }
│   │   → persist to workspaceState, _sendData()
│   └── 'toggleSkillConnection' { source, target, disabled }
│       → persist to workspaceState, _sendData()
│
Webview (React)
│
├── index.tsx
│   ├── showSuggestions: boolean (useState, default true)  ← R3
│   └── filteredGraph = useMemo → filters suggested edges when showSuggestions=false
│
├── WhiteboardCanvas.tsx
│   ├── handleDismissSuggestion  — uses originalLabel (R8), posts 'dismissSuggestion'  (R1)
│   ├── handleAcceptSuggestion   — uses originalLabel (R9)
│   ├── handleToggleConnection   — posts 'toggleSkillConnection' (R4, R6)
│   └── nodeContextMenu          — adds click-outside handler (R12)
│
└── EdgeContextMenu.tsx
    └── isSuggested from originalLabel (R7), shows Disable/Enable option (R4, R6)
```

---

## 2. State Persistence Strategy

### Choice: `vscode.ExtensionContext.workspaceState`
**Rationale:** Workspace state is the idiomatic VS Code mechanism for per-workspace persistent UI state. It avoids polluting `.agents/` or `agentic.json` with UI concerns, requires zero file I/O, and survives VS Code restarts.

**Discarded alternatives:**
- `.agents/harness-manager.state.json` — pollutes the agents directory with UI state, triggers the file watcher and causes an extra `_sendData()` loop.
- `vscode.globalState` — global scope is wrong; dismissed suggestions are per-workspace.
- Storing in `agentic.json` — mixes structural data with ephemeral UI state.

### Data Shapes

```ts
// Key: 'harness-manager.dismissedSuggestions'
// Value: string[]  (serialized as JSON array by VS Code workspaceState)
// Each entry: "subagentId::skillId"
type DismissedSuggestions = string[];

// Key: 'harness-manager.disabledConnections'
// Value: string[]
// Each entry: "source::target"
type DisabledConnections = string[];
```

---

## 3. Parser Changes (`harnessParser.ts` + `parserLogic.ts`)

### 3.1 Parse Options Interface

Add to `harnessParser.ts`:
```ts
interface ParseOptions {
    dismissedSuggestions?: Set<string>;   // "subagentId::skillId"
    disabledConnections?: Set<string>;    // "source::target"
}
```

`HarnessParser.parse(options?: ParseOptions)` passes these sets down to:
- `addSemanticSuggestions(result, semanticOpts, dismissedSuggestions)` — skips pairs in the set
- `addCrossRefEdges(result, dismissedSuggestions)` — same
- A new inline pass at the end: for each `uses` edge whose `"source::target"` key is in `disabledConnections`, set `edge.metadata.disabled = true`

### 3.2 Fix Double Idoneity Computation (R10)

`enrichWithIdoneity(result)` returns the computed `IdoneityMatrix` (currently `void`).
`enrichSuggestedEdgesWithIdoneity(result, matrix: IdoneityMatrix)` accepts the pre-computed matrix.

Changes:
- `enrichWithIdoneity` signature: `export function enrichWithIdoneity(result: ParserResult): IdoneityMatrix`
- `enrichSuggestedEdgesWithIdoneity` signature: `export function enrichSuggestedEdgesWithIdoneity(result: ParserResult, matrix: IdoneityMatrix): void`
- In `harnessParser.ts`, thread the matrix through:
  ```ts
  const matrix = enrichWithIdoneity(result);
  addCrossRefEdges(result, dismissedSuggestions);
  await addSemanticSuggestions(result, { ... }, dismissedSuggestions);
  enrichSuggestedEdgesWithIdoneity(result, matrix);
  ```

---

## 4. Extension Message Protocol Changes (`extension.ts`)

### New message handlers

```ts
case 'dismissSuggestion': {
    const key = `${data.subagentId}::${data.skillId}`;
    const current = this._workspaceState.get<string[]>('harness-manager.dismissedSuggestions', []);
    if (!current.includes(key)) {
        await this._workspaceState.update('harness-manager.dismissedSuggestions', [...current, key]);
    }
    this._sendData();
    break;
}
case 'toggleSkillConnection': {
    const key = `${data.source}::${data.target}`;
    const current = this._workspaceState.get<string[]>('harness-manager.disabledConnections', []);
    let updated: string[];
    if (data.disabled) {
        updated = current.includes(key) ? current : [...current, key];
    } else {
        updated = current.filter(k => k !== key);
    }
    await this._workspaceState.update('harness-manager.disabledConnections', updated);
    this._sendData();
    break;
}
```

`HarnessDashboardProvider` must receive `context: vscode.ExtensionContext` to access `workspaceState`. Currently the constructor only receives `_extensionUri` and `_workspaceRoot`. Add `context` as a third constructor parameter.

---

## 5. Webview Changes

### 5.1 `index.tsx` — Global Suggestion Toggle (R3)

Add `showSuggestions` state (default `true`). Pass it to `WhiteboardCanvas` as a prop:
```tsx
const filteredGraph = React.useMemo(() => {
    if (!data) return null;
    const nodes = /* existing feature filter logic */;
    const edges = baseEdges.filter(e => {
        if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false;
        if (!showSuggestions && e.label === 'suggested') return false;
        return true;
    });
    return { nodes, edges };
}, [data, showSpecs, showSuggestions]);
```

Add checkbox to header:
```tsx
<vscode-checkbox checked={showSuggestions} onChange={(e: any) => setShowSuggestions(e.target.checked)}>
    Suggestions
</vscode-checkbox>
```

### 5.2 `WhiteboardCanvas.tsx` — Bug Fixes + Toggle Handler

#### Fix R8 — handleDismissSuggestion
```tsx
const handleDismissSuggestion = React.useCallback((source: string, target: string) => {
    setEdges((eds) => eds.filter(e =>
        !(e.source === source && e.target === target && (e.data as any)?.originalLabel === 'suggested')
    ));
    const vscode = (window as any).__harness_vscode_api;
    if (vscode?.postMessage) {
        vscode.postMessage({ type: 'dismissSuggestion', subagentId: source, skillId: target });
    }
}, [setEdges]);
```

#### Fix R9 — suggestion dialog Accept
```tsx
const edge = edges.find(
    e => e.source === suggestionDialog.subagentId &&
        e.target === s.skillId &&
        (e.data as any)?.originalLabel === 'suggested'
);
```

#### New R4/R6 — handleToggleConnection
```tsx
const handleToggleConnection = React.useCallback((edge: Edge, disable: boolean) => {
    const vscode = (window as any).__harness_vscode_api;
    if (vscode?.postMessage) {
        vscode.postMessage({ type: 'toggleSkillConnection', source: edge.source, target: edge.target, disabled: disable });
    }
    setContextMenuEdge(null);
}, []);
```

#### Fix R12 — Node context menu click-outside
Wrap the `nodeContextMenu` `div` with a full-screen overlay:
```tsx
{nodeContextMenu && (
    <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
             onClick={() => setNodeContextMenu(null)} />
        <div style={{ ...menuStyle, zIndex: 9999 }}>
            {/* menu content */}
        </div>
    </>
)}
```

### 5.3 `EdgeContextMenu.tsx` — Fix R7 + Add Disable/Enable Option

Replace `currentLabel` usage:
```tsx
const originalLabel = (edge.data as any)?.originalLabel as string | undefined;
const isSuggested = originalLabel === 'suggested';
const isUses = originalLabel === 'uses';
const isDisabled = isUses && edge.data?.metadata?.disabled === true;
const isMismatchEdge = isUses && edge.data?.metadata?._mismatch === true && !isDisabled;
```

Add Disable/Enable button (below the mismatch info, above the divider):
```tsx
{isUses && !isSuggested && (
    <button style={itemStyle}
        onClick={() => { onToggleConnection?.(edge, !isDisabled); onClose(); }}
        onMouseEnter={...} onMouseLeave={...}
    >
        {isDisabled ? '▶ Enable Connection' : '⏸ Disable Connection'}
    </button>
)}
```

New optional prop:
```ts
onToggleConnection?: (edge: Edge, disable: boolean) => void;
```

### 5.4 Edge Rendering — Disabled Style (R5)

In `WhiteboardCanvas.tsx`, `initialEdges` mapping:
```tsx
const isDisabled = label === 'uses' && e.metadata?.disabled === true;
const edgeStyle = isDisabled
    ? { stroke: '#6c6c8a', strokeWidth: 2, strokeDasharray: '4,4', strokeLinecap: 'round' as const, opacity: 0.45 }
    : isMismatchEdge ? { ... }
    : effectiveCfg.style;

const displayLabel = isDisabled
    ? `⏸ ${label}`
    : /* existing displayLabel logic */;
```

---

## 6. Type Changes (`types.ts`)

No new types needed. The `disabled` flag is stored in `HarnessEdge.metadata.disabled: boolean` (existing `Record<string, any>` — no type change required).

---

## 7. Discarded Alternatives

| Alternative | Reason discarded |
|-------------|-----------------|
| Store dismissed suggestions in `.agents/harness-manager.state.json` | Triggers file watcher → extra `_sendData()` loop. Pollutes `.agents/`. |
| Add `disabled: true` to `agentic.json` skills array entry | Structural config file should not hold UI state. |
| Filter suggestions client-side only (ephemeral) | Current broken approach — dismissed pairs reappear on parse. |
| Compute idoneity twice (current) | Wasteful; the corpus build is O(n·m·k) where n=subagents, m=skills, k=vocab. |

---

## 8. Security Considerations

- All message handlers in `extension.ts` validate that `data.subagentId`, `data.skillId`, `data.source`, and `data.target` are non-empty strings before persisting. This prevents injection of malformed keys into workspace state.
- `workspaceState` is scoped to the workspace; no cross-workspace data leakage.
