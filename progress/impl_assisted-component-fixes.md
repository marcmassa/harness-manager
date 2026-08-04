# FEAT-035 — Assisted Component Fixes — Implementation Log

**Date:** 2026-08-04
**Release:** v0.8.0 (ships inside the same minor as FEAT-034, no version bump)
**Status:** Done — 53/53 tasks; smoke tested by the maintainer in Kiro and VS Code

---

## R↔T Traceability

| Requirement | Task(s) | Test | Outcome |
|---|---|---|---|
| R1 — two named modes | T12, T17 | — | `ai-refine` and `delegate` handled as separate coordinator cases |
| R2 — eligibility by confidence | T20, T26 | `OptimizerPanel.test.ts` | Promoted only when no `fix` **and** `confidence` ≠ `fact`; a `fact` finding with no fix is never promoted |
| R3 — delegation scope | T6, T22 | `delegateTask.test.ts` | `finding` / `component` / `rule` scopes; per-rule batch row, per-component button |
| R4 — no silent application | T11, T18 | — | Every write path ends in a modal; delegation confirms before launching |
| R5 — provider chain reuse | T12 | — | `createProviderChain([vscodeLmProvider, createOpenAiCompatibleProvider(o)], o)` |
| R6 — no API key on the primary path | T12 | manual (T34) | `vscode.lm` is first in the chain |
| R7 — model override | T15, T21 | `optimizerConfig.test.ts` | Panel selector; persisted under `harness-dashboard.optimizer.aiModel` |
| R8 — prompt content | T2, T4 | `aiRefine.test.ts` | Path, type, rule, title, detail, full content; asserted to contain no sibling path |
| R9 — response is content | T3, T4 | `aiRefine.test.ts` | Outer fence stripped (bare + tagged); inner fences preserved; empty rejected |
| R10 — reuse of the diff preview | T11, T12 | — | `_previewAndWrite()` shared with the deterministic fixes |
| R11 — frontmatter integrity | T3, T4 | `aiRefine.test.ts` | Dropped keys warn but still show the diff; added keys do not warn |
| R12 — timeout and concurrency | T13 | — | `Promise.race` at 30 s; `_refinesInFlight` refuses a second refine per finding |
| R13 — provider failure non-fatal | T14 | — | Reason posted and logged; deterministic fix stays available |
| R14 — adapter reuse and availability | T16, T17, T24, T26 | `OptimizerPanel.test.ts` | `RunAdapterRegistry.detect()`; the action is hidden, never disabled |
| R15 — task construction | T6, T7 | `delegateTask.test.ts` | Names every path and rule; constrains the agent to those files |
| R16 — working-tree warning | T17 | — | `git status --porcelain`; three states — clean / dirty / no-vcs — each with its own wording |
| R17 — honest labelling | T18 | — | Confirmation states that the agent writes directly with no diff preview |
| R18 — launch path | T18 | — | Integrated terminal via the adapter's `buildCommand` |
| R19 — post-delegation rescan | T19 | — | `onDidCloseTerminal` → `scheduleScan()` |
| R20 — batch cap | T6, T17 | `delegateTask.test.ts` | `componentCount` counts distinct components; >20 needs a second confirmation |
| R21 — per-finding actions | T20, T26 | `OptimizerPanel.test.ts` | Deterministic fix, then AI refine, then Delegate |
| R22 — model selector | T21 | — | Header `<select>` with an "Auto" entry from `getOptimizerAiModels` |
| R23 — batch controls | T22 | — | Per-component button; per-rule row grouped by rule ID |
| R24 — pending and result states | T23, T26 | `OptimizerPanel.test.ts` | Spinner text + disable for that finding only; transient ✓/✕ carrying the reason |
| R25 — settings | T10, T27 | `optimizerConfig.test.ts` | `assistedFixes.enabled`, `assistedFixes.mode` |
| R26 — kill switch | T10, T24, T26 | `OptimizerPanel.test.ts` | Both actions hidden; no provider contacted |
| R27 — message types | T8, T9 | `messageDiscriminator.test.ts` | Seven types in the union **and** `KNOWN_MESSAGE_TYPES` |
| R28 — privacy | T2, T4, T14 | `aiRefine.test.ts` | Prompt carries one component only; the served provider is reported back |

## Key files created

`src/optimizer/aiRefine.ts` (+ test), `src/optimizer/delegateTask.ts` (+ test),
`progress/impl_assisted-component-fixes.md`.

## Key files modified

`src/coordinators/OptimizerCoordinator.ts` (`_previewAndWrite`, `_aiRefine`,
`_delegate`, `_gitState`, `_buildScope`, `_reportMessage`),
`src/coordinators/optimizerConfig.ts`, `src/optimizer/types.ts`
(`assistedFixes`, `OptimizerFinding.confidence`),
`src/optimizer/optimizerEngine.ts` (stamps `confidence`),
`src/webview/OptimizerPanel.tsx`, `src/webview/index.tsx`, `src/types.ts`,
`src/extension.ts`, `package.json`, `README.md`, `CHANGELOG.md`, `DESIGN.md`.

