# FEAT-035 — Assisted Component Fixes

> **Feature ID:** FEAT-035
> **Feature Name:** assisted-component-fixes
> **Type:** feat
> **Priority:** P1
> **Sprint:** Next
> **Release:** v0.8.0 (ships within the same minor as FEAT-034)
> **Agent:** typescript-implementer
> **Depends on:** FEAT-034 (Component Optimizer)

---

## Context

FEAT-034 ships 17 deterministic rules and five deterministic quick fixes. The audit that followed it established a distinction that shapes this feature:

- **`fact`-tier rules** verify something checkable and already have mechanical fixes. `name` is missing → write `name`. There is no judgement to exercise and no reason to involve a model.
- **`heuristic`- and `opinion`-tier rules** frequently have no mechanical fix at all. "This skill is 1 991 tokens" has no arithmetic answer: someone must decide *what* to extract and how to rewrite what remains. Today those findings are reported and then abandoned.

**Reconciled with what FEAT-034 actually shipped.** This spec was drafted before
FEAT-034's calibration amendments (see that spec's §H). It originally named the
two groups as hardcoded lists of rule IDs. FEAT-034 shipped `RuleConfidence`
(`fact` / `heuristic` / `opinion`) as a declared property of every rule, which is
the same distinction expressed structurally — so this feature keys off that
instead. A rule added later lands on the correct side with no edit here, and no
list can go stale.

This feature closes that gap with two clearly separated modes, using infrastructure the repo already has. **No new npm dependency.**

| Mode | Reuses | Shape |
|---|---|---|
| **AI Refine** | `src/lmUtils.ts` provider chain | Request/response. Returns proposed content into FEAT-034's existing diff-preview flow. |
| **Delegate to Agent** | `src/run/` RunAdapter registry | Autonomous. A terminal CLI edits the working tree directly. |

### The guarantee, stated precisely

FEAT-034 R32 guarantees that nothing reaches disk before the user confirms a diff. **AI Refine preserves that guarantee exactly** — it produces content and hands it to the same code path. **Delegation cannot preserve it**, because an agentic CLI edits files itself and returns no content to us. That is not a defect to paper over; it is a different contract, and this spec requires it to be presented as such.

### Non-goals

- No change to any FEAT-034 rule, threshold, score or weight.
- No LLM in detection or scoring — that stance from FEAT-034 is unchanged. A model may only ever propose content the user reviews.
- No new npm dependency, no bundled model, no telemetry.
- No automatic application of an AI proposal. There is no "fix everything silently" path in either mode.

---

## EARS Patterns

| Pattern | Syntax | When to use |
|--------|----------|---------------|
| **Ubiquitous** | `SHALL ...` | Always true |
| **Event** | `WHEN <event> SHALL ...` | Triggered by an event |
| **State** | `WHILE <state> SHALL ...` | While a condition holds |
| **Optional** | `WHERE <option> SHALL ...` | Varies by configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Failures and edge cases |

---

## A — Mode selection and eligibility

### R1 — Two named modes
- **Pattern:** Ubiquitous
- The optimizer SHALL offer exactly two assisted modes: `ai-refine` (in-editor language model) and `delegate` (terminal CLI agent).

### R2 — Eligibility by rule confidence
- **Pattern:** Ubiquitous
- `ai-refine` SHALL be offered on any finding, and SHALL be surfaced as the primary action only where the finding carries no deterministic `fix` **and** its `confidence` is `heuristic` or `opinion`.
- WHERE a finding already carries a deterministic `fix`, that fix SHALL remain the primary action and `ai-refine` SHALL be secondary.
- WHERE a finding's `confidence` is `fact` and it carries no fix, `ai-refine` SHALL remain available but SHALL NOT be promoted: a verifiable defect with no mechanical fix is a reporting gap, not a judgement call.
- The engine SHALL stamp `confidence` onto every finding so this decision needs no access to the rule registry.

### R3 — Delegation scope
- **Pattern:** Ubiquitous
- `delegate` SHALL be offered for a single finding, for all findings on one component, and for all findings sharing one rule ID across components (batch).

