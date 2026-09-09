# Changelog

All notable changes to Harness Dashboard are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **On test counts:** Every feature in this project that has `"sdd": true` in
> `feature_list.json` goes through Spec-Driven Development. Each spec adds a set
> of EARS requirements (R1..Rn), each requirement has one or more corresponding
> unit tests. The test count therefore grows by 5–30 per feature — it is not
> a fixed metric but a direct reflection of the requirement surface. Test counts
> in this changelog are informational checkpoints, not targets.

---

## [0.8.1] — 2026-09-09

> **Supply-Chain Health** (FEAT-036): the advisory loop gains a deterministic view of your dependency graph — missing update-bot config, stale security `overrides`, and prod-vs-dev audit findings — with one-click remediation. No breaking changes; **zero new npm dependencies**. All 773 unit tests pass.

### Added

#### Supply-chain scanner (`src/supply-chain/`)

- **Pure, deterministic modules** — `packageJsonParser` (deps / devDeps / `overrides` maps), `lockfileParser` (resolved versions + dev flags), `botConfigDetector` (Dependabot YAML parsed with the existing `yaml` package; Renovate presence), `semverLite` (numeric-dot compare — chosen over a `semver` dependency, see spec Discarded Alternatives), `auditReducer`, and a `scanner` orchestrating them behind an injected `{readFile, exists}` — the same DI pattern as `SignalScanner`. No `vscode` import anywhere; non-Node workspaces degrade to silence.
- **`SupplyChainReport`** attached to the advisory profile: declared and resolved versions, bot-config map, and an `AuditSummary` exposing prod/dev finding **counts and list** plus audit state (`not-run` / `unavailable` / `captured`).

#### SC rule family in the advisory engine

- `sc-add-update-bot` (SC-01) — fires exactly once when a Node workspace has neither a Dependabot `npm` config nor Renovate. Carries a `create-file` action scaffolding a vetted `.github/dependabot.yml` (npm + github-actions, weekly, grouped minor/patch, prod+dev).
- `sc-stale-override:<pkg>` (SC-02) — when a cached audit reports a patched version higher than a pinned `package.json#overrides` entry, names package, current pin and patched version. Stable per-package IDs keep dismissal persistence working.
- `sc-audit-findings` (SC-03) — aggregate summary with remediation actions while any finding remains.
- Actions reuse the FEAT-032 `SuggestionAction` vocabulary unchanged: `create-file` (non-destructive — an existing file is opened in the editor, never overwritten) and `run-command` (`npm audit fix`, `npm outdated`).

#### Audit execution edge — user-triggered, bounded

- `harness-dashboard.runSupplyChainAudit` command (palette + AdvisoryPanel button) runs **one** `execFile('npm', ['audit','--json'])` with a 15 s timeout, caches the payload for the session, and schedules a re-scan. Never launched during scans, activation, or watcher events (`noAutoAudit.test.ts` pins it); spawn/timeout/parse failures degrade to `unavailable` without breaking the scan.
- AdvisoryPanel gains a *Supply Chain* section: prod/dev counts, audit-state badge, Run-audit button — hidden for non-Node workspaces.

### Security / dogfooding

- **This repository now ships the config SC-01 prescribes**: `.github/dependabot.yml` added (npm + github-actions ecosystems, weekly, grouped minor/patch, dev + prod).
- **Stale security override fixed**: `overrides.undici` `7.28.0` → `7.29.0` (GHSA-4cwx-7wf7-3272 and four others), lockfile refreshed.
- `npm audit` — **0 vulnerabilities** (was 8: 7 high + 1 moderate, all dev-transitive at write-time, 12 alerts open on the default branch before this release).

### Changed

- `ActionExecutor` `create-file` existing-file branch now opens the file in the editor before returning (ADR-004) — completes R5's second clause for every action caller; write/skip semantics otherwise unchanged.

### Technical

- 92 new tests (773 total, 56 files); `./check.sh` green including adapter-sync and governance gates.
- Zero new dependencies; extension code still performs no external HTTP.

---

## [0.8.0] — 2026-08-03

> **Component Optimizer**, plus assisted fixes for the findings it cannot correct mechanically. No breaking changes to settings, commands, or output format; both features ship enabled and can be switched off entirely.

### Added

#### Component Optimizer — per-component quality scoring

Until now the tool told you *what exists* in your agent architecture. It never told you *whether it is well built*. The three existing analysis layers all sit at the wrong granularity for that: the Advisory scans the workspace, idoneity scores relationships, and the KISS/DRY hooks only look at TypeScript source. Nothing read a `SKILL.md`.

- **`src/optimizer/` module** — 19 files, entirely pure: nothing in it imports `vscode`, and its only I/O is an injected `readFile` callback. Adds **no npm dependency**.
- **Scores every component** (`agent`, `subagent`, `skill`, `steering`, `hook`) from 0–100 across six dimensions — structure, clarity, context budget, integration, hygiene, consistency — plus an architecture-wide rollup. Scoring is deduction-based (`error` −25, `warning` −10, `info` −3) so it is explainable in one line, and fully deterministic: the same inputs always produce the same report.
- **19 rules in six families**, each with a stable ID that will never be reused:
  - `OPT-S01`–`OPT-S03`, `S05`, `S06` **structure** — missing or unparseable frontmatter, `name` not matching its directory, description length bounds, required sections per type, hook `event`/`script` contract, steering `appliesTo`.
  - `OPT-B01`–`OPT-B03` **context budget** — per-component token estimate against a self-calibrating threshold (see *Calibration* below), extractable reference content, and an agent rollup over everything reachable by `uses` and `governs` edges.
  - `OPT-C01`–`OPT-C02` **consistency** — divergence from the conventions of your *own* same-typed components, with the convention derived from the corpus rather than prescribed.
  - `OPT-O01`–`OPT-O03` **integration** — TF-IDF cosine overlap between same-typed components, orphan skills and under-connected subagents, and ownership mismatch.
  - `OPT-D01`–`OPT-D02` **drift** — manifest-declared but missing files, duplicate names across frameworks, broken cross-references.
  - `OPT-H01`–`OPT-H02` **hygiene** — absolute machine-specific paths, credential-shaped strings.
  - `OPT-S04` + `OPT-H03` **clarity** — `OPT-S04` deserves its own mention: progressive disclosure selects a skill from its description alone, so a description that never says *when* to use it is unlikely to ever be loaded — a silent failure that is invisible in the graph. `OPT-H03` reports vague-quantifier density as one aggregate, never per occurrence.
