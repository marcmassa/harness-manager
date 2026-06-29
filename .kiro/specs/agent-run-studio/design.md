# Design — FEAT-033: Agent Run & Architecture Studio

## 1. New module: `src/run/`

```
src/run/
  types.ts                   RunAdapter, RunNode, RunOptions, RunHistoryEntry
  runAdapterRegistry.ts      RunAdapterRegistry (detect, select, persist)
  adapters/
    claudeCodeAdapter.ts     ClaudeCodeAdapter
    geminiCliAdapter.ts      GeminiCliAdapter
    genericAdapter.ts        GenericAdapter (fallback — open file)
```

### 1.1 `src/run/types.ts`

```typescript
export interface RunAdapter {
  readonly id: string;
  readonly name: string;
  readonly cliCommand: string;
  isAvailable(): Promise<boolean>;
  buildCommand(node: RunNode, opts: RunOptions): string;
}

export interface RunNode {
  id: string;
  type: 'agent' | 'subagent' | 'skill';
  name: string;
  filePath: string;        // workspace-relative
}

export interface RunOptions {
  task: string;
  featureContext?: string; // pre-fetched spec text (requirements.md excerpt)
  model?: string;
  interactive?: boolean;   // default true for claude-code
  extraArgs?: string;
}

export interface RunHistoryEntry {
  nodeId: string;
  nodeName: string;
  adapterId: string;
  taskSnippet: string;
  timestamp: number;
  durationMs?: number;
}
```

### 1.2 ClaudeCodeAdapter

```typescript
export class ClaudeCodeAdapter implements RunAdapter {
  id = 'claude-code';
  name = 'Claude Code';
  cliCommand = 'claude';

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const cp = require('child_process');
      cp.exec('which claude', (err: unknown) => resolve(!err));
    });
  }

  buildCommand(node: RunNode, opts: RunOptions): string {
    const parts: string[] = ['claude'];
    if (!opts.interactive) {
      // one-shot mode: non-interactive, prints response
      const task = this._buildTaskString(node, opts);
      parts.push('--print', JSON.stringify(task));
    }
    // Interactive mode: just `claude` — Claude Code will read CLAUDE.md from cwd
    // and the user types the task in the session.
    // We still pass a --message to pre-fill the first turn if available.
    else if (opts.task) {
      const task = this._buildTaskString(node, opts);
      parts.push('--message', JSON.stringify(task));
    }
    if (opts.model) parts.push('--model', opts.model);
    if (opts.extraArgs) parts.push(opts.extraArgs);
    return parts.join(' ');
  }

  private _buildTaskString(node: RunNode, opts: RunOptions): string {
    let task = '';
    if (node.filePath) {
      task += `[Context: ${node.filePath}]\n`;
    }
    task += opts.task;
    if (opts.featureContext) {
      task += `\n\n---\nFeature context:\n${opts.featureContext}`;
    }
    return task;
  }
}
```

### 1.3 GeminiCliAdapter

```typescript
export class GeminiCliAdapter implements RunAdapter {
  id = 'gemini-cli';
  name = 'Gemini CLI';
  cliCommand = 'gemini';

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const cp = require('child_process');
      cp.exec('which gemini', (err: unknown) => resolve(!err));
    });
  }

  buildCommand(node: RunNode, opts: RunOptions): string {
    const parts: string[] = ['gemini'];
    if (node.filePath) parts.push('--file', `"${node.filePath}"`);
    const task = opts.featureContext
      ? `${opts.task}\n\nFeature context:\n${opts.featureContext}`
      : opts.task;
    parts.push('--prompt', JSON.stringify(task));
    if (opts.model) parts.push('--model', opts.model);
    if (opts.extraArgs) parts.push(opts.extraArgs);
    return parts.join(' ');
  }
}
```

### 1.4 GenericAdapter (fallback)

```typescript
export class GenericAdapter implements RunAdapter {
  id = 'generic';
  name = 'Open in Editor';
  cliCommand = '';

  async isAvailable(): Promise<boolean> { return true; }

  buildCommand(node: RunNode, _opts: RunOptions): string {
    // The RunCoordinator handles 'generic' specially — it calls
    // vscode.window.showTextDocument() instead of creating a terminal.
    return node.filePath;
  }
}
```

### 1.5 RunAdapterRegistry

```typescript
export class RunAdapterRegistry {
  private _adapters: RunAdapter[];
  private _available: RunAdapter[] | null = null;

  constructor(adapters: RunAdapter[]) {
    this._adapters = adapters;
  }

  async detect(): Promise<RunAdapter[]> {
    if (this._available) return this._available;
    const results = await Promise.all(
      this._adapters.map(async a => ({ a, ok: await a.isAvailable() }))
    );
    this._available = results.filter(r => r.ok).map(r => r.a);
    return this._available;
  }

  forceRefresh(): void { this._available = null; }

  getById(id: string): RunAdapter | undefined {
    return this._adapters.find(a => a.id === id);
  }
}
```