### R4 — No silent application
- **Pattern:** Ubiquitous
- Neither mode SHALL write a file without an explicit user action taken after the proposed change (or the delegation target) has been shown.

---

## B — AI Refine

### R5 — Provider chain reuse
- **Pattern:** Ubiquitous
- `ai-refine` SHALL obtain text through `createProviderChain([vscodeLmProvider, createOpenAiCompatibleProvider(opts)], opts)` from `src/lmUtils.ts`, so `vscode.lm` (Copilot, Kiro, or whatever the host editor provides) is tried before any configured HTTP endpoint.

### R6 — No API key required for the primary path
- **Pattern:** Ubiquitous
- WHEN a `vscode.lm` chat model is available, `ai-refine` SHALL function with no API key and no HTTP request.

### R7 — Model override
- **Pattern:** Optional
- WHERE the user has selected a model in the Optimizer panel, that family SHALL be passed as `AiProviderOptions.model`, overriding `harness-dashboard.ai.model`.
- The model list SHALL be obtained through the existing `getLmModels` message.
- The selection SHALL persist per workspace under `harness-dashboard.optimizer.aiModel`.

### R8 — Prompt content
- **Pattern:** Ubiquitous
- The prompt SHALL include: the component's full current content, its node type, the finding's `ruleId`, `title` and `detail`, and an instruction to return the complete corrected file.
- The prompt SHALL NOT include any other component's content, and SHALL NOT include workspace paths outside the component's own `filePath`.

### R9 — Response is content, not instructions
- **Pattern:** Ubiquitous
- The provider response SHALL be treated as the proposed full file content, after stripping a single leading/trailing markdown code fence when present.
- IF the response is empty after stripping, THEN the refine SHALL fail with a reason and nothing SHALL be written.

### R10 — Reuse of the diff preview
- **Pattern:** Event
- WHEN a refine produces content, the extension SHALL stage it through the existing `OptimizerDiffProvider` on the `harness-optimizer` scheme and open a native diff, followed by the same modal confirmation used by deterministic fixes.
- The write SHALL go through `HarnessWriter.writeFileAtPath` and SHALL then call `scheduleScan()`.

### R11 — Frontmatter integrity check
- **Pattern:** Unwanted
- IF the proposed content fails to parse as frontmatter + body, or drops a `name` field the original had, THEN the extension SHALL still show the diff but SHALL prepend a warning to the confirmation modal naming what was lost.
- The user SHALL remain able to accept it; the check informs, it does not block.

### R12 — Timeout and cancellation
- **Pattern:** Unwanted
- IF a refine has not returned within 30 seconds, THEN it SHALL be abandoned, a `quickFixResult` with `ok:false` SHALL be posted, and nothing SHALL be written.
- WHILE a refine is in flight, the panel SHALL show a per-finding pending state and SHALL prevent a second concurrent refine on the same finding.

### R13 — Provider failure is non-fatal
- **Pattern:** Unwanted
- IF every provider in the chain fails, THEN the reason SHALL be surfaced in the panel and logged to the output channel, and the deterministic fix (where one exists) SHALL remain available.

---

## C — Delegate to Agent

### R14 — Adapter reuse and availability
- **Pattern:** Ubiquitous
- `delegate` SHALL list targets from the existing `RunAdapterRegistry.detect()`, so only CLIs actually installed on the machine are offered.
- IF no terminal adapter is available, THEN the delegate action SHALL be hidden rather than shown disabled.

### R15 — Task construction
- **Pattern:** Ubiquitous
- The delegated task text SHALL name the target file path(s), the rule ID(s), and the finding detail(s), and SHALL instruct the agent to change only those files.

### R16 — Working-tree warning
- **Pattern:** Unwanted
- IF the git working tree has uncommitted changes when a delegation is requested, THEN the extension SHALL warn — naming that the agent edits files directly and that git is the only way back — and SHALL require explicit confirmation before launching.
- WHERE the workspace is not a git repository, the warning SHALL state that no version-control safety net was detected.

### R17 — Honest labelling of the contract
- **Pattern:** Ubiquitous
- The delegate action's confirmation SHALL state that the agent writes to the working tree directly and that no diff preview is shown.
- The UI SHALL NOT present `delegate` and `ai-refine` as interchangeable backends of one action.