- **Reuses the existing semantic layer rather than duplicating it** — `OPT-O01` builds its corpus from `tokenize`/`computeIdf`/`buildTfidfVectors`/`cosineSimilarity` in `semanticMatcher.ts`, `OPT-O03` delegates to `computeIdoneityMatrix()` + `detectMismatches()` in `idoneity.ts`, and `OPT-D02` uses `scanCrossReferences()` from `parserLogic.ts`.
- **Local token estimation** (`tokenEstimator.ts`) — prose at 4 chars/token, fenced code at 3, no tokenizer package. `tiktoken` would have added megabytes of WASM for accuracy the use case does not need; every estimate is labelled "est." in the UI.

#### Optimizer panel and whiteboard chips

- **Fourth "Optimizer" tab** — architecture score header with a Re-scan button, component table sorted worst-first, expandable rows listing each component's findings, and filters by type / severity / dimension that compose with AND.
- **Score chip on whiteboard nodes** — tier-coloured, with a tooltip stating score, tier and finding count. Nodes the report does not cover render no chip, so uncovered node types look exactly as before.
- **Finding dismissal** — persisted per workspace under `harness-dashboard.dismissedOptimizerFindings` as `<ruleId>::<nodeId>`, with a restore-all control. Dismissed findings are filtered *before* scoring, so dismissing one actually raises the score.

#### Quick fixes

- **Five deterministic transforms** — `insert-frontmatter`, `set-frontmatter-field`, `append-section-stubs`, `extract-to-references`, `relativize-path` — each a pure `string → string` function.
- **Diff preview before any write** — the proposed content is served through a `TextDocumentContentProvider` on the `harness-optimizer:` scheme and shown in a native diff editor. Nothing reaches disk until the user confirms a modal. A temp file would have polluted the workspace and the user's git status.
- **`extract-to-references` refuses to overwrite** an existing target rather than clobbering it, and writes both files (the trimmed component and the new `references/<slug>.md`) when applied.

#### Calibration — thresholds judged against your corpus, not a constant

The first cut used fixed budgets (500 tokens for a skill). Measured against the five real skills in this repository — 472, 719, 939, 1093 and 1991 estimated tokens — that constant flagged **four of the five**, one as an `error`. A rule that reports 80% of a competent author's corpus measures the constant, not the corpus.

- **Relative budgets** — `OPT-B01`/`OPT-B02` now fire above `2.5× the median of your same-typed components`, falling back to a configurable absolute budget only below five components of that type. A percentile was rejected: a percentile always reports a fixed fraction, so a uniformly good corpus would still be flagged. A median multiple can legitimately report nothing — and on this repository it now reports **0 of 5**.
- **Confidence tiers** — every rule declares whether it verifies a `fact` (the file exists or it does not), applies a `heuristic` (real mechanism, approximate detection), or fires on an unvalidated threshold (`opinion`).
- **Severity ceiling** — the engine clamps each finding to its rule's tier: `fact` may reach `error`, `heuristic` caps at `warning`, `opinion` caps at `info`. An invented constant can no longer deduct as much as a genuinely broken frontmatter.

#### Dimension radar and legend

- **Radar chart** at architecture level and per component: six fixed axes, every axis direct-labelled with its value, radial scale numbered 0/25/50/75/100, banded ranges and marked ring vertices. Inline SVG, no charting dependency, theme-aware.
- Its reason for existing: a component at 100/100/40/100 and one at 85/85/85/85 average the same and mean opposite things. The single number cannot show that; the polygon shows it instantly.
- **Collapsible legend** — per dimension: the question it asks, the rule IDs feeding it, the current value, the finding count, plus the deduction model and the confidence ceiling.

#### Accessibility

- **Tier palette replaced.** The original five hand-picked hues failed validation: tiers A (`#22bb66`) and B (`#88cc33`) measured ΔE 10.2 in *normal* vision against a floor of 15, and 3.4 under deuteranopia — two adjacent tiers were effectively one colour. Tiers now use the validated four-role status palette with A and B sharing `good`; the tier letter carries the five-way distinction and a tier colour never appears without its numeric score.

#### Assisted fixes — two modes, two different contracts

`fact`-tier rules already have mechanical fixes: `name` is missing, so write `name`. `heuristic`- and `opinion`-tier rules frequently have none — "this skill is 1 991 tokens" has no arithmetic answer, because someone must decide *what* to extract. Those findings were reported and then abandoned. Two modes close that gap, both reusing infrastructure that already shipped and adding **no npm dependency**.

- **AI Refine** — proposes a rewrite through the existing `lmUtils` provider chain, so `vscode.lm` is tried first and works on your existing subscription with no API key **wherever the host exposes a model**. Verified in smoke testing: VS Code with Copilot does; **Kiro does not implement `vscode.lm`**, and there an API key is required. The failure message distinguishes the two cases instead of reporting only the last provider's error. The proposal is handed to the *same* diff-preview code path as the deterministic fixes, which is what preserves the guarantee that nothing reaches disk before you confirm. A model selector in the panel header overrides the workspace default.
- **Delegate** — hands a scoped task to an installed terminal agent (Claude Code, Gemini CLI) via the `RunAdapter` registry FEAT-033 already built. Available for one finding, all findings on a component, or all occurrences of one rule across components.

**A third mode where neither works.** `vscode.lm` is not the universal contract it looks like — verified against the installed editors, Kiro runs on a VS Code base new enough to have the API but its agent neither registers a model provider nor consumes one, and exposes no extension API. But the user is already signed in there with a model chosen. So **Ask &lt;host&gt;** places the prompt in the host editor's own chat input: no credentials, no configuration, no per-host model plumbing. It is strictly one-way — nothing comes back, nothing is written — which makes it the safest of the three and the least automated. Host detection probes the live command list (`kiroAgent.focusChatInput`, `workbench.action.chat.open`) rather than sniffing the product name, so an unrecognised fork simply does not offer the action. Each host's payload mirrors the shape that host's own actions use — for Kiro that means `newSession: true`, without which the prompt only landed when the chat input was already empty. Antigravity was verified to expose no chat command at all: its agent runs outside the extension host.

**The same fallback covers spec generation.** The SDD panel's three AI paths hit the identical wall in Kiro. Where the host offers no model and no API key is set, "Generate with AI" is replaced by "Ask &lt;host&gt;". Prompt construction moved to a pure shared module so the direct route and the handoff send byte-identical text — two copies would drift, and the symptom would be subtly different specs depending on which button the host allowed.

