# FEAT-030 — Tech Debt & Security Hardening — Design

---

## Summary

This feature closes five independent concern areas — webview security, message dispatch, two large-file decompositions, type safety, and dependency hygiene — without adding any user-visible feature. Each area targets a concrete measurable threshold (nonce present, ≤ 400 lines, ≤ 20 `any`, etc.) so that the reviewer and `./check.sh` can verify completion objectively.

All changes are internal refactors. The public API of every component (message types, `ParserResult`, `HarnessNode`) is preserved for the adapters; only the TypeScript representation of `metadata` gains precision.

---

## Affected Files

| File | Action | Reason |
|---|---|---|
| `src/extension.ts` | modify | extract message handlers to coordinators, add nonce, fix sandbox |
| `src/coordinators/WhiteboardCoordinator.ts` | create | whiteboard/graph message domain |
| `src/coordinators/SddCoordinator.ts` | create | SDD-panel message domain |
| `src/coordinators/AdvisoryCoordinator.ts` | create | advisory/detection message domain |
| `src/types.ts` | modify | discriminated union for `HarnessNode.metadata`, `WebviewMessage` union |
| `src/webview/FeatureSpecPanel.tsx` | modify | split into sub-components |
| `src/webview/FeatureList.tsx` | create | feature list column (extracted from FeatureSpecPanel) |
| `src/webview/SpecEditor.tsx` | create | tabbed spec viewer/editor (extracted from FeatureSpecPanel) |
| `src/webview/AiAssistBar.tsx` | create | AI generation button row (extracted from FeatureSpecPanel) |
| `package.json` | modify | move `dagre` + `@types/dagre` to `devDependencies` |
| `DESIGN.md` | modify | update §6 to reference `yaml` + `src/frontmatter.ts` |
| `src/webview/layoutUtils.test.ts` | create | Vitest tests for pure layout functions |
| `src/webview/profileToNodes.test.ts` | already exists — extend | verify coverage of edge cases |
| `src/messageDiscriminator.test.ts` | create | tests for WebviewMessage type guard |

---

## Signatures and Structures

### A — CSP nonce (R1–R3)

```typescript
// src/extension.ts — getWebviewContent()
import * as crypto from 'crypto';

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const scriptUri = webview.asWebviewUri(...);
    return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 script-src 'nonce-${nonce}';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 img-src ${webview.cspSource} data:;">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
```

### B — Sandbox (R4)

```typescript
// Both WebviewPanel and WebviewView option objects
options: {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [distUri],
    // removed: allow-same-origin
    // 'allow-scripts allow-forms' is the minimal required set
}
// Note: sandbox is set implicitly by VS Code when enableScripts: true.
// Remove any explicit sandbox: '...' string that adds allow-same-origin.
```

### C — Message discriminator (R5–R6)

```typescript
// src/types.ts — append after existing types

export type WebviewMessageType =
    | 'ready' | 'getData' | 'selectNode' | 'openFile' | 'createEdge'
    | 'deleteEdge' | 'acceptSuggestion' | 'dismissSuggestion'
    | 'toggleConnection' | 'createSubagent' | 'createSkill' | 'deleteNode'
    | 'updateMetadata' | 'reassignSkill' | 'updateEdgeLabel'
    | 'openSpec' | 'saveSpec' | 'generateSpec' | 'updateFeatureStatus'
    | 'acknowledgeNode' | 'dismissAdvisory' | 'scaffold' | 'openExternal';

export interface WebviewMessage {
    type: WebviewMessageType;
    [key: string]: unknown;
}

export function isKnownWebviewMessage(msg: unknown): msg is WebviewMessage {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        typeof (msg as Record<string, unknown>).type === 'string' &&
        KNOWN_MESSAGE_TYPES.has((msg as Record<string, unknown>).type as string)
    );
}

const KNOWN_MESSAGE_TYPES = new Set<string>([
    'ready', 'getData', 'selectNode', 'openFile', 'createEdge',
    'deleteEdge', 'acceptSuggestion', 'dismissSuggestion',
    'toggleConnection', 'createSubagent', 'createSkill', 'deleteNode',
    'updateMetadata', 'reassignSkill', 'updateEdgeLabel',
    'openSpec', 'saveSpec', 'generateSpec', 'updateFeatureStatus',
    'acknowledgeNode', 'dismissAdvisory', 'scaffold', 'openExternal'
]);
```

### D — Domain coordinators (R7–R8)

```typescript
// src/coordinators/WhiteboardCoordinator.ts
export class WhiteboardCoordinator {
    constructor(
        private readonly writer: HarnessWriter,
        private readonly postMessage: (msg: unknown) => void,
        private readonly workspaceRoot: vscode.Uri,
        private readonly log: vscode.LogOutputChannel
    ) {}

    async handle(msg: WebviewMessage): Promise<boolean> {
        switch (msg.type) {
            case 'createEdge': ...
            case 'deleteEdge': ...
            case 'acceptSuggestion': ...
            // ... whiteboard operations
            default: return false; // not handled by this coordinator
        }
    }
}

// src/coordinators/SddCoordinator.ts — same pattern, SDD messages
// src/coordinators/AdvisoryCoordinator.ts — same pattern, advisory messages
```