### R18 — Launch path
- **Pattern:** Event
- WHEN a delegation is confirmed, the extension SHALL launch the adapter through the existing `RunCoordinator` terminal path and SHALL record it in the existing run history.

### R19 — Post-delegation rescan
- **Pattern:** Event
- WHEN a delegated terminal exits, the extension SHALL trigger `scheduleScan()` so the optimizer report reflects whatever the agent changed.

### R20 — Batch scope cap
- **Pattern:** Unwanted
- IF a batch delegation would target more than 20 components, THEN the extension SHALL require a second confirmation stating the exact count.

---

## D — Panel surface

### R21 — Per-finding actions
- **Pattern:** Ubiquitous
- Each finding row SHALL show, in this order: its deterministic fix (when present), "AI refine", and "Delegate".

### R22 — Model selector
- **Pattern:** Ubiquitous
- The Optimizer panel header SHALL include a model selector populated from `getLmModels`, with an "Auto" entry that uses the unmodified provider chain.

### R23 — Batch controls
- **Pattern:** Ubiquitous
- The panel SHALL offer "Delegate all findings for this component" on a component row and "Delegate all N findings for this rule" grouped by rule ID.

### R24 — Pending and result states
- **Pattern:** State
- WHILE a refine is pending, its finding row SHALL show a spinner and disable both assisted actions for that finding.
- WHEN a refine or delegation resolves, the row SHALL show a transient success or failure indicator carrying the failure reason.

---

## E — Configuration and safety

### R25 — Settings
- **Pattern:** Optional
- `package.json#contributes.configuration` SHALL declare `harness-dashboard.optimizer.assistedFixes.enabled` (boolean, default `true`) and `harness-dashboard.optimizer.assistedFixes.mode` (enum `both` | `ai-only` | `delegate-only`, default `both`).

### R26 — Kill switch
- **Pattern:** Optional
- WHERE `assistedFixes.enabled` is `false`, neither assisted action SHALL render and no provider SHALL be contacted.

### R27 — Message types
- **Pattern:** Ubiquitous
- These SHALL be added to `WebviewMessageType` and `KNOWN_MESSAGE_TYPES`: `aiRefineFinding`, `aiRefineResult`, `delegateFinding`, `delegateResult`, `getOptimizerAiModels`, `optimizerAiModels`.

### R28 — No content leaves the machine without a configured endpoint
- **Pattern:** Ubiquitous
- WHERE only `vscode.lm` is used, no component content SHALL be sent over HTTP by this extension.
- WHERE the OpenAI-compatible fallback is reached, the panel SHALL indicate which provider served the response.

---

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| Judgement findings become actionable, not just reported | R1, R2, R5, R10 |
| The editor's own subscription is used, no API key needed | R5, R6, R7, R22 |
| AI proposals keep FEAT-034's preview guarantee | R4, R10, R11 |
| Delegation is offered where autonomy actually helps | R3, R14, R15, R23 |
| Delegation's weaker contract is stated, not hidden | R16, R17, R20 |
| Failures never corrupt a file or block the deterministic path | R9, R11, R12, R13 |
| The feature is configurable and fully switchable off | R25, R26 |
| Privacy is explicit about when content leaves the machine | R8, R28 |

---

## F — Post-approval amendment: hand off to the host's chat (R29–R32)

Added after smoke testing established that `vscode.lm` is not the universal
contract this spec assumed. Verified against the installed editors: Kiro runs on
VS Code 1.94+ so the API *exists*, but its bundled agent neither registers a
chat-model provider nor consumes `selectChatModels`, and exposes no extension
API — AI Refine cannot work there at any configuration short of the user
supplying their own API key.

The observation that drives this: we do not actually need the host's *model*. The
user is already signed in, with a model chosen in the host's own UI. We need its
**chat input**.

### R29 — Third assisted mode
- **Pattern:** Ubiquitous
- A third mode, `handoff`, SHALL place the refine prompt into the host editor's
  own chat input.
- Its contract SHALL be stated as strictly one-way: nothing is returned, nothing
  is previewed, and no file is written by this extension.