---

## 2. RunCoordinator (`src/coordinators/RunCoordinator.ts`)

```typescript
export class RunCoordinator {
  private _terminals = new Map<string, vscode.Terminal>(); // nodeId → terminal
  private _startTimes = new Map<string, number>();

  constructor(
    private readonly _registry: RunAdapterRegistry,
    private readonly _root: vscode.Uri,
    private readonly _workspaceState: vscode.Memento,
    private readonly _log: vscode.LogOutputChannel,
  ) {}

  setPostToWebview(fn: (msg: unknown) => void): void {
    this._postToWebview = fn;
  }
  private _postToWebview: (msg: unknown) => void = () => {};

  /** Called once after construction — registers terminal lifecycle listener. */
  activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.onDidCloseTerminal(t => this._onTerminalClose(t))
    );
  }

  async handle(
    msg: WebviewMessage,
    postMessage: PostMessageFn,
  ): Promise<boolean> {
    switch (msg.type) {
      case 'getRunAdapters': {
        const available = await this._registry.detect();
        postMessage({ type: 'runAdapters', adapters: available.map(a => ({ id: a.id, name: a.name })) });
        return true;
      }
      case 'runAgent': {
        const { nodeId, nodeName, nodeFilePath, nodeType, adapterId, task, featureName, model, interactive, extraArgs } =
          msg as unknown as RunAgentMessage;
        await this._runAgent({ nodeId, nodeName, nodeFilePath, nodeType, adapterId, task, featureName, model, interactive, extraArgs }, postMessage);
        return true;
      }
      case 'getRunHistory': {
        const history = this._workspaceState.get<RunHistoryEntry[]>(RUN_HISTORY_KEY, []);
        postMessage({ type: 'runHistory', history });
        return true;
      }
      default:
        return false;
    }
  }

  private async _runAgent(params: RunAgentMessage, postMessage: PostMessageFn): Promise<void> {
    const adapter = this._registry.getById(params.adapterId);
    if (!adapter) {
      postMessage({ type: 'agentRunError', nodeId: params.nodeId, error: `Adapter '${params.adapterId}' not found` });
      return;
    }

    // Generic adapter → open file in editor, don't create terminal
    if (params.adapterId === 'generic') {
      const uri = vscode.Uri.joinPath(this._root, params.nodeFilePath);
      await vscode.window.showTextDocument(uri);
      return;
    }

    // Fetch feature context if requested
    let featureContext: string | undefined;
    if (params.featureName) {
      featureContext = await this._readFeatureContext(params.featureName);
    }

    const node: RunNode = {
      id: params.nodeId,
      type: params.nodeType as RunNode['type'],
      name: params.nodeName,
      filePath: params.nodeFilePath,
    };
    const opts: RunOptions = {
      task: params.task,
      featureContext,
      model: params.model,
      interactive: params.interactive ?? true,
      extraArgs: params.extraArgs,
    };

    const cmd = adapter.buildCommand(node, opts);
    const termName = `⚡ ${params.nodeName}`;

    // Reuse terminal if still open
    let terminal = this._terminals.get(params.nodeId);
    if (!terminal || terminal.exitStatus !== undefined) {
      terminal = vscode.window.createTerminal({
        name: termName,
        cwd: this._root,
      });
      this._terminals.set(params.nodeId, terminal);
    }

    this._startTimes.set(params.nodeId, Date.now());
    terminal.sendText(cmd);
    terminal.show();

    // Save to history
    const entry: RunHistoryEntry = {
      nodeId: params.nodeId,
      nodeName: params.nodeName,
      adapterId: params.adapterId,
      taskSnippet: params.task.slice(0, 80),
      timestamp: Date.now(),
    };
    this._appendHistory(entry);

    postMessage({ type: 'agentRunStarted', nodeId: params.nodeId });
    this._postToWebview({ type: 'agentRunStarted', nodeId: params.nodeId });
  }

  private _onTerminalClose(terminal: vscode.Terminal): void {
    for (const [nodeId, t] of this._terminals) {
      if (t === terminal) {
        const start = this._startTimes.get(nodeId);
        const durationMs = start ? Date.now() - start : undefined;
        this._updateHistoryDuration(nodeId, durationMs);
        this._terminals.delete(nodeId);
        this._startTimes.delete(nodeId);
        this._postToWebview({ type: 'agentRunEnded', nodeId });
        break;
      }
    }
  }

  private async _readFeatureContext(featureName: string): Promise<string> {
    try {
      const uri = vscode.Uri.joinPath(this._root, `.kiro/specs/${featureName}/requirements.md`);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');
      return text.slice(0, 800);
    } catch {
      return '';
    }
  }

  private _appendHistory(entry: RunHistoryEntry): void {
    const history = this._workspaceState.get<RunHistoryEntry[]>(RUN_HISTORY_KEY, []);
    history.unshift(entry);
    void this._workspaceState.update(RUN_HISTORY_KEY, history.slice(0, 20));
  }

  private _updateHistoryDuration(nodeId: string, durationMs?: number): void {
    if (!durationMs) return;
    const history = this._workspaceState.get<RunHistoryEntry[]>(RUN_HISTORY_KEY, []);
    const entry = history.find(e => e.nodeId === nodeId && !e.durationMs);
    if (entry) {
      entry.durationMs = durationMs;
      void this._workspaceState.update(RUN_HISTORY_KEY, history);
    }
  }
}

const RUN_HISTORY_KEY = 'harness-dashboard.runHistory';
```

