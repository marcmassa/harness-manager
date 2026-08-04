# FEAT-035 — Assisted Component Fixes — Design

---

## Summary

Two assisted modes bolt onto FEAT-034's finding rows. Both reuse infrastructure that already ships; neither adds an npm dependency.

```
                        OptimizerPanel finding row
                                  │
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
   deterministic fix         AI Refine             Delegate
   (FEAT-034, unchanged)         │                     │
             │                   │                     │
             │        lmUtils.createProviderChain      RunAdapterRegistry.detect()
             │        vscode.lm → OpenAI-compat        claude-code │ gemini-cli
             │                   │                     │
             │            proposed content       git-dirty warning + confirm
             │                   │                     │
             └───────────────────┤                     ▼
                                 ▼             RunCoordinator → integrated terminal
                   OptimizerDiffProvider.stage()        │
                   vscode.diff + modal confirm     agent edits working tree
                   HarnessWriter.writeFileAtPath()      │
                                 │                      │
                                 └──── scheduleScan() ──┘
```

The left two paths converge on **exactly the same write code** as FEAT-034. The right path deliberately does not, and the UI says so.

---

## Affected Files

| File | Action | Reason |
|---|---|---|
| `src/optimizer/aiRefine.ts` | **new** | Pure prompt construction + response normalization (R8, R9) |
| `src/optimizer/aiRefine.test.ts` | **new** | Prompt content, fence stripping, frontmatter integrity (R8, R9, R11) |
| `src/optimizer/delegateTask.ts` | **new** | Pure task-text construction for single/component/batch scopes (R15) |
| `src/optimizer/delegateTask.test.ts` | **new** | Task text names files and rules; batch grouping (R15, R20) |
| `src/coordinators/OptimizerCoordinator.ts` | modify | Six new message cases; refine and delegate flows (R10, R12, R18) |
| `src/coordinators/optimizerConfig.ts` | modify | `assistedFixes.enabled` / `.mode` readers (R25) |
| `src/webview/OptimizerPanel.tsx` | modify | Per-finding actions, model selector, batch controls, pending states (R21–R24) |
| `src/webview/index.tsx` | modify | New message handling; refine/delegate handlers |
| `src/types.ts` | modify | Six message types in union **and** `KNOWN_MESSAGE_TYPES` (R27) |
| `src/extension.ts` | modify | Pass `RunAdapterRegistry` into `OptimizerCoordinator` |
| `package.json` | modify | Two settings (version unchanged — ships inside 0.8.0) |
| `src/chatHandoff.ts` | **new, then moved to `src/`** | Host chat registry; promoted out of `src/optimizer/` once the SDD panel also needed it (R34) |
| `src/sdd/specPrompts.ts` | **new** | Pure prompt builders shared by the direct and handoff routes (R35) |
| `src/coordinators/SddCoordinator.ts` | modify | `getAiCapabilities`, `handoffSpecPrompt`, prompt building extracted out |
| `src/webview/AiAssistBar.tsx` | modify | "Ask &lt;host&gt;" affordance (R37) |
| `src/webview/SpecEditor.tsx`, `FeatureSpecPanel.tsx` | modify | Capability plumbing |

**Unchanged on purpose:** every file under `src/optimizer/rules/`, `scorer.ts`, `optimizerEngine.ts`. This feature adds no rule and changes no score.

---

## Signatures and Structures

### A — `src/optimizer/aiRefine.ts` (pure, no `vscode`)

```ts
export interface RefinePromptInput {
    source: ComponentSource;
    finding: OptimizerFinding;
}

/** R8 — deterministic prompt. Same input always yields the same string. */
export function buildRefinePrompt(input: RefinePromptInput): string;

export type NormalizedRefine =
    | { ok: true; content: string; warnings: string[] }
    | { ok: false; reason: string };

/**
 * R9 + R11 — strip one leading/trailing code fence, reject empty, and report
 * (without blocking) frontmatter regressions against the original.
 */
export function normalizeRefineResponse(
    raw: string,
    original: ComponentSource,
): NormalizedRefine;
```

`normalizeRefineResponse` returns `warnings` rather than failing on a frontmatter regression: the model may legitimately restructure a file, and the user is about to see a full diff anyway. Blocking there would trade a real capability for a guard the diff already provides. The warnings are surfaced in the modal detail (R11).

### B — `src/optimizer/delegateTask.ts` (pure, no `vscode`)

```ts
export type DelegateScope =
    | { kind: 'finding'; finding: OptimizerFinding }
    | { kind: 'component'; nodeId: string; findings: OptimizerFinding[] }
    | { kind: 'rule'; ruleId: string; findings: OptimizerFinding[] };

export interface DelegateTask {
    text: string;
    filePaths: string[];
    componentCount: number;
}

/** R15, R20 — names every target path and rule; caller enforces the 20 cap. */
export function buildDelegateTask(scope: DelegateScope): DelegateTask;
```

