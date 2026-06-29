# Requirements — FEAT-033: Agent Run & Architecture Studio

> Two complementary upgrades that make the whiteboard a real development tool:
>
> **Phase 1 — Agent Run Panel**: launch any agent from any whiteboard node with
> any installed CLI; no vendor lock-in; results visible in VS Code's integrated terminal.
>
> **Phase 2 — Architecture Studio**: replace the minimal "create node" form with a
> guided Agent Builder wizard; add Architecture Templates to bootstrap common patterns;
> add "scaffold missing" and "sync from filesystem" to keep the whiteboard and disk in sync.

---

## Group A — CLI Abstraction & Run Adapters (Phase 1)

**R1** — The system SHALL define a `RunAdapter` interface in `src/run/types.ts`:
```typescript
interface RunAdapter {
  id: string;              // e.g. 'claude-code', 'gemini-cli', 'generic'
  name: string;            // display name: 'Claude Code', 'Gemini CLI', …
  cliCommand: string;      // base CLI binary name used for detection
  isAvailable(): Promise<boolean>;   // resolves true if binary found on PATH
  buildCommand(node: RunNode, opts: RunOptions): string;
  // Returns the full shell command to pass to the terminal.
}

interface RunNode {
  id: string;
  type: 'agent' | 'subagent' | 'skill';
  name: string;
  filePath: string;        // workspace-relative path to SUBAGENT.md / SKILL.md
}

interface RunOptions {
  task: string;            // the prompt / task description
  featureName?: string;    // when set, spec context is appended to prompt
  model?: string;          // optional model override
  extraArgs?: string;      // raw extra CLI args (power users)
}
```

**R2** — The system SHALL ship three built-in `RunAdapter` implementations:

| id | name | buildCommand example |
|---|---|---|
| `claude-code` | Claude Code | `claude --print "…task…"` or interactive `claude` |
| `gemini-cli` | Gemini CLI | `gemini --prompt "…task…"` |
| `generic` | Open in Editor | Opens the agent's file in VS Code (fallback, always available) |

**R3** — `ClaudeCodeAdapter.buildCommand()` SHALL support two modes controlled by
`RunOptions.interactive: boolean` (default `true`):
- **Interactive** (default): `claude` — opens a full Claude Code session in the terminal
  with the agent's SUBAGENT.md passed as `--system-prompt` or loaded from the working dir.
- **One-shot**: `claude --print "<task>"` — non-interactive, prints response, exits.

**R4** — `GeminiCliAdapter.buildCommand()` SHALL produce:
`gemini --file "<filePath>" --prompt "<task>"` when a file path is available,
falling back to `gemini --prompt "<task>"`.

**R5** — `RunAdapterRegistry` (`src/run/runAdapterRegistry.ts`) SHALL:
- Accept the list of all adapters in its constructor.
- On `detect()`, call `isAvailable()` on each and return only those that resolve `true`,
  always including `generic`.
- Cache detection results for the session (re-detect on `forceRefresh()`).

**R6** — The selected CLI SHALL be persisted per-workspace in `workspaceState`
under key `'harness-dashboard.selectedRunAdapterId'`.

**R7** — If no CLI adapter is detected (only `generic` available), the Run panel SHALL
display a prominent notice: "No agent CLI detected. Install Claude Code or Gemini CLI to run agents directly." with a "Learn more" link.

---

## Group B — Whiteboard Run Actions (Phase 1)

**R8** — Every whiteboard node of type `subagent` or `agent` SHALL display a ▶ **Run**
button in its node action toolbar when the node is selected or hovered. Skill nodes
may also show ▶ but it is lower priority.

**R9** — Clicking ▶ on a node SHALL open the **Run Agent Panel** — a slide-in drawer
anchored to the right side of the whiteboard canvas, 340 px wide, overlapping the canvas
(not pushing it). It may be dismissed with × or Escape.

**R10** — The Run Agent Panel SHALL contain the following controls, in order:

1. **Agent** (read-only label) — the node's name and its file path.
2. **CLI** (dropdown) — lists available adapters with their `name`; shows selected CLI.
   Changing it immediately updates the preview command.
3. **Mode** (segmented toggle, Claude Code only) — "Interactive" / "One-shot".
4. **Task** (textarea, min 3 rows) — the prompt the agent will receive. Pre-populated
   from the node's description if one exists.
5. **Attach feature** (collapsible section) — a searchable list of features from
   `feature_list.json`; selecting one appends the feature's title + first 800 chars of
   its requirements.md to the Task field.
6. **Model override** (text input, collapsed by default) — optional model flag.
7. **Command preview** (code block, read-only, auto-updated) — shows the exact shell
   command that will execute.
8. **▶ Run** button (primary) — executes the command.
9. **Copy command** icon button — copies command to clipboard without executing.

**R11** — Clicking **▶ Run** SHALL:
1. Create a `vscode.Terminal` named `⚡ <agent-name>` (or reuse an existing one with the
   same name if still open).
2. `cd` into the workspace root.
3. Send the built command to the terminal via `terminal.sendText(cmd)`.
4. Call `terminal.show()` to bring the terminal panel to focus.
5. Post `{ type: 'agentRunStarted', nodeId, terminalName }` to the webview.

**R12** — The webview SHALL track which `nodeId`s have active terminals in a
`runningNodeIds: Set<string>` state. Nodes in this set SHALL display an animated
pulsing ring (CSS `@keyframes`) around their whiteboard card.

**R13** — When a terminal is closed (via `vscode.window.onDidCloseTerminal`),
the extension SHALL post `{ type: 'agentRunEnded', nodeId }` so the webview removes
the node from `runningNodeIds`.

