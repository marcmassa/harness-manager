# Tasks — Assisted Component Fixes

> Discrete steps in implementation order. Mark `[x]` on completion.
> Each task references the R<n> it covers.
> Groups A–B are pure modules with no `vscode` import. C wires the host,
> D surfaces it, E closes the release.

---

## Group A — AI Refine core (pure)

- [x] **T1** — Create `src/optimizer/aiRefine.ts` with `RefinePromptInput`, `buildRefinePrompt()` and the `NormalizedRefine` type per `design.md` §A _(R8, R9)_

- [x] **T2** — Implement `buildRefinePrompt()` using the prompt shape in `design.md` §D: file path, node type, rule ID, title, detail, full current content, and the "return the complete file" instruction. Include no other component's content _(R8, R28)_

- [x] **T3** — Implement `normalizeRefineResponse()`: strip a single leading/trailing markdown fence (bare and language-tagged), reject empty-after-strip with a reason, and compare frontmatter against the original to produce non-blocking `warnings` for dropped fields _(R9, R11)_

- [x] **T4** — Write `src/optimizer/aiRefine.test.ts`: prompt determinism and required content; prompt excludes sibling content; fence stripping across four shapes; empty rejected; dropped `name` yields `ok:true` **with** a warning _(R8, R9, R11, R28)_

---

## Group B — Delegation core (pure)

- [x] **T5** — Create `src/optimizer/delegateTask.ts` with `DelegateScope`, `DelegateTask` and `buildDelegateTask()` per `design.md` §B _(R15)_

- [x] **T6** — Implement `buildDelegateTask()` for all three scopes (`finding`, `component`, `rule`), naming every target path and rule ID and instructing the agent to change only those files; compute `componentCount` from distinct node IDs _(R15, R20)_

- [x] **T7** — Write `src/optimizer/delegateTask.test.ts`: each scope names its paths and rule IDs; `componentCount` counts distinct components, not findings; duplicate paths appear once _(R15, R20)_

---

## Group C — Host wiring

- [x] **T8** — Add `aiRefineFinding`, `aiRefineResult`, `delegateFinding`, `delegateResult`, `getOptimizerAiModels`, `optimizerAiModels` to the `WebviewMessageType` union **and** `KNOWN_MESSAGE_TYPES` in `src/types.ts` _(R27)_

- [x] **T9** — Extend `src/messageDiscriminator.test.ts` for the six new types _(R27)_

- [x] **T10** — Add `assistedFixes.enabled` (boolean, `true`) and `assistedFixes.mode` (enum `both`|`ai-only`|`delegate-only`, `both`) to `readOptimizerConfig()` in `src/coordinators/optimizerConfig.ts`, and extend `optimizerConfig.test.ts` _(R25, R26)_

- [x] **T11** — Extract FEAT-034's `_applyQuickFix` tail into a shared `_previewAndWrite(source, content, title, warnings)` on `OptimizerCoordinator`: stage → `vscode.diff` → modal (prepending warnings when present) → `HarnessWriter.writeFileAtPath` → `scheduleScan()` → clear. Re-point the existing deterministic fix path at it so the two cannot drift _(R10, R11)_

- [x] **T12** — Add the `aiRefineFinding` case: guard on `assistedFixes.enabled` and `mode`, build the prompt, call `createProviderChain([vscodeLmProvider, createOpenAiCompatibleProvider(o)], o)` with `o.model` from the panel selection, normalize, then call `_previewAndWrite` _(R5, R7, R10, R26)_

- [x] **T13** — Add the 30 s timeout via `Promise.race`, plus per-finding in-flight tracking that rejects a second concurrent refine on the same finding _(R12)_

- [x] **T14** — Post `aiRefineResult { ok, reason?, provider }` on every path including timeout, cancel and total provider failure; log failures to the output channel; leave the deterministic fix available _(R12, R13, R28)_

- [x] **T15** — Add `getOptimizerAiModels`: return `vscode.lm.selectChatModels()` families plus an "Auto" entry; persist the selection under `harness-dashboard.optimizer.aiModel` in `workspaceState` _(R7, R22)_

- [x] **T16** — Pass the existing `RunAdapterRegistry` into `OptimizerCoordinator` from `extension.ts` _(R14)_

- [x] **T17** — Add the `delegateFinding` case: `registry.detect()`, `buildDelegateTask(scope)`, the >20-component second confirmation, and the git working-tree check via `git status --porcelain` (missing binary or non-zero exit → "no version control detected", never an error) _(R14, R16, R20)_

- [x] **T18** — Add the delegation confirmation modal stating that the agent writes to the working tree directly and that no diff preview is shown; launch through `RunCoordinator`'s terminal path and record it in the existing run history _(R17, R18)_

- [x] **T19** — Trigger `scheduleScan()` when a delegated terminal exits _(R19)_

---

## Group D — Panel surface

- [x] **T20** — Add "AI refine" and "Delegate" buttons to each finding row in `src/webview/OptimizerPanel.tsx`, ordered after the deterministic fix, using the `btnPrimary` / `btnSubtle` styles already defined there. Where a deterministic fix exists it stays primary and AI refine renders subtle _(R2, R21)_

- [x] **T21** — Add the header model selector populated from `getOptimizerAiModels`, with "Auto" as the default entry _(R22)_

- [x] **T22** — Add batch controls: "Delegate all findings for this component" on the component row, and a per-rule "Delegate all N findings" grouping _(R3, R23)_

- [x] **T23** — Add per-finding pending state (spinner, both assisted actions disabled for that finding) and transient success/failure indicators carrying the reason _(R24)_