**The two write-capable modes are not interchangeable, and the UI says so.** An agentic CLI edits the working tree itself and returns no content, so delegation *cannot* offer a diff preview. Hiding both behind one "Fix with AI" button would mean the same click sometimes shows a diff and sometimes silently rewrites files. Delegation therefore states its contract in the confirmation and warns when the working tree is dirty — or when no version control is detected at all, where there is no way back.

- **Guardrails** — a refine abandons after 30 s without writing anything; a second refine on the same finding is refused rather than racing two writes to one file; a batch above 20 components needs a second confirmation naming the count; every failure path posts a reason and leaves the deterministic fix available.
- **Promotion follows the evidence** — AI Refine is offered everywhere but promoted to the primary action only where a finding has no mechanical fix *and* its rule involves judgement. A `fact` finding with no fix is a gap in our own rules, not a question worth handing to a model.

### Changed

- **`HarnessWriter.writeFileAtPath(relPath, content)`** — new generic write method with a path-traversal guard, so quick fixes can rewrite an arbitrary component file without bypassing the writer.
- **`openFileInEditor(root, filePath, line?)`** — now accepts an optional 1-based line and reveals it, clamped to the document length so a stale finding cannot throw. `openInEditor` passes it through.
- **`OptimizerCoordinator`** joins the coordinator chain as the fifth handler, following the same `handle(msg, postMessage, sendData)` contract as the other four.
- **The optimizer report rides the existing `scheduleScan` debounce** rather than adding a second timer, so any coordinator write that already refreshes the advisory now refreshes the optimizer too.
- **`_previewAndWrite()`** — the stage → diff → modal → write → rescan tail is now shared by the deterministic fixes and AI Refine. They must not drift: that function *is* the no-write-without-confirmation guarantee.
- **Findings carry their rule's `confidence`**, stamped by the engine, so the UI can say what kind of claim a finding makes without consulting the rule registry.

### Fixed

- **Terminal commands raced the shell.** `sendText` immediately after `createTerminal()` is typed into a shell that has not finished starting and is silently swallowed — the terminal opened and nothing ran. New `src/terminalUtils.ts#sendWhenShellReady` waits for the shell-integration signal where that API exists and falls back to a bounded delay otherwise. Applied to the optimizer's delegation **and** to the FEAT-033 Run panel (`RunCoordinator`), which carried the same latent defect; a reused terminal skips the wait.
- **`OPT-O02` was mis-tagged `fact`.** It asks whether the *derived graph* holds a `uses` edge, and that graph is built by eight adapters from heterogeneous sources. Smoke testing surfaced a skill declared in `skills[]` for three subagents and still reported as an orphan. `DESIGN.md` principle 5 is explicit that the graph is derived and never the source of truth, so the rule is now `heuristic` and its message says the claim comes from the graph — making a false positive diagnosable instead of authoritative.
- **`OPT-D01` reported a populated directory as missing.** Adapters may root a synthetic node at a config directory (Kiro does, at `.kiro`), and the loader could not tell a directory from an absent path. Since `OPT-D01` is `fact`-tier at `error` severity, this was a false claim from the one tier that must not make one. `ComponentSource.pathKind` now distinguishes `file` / `directory` / `missing` / `unresolved` via a real `stat`, and the rule fires only on `missing`.

- **~390 KB of dead code removed from the package.** `dist/` held two bundles no entry point produces — `extension.js` from the 0.1.0 era and `sddManager.js` whose entry point was deleted months ago — and `vsce` sweeps the whole directory. The build now prunes anything in `dist/` that is not a declared output, so a removed entry point cannot leave a passenger behind again.

### Settings

Ten new keys, all under `harness-dashboard.optimizer.*`: `enabled` (default `true`), `budgetMedianMultiple` (`2.5`), `tokenBudget.skill` (`1500`), `tokenBudget.subagent` (`2500`), `tokenBudget.steering` (`1500`), `tokenBudget.agentRollup` (`12000`), `overlapThreshold` (`0.8`), `disabledRules` (`[]`), `assistedFixes.enabled` (`true`) and `assistedFixes.mode` (`both` | `ai-only` | `delegate-only`, default `both`). The `tokenBudget.*` values are fallbacks used only below five components of a type; above that, `budgetMedianMultiple × the corpus median` applies. Setting `enabled` to `false` restores exactly the 0.7.0 behaviour: no scan runs, no chip renders.

### Commands

- `harness-dashboard.optimizeComponents` — "Harness: Optimize Components".

### Notes

- **No LLM participates in detection or scoring.** Every finding comes from a pure, table-driven rule. AI-assisted *rewriting* was deliberately deferred: a score you cannot reproduce is a score you cannot trust or test. See `.kiro/specs/component-optimizer/design.md` § Discarded Alternatives.
- **Credential findings never reproduce the matched secret** — only the pattern name and line number, with a test asserting the match appears nowhere in the serialized finding.
- Test count: 421 → 681.

---

## [0.7.0] — 2026-06-30

> **Unified entity wizard, connection overhaul, and visual polish.** No breaking changes to settings, commands, or output format.

### Added

#### Agent Builder Wizard — unified entity creation

- **All 6 node types in one wizard** — steering, hook, skill, subagent, agent and feature-spec are now created from the Agent Builder Wizard, replacing the old "Add Entity" side panel (`EntitySidePanel` removed).
- **Guided vs. Advanced mode toggle** — guided mode steps through fields one at a time with per-step validation; advanced mode shows all fields on a single scrollable page. State is shared between modes — switching never resets data.
- **`StepSteering` / `StepHook` components** — dedicated wizard steps collect `applies_to` and trigger event/script fields. `HarnessWriter.createSteering` writes to `.claude/steering/<name>.md`; `HarnessWriter.createHook` writes to `.claude/hooks/<name>.sh`.
- **`createSteering` / `createHook` message handlers** added to `WhiteboardCoordinator` and `KNOWN_MESSAGE_TYPES`.
- **`initialType` prop on `AgentBuilderWizard`** — header buttons ("✨ Generate Spec" → `feature-spec`, "+ New Node" → default) pass a pre-selected type when opening the wizard from any tab.
- **Wizard at root DOM level** — the modal is no longer rendered inside the whiteboard section; it is not affected by `display:none` on non-whiteboard tabs.

#### Whiteboard connection overhaul

- **Full architectural relationship coverage** — `getCanonicalEdgeForPair` replaces `getCanonicalUsesLinkPair` and now resolves:
  - `agent ↔ subagent` → **"manages"** (canonical: agent → subagent)
  - `agent/subagent ↔ skill` → **"uses"** (canonical: owner → skill)
  - `agent/subagent ↔ steering` → **"governs"** (canonical: steering → owner)
  - `agent/subagent ↔ hook` → **"triggers"** (canonical: hook → owner)