```typescript
// src/extension.ts — _handleWebviewMessage after refactor
private async _handleWebviewMessage(data: unknown): Promise<void> {
    if (!isKnownWebviewMessage(data)) {
        this._log.warn(`Unknown message type: ${(data as any)?.type}`);
        return;
    }
    const handled =
        await this._whiteboardCoordinator.handle(data) ||
        await this._sddCoordinator.handle(data) ||
        await this._advisoryCoordinator.handle(data);
    if (!handled) {
        this._handleSharedMessage(data); // getData, ready, openFile, etc.
    }
}
```

### E — HarnessNode.metadata discriminated union (R12)

```typescript
// src/types.ts

export interface AgentMetadata    { _filePath?: string; description?: string; }
export interface SubagentMetadata { _filePath?: string; description?: string; roleFile?: string; }
export interface SkillMetadata    { _filePath?: string; description?: string; discoveryMethod?: DiscoveryMethod; }
export interface SteeringMetadata { _filePath?: string; description?: string; appliesTo?: string[]; }
export interface HookMetadata     { _filePath?: string; event?: string; script?: string; }
export interface FeatureMetadata  { status?: string; priority?: string; sprint?: string; }
export interface DiscoveredMetadata {
    layer?: 'cli' | 'impl' | 'harness' | 'sdd';
    signals?: string[];
    confidence?: number;
    acknowledged?: boolean;
}

export type NodeMetadata =
    | AgentMetadata | SubagentMetadata | SkillMetadata
    | SteeringMetadata | HookMetadata | FeatureMetadata | DiscoveredMetadata;

export interface HarnessNode {
    id: string;
    type: NodeType;
    label: string;
    metadata: NodeMetadata;
}
```

Access pattern for callers that need type-specific fields:
```typescript
// Narrowing by node type — no cast needed
if (node.type === 'skill') {
    const meta = node.metadata as SkillMetadata; // one explicit cast at the boundary
}
```

---

## Algorithm / Flow

```
extension.ts activate()
  └─ create WhiteboardCoordinator, SddCoordinator, AdvisoryCoordinator
  └─ register _handleWebviewMessage

_handleWebviewMessage(raw)
  1. isKnownWebviewMessage(raw)? → if not, warn + return
  2. whiteboardCoordinator.handle(msg) → handled? stop
  3. sddCoordinator.handle(msg)       → handled? stop
  4. advisoryCoordinator.handle(msg)  → handled? stop
  5. handleSharedMessage(msg)         → getData, ready, openFile, openExternal
```

---

## Error Handling

| Condition | Response |
|---|---|
| Unknown message type received | Log warning to output channel, no-op |
| Coordinator throws during handle() | Catch in extension.ts, show vscode.window.showErrorMessage |
| Nonce generation fails (crypto unavailable) | Propagate error — extension cannot activate safely without CSP |
| metadata cast fails at narrowing site | TypeScript compile-time error (prevents silent runtime failure) |

---

## Discarded Alternatives

**For the CSP nonce**: using a static hardcoded nonce string was considered and rejected because a static nonce provides no security benefit — any injected script would know the nonce value. A per-render random nonce is the VS Code documentation-recommended approach.

**For extension.ts decomposition**: splitting by file feature area (whiteboard, SDD, advisory) was chosen over splitting by message direction (host→webview vs webview→host) because the feature-area split aligns with the existing module structure (`src/agentic-detector/`, `src/discovery/`) and makes it easier to trace which coordinator owns which handler.

**For FeatureSpecPanel split**: extracting to three components (`FeatureList`, `SpecEditor`, `AiAssistBar`) was chosen over a single extract into a generic `Panel` HOC because the three components have distinct prop interfaces and different update frequencies, making a HOC abstraction premature.

**For HarnessNode.metadata typing**: a generic `Record<string, unknown>` (replacing `any`) was considered. Rejected because it still requires unsafe casts at every access site. A discriminated union per NodeType allows call sites to narrow safely once and avoids casts throughout the codebase.

---

## Risks and Edge Cases

- **Coordinator refactor breaks webview round-trip**: the message bus between webview and host is informal (stringly typed). Adding `isKnownWebviewMessage` without a complete enumeration of all message types would silently drop messages. Mitigation: enumerate all 23 message types from the current `switch` before removing the old handler.
- **metadata cast propagation**: narrowing `NodeMetadata` requires updating all call sites that access `node.metadata.<field>` (grep: ~35 occurrences). If any site is missed, TypeScript strict mode will catch it at compile time.
- **dagre devDependency move**: esbuild tree-shakes `dagre` from the production bundle already (it's imported in `layoutUtils.ts` which is dead code in the main path). Moving it to `devDependencies` has no bundle impact but changes `npm install --production` behaviour. Mitigation: verify with `npm run build` that the bundle size does not change.
- **FeatureSpecPanel split with shared state**: the three sub-components share `selectedFeature` and `activeTab` state. These must stay in the parent `FeatureSpecPanel` as props or in a React context to avoid prop-drilling.