## Deviations from the approved spec

1. **R2 was rewritten before implementation.** The approved text listed the two
   rule groups as hardcoded arrays of rule IDs. FEAT-034 subsequently shipped
   `RuleConfidence` as a declared property of every rule — the same distinction
   expressed structurally. R2 now keys off it, so a rule added later lands on the
   correct side with no edit and no list can go stale. Recorded in the spec's
   Context section.

2. **A seventh message type, `setOptimizerAiModel`, was added.** R7 requires the
   model selection to persist per workspace but the spec only named the *read*
   message (`getOptimizerAiModels`). Without a write message there was no way to
   store the choice.

3. **`_reportMessage()` centralises the report envelope.** The webview cannot read
   settings or detect CLIs, so `assistedEnabled`, `assistedMode` and
   `hasTerminalAgent` travel with the report. Building it in one place stops six
   literal call sites from drifting.

4. **R2 gained a clause the spec did not have.** A `fact`-tier finding with no
   mechanical fix does not promote AI Refine. That case is a gap in our own rule
   coverage, not a judgement call, and promoting a model there would disguise the
   gap.

5. **`DESIGN.md` principle 3 was amended.** It stated that an LLM may only propose
   content the user reviews. Delegation is a genuine exception — an external agent
   writes directly — so the principle now names that exception explicitly instead
   of leaving a reader to reconcile it.

6. **No version bump.** The spec targeted v0.9.0; the maintainer directed that this
   ships inside the existing 0.8.0 release. T28 records the decision.

## Defects found in smoke testing

The maintainer's smoke test surfaced four real bugs, three of them mine.

1. **AI Refine could never reach the editor's model.** `vscodeLmProvider` passes
   `options.model` to `vscode.lm.selectChatModels({ family })`. The coordinator
   was feeding it the OpenAI-compatible default (`gpt-4o-mini`), which is not a
   family Copilot or Kiro publishes, so the primary provider matched nothing and
   the chain fell through to an unconfigured HTTP fallback. Surfaced as "All
   providers failed: API key not configured" — hiding that a perfectly good
   editor model may have been available. Fixed by splitting the two namespaces in
   `buildRefineProviderOptions()`, extracted to the vscode-free module precisely
   so a test can pin it.

2. **The delegated task never reached the CLI.** `RunAdapter.buildCommand`
   defaults to `interactive: true`, and in that mode `ClaudeCodeAdapter` emits a
   bare `claude` and drops the task entirely — correct for FEAT-033, where the
   user reads the task in the Run panel, but fatal for delegation, where the task
   *is* the instruction. Fixed by passing `interactive: false`.

3. **The command raced the shell.** `sendText` immediately after
   `createTerminal()` is typed into a shell that is not listening yet and is
   swallowed. Fixed with `src/terminalUtils.ts#sendWhenShellReady`, which waits
   for the shell-integration signal where the API exists (1.93+) and falls back to
   a bounded delay on the declared `^1.85.0` engine.

4. **`OPT-D01` reported a populated directory as missing** — see the FEAT-034
   implementation log; the fix landed in the optimizer's loader and drift rule.

`RunCoordinator.ts:140` carried the same defect as (3) on the FEAT-033 run path.
It was fixed in the same change, sharing the new helper, and skips the wait for a
reused terminal so warm terminals pay no delay.

## Post-approval extension: chat handoff (R29–R39, T35–T48)

Two amendments after the gate, both driven by smoke testing rather than design.

### §F — hand off to the host's chat (R29–R33)

Smoke testing established that `vscode.lm` is not the universal contract this spec
assumed. Verified against the installed editors:

| Host | Finding | Evidence |
|---|---|---|
| Kiro | VS Code 1.94+ base, so the API exists, but its agent neither registers a model provider nor consumes one, and exposes no extension API (`api: null`) | 0 matches for `registerChatModelProvider` / `selectChatModels` in `kiro.kiro-agent/dist` |
| VS Code | `workbench.action.chat.open` takes `{ query, isPartialQuery }`; `isPartialQuery` prefills instead of sending | `workbench.desktop.main.js` |
| Antigravity | No chat command at all — its agent runs outside the extension host | 22 contributed commands, none chat-related |

The reframe: we never needed the host's *model*, only its *chat input*. The user is
already signed in with a model chosen. Host selection probes the live command list
rather than sniffing the product name, so an unknown fork degrades to "no action
offered" instead of throwing, and a fork that later adds a known command starts
working with no change.

