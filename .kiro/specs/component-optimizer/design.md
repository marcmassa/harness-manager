# FEAT-034 — Component Optimizer — Design

---

## Summary

A new deterministic analysis module, `src/optimizer/`, scores every architecture component (`agent`, `subagent`, `skill`, `steering`, `hook`) against a table of pure rules, and surfaces the result in a fourth webview tab plus a score chip on each whiteboard node.

The module reuses three existing subsystems rather than reimplementing them: `semanticMatcher.ts` for TF-IDF overlap, `idoneity.ts` for ownership mismatch, and `parserLogic.scanCrossReferences()` for link resolution. It introduces **no new npm dependency**.

```
FileSystemWatcher / coordinator write
            │
            ▼  debounce (shared with advisory scan)
   OptimizerEngine.scan(graph, config)
            │
            ├─ componentLoader  → ComponentSource[]   (reads disk via workspace.fs)
            ├─ tokenEstimator   → tokenEstimate       (local heuristic)
            ├─ RULES[]          → OptimizerFinding[]  (pure, no I/O)
            └─ scorer           → ComponentScore[] + architectureScore
            │
            ▼  postMessage 'optimizerReport'
   ┌────────────────────┬──────────────────────────┐
   │  OptimizerPanel    │  CustomNode score chip   │
   │  (4th tab)         │  (whiteboard)            │
   └────────────────────┴──────────────────────────┘
```

Quick fixes are computed as pure `string → string` transforms, previewed in a native VS Code diff backed by a virtual document, and only written after explicit user confirmation.

---

## Affected Files

| File | Action | Reason |
|---|---|---|
| `src/optimizer/types.ts` | **new** | `ComponentSource`, `OptimizerFinding`, `OptimizerRule`, `RuleContext`, `ComponentScore`, `OptimizerReport`, `QuickFix`, `OptimizerConfig` |
| `src/optimizer/tokenEstimator.ts` | **new** | Local, dependency-free token estimate (R4) |
| `src/optimizer/componentLoader.ts` | **new** | Node → `ComponentSource`; the only I/O in the module (R2, R3) |
| `src/optimizer/rules/structure.ts` | **new** | `OPT-S01`–`OPT-S06` (R13–R18) |
| `src/optimizer/rules/budget.ts` | **new** | `OPT-B01`–`OPT-B03` (R19–R21) |
| `src/optimizer/rules/overlap.ts` | **new** | `OPT-O01`–`OPT-O03` (R22–R24) |
| `src/optimizer/rules/drift.ts` | **new** | `OPT-D01`–`OPT-D02` (R25, R26) |
| `src/optimizer/rules/hygiene.ts` | **new** | `OPT-H01`–`OPT-H03` (R27–R29) |
| `src/optimizer/rules/index.ts` | **new** | `ALL_RULES` registry + disablement filter (R30) |
| `src/optimizer/scorer.ts` | **new** | Dimension → component → architecture rollup (R9–R12) |
| `src/optimizer/optimizerEngine.ts` | **new** | Orchestrates load → evaluate → score; never throws (R5, R53) |
| `src/optimizer/quickFix.ts` | **new** | The five pure fix transforms (R31, R36) |
| `src/optimizer/optimizerDiffProvider.ts` | **new** | `TextDocumentContentProvider` on the `harness-optimizer` scheme (R33) |
| `src/coordinators/OptimizerCoordinator.ts` | **new** | Handles the seven new message types (R48) |
| `src/webview/OptimizerPanel.tsx` | **new** | Header, filters, component table, finding rows (R37–R44) |
| `src/types.ts` | modify | Seven message types added to the union **and** to `KNOWN_MESSAGE_TYPES` (R48) |
| `src/extension.ts` | modify | Instantiate + wire `OptimizerCoordinator`; register the diff provider and the command; recompute the report inside the existing `scheduleScan` path (R47, R51) |
| `src/webview/index.tsx` | modify | Fourth tab, `optimizerReport` state, message handling, pass scores to the canvas (R37, R45) |
| `src/webview/WhiteboardCanvas.tsx` | modify | Thread `scoresByNodeId` into node data (R45) |
| `src/webview/components/CustomNode.tsx` | modify | Render the score chip (R45, R46) |
| `package.json` | modify | Seven settings, one command, version `0.8.0` (R49, R51) |

---

## Signatures and Structures

### A — `src/optimizer/types.ts`