---

## 3. Whiteboard changes

### 3.1 New message types (src/types.ts)

```typescript
| 'getRunAdapters'     // webview → ext: request available adapters
| 'runAdapters'        // ext → webview: { adapters: {id,name}[] }
| 'runAgent'           // webview → ext: RunAgentMessage payload
| 'agentRunStarted'    // ext → webview: { nodeId }
| 'agentRunEnded'      // ext → webview: { nodeId }
| 'agentRunError'      // ext → webview: { nodeId, error }
| 'getRunHistory'      // webview → ext: request history
| 'runHistory'         // ext → webview: { history: RunHistoryEntry[] }
```

### 3.2 State in index.tsx

```typescript
const [runningNodeIds, setRunningNodeIds] = React.useState<Set<string>>(new Set());
const [runHistory, setRunHistory] = React.useState<RunHistoryEntry[]>([]);
const [runAdapters, setRunAdapters] = React.useState<{ id: string; name: string }[]>([]);
const [runPanelNodeId, setRunPanelNodeId] = React.useState<string | null>(null);

// In message handler:
case 'runAdapters': setRunAdapters(message.adapters); break;
case 'agentRunStarted':
  setRunningNodeIds(prev => new Set([...prev, message.nodeId])); break;
case 'agentRunEnded':
  setRunningNodeIds(prev => { const n = new Set(prev); n.delete(message.nodeId); return n; }); break;
case 'runHistory': setRunHistory(message.history); break;
```

### 3.3 RunAgentPanel component (src/webview/RunAgentPanel.tsx)

New component, ~220 lines. Props:

```typescript
interface RunAgentPanelProps {
  nodeId: string;
  nodeName: string;
  nodeFilePath: string;
  nodeType: 'agent' | 'subagent' | 'skill';
  adapters: { id: string; name: string }[];
  selectedAdapterId: string;
  onAdapterChange: (id: string) => void;
  features: FeatureListItem[];   // from SDD featureList state
  onRun: (opts: RunAgentOpts) => void;
  onClose: () => void;
  isRunning: boolean;
}
```

Layout (340 px slide-in drawer, right side of whiteboard):
```
┌─────────────────────────────────────────┐
│ ⚡ Run Agent                          × │
│─────────────────────────────────────────│
│ Agent:  frontend-agent                  │
│         .agents/subagents/frontend/...  │
│─────────────────────────────────────────│
│ CLI  [Claude Code ▾] [● Gemini CLI]     │
│                                         │
│ Mode   ○ Interactive  ○ One-shot        │  (claude-code only)
│─────────────────────────────────────────│
│ Task                                    │
│ ┌─────────────────────────────────────┐ │
│ │ Implement the login feature         │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│─────────────────────────────────────────│
│ ▸ Attach feature  [search features…  ▾] │
│─────────────────────────────────────────│
│ ▸ Advanced  [Model: ______] [Args: ___] │
│─────────────────────────────────────────│
│ Command preview                         │
│ claude --message "Implement login…"     │
│─────────────────────────────────────────│
│  [□ Copy]               [▶ Run Agent]  │
└─────────────────────────────────────────┘
```

### 3.4 Run button in WhiteboardCanvas

Each `HarnessNode` card (in `src/webview/WhiteboardCanvas.tsx` or its node renderer) gets
a ▶ button in its toolbar when selected. The button calls
`onRunNode(nodeId)` → parent sets `runPanelNodeId` → `RunAgentPanel` renders.

### 3.5 Running node visual

```css
@keyframes runPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--run-color-rgb), 0.4); }
  50%       { box-shadow: 0 0 0 6px rgba(var(--run-color-rgb), 0); }
}
.harness-node--running {
  animation: runPulse 1.2s ease-out infinite;
  --run-color-rgb: 99, 179, 237;  /* blue */
}
```

---

## 4. Architecture Studio

### 4.1 AgentBuilderWizard (`src/webview/AgentBuilderWizard.tsx`)

Multi-step modal, ~300 lines. Steps controlled by `step: 1|2|3|4` local state.