- **Connection pills on hover** — OUT/IN pills are now visible on mouse-over for all connectable node types (including steering and hook), without requiring the node detail panel to be open first.
- **`connectionLineStyle`** — a dashed blue line (`var(--vscode-focusBorder)`) tracks the cursor during drag-to-connect.
- **`isValidConnection` prop** — invalid drops are blocked at the ReactFlow level before `onConnect` fires.
- **`onConnectStart` captures any handle type** — previously only source handles registered as drag origin; now both handle types are captured so `isLinkTargetActive` highlights correctly during any drag.
- **`CUSTOM_EDGES_KEY` (`harness-dashboard.customEdges`)** — new `workspaceState` key persists non-"uses" edges (manages/governs/triggers) across reloads. `sendData` merges these into the graph alongside existing `customUsesEdges`. Delete is handled by `_removeCustomEdge`.

#### WhiteboardCoordinator — new message handlers (FEAT-033 Phase 2)

- `getLmModels`, `generateAgentDescription`, `createNodeFromWizard`
- `getArchitectureTemplates`, `applyArchitectureTemplate`

### Changed

- **Button style standard** — `harnessActionBtnStyle` (vivid `vscode-button-background` color + 7px rounded, shadow) applied consistently to header buttons and whiteboard toolbar primary action. Secondary toolbar buttons (`⊞ Templates`, `⚙`) use `toolbarBtnSecondaryStyle` (neutral widget background).
- **Floating expand button** — moved from the tab header to a fixed bottom-right position (`position: fixed`, `zIndex: 2000`). Hidden when `window.__harness_is_full_window` is `true`.
- **`__harness_is_full_window` injection** — a nonce-tagged inline `<script>` sets this global before the module script loads, allowing React to distinguish sidebar from full-window mode without an extra postMessage round-trip.
- **`canLinkThroughPills`** — extended to include `steering` and `hook` node types (previously only `agent`, `subagent`, `skill`).
- **`createEdge` message** — now accepts an optional `label` field. Non-"uses" labels bypass `HarnessWriter.createEdge` and go straight to `_upsertCustomEdge`.
- **`_deleteEdgeWithFallback`** — non-"uses" labels now also clean up the `CUSTOM_EDGES_KEY` store via `_removeCustomEdge`.

### Removed

- **`EntitySidePanel`** — component no longer imported or rendered; replaced entirely by `AgentBuilderWizard`.

---

## [0.6.0] — 2026-06-27

> **Tech Debt & Security Hardening (FEAT-030)** — no new end-user features; all changes are security hardening, internal architecture refactoring, and type safety improvements. No breaking changes to settings, commands, or output format. All 372 unit tests pass (+15 new).

### Security

- **CSP nonce (R1–R3)** — `_getWebviewHtml()` now generates a 16-byte cryptographic nonce on every call using `globalThis.crypto.getRandomValues` (Web Crypto API, no Node.js dependency). The nonce is embedded in both the `<meta http-equiv="Content-Security-Policy">` header (`script-src 'nonce-...'`) and the `<script nonce="...">` attribute. `unsafe-inline` is absent from the policy.
- **Sandbox hardening (R4)** — `allow-same-origin` removed from the `sandbox` option on both the sidebar `WebviewView` and the full-window `WebviewPanel`. A compromised script can no longer elevate to the extension host origin.
- **Unknown-message guard (R5–R6)** — all 28 message types now have a corresponding entry in `WebviewMessageType` (union) and `KNOWN_MESSAGE_TYPES` (`Set<string>`). `isKnownWebviewMessage()` type guard rejects anything outside the set before the switch statement is entered; unknown types are logged with `this._log.warn(...)` and dropped silently.

### Refactored

#### Domain coordinator pattern (R7–R9)

- **`src/coordinators/WhiteboardCoordinator.ts`** — handles 13 whiteboard/graph cases: `createNode`, `deleteNode`, `updateMetadata`, `createEdge`, `deleteEdge`, `confirmAndDeleteEdge`, `getMarkdownContent`, `openMarkdownFile`, `acceptSuggestion`, `dismissSuggestion`, `reassignSkill`, `updateEdgeLabel`, `toggleSkillConnection`. Contains the `_shouldUseCustomEdgeFallback`, `_upsertCustomUsesEdge`, `_removeCustomUsesEdge`, and `_deleteEdgeWithFallback` private helpers.
- **`src/coordinators/SddCoordinator.ts`** — handles 10 SDD cases: `getFeatureList`, `getSpecFile`, `saveSpecFile`, `generateWithAI`, `createSpecFile`, `generateSpecDraft`, `openInEditor`, `createFeature`, `generateFeatureDescription`, `deleteFeature`. Owns all SDD private helpers previously scattered in `extension.ts`.
- **`src/coordinators/AdvisoryCoordinator.ts`** — handles 2 advisory cases: `dismissAgenticSuggestion`, `applyHarnessSDD`. Owns the `_applyHarnessSDD` scaffold logic.
- **`src/extension.ts`** — `_handleWebviewMessage` reduced to 45 lines: validates message, dispatches `ready`/`getData`/`openFullWindow`/`openSettings` inline, chains coordinators for everything else. `setupCodeQualityVerifier` and helpers extracted to **`src/verifier/codeQualitySetup.ts`**. Result: **340 executable lines** (target: ≤ 400).

#### FeatureSpecPanel decomposition (R10–R11)

The 1 994-line `FeatureSpecPanel.tsx` was split into five focused files. All four listed files are ≤ 600 lines:

| File | Lines | Responsibility |
|------|-------|---------------|
| `FeatureSpecPanel.tsx` | 192 | Feature list state, message routing, outer layout |
| `FeatureList.tsx` | 221 | Sidebar with `FeatureCard`, `StatusBadge`, `PriorityBadge` |
| `SpecEditor.tsx` | 314 | Feature header, tab strip, edit/view tab content |
| `AiAssistBar.tsx` | 96 | Action bar (Create from Template / Edit / Generate with AI) |
| `SpecWizard.tsx` | 372 | AI-assisted spec generation wizard (5 steps) |

#### Type safety (R12–R13)