```ts
export type OptimizerDimension = 'structure' | 'budget' | 'integration' | 'hygiene';
export type OptimizerSeverity  = 'error' | 'warning' | 'info';
export type ScoreTier          = 'A' | 'B' | 'C' | 'D' | 'F';

export type OptimizableType = 'agent' | 'subagent' | 'skill' | 'steering' | 'hook';

export interface ComponentSource {
    nodeId: string;
    nodeType: OptimizableType;
    label: string;
    filePath: string;          // '' when unresolved
    raw: string;
    frontmatter: Record<string, unknown>;
    body: string;
    exists: boolean;
    tokenEstimate: number;
}

export type QuickFixType =
    | 'set-frontmatter-field'
    | 'insert-frontmatter'
    | 'append-section-stubs'
    | 'extract-to-references'
    | 'relativize-path';

export interface QuickFix {
    type: QuickFixType;
    label: string;
    payload: Record<string, string>;
}

export interface OptimizerFinding {
    ruleId: string;            // OPT-<F><NN>
    nodeId: string;
    nodeType: OptimizableType;
    filePath: string;
    severity: OptimizerSeverity;
    dimension: OptimizerDimension;
    title: string;
    detail: string;
    line?: number;             // 1-based
    relatedNodeIds?: string[];
    fix?: QuickFix;
}

/** Everything a rule may read. Pure — no vscode, no fs. */
export interface RuleContext {
    source: ComponentSource;
    all: ComponentSource[];
    sourcesById: Map<string, ComponentSource>;
    edges: { source: string; target: string; label: string }[];
    nodeIds: Set<string>;
    existingPaths: Set<string>;   // normalized workspace-relative paths
    config: OptimizerConfig;
}

export interface OptimizerRule {
    id: string;
    appliesTo: readonly OptimizableType[];
    dimension: OptimizerDimension;
    /** Documentation only — the actual severity lives on each finding. */
    defaultSeverity: OptimizerSeverity;
    evaluate(ctx: RuleContext): OptimizerFinding[];
}

export interface ComponentScore {
    nodeId: string;
    nodeType: OptimizableType;
    label: string;
    score: number;                                  // 0–100
    tier: ScoreTier;
    dimensions: Record<OptimizerDimension, number>;
    tokenEstimate: number;
    findingCount: number;
}

export interface OptimizerReport {
    ok: boolean;
    error?: string;
    scanTimestamp: number;
    architectureScore: number;
    totalComponents: number;
    truncated: boolean;
    components: ComponentScore[];
    findings: OptimizerFinding[];
    dismissedCount: number;
    findingCounts: {
        bySeverity: Record<OptimizerSeverity, number>;
        byDimension: Record<OptimizerDimension, number>;
    };
}

export interface OptimizerConfig {
    enabled: boolean;
    tokenBudget: { skill: number; subagent: number; agent: number; steering: number; agentRollup: number };
    overlapThreshold: number;
    disabledRules: string[];
}
```

### B — `src/optimizer/tokenEstimator.ts` (R4)

No tokenizer dependency. Prose is estimated at 4 characters per token; fenced code blocks at 3, because code tokenizes more densely. Frontmatter counts as prose.

```ts
export function estimateTokens(text: string): number;
```

