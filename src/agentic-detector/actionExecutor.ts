import * as vscode from 'vscode';
import type { SuggestionAction } from './types.js';
import type { AgenticDetector } from './agenticDetector.js';

/**
 * Executes a {@link SuggestionAction} inside the VS Code extension host.
 *
 * Each `ActionType` maps to a concrete VS Code API call.  The executor
 * never throws — all errors are caught, logged, and returned as
 * `{ ok: false, error: string }` so the webview can surface them inline.
 *
 * After a successful execution, `agenticDetector.scheduleScan()` is called
 * so the advisory panel re-evaluates which suggestions are still relevant.
 */
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
                try { await vscode.workspace.fs.stat(uri); return; } catch { /* file doesn't exist — create it */ }
                const content = payload.template ?? '';
                const parentPath = payload.relPath.split('/').slice(0, -1).join('/');
                await vscode.workspace.fs.createDirectory(
                    vscode.Uri.joinPath(this._root, parentPath),
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
                    const body = SUBAGENT_TEMPLATE
                        .replace(/\{\{NAME\}\}/g, name)
                        .replace(/\{\{DESCRIPTION\}\}/g, desc);
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
                    const body = SKILL_TEMPLATE
                        .replace(/\{\{NAME\}\}/g, name)
                        .replace(/\{\{DESCRIPTION\}\}/g, desc);
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

// ─── File templates ────────────────────────────────────────────────────────────

const SUBAGENT_TEMPLATE = `# {{NAME}}

{{DESCRIPTION}}

## Capabilities

-

## Instructions

You are {{NAME}}. Your role is to ...

## Output Format

Return results as ...
`;

const SKILL_TEMPLATE = `name

{{NAME}}

description

{{DESCRIPTION}}

# {{NAME}}

## Philosophy

{{DESCRIPTION}}

The goal is to [state the single clear outcome this skill produces].

## When to use this skill

- Use when you need to [primary trigger]
- Use when [secondary trigger]
- **Do NOT use** when [counter-indication — e.g. the task is already defined]

## Phases

### Phase 1: [Understand the context]

1. Read the relevant files and understand the current state
2. Identify the specific goal and any constraints
3. Clarify ambiguities before proceeding

**Completion criteria:** You can state in one sentence what needs to happen and why.

### Phase 2: [Execute]

1. [Step 1 — concrete action]
2. [Step 2 — concrete action]
3. [Step 3 — concrete action]

**Completion criteria:** [What must be true — e.g. "all tests pass", "the file exists and is valid"]

### Phase 3: [Verify]

1. Confirm the output meets the original goal
2. Check for side-effects or regressions
3. Clean up any temporary state

**Completion criteria:** The outcome matches what was stated in Phase 1.

## Anti-patterns

- **DO NOT** skip Phase 1 — acting on assumptions causes rework
- **DO NOT** [specific pitfall for this skill]
- **DO NOT** [another specific pitfall]

## Checklist

- [ ] Phase 1 complete — goal clearly stated
- [ ] Phase 2 complete — execution done
- [ ] Phase 3 complete — verified and clean
`;