- **`NodeMetadata` discriminated union** — `HarnessNode.metadata` changed from `Record<string, any>` to `NodeMetadata`, a union of seven typed interfaces: `AgentMetadata`, `SubagentMetadata`, `SkillMetadata`, `SteeringMetadata`, `HookMetadata`, `FeatureMetadata`, `DiscoveredMetadata`. Each interface includes a `[key: string]: unknown` index signature to accommodate arbitrary frontmatter fields without losing structural typing.
- **`_handleWebviewMessage` parameter** — changed from `data: any` to `data: unknown`; property accesses inside case blocks use explicit `as string` casts at the type boundary.
- **`HarnessEdge.metadata`** — narrowed from `Record<string, any>` to `Record<string, unknown>`.
- **`parserLogic.ts`** — `data.name` (gray-matter output) cast via `(data.name as string | undefined)` instead of implicit `any`.

### Changed

- **`dagre` → `devDependencies` (R14)** — the Dagre layout library is used only during the esbuild bundle step; it is no longer included in `dependencies` (and therefore no longer listed as a production VSIX dependency). Bundle size is unchanged.
- **`DESIGN.md` §4 + §6 (R15)** — stale `gray-matter` references updated to reflect the replacement with `yaml` + `src/frontmatter.ts` introduced in 0.5.1.

### Tests

- **`src/webview/layoutUtils.test.ts`** (new, 6 tests) — `getLayoutedElementsByProvider`: empty arrays, single agent node, row wrap at `MAX_NODES_PER_ROW`, feature nodes separate, multi-provider groups, non-arch edge filtering.
- **`src/messageDiscriminator.test.ts`** (new, 8 tests) — `isKnownWebviewMessage`: accepts all 28 known types, rejects empty object / string / null / undefined / unknown type / numeric type, accepts messages with extra payload fields.
- **Total: 372 tests** across 25 files (+15 new since 0.5.1).

---

## [0.5.1] — 2026-06-27

> Security patch release. No new features, no breaking changes. All 357 unit tests pass.

### Security

- **`form-data` CRLF injection** (GHSA-hmw2-7cc7-3qxx, high) — forced `form-data@4.0.6` via `npm overrides`. Transitive via `@vscode/vsce`.
- **`undici` multiple CVEs** (GHSA-vmh5-mc38-953g, GHSA-p88m-4jfj-68fv, GHSA-vxpw-j846-p89q, GHSA-hm92-r4w5-c3mj, GHSA-35p6-xmwp-9g52, GHSA-g8m3-5g58-fq7m, GHSA-pr7r-676h-xcf6, high) — TLS certificate bypass, HTTP header injection, WebSocket DoS, SOCKS5 proxy pool reuse, keep-alive poisoning, Set-Cookie downgrade, shared cache disclosure — forced `undici@7.28.0` via `npm overrides`. Transitive via `@vscode/vsce → cheerio`.
- **`diff` DoS** (GHSA-73rr-hh4g-fpgx, moderate) — quadratic complexity in `parsePatch`/`applyPatch` — forced `diff@9.0.0` via `npm overrides`. Transitive via `mocha`.
- **`js-yaml` DoS** (GHSA-h67p-54hq-rp68, moderate) — quadratic complexity in YAML merge-key alias handling — removed `gray-matter` (which pins `js-yaml@^3.x` with no upstream fix) and replaced it with a lightweight internal `src/frontmatter.ts` using the `yaml` package. The new module exposes the same `matter(content)` / `matter.stringify(body, data)` API used across all call sites.

### Technical

- `npm audit` — **0 vulnerabilities** (was 2 high + 2 moderate before this patch).
- `gray-matter` removed from `dependencies`; `yaml` added.
- `src/frontmatter.ts` introduced as the single frontmatter parsing entry point.
- No changes to extension behaviour, settings, or output format.

---

## [0.5.0] — 2026-06-20

> Headline feature: **Universal Agentic Architecture Detection & Advisory (FEAT-029)** — scans any workspace for agentic implementation signals, classifies maturity (L0–L5), identifies architecture patterns, renders discovered elements on the whiteboard, and generates actionable improvement suggestions. Plus: adapter-aware deduplication, Harness/SDD adoption events, SVG signal bar chart, and one-click scaffold.

### Added

#### FEAT-029 — Universal Agentic Architecture Detection & Advisory

- **30 declarative signal definitions** across 9 categories (prompts, rules, MCP, frameworks, tools, skills, agent scripts, memory, context) in `signalCatalog.ts`.
- **Signal scanner** (`signalScanner.ts`) — VS Code `findFiles`-based scanner with 200-file cap and excluded-dir filtering. 5 pattern types: yaml-frontmatter, json-key, import-statement, shell-command, regex. 21 tests.
- **Maturity classifier** (`maturityClassifier.ts`) — classifies workspaces L0 (no signals) through L5 (full lifecycle automation). 11 tests.
- **Pattern analyzer** (`patternAnalyzer.ts`) — detects 8 architecture patterns (Tool-Using Agent, Pipeline, Orchestrator-Worker, Multi-Agent, etc.) with confidence scoring. 11 tests.
- **Advisory engine** (`advisoryEngine.ts`) — 15+ suggestion rules across 6 categories, maturity-gated, per-suggestion dismiss tracking. 73 tests.
- **Layer integration** (`agenticDetector.ts`) — 3-layer orchestration (CLI/Install → Implementation → Methodology), file watcher, dismiss/restore persistence, adapter-aware dedup via `_getAdapterClaimedFiles()`.
- **Tree view** (`agenticDetectorProvider.ts`) — 579-line TreeDataProvider for the sidebar.
- **Harness/SDD adoption events** — `harnessDetected` / `sddDetected` events with transition tracking, `feature_list.json` watcher.
- **27 integration tests** for the detector layer.

#### Whiteboard Layer Visualization (Phase 5)

- **5 discovered node types** — `discovered-cli`, `discovered-implementation`, `discovered-harness`, `discovered-sdd`, `cli-install` with dashed/solid borders and acknowledgement icons.
- **Layer badges** — `[CLI]` (blue), `[IMPL]` (green), `[HARNESS]` (emerald), `[SDD]` (teal) on whiteboard nodes.
- **`profileToNodes.ts`** — transforms `AgenticProfile` → `HarnessNode[]` + `HarnessEdge[]`. 9 tests.
- **`DiscoveredNode.tsx`** — custom React Flow node with `?`/`✓` icons and evidence tooltip on click.
- **`LayerLegend.tsx`** — collapsible legend in the whiteboard toolbar.
- **Acknowledgement persistence** — `acknowledgeNode`/`isNodeAcknowledged` via `workspaceState`.
- **Inferred edges** — `edgeType: 'inferred'` with muted styling.

#### Advisory Panel Enhancements (Phase 6)