Implementation: split on fenced blocks (` ``` `), sum `ceil(len / 4)` for prose segments and `ceil(len / 3)` for code segments. Monotonic by construction, since every segment contributes a non-negative amount.

### C — `src/optimizer/componentLoader.ts` (R2, R3)

```ts
export async function loadComponents(
    nodes: HarnessNode[],
    root: vscode.Uri,
    readFile: (rel: string) => Promise<string | null>,
): Promise<ComponentSource[]>;
```

`readFile` is injected so the whole module stays testable without a `vscode` mock. `extension.ts` passes a `vscode.workspace.fs`-backed reader; tests pass a `Map` lookup.

The loader reads from `metadata._filePath` and parses frontmatter with the existing `src/frontmatter.ts` adapter. It deliberately ignores `metadata.body`, `metadata._fullBody`, `metadata._body` and `metadata._preview`: those are truncated (`body` at 500 chars, `_preview` at 500 chars) and inconsistent across node types (`_fullBody` exists for subagents and skills, `_body` for steering, neither for hooks). Disk is the single authority.

### D — Rule registry (`src/optimizer/rules/index.ts`)

Mirrors the existing `RULES: SuggestionRule[]` table in `src/agentic-detector/advisoryEngine.ts`, so contributors meet one pattern, not two.

```ts
export const ALL_RULES: readonly OptimizerRule[];
export function activeRules(disabled: string[]): OptimizerRule[];
```

### E — `src/optimizer/scorer.ts` (R10–R12)

```ts
export const SEVERITY_WEIGHT = { error: 25, warning: 10, info: 3 } as const;

export function scoreComponent(source: ComponentSource, findings: OptimizerFinding[]): ComponentScore;
export function tierFor(score: number): ScoreTier;
export function rollup(components: ComponentScore[]): number;
```

Deduction model: each dimension starts at 100 and loses `SEVERITY_WEIGHT[severity]` per finding in that dimension, clamped at 0. The component score is the mean of the four dimensions. This keeps a component with a single `error` in one dimension at 93 overall rather than at 75 — a single structural bug should not read as a broken component.

### F — Overlap rule reuse (R22)

`OPT-O01` builds its corpus with the existing primitives and adds no new maths:

```ts
const corpus = new Map<string, string[]>(
    sameTyped.map(s => [s.nodeId, tokenize(describe(s))]),
);
const idf     = computeIdf(corpus);
const vectors = buildTfidfVectors(corpus, idf);
// pairwise cosineSimilarity(vectors.get(a)!, vectors.get(b)!) >= config.overlapThreshold
```

`OPT-O03` calls `computeIdoneityMatrix()` + `detectMismatches(matrix, edges)` and maps each `MismatchInfo` to one finding — the mismatch logic is not duplicated.

### G — `src/optimizer/quickFix.ts` (R31)

```ts
export function computeFix(source: ComponentSource, fix: QuickFix): { ok: true; content: string } | { ok: false; reason: string };
```

| Fix type | Transform |
|---|---|
| `insert-frontmatter` | Prepend `---\nname: <dir>\ndescription: \n---\n` |
| `set-frontmatter-field` | Re-serialize frontmatter with `payload.field` set to `payload.value` |
| `append-section-stubs` | Append the missing `##` headings listed in `payload.sections` |
| `extract-to-references` | Move sections after the second `##` into `references/<slug>.md`, replace with a link line |
| `relativize-path` | Replace the workspace-root prefix on line `payload.line` with a relative path |

`extract-to-references` returns `{ ok: false }` when the target file already exists (R36); it is the only fix that writes two files, and the coordinator performs both writes through `HarnessWriter`.

### H — Diff preview (R32, R33, R34)

```
applyQuickFix (webview)
  → OptimizerCoordinator.handle()
      → computeFix()                              pure
      → diffProvider.stage(uri, proposedContent)  in-memory Map
      → vscode.commands.executeCommand('vscode.diff', fileUri, harnessOptimizerUri, title)
      → vscode.window.showInformationMessage('Apply this fix?', { modal: true }, 'Apply')
      → HarnessWriter write + scheduleScan()
```

The virtual document lives under `harness-optimizer:/<nodeId>/<ruleId>.md`. The provider holds an in-memory `Map<string, string>` cleared after each decision, so nothing is ever written to the user's workspace for preview purposes.

### I — Coordinator (R48)

`OptimizerCoordinator` follows the existing four-coordinator contract exactly — `handle(msg, postMessage, sendData): Promise<boolean>` returning `false` for unknown types — and is appended to the `||` chain in `extension.ts:529`.

| Message | Direction | Effect |
|---|---|---|
| `getOptimizerReport` | webview → host | Post the cached report, or scan if none |
| `runOptimizerScan` | webview → host | Force a scan, then post `optimizerReport` |
| `optimizerReport` | host → webview | The full report |
| `applyQuickFix` | webview → host | Diff preview → confirm → write |
| `quickFixResult` | host → webview | `{ ok, reason? }` |
| `dismissOptimizerFinding` | webview → host | Persist `<ruleId>::<nodeId>`, re-scan |
| `restoreOptimizerFindings` | webview → host | Clear the dismissal list, re-scan |

Dismissals persist to `workspaceState` under `harness-dashboard.dismissedOptimizerFindings`, matching the `harness-dashboard.dismissedSuggestions` precedent.

### J — Webview surface

`OptimizerPanel.tsx` reuses the `AdvisoryPanel.tsx` visual language: the same header bar with a Re-scan button and spinner, the same `EffortImpactBadge`-style pill for severity, the same card borders and VS Code theme variables. The component table is a `<div>` grid rather than a `<table>` so the row-expansion animation matches the existing panels.

The score chip in `CustomNode.tsx` is a 22×14 rounded rect in the node's top-right corner, coloured by tier (`A` `#22bb66`, `B` `#88cc33`, `C` `#d4a017`, `D` `#e06c2b`, `F` `#d13438`) — the same palette family as `MATURITY_DEFINITIONS`.

---

## Discarded Alternatives

**LLM-based scoring.** Rejected. It would make the score non-reproducible, untestable against fixtures, dependent on model availability, and slow. `DESIGN.md` principle 3 ("Frugal AI, no surprises") and principle 5 ("Testable, by construction") both point the other way. AI-assisted *rewriting* remains a legitimate follow-up because it is a proposal the user reviews in a diff, not a hidden judgement — it goes to the backlog, not to this release.

**A tokenizer dependency (`tiktoken`, `gpt-tokenizer`).** Rejected. `tiktoken` ships WASM in the megabytes; `DESIGN.md` constrains the VSIX and forbids adding a dependency when an in-set alternative exists. A character-ratio heuristic is accurate to roughly ±15 % on markdown, which is more than enough to decide "this skill is 4 000 tokens and should be split". The estimate is labelled "est." everywhere in the UI.

**Folding the findings into `AdvisoryPanel` as `Suggestion[]`.** Rejected. The advisory operates at workspace granularity and renders one card per suggestion; the optimizer produces tens of findings across tens of components and needs a sortable, filterable table keyed by component. Forcing per-component data through the suggestion card would degrade both surfaces.

**Extending `AdvisoryCoordinator` instead of adding a coordinator.** Rejected. `AdvisoryCoordinator` owns the `AgenticDetector` lifecycle; the optimizer has an independent lifecycle, its own cache, and its own persistence key. The repo already establishes one coordinator per domain (Whiteboard, Sdd, Advisory, Run) — a fifth is the consistent move.

**A temp file or `WorkspaceEdit` preview for quick fixes.** Rejected. A temp file pollutes the user's workspace and their git status. `WorkspaceEdit` with `refactor.preview` shows a tree of edits, not a readable side-by-side of a rewritten markdown file. A virtual document via `TextDocumentContentProvider` gives a real diff editor with zero filesystem footprint.

**A weighted-positive scoring model** (award points for present qualities rather than deduct for defects). Rejected. It requires calibrating a weight for every positive attribute and produces confusing scores for components that are simply small. Deduction from 100 is trivially explainable in the UI: "−25 for one error".

**Per-occurrence reporting of vague quantifiers.** Rejected explicitly in R29. A 3 000-token subagent legitimately contains the word "some" a dozen times; twelve findings would drown the real defects and train the user to ignore the panel. Density as a single `info` finding preserves the signal at a fraction of the noise.

**Re-using the parser's `metadata.body` instead of reading files.** Rejected. `body` is truncated at 500 characters and the full-body field is named differently per node type (`_fullBody`, `_body`, `_preview`, or absent for hooks). Every budget and hygiene rule needs the complete text.

---

## Testing Strategy

Unit tests are Vitest, colocated with the module, and use fixture strings — no `vscode` mock is needed anywhere in `src/optimizer/` because the only I/O is the injected `readFile`.

| Test file | Covers |
|---|---|
| `src/optimizer/tokenEstimator.test.ts` | R4 — known fixtures within tolerance, code-block weighting, monotonicity property |
| `src/optimizer/componentLoader.test.ts` | R1, R2, R3 — type filtering, frontmatter split, missing-file path |
| `src/optimizer/rules/structure.test.ts` | R13–R18 — one positive and one negative case per rule, per applicable type |
| `src/optimizer/rules/budget.test.ts` | R19–R21 — threshold boundaries, ×3 escalation, rollup contributor ordering |
| `src/optimizer/rules/overlap.test.ts` | R22–R24 — symmetric emission, threshold boundary, mismatch mapping |
| `src/optimizer/rules/drift.test.ts` | R25, R26 — manifest drift, duplicate names, broken links |
| `src/optimizer/rules/hygiene.test.ts` | R27–R29 — path/credential matches, **assertion that no finding detail contains the matched secret**, density boundary |
| `src/optimizer/scorer.test.ts` | R10–R12 — weight arithmetic, clamp at 0, tier boundaries at 39/40/59/60/74/75/89/90, empty rollup |
| `src/optimizer/optimizerEngine.test.ts` | R5, R30, R53 — 500-component cap, rule disablement, throwing rule yields `ok: false` |
| `src/optimizer/quickFix.test.ts` | R31, R36 — each transform round-trips to valid markdown; `extract-to-references` refuses an existing target |
| `src/messageDiscriminator.test.ts` | R48 — the seven new types are accepted by `isKnownWebviewMessage` |

A determinism test runs a full scan twice over the same fixture set and asserts deep equality of the reports minus `scanTimestamp` (R10).

The performance budget (R52) is asserted in `optimizerEngine.test.ts` against 100 generated 2 KB components with a 1 000 ms ceiling, using pre-loaded sources so file I/O is excluded.

---

## Rollout

No migration, no breaking change. The feature ships enabled by default; `harness-dashboard.optimizer.enabled: false` restores exactly the 0.7.0 behaviour. No existing message type, settings key, or persisted `workspaceState` key changes meaning.