**R14** — A **Run History** entry SHALL be written to `workspaceState` on each run:
```typescript
interface RunHistoryEntry {
  nodeId: string;
  nodeName: string;
  adapterId: string;
  taskSnippet: string;   // first 80 chars of task
  timestamp: number;
  durationMs?: number;   // set when terminal closes
}
```
The last 20 entries are kept (FIFO). Stored under `'harness-dashboard.runHistory'`.

**R15** — The whiteboard SHALL display a small "Last run" timestamp badge (relative
time, e.g. "3 min ago") on nodes that have at least one history entry. It updates
every 60 s.

**R16** — A **Run History** panel SHALL be accessible from a new "Runs" icon button
in the whiteboard toolbar (clock icon). It slides in over the canvas (same pattern as
Run Agent Panel) showing the last 20 entries: node name, CLI badge, task snippet,
timestamp. Clicking an entry re-opens the Run Agent Panel with the same node and
pre-fills the task.

---

## Group C — Architecture Studio: Agent Builder Wizard (Phase 2)

**R17** — The existing "Create node" button/flow in the whiteboard SHALL be replaced
by an **Agent Builder Wizard** — a multi-step modal (not a simple form).

**R18** — The wizard SHALL have the following steps for `subagent` type:

**Step 1 — Type & Name**
- Node type: Agent / Sub-agent / Skill (segmented toggle).
- Name (text input, slug-validated: lowercase, hyphens only).
- Display name (text input, free-form).

**Step 2 — Role & Capabilities**
- Role description (textarea, 2–4 sentences — what this agent does).
- Capabilities (tag-style multi-input — add individual capability strings).
- "✨ Generate with AI" button: sends name + role to `lmUtils.generateText()` and
  fills in a suggested role + 5 capabilities. The user can accept, edit, or regenerate.

**Step 3 — Connections**
- Multi-select from existing skill nodes (shows current whiteboard skills with
  checkboxes). Selected skills will become `uses` edges.
- Optional: "Create and connect new skill inline" shortcut (triggers skill sub-wizard).

**Step 4 — Preview & Create**
- Shows a rendered preview of the SUBAGENT.md that will be created (the template
  populated with values from steps 1–3).
- User can edit the preview directly before creating.
- **Create** button creates the node in `agentic.json`, writes the SUBAGENT.md to
  `.agents/subagents/<name>/SUBAGENT.md`, creates selected edges.

**R19** — For `skill` type the wizard has the same steps but shorter:
Step 1 (Type & Name) → Step 2 (Purpose & Steps) → Step 3 (Preview & Create).
Generates a SKILL.md.

**R20** — AI generation in Step 2 SHALL use `lmUtils.generateText()` with a structured
prompt that returns JSON `{ role: string, capabilities: string[] }` (for agents) or
`{ purpose: string, steps: string[] }` (for skills). The panel parses this and fills
the form fields. If the LM is unavailable, the button is hidden and the user fills manually.

**R21** — The wizard SHALL validate at each step before allowing "Next":
- Step 1: name must be non-empty, slug-valid, and unique in the current graph.
- Step 2: role must be at least 20 characters.
- Step 3: no validation required.
- Step 4: none (Create triggers the action).

---

## Group D — Architecture Studio: Templates (Phase 2)

**R22** — The whiteboard toolbar SHALL include a **Templates** button (grid icon) that
opens a template picker panel.

**R23** — The system SHALL ship the following built-in architecture templates:

| ID | Name | Description | Nodes created |
|---|---|---|---|
| `solo-agent` | Solo Agent | Single agent with CLAUDE.md | 1 agent |
| `agent-with-skills` | Agent + Skills | Agent with 3 pre-wired skills | 1 agent + 3 skills |
| `coordinator-specialists` | Coordinator + Specialists | Coordinator orchestrates 2–3 domain agents | 1 coordinator + 2 specialists |
| `sdd-pipeline` | Full SDD Pipeline | Frontend, Backend, QA, Review agents wired to SDD | 4 agents + feature tracking |

**R24** — Applying a template SHALL:
1. Show a confirmation: "This will add N nodes and create files in `.agents/`. Continue?"
2. Create each node via the existing `WhiteboardCoordinator.createNode()` path.
3. Create the corresponding `.agents/` files (SUBAGENT.md / SKILL.md) with
   template-specific content stubs.
4. Create the edges between nodes.
5. Trigger a `scheduleScan()` to refresh the advisory panel.

**R25** — If existing nodes conflict (same name), the template application SHALL
skip the conflicting node and log a warning rather than overwriting.

**R26** — Each template card in the picker SHALL show: name, description, a small
preview diagram (ASCII or inline SVG), and the number of nodes/edges it creates.

---

## Group E — Architecture Studio: Sync Utilities (Phase 2)

**R27** — A **"Scaffold missing files"** VS Code command (`harness-dashboard.scaffoldMissing`)
SHALL scan all whiteboard nodes and create `.agents/` files for any node that exists
in `agentic.json` but has no corresponding file on disk. It opens a QuickPick showing
which files will be created and lets the user confirm before writing.

**R28** — A **"Sync from filesystem"** VS Code command (`harness-dashboard.syncFromFilesystem`)
SHALL scan `.agents/subagents/**` and `.agents/skills/**` for directories containing
SUBAGENT.md / SKILL.md files not already in `agentic.json`, and import them as new nodes
into the whiteboard. It shows a QuickPick diff ("3 agents found not in whiteboard") before
writing `agentic.json`.

**R29** — Both commands SHALL be accessible from the whiteboard toolbar (⚙ menu) in
addition to the VS Code command palette.

**R30** — After either sync command completes, the extension SHALL call `sendData()`
to refresh the whiteboard and `scheduleScan()` to refresh the advisory panel.
