# Tasks — FEAT-032: Advisory Suggestion Actions

> Groups A–D match requirement groups. Mark `[x]` on completion.

---

## Group A — Types & ActionExecutor

- [ ] **T1** — Add `ActionType` union and `SuggestionAction` interface to `src/agentic-detector/types.ts`; add optional `actions?: SuggestionAction[]` to `Suggestion` interface _(R1, R2)_

- [ ] **T2** — Create `src/agentic-detector/actionExecutor.ts` with `ActionExecutor` class implementing all six `ActionType` handlers; include `SUBAGENT_TEMPLATE` and `SKILL_TEMPLATE` string constants _(R3–R8, R19)_

- [ ] **T3** — Add `'executeAdvisoryAction'` and `'advisoryActionResult'` to `WebviewMessageType` union and `KNOWN_MESSAGE_TYPES` Set in `src/types.ts` _(R15, R16, R20)_

---

## Group B — Extension Wiring

- [ ] **T4** — In `AdvisoryCoordinator`: add private `_actionExecutor?: ActionExecutor` field; update `setAgenticDetector()` to instantiate `ActionExecutor` _(R17, R18)_

- [ ] **T5** — In `AdvisoryCoordinator.handle()`: add `case 'executeAdvisoryAction'` — resolves the `SuggestionAction` from the cached profile, delegates to `_actionExecutor.execute()`, posts `advisoryActionResult` _(R17, R19, R20)_

- [ ] **T6** — In `src/extension.ts`: pass `_workspaceRoot` (or the existing `root` URI) to `AdvisoryCoordinator` constructor so `ActionExecutor` can resolve paths — update constructor signature accordingly _(R17)_

---

## Group C — Advisory Panel UI

- [ ] **T7** — Add `actionStates: Record<string, 'idle'|'running'|'success'|'error'>` state to `AdvisoryPanel`; add `onExecuteAction: (suggestionId, actionId) => void` and `actionStates` props _(R11, R12, R13)_

- [ ] **T8** — Implement `ActionButton` component inside `AdvisoryPanel.tsx`; render a flex-wrap row of `ActionButton`s below each suggestion's description when `suggestion.actions` is non-empty _(R9, R10, R14)_

- [ ] **T9** — In `index.tsx`: add `handleExecuteAction` callback that sets the button to `'running'`, posts `executeAdvisoryAction`, and listens for `advisoryActionResult` to set `'success'` or `'error'`; pass callback and states to `<AdvisoryPanel>` _(R15, R20)_

- [ ] **T10** — Add `case 'advisoryActionResult'` to the message switch in `index.tsx` _(R20)_

---

## Group D — Initial Rule Actions (R21)

- [ ] **T11** — Add actions to `organize-prompts` rule: `create-directory prompts/` + `create-file prompts/system.md` _(R21)_

- [ ] **T12** — Add action to `no-signals-detected` rule: `scaffold-agent main-agent` _(R21)_

- [ ] **T13** — Add actions to `add-claude-md` and `add-agent-readme` rules: `create-file CLAUDE.md` / `create-file AGENTS.md` with starter templates _(R21)_

- [ ] **T14** — Add action to `agents-without-skills` (S-GC01): `scaffold-skill my-first-skill` _(R21)_

---

## Closure

- [ ] **T15** — Write Vitest tests for `ActionExecutor`: mock `vscode.workspace.fs` and assert correct file creation for each `ActionType`; test error propagation returns `{ ok: false }` without throwing

- [ ] **T16** — `npm test` all pass; `npm run build` zero errors; update `feature_list.json` FEAT-032 to `"done"`; log in `progress/progress.md`