- **`AdvisoryPanel.tsx`** — 534-line React component with maturity badge, CLI list, pattern display, and suggestion cards.
- **SVG bar chart** — pure-SVG horizontal bars for all 9 signal categories, color-coded (grey for zero count), percentage-filled `<rect>` with zero dependencies.
- **One-click scaffold** (`scaffold.ts`) — `scaffoldAgenticJson()` and `scaffoldFeatureListJson()` generate `.agents/agentic.json` + `feature_list.json` from detected signals; handler in `extension.ts` re-scans after writing.
- **17 tests** for AdvisoryPanel.

### Technical

- Test suite: **357 unit tests** (23 files) — 29 new tests across all feature areas.
- Build: `npm run build` clean, no errors.
- All 29 features in `feature_list.json` are `done`.

## [0.4.1] — 2026-06-18

> Patch release: whiteboard layout overhaul and specs discovery fix. Feature chips remain visible but are now separated from the architectural hierarchy and rendered in a compact grid. No new features.

### Changed

#### Whiteboard layout — architectural hierarchy, no more horizontal overflow

- **Feature nodes repositioned.** Feature/spec nodes are now rendered as compact chips in a grid below the architectural graph, visually separated from the agent hierarchy. They no longer participate in the dagre layout and no longer inflate the sector horizontally. The `executing` edges (agent → feature) are excluded from the whiteboard graph so they do not contribute to layout width — features remain accessible via the SDD panel.
- **TB hierarchy with row-wrap.** The layout engine positions `agent → subagent → skill/steering/hook` in a strict top-to-bottom hierarchy without dagre. Each rank is laid out manually with a `MAX_NODES_PER_ROW = 4` cap: when a rank has more than 4 nodes they wrap into additional rows instead of extending horizontally. Sector width is now bounded and predictable regardless of how many subagents or skills a provider has.
- **`dagre` removed from the layout path.** `layoutUtils.ts` no longer imports dagre for the whiteboard layout. The dagre dependency remains in `package.json` for potential future use.
- **Node handle positions corrected** — structural nodes use `top`/`bottom` handles (TB flow).

#### Specs discovery — recursive, not hardcoded

- **`findSpecsRoot`** replaces the hardcoded `WORKSPACE_BASES = ['.', '.kiro']` list. Uses `vscode.workspace.findFiles('**/specs/FEATURE/requirements.md')` to locate the `specs/` directory anywhere in the workspace tree, regardless of nesting.
- **`invalidateSpecsRootCache`** — exported so callers can reset the cache after the first spec is written (first-create scenario).
- **`HarnessSddAdapter`** now uses `readTextMultiBase` (added in 0.4.0) for `feature_list.json` and `progress/progress.md`, picking up files under `.kiro/` automatically.

#### Code quality hooks — path migration

- KISS and DRY hook scripts (`on-file-saved-kiss-check.sh`, `on-file-saved-dry-check.sh`) moved from `hooks/` to `.kiro/hooks/` together with `kiss_check.py` and `dry_check.py`.
- `codeQualityRunner.ts` `HOOK_SCRIPTS` map updated to `.kiro/hooks/` paths.
- `agentic.json#hooks[]` `script` fields updated; `kiro_hook` field added pointing to the corresponding Kiro v1 JSON hook file.
- Five Kiro v1 hook files created under `.kiro/hooks/` (`kiss-check.json`, `dry-check.json`, `spec-created-validate.json`, `feature-done-notify.json`, `check-pass-timestamp.json`).

#### R4 diagnostic message (FEAT-028)

- `generateText` now returns a user-actionable error when no AI provider is available and no API key is configured: `"No AI provider available. Configure harness-dashboard.ai.apiKey … or install GitHub Copilot (vscode.lm). Diagnostic: <last error>"`.
- Unit test updated to assert the three parts of the message (`No AI provider available`, `harness-dashboard.ai.apiKey`, `GitHub Copilot`).

### Technical

- Test suite: **228 unit tests** (16 files) — unchanged count, all pass.
- Build: `npm run build` clean, no errors.
- `dagre` import removed from `layoutUtils.ts` (the dependency itself is retained).

> Adds 5 new features bringing the total to 28 done. FEAT-028 (Universal AI Provider) is the headline feature — AI spec generation works in Kiro and other IDEs without Copilot via configurable provider chain. FEAT-027 (KISS + DRY code quality hooks) enforces architectural principles on every save. FEAT-024/025/026 extend the whiteboard with steering, hooks, SDD management panel, and cross-framework discovery.

### Added

#### FEAT-028 — Universal AI Provider (provider chain)

- **Provider chain (Chain of Responsibility)**: `[vscodeLmProvider, createOpenAiCompatibleProvider]` — tries `vscode.lm` first, falls back to OpenAI-compatible API.
- **`AiProvider` interface** — `name`, `tryGenerate(prompt, options?)` — any provider is one `AiProvider` object.
- **`createOpenAiCompatibleProvider(defaults)`** — zero-dependency factory using Node.js built-in `https`. Configurable endpoint, model, API key.
- **`createProviderChain(providers, options)`** — tries providers in order; first success wins; last error if all fail.
- **`generateText(prompt, log?, options?)`** — backward-compatible entry point, unchanged signature.
- **3 settings** (`ai.apiKey`, `ai.endpoint`, `ai.model`) — fallback disabled by default (empty apiKey).
- **`harness-dashboard.checkLM` command** — diagnoses LM availability + runs a test generation; results shown in info/warning message with "View Output" action.
- **Settings gear button** — ⚙️ icon in the toolbar opens VS Code settings filtered to `@ext:marcmassacapo.harness-dashboard-vscode`.
- **Zero new npm dependencies** — `https` module used directly.
- **23 unit tests** covering all providers, chain logic, HTTP errors, and backward compatibility.
- **Traceability**: `progress/impl_universal-ai-provider.md` documents R<n>↔test mapping.

#### FEAT-027 — Code Quality On-Save Hooks (KISS + DRY)

- **KISS hook** (`hooks/kiss_check.py`) — checks for overengineering: long files >400 lines, long functions >80 lines, deep nesting >4 levels, unused parameters, excessive swallowed exceptions.
- **DRY hook** (`hooks/dry_check.py`) — checks for duplication: repeated string literals (>=12 chars, 3+ times), magic numbers, near-duplicate functions (Jaccard >= 0.85), duplicate interface/type definitions.
- **Two bash hooks** (`hooks/on-file-saved-kiss-check.sh`, `hooks/on-file-saved-dry-check.sh`) — triggered on TypeScript save in `src/`.
- **`hooks/code-quality-checks.json`** — JSON catalog listing all rules (runtime form of steering principles).
- **Registered in `agentic.json#hooks[]`** under events `on_file_saved_kiss` and `on_file_saved_dry`.
- **5 settings** (`verifyOnSave`, `blockOnSave`, `kissEnabled`, `dryEnabled`, `severity`).
- **`harness-dashboard.verifyCodeQuality` command** — manual verify of any chosen file.
- Reports issues to VS Code's Problems panel and an OutputChannel.