### C — Coordinator flows

**AI Refine** (R10, R12) — the only new logic is producing the content; everything after `stage()` is FEAT-034's existing `_applyQuickFix` tail, extracted into a shared `_previewAndWrite(source, content, title, warnings)` helper so the two paths cannot drift:

```
aiRefineFinding
  → guard assistedFixes.enabled + mode (R26)
  → buildRefinePrompt(source, finding)
  → createProviderChain([vscodeLmProvider, createOpenAiCompatibleProvider(o)], o)
       with o.model = selected family ?? config ai.model         (R7)
  → Promise.race([chain.tryGenerate(prompt), timeout(30_000)])   (R12)
  → normalizeRefineResponse(raw, source)                         (R9, R11)
  → _previewAndWrite(...)  ← shared with deterministic fixes     (R10)
  → post aiRefineResult { ok, reason?, provider }                (R28)
```

**Delegate** (R14, R16–R19):

```
delegateFinding
  → registry.detect(); if empty → action was never rendered      (R14)
  → buildDelegateTask(scope)
  → if componentCount > 20 → second modal naming the count       (R20)
  → git status check → warn if dirty or not a repo               (R16)
  → modal stating "the agent writes directly, no diff preview"   (R17)
  → RunCoordinator launch in integrated terminal                 (R18)
  → on terminal close → scheduleScan()                           (R19)
```

The git check runs `git status --porcelain` through `child_process`, already used by `src/verifier/codeQualityRunner.ts`. A non-zero exit or missing binary is treated as "not a repository" (R16 second clause), never as an error.

### D — Prompt shape (R8)

```
You are correcting one file in an AI agent architecture.

File: <filePath>
Component type: <nodeType>

Issue (<ruleId>): <title>
<detail>

Current content:
---
<raw>
---

Return the COMPLETE corrected file and nothing else. No explanation, no
markdown fence. Preserve the YAML frontmatter and every field it already has
unless the issue is specifically about the frontmatter.
```

Only this component's content is included — never a sibling's, and never a path outside its own `filePath` (R8, R28).

---

## Discarded Alternatives

**One "Fix with AI" button that silently picks a backend.** Rejected, and this is the central design decision. The two modes offer materially different guarantees: AI Refine cannot write without the user approving a diff; delegation hands an autonomous agent write access to the working tree. Hiding that behind one control would mean the same click sometimes shows a diff and sometimes silently rewrites files. R17 forbids it.

**Letting the model apply changes through a tool-use loop.** Rejected. It would replace the diff-preview guarantee with trust in a model's tool calls, for no gain FEAT-034's flow does not already provide. Delegation already covers the autonomous case, honestly labelled.

**Blocking an AI proposal that regresses the frontmatter.** Rejected in favour of warn-and-show (R11). The user is one modal away from a full side-by-side diff; a hard block would reject legitimate restructurings while adding nothing the diff does not already reveal.

**A dedicated HTTP client for the AI call.** Rejected. `lmUtils.ts` already implements the chain over Node's built-in `https`, with `vscode.lm` first. Adding a second path would fragment provider configuration and break the no-API-key primary route.

**Extending `RunNode` to carry steering and hook types.** Rejected. `RunNode.type` is `'agent' | 'subagent' | 'skill'` because FEAT-033 runs *agents*. Delegation targets *files*, which is a different thing. `buildDelegateTask` produces plain task text plus paths and does not reuse `RunNode`.

**Auto-applying refines above a confidence threshold.** Rejected. There is no confidence signal to threshold on — the model returns text, not a calibrated score — so any threshold would be theatre. R4 makes the absence of a silent path explicit.

---

## Testing Strategy

Both new modules are pure and testable without a `vscode` mock, matching `src/optimizer/`.

| Test file | Covers |
|---|---|
| `aiRefine.test.ts` | R8 prompt is deterministic and contains file path, rule ID, detail and content; contains no sibling content. R9 fence stripping (```` ``` ````, ```` ```md ````, none, both ends); empty-after-strip rejected. R11 dropped `name` produces a warning but still `ok: true`. |
| `delegateTask.test.ts` | R15 task text names every target path and rule ID for all three scopes; R20 `componentCount` is accurate for batch grouping. |
| `optimizerConfig.test.ts` | R25 both settings with defaults; R26 `enabled:false` reflected in the config object. |
| `messageDiscriminator.test.ts` | R27 the six new types are accepted. |
| `OptimizerPanel.test.ts` | R21 action ordering; R24 pending state disables both assisted actions for that finding. |

Manual smoke (needs a live host): R6 refine with only `vscode.lm` available and no API key; R10 the diff and modal appear and nothing is written on cancel; R12 timeout; R16 dirty-tree warning; R17 delegation modal wording; R19 rescan after terminal close.

---

## Rollout

Additive. `assistedFixes.enabled: false` restores FEAT-034 behaviour exactly. No existing message type, setting, persisted key, rule, threshold or score changes meaning.