- [x] **T24** — Hide both assisted actions entirely when `assistedFixes.enabled` is false, and hide "Delegate" when no terminal adapter is available _(R14, R26)_

- [x] **T25** — Add refine/delegate handlers and the six message cases to `src/webview/index.tsx` _(R27)_

- [x] **T26** — Extend `src/webview/OptimizerPanel.test.ts`: action ordering per R21; pending state disables both assisted actions for that finding only _(R21, R24)_

---

## Group E — Release

- [x] **T27** — Contribute the two `assistedFixes` settings in `package.json#contributes.configuration` _(R25)_

- [x] **T28** — No version bump: FEAT-035 ships inside the existing `0.8.0` release alongside FEAT-034 _(release)_

- [x] **T29** — Extend the existing `[0.8.0]` CHANGELOG entry and the README "What's new in 0.8.0" section, stating plainly that AI Refine keeps the preview guarantee and delegation does not _(R17, governance)_

- [x] **T30** — Add the `src/optimizer/` AI-assist row to `DESIGN.md` §4 and confirm §2 principle 3 still reads correctly (a model proposes; it never scores) _(governance)_

- [x] **T31** — Confirm `progress/backlog.md` carries no duplicate of this feature. (The original P2 follow-up item was removed when FEAT-034 closed: `check.sh` forbids the backlog from referencing a `done` feature, and this spec supersedes that item.) _(governance)_

- [x] **T32** — Write `progress/impl_assisted-component-fixes.md` with the `R<n> → test` map _(governance)_

- [x] **T33** — Run `npm run build`, `npx vitest run` and `./check.sh`; all green before flipping FEAT-035 to `done` _(gate)_

- [x] **T34** — Manual smoke test: refine with only `vscode.lm` and no API key (R6); diff appears and cancel writes nothing (R10); timeout path (R12); dirty-tree warning (R16); delegation modal wording (R17); rescan after terminal close (R19) _(R6, R10, R12, R16, R17, R19)_

---

## Group F — Post-approval: chat handoff (R29–R33)

- [x] **T35** — Add `src/optimizer/chatHandoff.ts`: `ChatHandoffAdapter`, the Kiro and VS Code entries with verified payload shapes, and `selectChatAdapter()` probing the live command list _(R30, R31)_

- [x] **T36** — Add `handoffToChat` / `handoffResult` message types to the union **and** `KNOWN_MESSAGE_TYPES` _(R29)_

- [x] **T37** — Add `_handoffToChat()` and `_chatAdapter()` to `OptimizerCoordinator`; prefill rather than submit _(R29, R32)_

- [x] **T38** — Carry `chatHostName` on the report envelope so the panel can label the action with the actual host _(R30)_

- [x] **T39** — Add the "Ask <host>…" button, shown only where a chat command exists and independent of API-key configuration _(R33)_

- [x] **T40** — Write `src/optimizer/chatHandoff.test.ts`: probing, fork-precedence, per-host payload shapes, and the Antigravity case (no chat command → no action) _(R30, R31)_

---

## Group G — Post-approval: spec-generation handoff (R34–R39)

- [x] **T41** — Move `chatHandoff.ts` and its test from `src/optimizer/` to `src/`; update the optimizer's import _(R34)_

- [x] **T42** — Create `src/sdd/specPrompts.ts` with `buildSpecDraftPrompt` and `buildFeatureDescriptionPrompt`, carrying the caps and truncation over verbatim; repoint the coordinator's direct paths at them _(R35)_

- [x] **T43** — Add `_buildGenerateWithAiPromptFor()` / `_buildSpecDraftPromptFor()` so the handoff reproduces each prompt exactly _(R35)_

- [x] **T44** — Add `getAiCapabilities` and `handoffSpecPrompt` cases plus the three message types in the union **and** the Set _(R36, R38, R39)_

- [x] **T45** — Extend `AiAssistBar` with the "Ask &lt;host&gt;" affordance and plumb capabilities through `index.tsx` → `FeatureSpecPanel` → `SpecEditor`; probe once on `ready` _(R36, R37)_

- [x] **T46** — Write `src/sdd/specPrompts.test.ts`: determinism, the four description shapes, metadata only when a feature is known, the 4096 context cap, the truncation marker _(R35)_

- [x] **T47** — Extend the `[0.8.0]` CHANGELOG entry and the README for the spec-generation fallback _(governance)_

- [x] **T48** — Manual smoke test in Kiro: "Generate with AI" is replaced by "Ask Kiro" (R37); the prompt arrives prefilled and unsent (R38) _(R37, R38)_

- [x] **T50** — Extract the handoff into reusable halves: `src/chatHandoffHost.ts` (`sendPromptToHostChat`, `detectChatHost`) for the host side and `src/webview/components/AskHostButton.tsx` for the UI, so both panels and any future caller share one implementation _(R34)_

- [x] **T51** — Fix the Kiro payload to `{ prompt, newSession, submit }`, mirroring `buildEditorActionPayload` in Kiro's own bundle; `clear` does not replace an in-progress draft _(R31)_

- [x] **T52** — Hide AI Refine in the optimizer when neither an editor model nor an API key is available, matching the SDD panel, and promote the handoff in its place _(R37)_

- [x] **T53** — Rework the button styles: shared geometry, filled secondary background. The hairline-outline version read as text rather than as a control _(R21)_

- [x] **T49** — Screenshot capture moved to the backlog as documented debt: the two README rows are commented out so nothing renders broken, and capture is blocked on macOS Screen Recording permission for the build environment. Tracked in `progress/backlog.md` _(governance)_
