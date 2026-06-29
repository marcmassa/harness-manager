# Requirements — FEAT-032: Advisory Suggestion Actions

> Advisory suggestions stop being read-only text cards and become executable actions.
> The advisory engine closes the loop: each suggestion can carry one or more actions
> the user can trigger with a single click, without leaving the panel.

---

## Group A — Action Model

**R1** — The `Suggestion` type in `src/agentic-detector/types.ts` SHALL include an optional
`actions?: SuggestionAction[]` field alongside existing fields. Adding it is backwards-compatible:
rules without actions continue to work unchanged.

**R2** — `SuggestionAction` SHALL be defined as:
```typescript
interface SuggestionAction {
  id: string;                // unique within the suggestion, e.g. 'create-prompts-dir'
  label: string;             // button text shown in the panel
  type: ActionType;
  payload: Record<string, string>;  // type-specific params
}
type ActionType =
  | 'open-file'          // open filePath in VS Code editor
  | 'create-directory'   // create dir at relPath
  | 'create-file'        // create file at relPath with content template
  | 'scaffold-agent'     // create SUBAGENT.md stub for agentId
  | 'scaffold-skill'     // create SKILL.md stub for skillId
  | 'run-command';       // run arbitrary shell command via vscode.tasks
```

**R3** — `ActionType = 'open-file'` payload SHALL include `{ filePath: string }` —
path relative to workspace root.

**R4** — `ActionType = 'create-directory'` payload SHALL include `{ relPath: string }`.

**R5** — `ActionType = 'create-file'` payload SHALL include `{ relPath: string, template: string }` —
`template` is the file body (may reference `{{AGENT_NAME}}`, `{{SKILL_NAME}}` placeholders
resolved by `ActionExecutor` from workspace context).

**R6** — `ActionType = 'scaffold-agent'` payload SHALL include `{ name: string, description: string }`;
the executor creates `.agents/subagents/<name>/SUBAGENT.md` with a minimal populated template.

**R7** — `ActionType = 'scaffold-skill'` payload SHALL include `{ name: string, description: string }`;
the executor creates `.agents/skills/<name>/SKILL.md` with a minimal populated template.

**R8** — `ActionType = 'run-command'` payload SHALL include `{ command: string, cwd?: string }`;
the executor runs the command via a `vscode.Terminal` (not a hidden task) so the user
can see output.

---

## Group B — Advisory Panel UI

**R9** — The advisory panel SHALL render action buttons below the description of each
non-dismissed suggestion that has at least one action. Each button shows the action's `label`.

**R10** — Action buttons SHALL be styled distinctly from the dismiss button — outlined
style, not filled — to signal they are secondary actions.

**R11** — While an action is executing, its button SHALL display a spinner and be disabled
to prevent double-execution.

**R12** — On success, the button SHALL briefly show "✓ Done" for 2.5 s then revert
to its original label.

**R13** — On failure, the button SHALL show "✗ Error" and the suggestion card SHALL
display an inline error message below the buttons for 5 s.

**R14** — Multiple actions on the same suggestion SHALL be rendered horizontally in a
flex-wrap row; they never stack vertically.

---

## Group C — Extension Execution

**R15** — The webview SHALL post `{ type: 'executeAdvisoryAction', suggestionId: string, actionId: string }`
when the user clicks an action button.

**R16** — `'executeAdvisoryAction'` SHALL be added to `WebviewMessageType` and `KNOWN_MESSAGE_TYPES`.

**R17** — `AdvisoryCoordinator.handle()` SHALL route `'executeAdvisoryAction'` to a new
`ActionExecutor` class in `src/agentic-detector/actionExecutor.ts`.

**R18** — `ActionExecutor` SHALL receive the workspace root URI and `AgenticDetector` reference.
After executing it SHALL call `agenticDetector.scheduleScan()` so the advisory panel
re-evaluates which suggestions are still relevant.

**R19** — `ActionExecutor.execute()` SHALL return `{ ok: boolean, error?: string }` and
NEVER throw — all errors are caught and returned.

**R20** — The extension SHALL post `{ type: 'advisoryActionResult', suggestionId, actionId, ok, error? }`
back to the webview regardless of success or failure.

---

## Group D — Initial Action Coverage

**R21** — The following existing advisory rules SHALL have at least one action defined:

| Rule ID | Action |
|---|---|
| `organize-prompts` | `create-directory` → `prompts/`, then `open-file` → `prompts/system.md` (creates stub) |
| `no-signals-detected` | `scaffold-agent` → creates a starter subagent named `main-agent` |
| `add-claude-md` | `create-file` → `CLAUDE.md` with minimal starter content |
| `add-agent-readme` | `create-file` → `AGENTS.md` with minimal starter content |
| `use-skill-files` | `scaffold-skill` → `my-first-skill` with description stub |
| `agents-without-skills` (S-GC01) | `scaffold-skill` → prompts user to name and creates SKILL.md stub |

**R22** — Rules added in future sprints SHALL include actions wherever an obvious one-click
fix exists; rules where the correct action is ambiguous SHALL have no actions.