| Requirement | Task(s) | Test | Outcome |
|---|---|---|---|
| R29 — third mode | T35, T37 | — | `handoff`, stated as strictly one-way |
| R30 — runtime probe | T35, T40 | `chatHandoff.test.ts` | Fork precedence; Antigravity yields no adapter |
| R31 — known hosts | T35, T40 | `chatHandoff.test.ts` | Payload shape per host pinned by test |
| R32 — prefill, never send | T37 | — | The prompt carries the file and bills the user's account |
| R33 — no credentials | T39 | — | Offered wherever a chat command exists |

### §G — the same handoff for spec generation (R34–R39)

The SDD panel's three AI paths hit the identical wall. **They do not carry the
model-selector defect** that broke AI Refine — they call `generateText(prompt, log)`
with no options, so the selector is empty and any model matches. They are correct
in VS Code with Copilot; only the absence of a model in the host is the problem.

| Requirement | Task(s) | Test | Outcome |
|---|---|---|---|
| R34 — reuse the registry | T41 | `chatHandoff.test.ts` | Promoted to `src/chatHandoff.ts`; no second detection path |
| R35 — prompt parity | T42, T43, T46 | `specPrompts.test.ts` | Both routes build from one pure module |
| R36 — capability probe | T44, T45 | — | Independently guarded; probed once on `ready` |
| R37 — offer what works | T45 | — | "Generate with AI" → "Ask &lt;host&gt;"; stays visible when nothing is available so its error can explain |
| R38 — prefill | T44 | — | Spec prompts can carry a whole template |
| R39 — message types | T44 | `messageDiscriminator.test.ts` | Three types, union **and** Set |

The risk in §G was never the button — it was the prompts. They were inline in
`SddCoordinator`, and the handoff had to rebuild them. Two copies would drift, and
the symptom (subtly different specs depending on which button the host allowed)
would be very hard to attribute. `src/sdd/specPrompts.ts` is the single origin, and
a determinism test holds it there. The 4096-character context cap and the
8192-character truncation were carried over verbatim: changing them would change
generated specs.

### Defect found in the second smoke round

**The Kiro payload was wrong and failed silently in the common case.** The first
implementation sent `{ prompt, clear: true }`, copied from a call site in Kiro's
bundle that pushes an MCP error into chat. Smoke testing showed the prompt only
landed when the chat input happened to be empty — `clear` does not replace an
in-progress draft in an existing session, and the handoff quietly did nothing when
it did not.

The correct shape is the one Kiro's **own** editor actions build
(`buildEditorActionPayload`): `{ prompt, reference, newSession: true, submit }`.
`newSession: true` is the operative part — it starts a fresh session instead of
competing with whatever the user was typing. `reference` is omitted because it
attaches an editor selection and our prompt already carries the component's full
text; `submit` is passed explicitly as `false` per R32/R38 rather than relying on
its default.

Pinned by three tests, including one asserting that no adapter sends `clear` at
all — the field reads as if it would help and does not.

### Process deviation

`./check.sh` caught the spec-generation work at `in_progress` with no spec files —
`requireSpec` working as designed. It had been started as a bug fix and was
briefly filed as a separate FEAT-036 before the maintainer directed that it belongs
inside this spec. FEAT-036 was withdrawn, its spec files deleted, and the work
folded in as §G / Group G.

## Verification

- `npm run build` — clean.
- `npx vitest run` — **681 passed**, 47 files (610 before this feature).
- `./check.sh` — all checks pass.

## Build hygiene found while packaging

`vsce package` revealed that `dist/` held two bundles no entry point produces:
`extension.js` (57 KB, 0.1.0 era) and `sddManager.js` (335 KB, entry point removed
months ago). `dist/` is gitignored, so nothing would ever have flagged them, and
`vsce` sweeps the whole directory — 0.8.0 was about to ship ~390 KB of code that
never executes.

`esbuild.js` now prunes anything in `dist/` that is not a declared output before
building, so a removed entry point cannot leave a passenger behind again.

**Related finding, not acted on.** `SDDManagerProvider` (`sddManagerProvider.ts`
lines 396–593, ~198 lines) is dead: its view `harness-dashboard.sddManager` is not
contributed in `package.json` and the class is never instantiated. It is the only
thing that referenced `dist/sddManager.js`, i.e. it declared a runtime dependency
on a bundle the build stopped producing — a latent break for anyone rebuilding
from clean. It survives solely because its own unit tests import it. Removing the
class and those tests is recommended but was left alone: deleting tested
production code is a wider decision than the packaging cleanup that surfaced it.

## Open items

- **Screenshots** for the two new surfaces are outstanding and tracked in
  `progress/backlog.md`. The README rows are commented out, so nothing renders
  broken. Capture is blocked on macOS Screen Recording permission in the build
  environment, not on the feature.
