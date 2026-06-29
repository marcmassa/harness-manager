# Design — FEAT-032: Advisory Suggestion Actions

## 1. Type changes (`src/agentic-detector/types.ts`)

```typescript
// New types appended at the bottom of types.ts

export type ActionType =
  | 'open-file'
  | 'create-directory'
  | 'create-file'
  | 'scaffold-agent'
  | 'scaffold-skill'
  | 'run-command';

export interface SuggestionAction {
  id: string;
  label: string;
  type: ActionType;
  payload: Record<string, string>;
}

// Updated Suggestion (existing interface):
export interface Suggestion {
  // ...existing fields...
  actions?: SuggestionAction[];   // ← NEW, optional
}
```

## 2. ActionExecutor (`src/agentic-detector/actionExecutor.ts`)

```typescript
import * as vscode from 'vscode';
import type { SuggestionAction } from './types.js';
import type { AgenticDetector } from './agenticDetector.js';

export class ActionExecutor {
  constructor(
    private readonly _root: vscode.Uri,
    private readonly _detector: AgenticDetector,
    private readonly _log: vscode.LogOutputChannel,
  ) {}

  async execute(action: SuggestionAction): Promise<{ ok: boolean; error?: string }> {
    try {
      await this._run(action);
      this._detector.scheduleScan();
      return { ok: true };
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? String(e);
      this._log.error(`[ActionExecutor] ${action.type} failed: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  private async _run(action: SuggestionAction): Promise<void> {
    const { type, payload } = action;
    switch (type) {
      case 'open-file': {
        const uri = vscode.Uri.joinPath(this._root, payload.filePath);
        await vscode.window.showTextDocument(uri);
        break;
      }
      case 'create-directory': {
        const uri = vscode.Uri.joinPath(this._root, payload.relPath);
        await vscode.workspace.fs.createDirectory(uri);
        break;
      }
      case 'create-file': {
        const uri = vscode.Uri.joinPath(this._root, payload.relPath);
        try { await vscode.workspace.fs.stat(uri); return; } catch { /* doesn't exist, create it */ }
        const content = payload.template ?? '';
        await vscode.workspace.fs.createDirectory(
          vscode.Uri.joinPath(this._root, payload.relPath.split('/').slice(0, -1).join('/'))
        );
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        await vscode.window.showTextDocument(uri);
        break;
      }
      case 'scaffold-agent': {
        const name = payload.name ?? 'main-agent';
        const desc = payload.description ?? 'A general-purpose agent.';
        const dir = vscode.Uri.joinPath(this._root, `.agents/subagents/${name}`);
        await vscode.workspace.fs.createDirectory(dir);
        const uri = vscode.Uri.joinPath(dir, 'SUBAGENT.md');
        try { await vscode.workspace.fs.stat(uri); } catch {
          const body = SUBAGENT_TEMPLATE.replace('{{NAME}}', name).replace('{{DESCRIPTION}}', desc);
          await vscode.workspace.fs.writeFile(uri, Buffer.from(body, 'utf8'));
        }
        await vscode.window.showTextDocument(uri);
        break;
      }
      case 'scaffold-skill': {
        const name = payload.name ?? 'my-skill';
        const desc = payload.description ?? 'A reusable skill.';
        const dir = vscode.Uri.joinPath(this._root, `.agents/skills/${name}`);
        await vscode.workspace.fs.createDirectory(dir);
        const uri = vscode.Uri.joinPath(dir, 'SKILL.md');
        try { await vscode.workspace.fs.stat(uri); } catch {
          const body = SKILL_TEMPLATE.replace('{{NAME}}', name).replace('{{DESCRIPTION}}', desc);
          await vscode.workspace.fs.writeFile(uri, Buffer.from(body, 'utf8'));
        }
        await vscode.window.showTextDocument(uri);
        break;
      }
      case 'run-command': {
        const t = vscode.window.createTerminal({ name: 'Harness Action' });
        t.sendText(payload.command);
        t.show();
        break;
      }
    }
  }
}

const SUBAGENT_TEMPLATE = `# {{NAME}}

{{DESCRIPTION}}

## Capabilities

- 

## Instructions

You are {{NAME}}. Your role is to ...

## Output Format

Return results as ...
`;