#### FEAT-025 — Enhanced SDD Panel

- **Dedicated SDD management panel** alongside the whiteboard — shows spec files (`requirements.md`, `design.md`, `tasks.md`) per feature.
- **Visual state badges** — feature chronology and status at a glance.
- **Inline spec editor** — edit spec files directly from the panel.
- **AI-assisted spec initiation** — integrate with the provider chain (vscode.lm → fallback) to generate EARS requirements, design decisions, or task lists with one click.

#### FEAT-024 — Steering & Hooks Observability

- **`steering` node type** — parses `agentic.json#steering[]`, reads steering markdown files, shows `steering → subagent` edges based on `applies_to`.
- **`hook` node type** — parses `agentic.json#hooks[]`, reads hook scripts, shows `hook → agent` edges.
- **Distinct visual styles** — steering files and hook scripts each get their own icon, colour, and shape.

#### FEAT-026 — Cross-framework hooks & steering discovery

- **Discovery layer** — scans both framework-specific roots (`.kiro/hooks/`, `.claude/hooks/`, etc.) and workspace root (`hooks/`, `steering/`) for hook/steering files.
- **Deduplication** — files found in both locations are shown once.
- **Per-adapter settings** — `hooksPath`, `steeringPath`, `discoverHooks`, `discoverSteering`.
- **Global settings** — `rootHooks`, `rootSteering` to control root-level discovery.
- **Backward-compatible** — FEAT-024's Harness-SDD handling unchanged.

### Changed

- **README.md** — version badge updated to 0.4.0; new features added to table; "What's new in 0.4.0" section; screenshot placeholders added.
- **`harness-dashboard.checkLM` command** — new command (category: "Harness Dashboard").
- **`harness-dashboard.verifyCodeQuality` command** — new command.
- **Settings gear button** added to the whiteboard toolbar.

### Technical

- Test suite: **228 unit tests** (Vitest, 16 files) — 87 new tests across 5 feature areas.
- All 28 features in `feature_list.json` are `done`.
- Lockfile regenerated with `npm install`; production dependency tree remains clean.
- `./check.sh`: all checks pass (only pre-existing ⚠️ `py_compile` warnings).

## [0.3.0] — 2026-06-14

> First published VSIX. FEAT-023 (configurable adapter paths + Kiro adapter + whiteboard polish) is the headline feature; backlog clearance and CI/CD hardening round out the release.

### Added

#### FEAT-023 — Configurable adapter paths + Kiro adapter + whiteboard UX polish

- **ConfigurationRegistry** (Part A) — singleton that lets users override adapter detection paths via VS Code settings. Five configurable adapters (Claude Code, Cursor, Gemini CLI, Copilot, Windsurf); two canonical adapters (Harness SDD, OpenCode) are not configurable. Six `contributes.configuration` entries in `package.json`. Cache is invalidated on `onDidChangeConfiguration`.
- **Kiro adapter** (Part B) — detects `.kiro/` files (agents, skills, relationships). First consumer of the ConfigurationRegistry. Registered as the 7th advertised adapter.
- **Whiteboard UX polish** (Part C) — `detectAndFixOverlaps()` guarantees no overlapping dagre-positioned nodes (4 px tolerance, 8 px stride, 5 iterations). Node appear animation (`@keyframes nodeAppear`, scale 0.85→1, 200 ms ease-out) with `prefers-reduced-motion: reduce` support. Edge style transitions animated at 150 ms. `fitView` eased to 400 ms `ease-in-out`.

#### Backlog clearance

- **Centralised style tokens** (P1) — extracted `SPACE`, `NODE_STYLES`, `HANDLE_ACCENT`, `HANDLE_PILL_BASE`, edge glow RGB tokens, animation keyframes, box-shadow helpers into `src/webview/styles.ts`. `CustomNode.tsx` and `index.tsx` now import from a single source of truth.
- **Publish VSIX workflow** (P2) — `.github/workflows/publish.yml` triggered on `v*.*.*` tags; runs `vsce package` + `vsce publish` with `VSCE_PAT` secret.
- **Codecov coverage upload** (P2) — CI workflow generates coverage via `@vitest/coverage-v8` and uploads to Codecov.
- **GitHub Actions SHA pinning** (P1) — `actions/checkout@v4` and `actions/setup-node@v4` pinned to commit SHAs.

### Changed

- **Published VSIX** — first public build at `harness-dashboard-vscode-0.3.0.vsix` (265 KB, 14 files).
- **Publisher identity** — `package.json#publisher` set to `marcmassacapo` (Marketplace identity).
- **CHANGELOG footnote** — explanatory note about test-count drift: each SDD feature adds 5–30 tests; the count reflects requirements, not a fixed target.
- **Zero npm audit warnings** — production dependency tree is clean.

### Removed

- **Duplicated CSS constants** — `SPACE`, `EASE_SMOOTH`, `nodeStyles`, `HANDLE_ACCENT`, `handlePillBase`, `hiddenHandleStyle` removed from component files; all now imported from `styles.ts`.

### Documentation

- `docs/configuration.md` — long-form ConfigurationRegistry reference (6 configurable adapters, 2 canonical, edge cases).
- `progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md` — full R↔T↔test traceability for FEAT-023 (22 requirements, 31 tasks).
- `progress/backlog.md` — completed items moved to "Completed" section; 3 remaining items documented as blocked.

### Technical

- Test suite: 141 unit tests (Vitest, 11 files) + 1 integration test (VS Code 1.124.2, 2.1 s).
- Coverage via `@vitest/coverage-v8`; reports to `coverage/` (lcov + text + html).
- `./check.sh`: 33 checks, 0 failures, 2 expected warnings (skipped CLI parity tests).
- All 23 SDD features in `feature_list.json` are `done`.

## [0.1.0] — 2026-06-08

> Renamed from *Harness Manager* to *Harness Dashboard* (identifier prefix: `harness-dashboard`).


### Added