Step 2 "Generate with AI" call:
```typescript
const handleGenerateAI = async () => {
  setAiGenerating(true);
  vscode.postMessage({ type: 'generateAgentDescription', name, role, type: nodeType });
  // extension calls lmUtils.generateText(), posts back 'agentDescriptionResult'
};
```

Extension response message: `{ type: 'agentDescriptionResult', role: string, capabilities: string[] }`

Step 4 preview renders the SUBAGENT.md template with form values substituted.

"Create" button sends:
```typescript
vscode.postMessage({
  type: 'createNodeFromWizard',
  nodeType,
  name,
  displayName,
  description: role,
  capabilities,
  connectSkillIds,  // string[]
});
```

`WhiteboardCoordinator` handles `createNodeFromWizard`:
1. Calls `this._writer.createSubagent(name, description)` or `createSkill(...)`.
2. Creates edges for each `connectSkillIds` entry.
3. Calls `sendData(postMessage)` and `this._scheduleScan?.()`.

### 4.2 Architecture Templates

```typescript
// src/whiteboard/architectureTemplates.ts
export interface ArchitectureTemplate {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  previewSvg: string;          // inline SVG ~100px × 80px
  nodes: TemplateNodeDef[];
  edges: TemplateEdgeDef[];
}

interface TemplateNodeDef {
  id: string;       // placeholder id, replaced on apply
  type: 'subagent' | 'skill';
  name: string;
  description: string;
}

interface TemplateEdgeDef {
  source: string;   // references TemplateNodeDef.id
  target: string;
}
```

Message flow:
```
webview → ext: { type: 'getArchitectureTemplates' }
ext → webview: { type: 'architectureTemplates', templates: ArchitectureTemplate[] }
webview → ext: { type: 'applyArchitectureTemplate', templateId: string }
ext → webview: { type: 'init', data: ... }  (full refresh after apply)
```

`WhiteboardCoordinator.handle()` processes `applyArchitectureTemplate`:
loops over `template.nodes`, calls `_writer.createSubagent()` or `createSkill()` for each,
then creates edges. Skips nodes whose name already exists (logs warning).

### 4.3 Sync commands (extension.ts)

```typescript
// harness-dashboard.scaffoldMissing
vscode.commands.registerCommand('harness-dashboard.scaffoldMissing', async () => {
  const data = provider.getCachedData();
  if (!data) { vscode.window.showWarningMessage('No data loaded yet'); return; }
  const missing = data.graph.nodes.filter(n => !n.filePath || !(await fileExists(root, n.filePath)));
  if (missing.length === 0) { vscode.window.showInformationMessage('All nodes have files.'); return; }
  const items = missing.map(n => ({ label: n.id, description: n.type, picked: true }));
  const selected = await vscode.window.showQuickPick(items, { canPickMany: true, title: 'Scaffold missing files' });
  if (!selected) return;
  for (const item of selected) {
    const node = missing.find(n => n.id === item.label)!;
    await actionExecutor.execute({ id: 'scaffold', label: '', type: node.type === 'skill' ? 'scaffold-skill' : 'scaffold-agent', payload: { name: node.id, description: '' } });
  }
  await provider._sendData();
});
```

---

## 5. Extension wiring (`extension.ts` changes)

```typescript
// New imports
import { RunAdapterRegistry } from './run/runAdapterRegistry.js';
import { ClaudeCodeAdapter } from './run/adapters/claudeCodeAdapter.js';
import { GeminiCliAdapter } from './run/adapters/geminiCliAdapter.js';
import { GenericAdapter } from './run/adapters/genericAdapter.js';
import { RunCoordinator } from './coordinators/RunCoordinator.js';

// In activate():
const runRegistry = new RunAdapterRegistry([
  new ClaudeCodeAdapter(),
  new GeminiCliAdapter(),
  new GenericAdapter(),
]);
const runCoordinator = new RunCoordinator(runRegistry, root, context.workspaceState, log);
runCoordinator.activate(context);
runCoordinator.setPostToWebview(msg => provider.postToWebview(msg));

// Wire into _handleWebviewMessage (inside HarnessDashboardProvider or via setRunCoordinator):
// RunCoordinator.handle() is called in the default chain after the three existing coordinators.

// New VS Code commands:
context.subscriptions.push(
  vscode.commands.registerCommand('harness-dashboard.scaffoldMissing', scaffoldMissingCommand),
  vscode.commands.registerCommand('harness-dashboard.syncFromFilesystem', syncFromFilesystemCommand),
);
```

---

## 6. package.json additions

```json
// commands:
{ "command": "harness-dashboard.scaffoldMissing", "title": "Harness: Scaffold Missing Agent Files" },
{ "command": "harness-dashboard.syncFromFilesystem", "title": "Harness: Sync Agents from Filesystem" }
```