### R30 — Host detection by runtime probe
- **Pattern:** Ubiquitous
- The available adapter SHALL be chosen by probing `vscode.commands.getCommands()`
  for a known command id, never by inspecting the product name.
- IF no known command is present, THEN the action SHALL be hidden rather than
  failing — an unrecognised fork degrades silently.
- WHERE a fork registers both its native command and the generic VS Code chat
  action, the fork's own command SHALL win, because that is the agent the user is
  signed in to.

### R31 — Known hosts
- **Pattern:** Ubiquitous
- `kiroAgent.focusChatInput` with `{ prompt, clear }` SHALL be used for Kiro.
- `workbench.action.chat.open` with `{ query, isPartialQuery }` SHALL be used for
  VS Code and forks exposing it.
- Payload construction SHALL be a pure function, so each host's shape is pinned by
  a test rather than discovered in production.

### R32 — Prefill, never auto-send
- **Pattern:** Ubiquitous
- The prompt SHALL be prefilled into the chat input rather than submitted.
- The prompt carries the component's full contents and is billed to the user's own
  account, so they SHALL see it before it is sent.

### R33 — Availability independent of credentials
- **Pattern:** Ubiquitous
- `handoff` SHALL be offered wherever a chat command exists, including editors
  where AI Refine cannot function, and SHALL require no API key.

---

## G — Post-approval amendment: the same handoff for spec generation (R34–R39)

The SDD panel has three AI paths — `generateWithAI`, `generateSpecDraft` and
`generateFeatureDescription` — all routing through the same `lmUtils` chain. They
fail in a host with no `vscode.lm` model for exactly the reason §F documents, so
they get the same escape hatch rather than a parallel solution.

**These paths do not carry the model-selector defect** that broke AI Refine: they
call `generateText(prompt, log)` with no options, so the selector is empty and any
available model matches. They are correct in VS Code with Copilot. Only the
absence of a model in the host is the problem.

### R34 — Handoff for the spec surface
- **Pattern:** Ubiquitous
- The three SDD generation paths SHALL each be able to hand their prompt to the
  host editor's chat, reusing the `ChatHandoffAdapter` registry rather than
  introducing a second host-detection mechanism.
- The registry SHALL live at `src/chatHandoff.ts` now that two domains depend on it.

### R35 — Prompt parity between routes
- **Pattern:** Ubiquitous
- The prompt sent by a handoff SHALL be byte-identical to the prompt the direct
  call would have sent for the same inputs.
- Prompt construction SHALL live in a pure module shared by both routes, so parity
  holds by construction rather than by discipline.
- Existing prompt text, the 4096-character cap on prior context and the
  8192-character truncation SHALL be carried over unchanged: altering them would
  change generated specs and is out of scope.

### R36 — Host capability probe
- **Pattern:** Event
- WHEN the webview sends `getAiCapabilities`, the extension SHALL reply with
  `hasEditorModel`, `chatHostName` and `hasApiKey`.
- Each probe SHALL be independently guarded; a throwing probe SHALL report its
  capability as absent rather than surfacing an error.
- The webview SHALL request this once during its startup handshake, not per
  interaction.

### R37 — Offer only what the host can do
- **Pattern:** Optional
- WHERE the host exposes neither a model nor a configured API key, "Generate with
  AI" SHALL be replaced by "Ask &lt;host&gt;" if a chat command exists.
- IF none of the three is available, THEN "Generate with AI" SHALL remain visible
  so its failure message can explain the situation — a control that vanishes
  explains nothing.

### R38 — Prefill, never submit
- **Pattern:** Ubiquitous
- A spec prompt can carry a whole template plus prior approved content and bills
  the user's own account, so it SHALL be prefilled and never auto-submitted.

### R39 — Message types
- **Pattern:** Ubiquitous
- `getAiCapabilities`, `aiCapabilities` and `handoffSpecPrompt` SHALL be added to
  the union **and** to `KNOWN_MESSAGE_TYPES`.
- `handoffSpecPrompt` SHALL discriminate the three prompt shapes by a `kind` field
  and SHALL reuse `handoffResult` for its reply.