const SKILL_TEMPLATE = `# {{NAME}} Skill

{{DESCRIPTION}}

## Usage

\`\`\`
Use this skill when you need to ...
\`\`\`

## Steps

1. 
2. 
3. 

## Outputs

- 
`;
```

## 3. AdvisoryCoordinator change

```typescript
// src/coordinators/AdvisoryCoordinator.ts — new case in handle()
case 'executeAdvisoryAction': {
  const { suggestionId, actionId } = msg as unknown as { suggestionId: string; actionId: string };
  const profile = this._agenticDetector?.getProfile();
  const suggestion = profile?.suggestions.find(s => s.id === suggestionId);
  const action = suggestion?.actions?.find(a => a.id === actionId);
  if (!action || !this._actionExecutor) {
    postMessage({ type: 'advisoryActionResult', suggestionId, actionId, ok: false, error: 'Action not found' });
    return true;
  }
  const result = await this._actionExecutor.execute(action);
  postMessage({ type: 'advisoryActionResult', suggestionId, actionId, ...result });
  return true;
}
```

`_actionExecutor` is injected via `setAgenticDetector()` (same pattern as `_agenticDetector`):
```typescript
setAgenticDetector(detector: AgenticDetector): void {
  this._agenticDetector = detector;
  this._actionExecutor = new ActionExecutor(this._workspaceRoot, detector, this._log);
}
```

## 4. AdvisoryPanel UI (`src/webview/AdvisoryPanel.tsx`)

### Action button component
```tsx
const ActionButton = ({ action, onExecute, state }: {
  action: SuggestionAction;
  onExecute: (actionId: string) => void;
  state: 'idle' | 'running' | 'success' | 'error';
}) => {
  const label =
    state === 'running' ? '…' :
    state === 'success' ? '✓ Done' :
    state === 'error'   ? '✗ Error' : action.label;

  return (
    <button
      onClick={() => state === 'idle' && onExecute(action.id)}
      disabled={state !== 'idle'}
      style={{
        fontSize: '0.72em',
        padding: '3px 10px',
        borderRadius: '6px',
        border: '1px solid var(--vscode-button-secondaryBorder, var(--vscode-panel-border))',
        background: state === 'success' ? 'color-mix(in srgb, #4caf50 12%, transparent)' :
                    state === 'error'   ? 'color-mix(in srgb, #f44336 12%, transparent)' :
                    'transparent',
        color: state === 'success' ? '#4caf50' :
               state === 'error'   ? '#f44336' :
               'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
        cursor: state === 'idle' ? 'pointer' : 'default',
        opacity: state === 'running' ? 0.6 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
};
```

### State in AdvisoryPanel
```typescript
// actionStates: { [suggestionId_actionId]: 'idle' | 'running' | 'success' | 'error' }
const [actionStates, setActionStates] = React.useState<Record<string, ActionButtonState>>({});

// Called by parent when advisoryActionResult arrives:
const updateActionState = (suggestionId: string, actionId: string, state: ActionButtonState) => {
  const key = `${suggestionId}::${actionId}`;
  setActionStates(prev => ({ ...prev, [key]: state }));
  if (state === 'success' || state === 'error') {
    setTimeout(() => setActionStates(prev => ({ ...prev, [key]: 'idle' })), 2500);
  }
};
```

## 5. Message types

```typescript
// src/types.ts — additions to WebviewMessageType and KNOWN_MESSAGE_TYPES
| 'executeAdvisoryAction'
| 'advisoryActionResult'
```

## 6. Example rule with actions

```typescript
// src/agentic-detector/advisoryEngine.ts
{
  id: 'organize-prompts',
  condition: (p) => (p.layers['2'].categories.find(c => c.category === 'prompts')?.count ?? 0) > 0
    && p.maturity.level === 'L1',
  build: (p) => ({
    title: 'Organize prompts into a directory',
    description: 'You have prompt files scattered at root level. Moving them into a `prompts/` directory ...',
    // ...
    actions: [
      {
        id: 'create-prompts-dir',
        label: 'Create prompts/',
        type: 'create-directory',
        payload: { relPath: 'prompts' },
      },
      {
        id: 'create-system-prompt',
        label: 'Add prompts/system.md',
        type: 'create-file',
        payload: {
          relPath: 'prompts/system.md',
          template: '# System Prompt\n\nYou are a helpful AI assistant.\n',
        },
      },
    ],
  }),
},
```