- **Whiteboard canvas** — interactive React Flow graph of agents, subagents, skills and features
- **Edge types** — `manages` (smoothstep, blue), `uses` (dashed teal), `suggested` (animated amber flow), `discovered` (straight grey)
- **Per-type edge glow** — hover and selection states match the edge's own color; no more generic blue shadow
- **Semantic skill discovery** — TF-IDF cosine similarity suggests missing subagent↔skill connections
- **Idoneity scoring** — best semantic owner per skill; mismatch highlighting for misrouted skills
- **Inline Markdown viewer** — read SUBAGENT.md / SKILL.md in the detail panel without leaving the whiteboard
- **Edit in editor** — "✏ Edit File" button opens the Markdown file in the VS Code text editor
- **Toggle connections** — disable/enable skill connections; state persisted per workspace
- **Dismiss suggestions** — permanently hide unwanted suggestions (persisted across reloads)
- **Detail side panel** — slides in from the right; active node shows pulsing ring + "▶ Viewing" badge
- **Progress timeline** — SDD feature lifecycle (pending → spec_ready → in_progress → done)
- **Entity creation panel** — add agents, subagents and skills from the activity bar side panel
- **Cross-reference detection** — scans Markdown bodies for explicit skill references
- **Orphan detection** — surfaces subagents/skills present on disk but not registered in `agentic.json`
- **Custom icon** — monochrome SVG for activity bar; full-colour SVG for gallery
- **Output channel** — extension logs appear in *Output > Harness Dashboard* with severity levels

### Technical

- Extension Host: TypeScript strict mode, esbuild bundle, `vscode.LogOutputChannel`
- Webview: React 18 + React Flow 11 + `@vscode/webview-ui-toolkit`
- Test suite: 112 unit tests (Vitest), zero integration test dependencies
- Adapter pattern for future multi-framework support (FEAT-015 in progress)

## [0.2.0] — 2026-06-11

> Adds CI, governance guard, E2E test, and 5 new features (FEAT-015 through FEAT-022). All 22 SDD features shipped in this release are `done`; the project has 126 unit tests + 1 integration test + a governance regression guard that catches stale `FEAT-XXX` references in the backlog at `./check.sh` time.

### Added

- **Universal agent architecture reader (FEAT-015)** — parse and visualise agent architectures from Claude Code, Gemini CLI, Cursor, GitHub Copilot, and OpenCode alongside Harness SDD, all on a single whiteboard. The `WindsurfAdapter` source still ships for users with existing Windsurf workspaces, but Windsurf is no longer advertised as a supported framework (the product was discontinued after FEAT-015 shipped; see ADR-003).
- **Relationship visual refinement (FEAT-016)** — per-type edge routing, glow, label pill borders, animated `suggested` edges, hover/selected z-index layering.
- **Node position persistence + handle-pill linking (FEAT-017)** — manually moved nodes stay where you put them after a graph refresh; drag from one node's pill to another to create an edge directly.
- **End-to-end integration test (FEAT-021)** — `@vscode/test-electron` test that runs the extension in a real VS Code instance and exercises the critical user path (activate → click node → open in editor) in 2.1 s. Runs locally with `npm run test:integration` and in CI on every push/PR.
- **GitHub Actions CI (FEAT-018)** — workflow at `.github/workflows/ci.yml` runs `npm ci && npm run build && npm test && ./check.sh` on every push and PR to `main`, with a concurrency group that cancels obsolete runs.
- **Governance guard (FEAT-019)** — `./check.sh` now fails the build if `DESIGN.md`, `progress/backlog.md`, or `progress/decisions.md` still contains a template placeholder, or if the backlog references a `done` feature. First ADR (`ADR-001: Adopt the Harness SDD framework`) + second ADR (`ADR-002: Accept the GitHub repository name harness-manager and document the mismatch`).
- **`.vsix` gitignore cleanup (FEAT-020)** — `*.vsix` and `.vscode-test/` are now in `.gitignore`; the three committed binaries are untracked and no longer pollute `git status`.
- **Repository rename decision (FEAT-022)** — the GitHub repo is intentionally named `harness-manager` while the product is `harness-dashboard`. ADR-002 documents the decision and the `## Note on the repository name` section in `README.md` explains the mismatch.

### Technical

- Test suite: 126 unit tests (Vitest) + 1 integration test (Mocha + `@vscode/test-electron`). Full chain (`npm run build && npm test && npm run test:integration && ./check.sh`) completes in < 30 s.
- New devDependencies: `mocha@^11.7.6`, `@types/mocha@^10.0.10`, `@vscode/test-electron@^3.0.0`.
- `esbuild.js` now produces three new build targets (`runIntegrationTests.cjs`, `bootstrap.cjs`, `criticalPath.test.cjs`) into `out/test/integration/` (not `dist/`, so they do NOT ship in the production VSIX).
- `vitest.config.ts` excludes `src/test/integration/**` from the Vitest run, keeping unit and integration suites disjoint.
- Harness framework sync: `render.py` (+61 LOC for `_merge_unique_ordered` and `_sanitize_template_body` helpers), `AGENTS.md` (+7 LOC for the "Skill Loading Mechanism" block per agentskills.io), `BOOTSTRAP.md` (note about programmatic opencode render), `check.sh` (new `npm test -- --run` invocation + CLI Adapter Tests section), deletion of obsolete `opencode.json.tmpl` (now generated programmatically).
- A pre-existing bug in `check.sh` (the feature-list validator heredoc swallowed Python's exit code) was fixed as part of FEAT-018; without the fix, R8 of the ci-github-actions spec was technically unproven.

### Governance

- This is the first release where every shipped feature has a complete R↔T↔test traceability map in `progress/impl_<feature>.md` (5 new impl reports added: ci-github-actions, governance-docs, vsix-gitignore-cleanup, e2e-integration-test, repo-rename-decision).
- The governance guard (FEAT-019) has already caught stale `FEAT-XXX` references in the backlog during FEAT-020, FEAT-021, and FEAT-022 implementation — it works as designed.
- Two ADRs are now in `progress/decisions.md`. The format template at the top of the file has been rewritten as prose to avoid false-positive matches against the new governance regex.

### Backlog (post-0.2.0)

- P0: land the CI workflow on `main` and verify the deferred T7/T11/T12 in the first real PR (operational, not a code change).
- P1: validate the 7 universal adapters with real-world repos; refactor webview styles into a `webviewStyles.ts` helper; pin GitHub Actions to commit SHAs.
- P2: Codecov, publish workflow, animated screenshots.
- Tech-debt: `npm audit` warnings; publisher identity (`marcmassacapo` vs `marcmassa`, out of scope per ADR-002); deprecate `npx vitest run` direct invocation; CHANGELOG test-count footnote.

