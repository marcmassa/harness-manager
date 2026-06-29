# Tasks — FEAT-033: Agent Run & Architecture Studio

> Phase 1 (T1–T22): Agent Run Panel — CLI detection, terminal integration, whiteboard ▶ button, run history.
> Phase 2 (T23–T38): Architecture Studio — Agent Builder Wizard, Templates, Sync utilities.
> Mark `[x]` on completion. Each task references the R<n> it covers.

---

## Phase 1 — Agent Run Panel

### Group A: Run Module

- [ ] **T1** — Create `src/run/types.ts`: define `RunAdapter`, `RunNode`, `RunOptions`,
  `RunHistoryEntry` interfaces and `RUN_HISTORY_KEY` constant _(R1)_

- [ ] **T2** — Implement `ClaudeCodeAdapter` in `src/run/adapters/claudeCodeAdapter.ts`:
  `isAvailable()` via `child_process.exec('which claude')`, `buildCommand()` for both
  interactive and one-shot modes _(R2, R3)_

- [ ] **T3** — Implement `GeminiCliAdapter` in `src/run/adapters/geminiCliAdapter.ts`:
  same `isAvailable()` pattern, `buildCommand()` with `--file` and `--prompt` flags _(R2, R4)_

- [ ] **T4** — Implement `GenericAdapter` in `src/run/adapters/genericAdapter.ts`:
  `isAvailable()` always `true`; `buildCommand()` returns the node's `filePath`
  (RunCoordinator handles it as a special case) _(R2)_

- [ ] **T5** — Implement `RunAdapterRegistry` in `src/run/runAdapterRegistry.ts`:
  `detect()`, `forceRefresh()`, `getById()`; detection results cached for the session _(R5)_

### Group B: RunCoordinator

- [ ] **T6** — Create `src/coordinators/RunCoordinator.ts` with `handle()` routing
  `getRunAdapters`, `runAgent`, `getRunHistory`; include terminal map, start-time map,
  `activate()` to register `onDidCloseTerminal` _(R11, R13, R14)_

- [ ] **T7** — Implement `_runAgent()` in `RunCoordinator`: resolve adapter, build command,
  create/reuse terminal via `vscode.window.createTerminal({ cwd: root })`,
  `sendText(cmd)`, `show()`, append to run history, post `agentRunStarted` _(R11, R12, R14)_

- [ ] **T8** — Implement `_onTerminalClose()` in `RunCoordinator`: find nodeId from terminal
  map, compute `durationMs`, update history entry, post `agentRunEnded` via
  `_postToWebview` _(R13, R14)_

- [ ] **T9** — Implement `_readFeatureContext()` in `RunCoordinator`: reads
  `.kiro/specs/<featureName>/requirements.md`, returns first 800 chars; silent on
  missing file _(R10)_

- [ ] **T10** — Implement `_appendHistory()` and `_updateHistoryDuration()` in
  `RunCoordinator`; store max 20 entries in `workspaceState` _(R14)_

- [ ] **T11** — Implement `getRunAdapters` case: call `registry.detect()`, post
  `runAdapters` with `{ id, name }` array; include a `noCliDetected: boolean` flag
  when only `generic` is available _(R5, R7)_

- [ ] **T12** — Add `RunCoordinator` to `HarnessDashboardProvider`: inject via
  `setRunCoordinator(coordinator)` (same setter pattern); wire in `_handleWebviewMessage`
  default chain _(extension.ts)_

- [ ] **T13** — Add `runRegistry` construction and `runCoordinator` wiring in `activate()`
  of `extension.ts`; call `runCoordinator.activate(context)` and
  `runCoordinator.setPostToWebview(msg => provider.postToWebview(msg))` _(R11, R13)_

### Group C: Message Types

- [ ] **T14** — Add `'getRunAdapters'`, `'runAdapters'`, `'runAgent'`, `'agentRunStarted'`,
  `'agentRunEnded'`, `'agentRunError'`, `'getRunHistory'`, `'runHistory'` to
  `WebviewMessageType` and `KNOWN_MESSAGE_TYPES` in `src/types.ts` _(R11)_

### Group D: Whiteboard UI — Run Agent Panel

- [ ] **T15** — Create `src/webview/RunAgentPanel.tsx` (~220 lines) with all controls
  from the design: CLI dropdown, Mode toggle (claude-code only), Task textarea,
  "Attach feature" collapsible, Advanced (model/args), Command preview block,
  Copy and ▶ Run buttons _(R9, R10)_

- [ ] **T16** — Implement command preview auto-update in `RunAgentPanel`: recompute
  the preview string client-side whenever CLI, mode, task, or feature changes, using
  the same logic as the adapters (a simple client-side preview builder, not calling
  the extension) _(R10)_

- [ ] **T17** — Add `runningNodeIds: Set<string>` and `runPanelNodeId: string|null`
  state to `index.tsx`; handle `agentRunStarted`, `agentRunEnded`, `runAdapters`,
  `runHistory` in the message switch _(R12, R13)_

- [ ] **T18** — Add ▶ Run button to whiteboard node toolbar in `WhiteboardCanvas.tsx` or
  the node renderer: visible on hover/select for `subagent` and `agent` type nodes;
  calls `onRunNode(nodeId)` _(R8)_

- [ ] **T19** — Wire `onRunNode` → sets `runPanelNodeId` → renders `<RunAgentPanel>`
  as an absolutely positioned overlay (right side, 340 px) inside the whiteboard
  container in `index.tsx` _(R9)_

- [ ] **T20** — Add `harness-node--running` CSS class and `@keyframes runPulse` animation
  to the global styles block in `index.tsx`; apply class to nodes whose `id` is in
  `runningNodeIds` _(R12)_

- [ ] **T21** — Add "Last run" timestamp badge to node cards: read `runHistory` from
  state, find the most recent entry for each `nodeId`, show relative time in a small
  badge; update every 60 s via `setInterval` in a `useEffect` _(R15)_

- [ ] **T22** — Add "Runs" history button (clock icon) in the whiteboard toolbar;
  clicking it renders a `RunHistoryPanel` slide-in (reuse the panel pattern from
  `RunAgentPanel`) showing last 20 entries; clicking an entry calls
  `setRunPanelNodeId(entry.nodeId)` and pre-fills the task _(R16)_

---

## Phase 2 — Architecture Studio

### Group E: Agent Builder Wizard

- [ ] **T23** — Add `'createNodeFromWizard'` and `'generateAgentDescription'` and
  `'agentDescriptionResult'` to `WebviewMessageType` and `KNOWN_MESSAGE_TYPES` _(R17)_

- [ ] **T24** — Create `src/webview/AgentBuilderWizard.tsx` (~300 lines): multi-step
  modal with steps Type/Name → Role/Capabilities → Connections → Preview/Create;
  local `step` state, `Back` / `Next` / `Create` buttons, per-step validation _(R17, R18, R21)_

- [ ] **T25** — Implement Step 2 "✨ Generate with AI" in `AgentBuilderWizard`: post
  `generateAgentDescription` to extension, disable button while waiting, fill form
  fields from `agentDescriptionResult`; hide button entirely if no LM configured _(R20)_

- [ ] **T26** — Handle `generateAgentDescription` in `WhiteboardCoordinator` (or a
  new `StudioCoordinator`): call `generateText()` with a structured prompt, parse
  JSON response, post `agentDescriptionResult` _(R20)_

- [ ] **T27** — Implement Step 4 SUBAGENT.md preview in `AgentBuilderWizard`: render
  a `<pre>` block with the template populated by form values; allow direct editing
  of the preview text before Create _(R18)_

- [ ] **T28** — Handle `createNodeFromWizard` in `WhiteboardCoordinator`: create the
  subagent/skill via `_writer`, create edges for each `connectSkillIds`, call
  `sendData` and `scheduleScan` _(R18, R19)_

- [ ] **T29** — Replace the existing "Create node" button/modal in `WhiteboardCanvas`
  (or its toolbar) with a button that opens `<AgentBuilderWizard>`; wire
  `onCreateNode` to toggle wizard visibility _(R17)_

### Group F: Architecture Templates

- [ ] **T30** — Create `src/whiteboard/architectureTemplates.ts` with the four built-in
  templates: `solo-agent`, `agent-with-skills`, `coordinator-specialists`, `sdd-pipeline`;
  each with `TemplateNodeDef[]` and `TemplateEdgeDef[]` _(R23)_

- [ ] **T31** — Add `'getArchitectureTemplates'`, `'architectureTemplates'`,
  `'applyArchitectureTemplate'` to message types _(R22)_

- [ ] **T32** — Handle `getArchitectureTemplates` in `WhiteboardCoordinator`: return
  the template list (serialized, without file content) _(R22)_

- [ ] **T33** — Handle `applyArchitectureTemplate` in `WhiteboardCoordinator`: loop
  nodes in the template, skip duplicates, call `_writer.createSubagent()` or
  `createSkill()`, create edges, call `sendData` + `scheduleScan` _(R24, R25)_

- [ ] **T34** — Create `src/webview/ArchitectureTemplatePanel.tsx` (~150 lines):
  template picker panel with cards showing name, description, preview SVG, and
  node/edge count; "Apply" button triggers confirmation dialog _(R26)_

- [ ] **T35** — Add "Templates" (grid icon) button to whiteboard toolbar; clicking
  opens `<ArchitectureTemplatePanel>` as a slide-in _(R22)_

### Group G: Sync Utilities

- [ ] **T36** — Register `harness-dashboard.scaffoldMissing` command in `extension.ts`
  and `package.json`: reads `getCachedData()`, finds nodes without files, shows
  QuickPick, calls `ActionExecutor` for each selected node _(R27, R29)_

- [ ] **T37** — Register `harness-dashboard.syncFromFilesystem` command: scans
  `.agents/subagents/**` and `.agents/skills/**` via `vscode.workspace.findFiles()`,
  compares against existing node IDs, shows QuickPick diff, writes new entries to
  `agentic.json`, calls `_sendData()` + `scheduleScan()` _(R28, R29)_

- [ ] **T38** — Add ⚙ menu to whiteboard toolbar with "Scaffold missing files" and
  "Sync from filesystem" menu items that execute the VS Code commands _(R29)_

---

## Closure

- [ ] **T39** — Write Vitest tests:
  - `ClaudeCodeAdapter.buildCommand()` for interactive and one-shot modes
  - `GeminiCliAdapter.buildCommand()` with and without file path
  - `RunAdapterRegistry.detect()` with mocked `isAvailable()` responses
  - `RunCoordinator` history management (append, duration update, FIFO limit)

- [ ] **T40** — `npm test` all pass; `npm run build` zero errors; `./check.sh` green;
  update `feature_list.json` FEAT-033 to `"done"`; log summary in `progress/progress.md`
