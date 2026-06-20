# FEAT-029 — Universal Agentic Architecture Detection & Advisory — Tasks

> **Traceability key:** Each task references the requirement(s) it fulfills as `[Rn]`.
> **Test tasks** are marked with `[TEST Rn]`.

---

## Phase 1 — Foundation: Signal Scanner (Layer 2)

- [ ] **T1**: Create `src/agentic-detector/` module directory with `types.ts` defining all types: `AgenticLayer`, `CLIInstall`, `SignalCategory`, `SignalMatch`, `SignalCategoryResult`, `MethodologyInfo`, `MaturityLevel` + `MATURITY_DEFINITIONS`, `MaturityInfo`, `ArchitecturePattern`, `PatternMatch`, `Suggestion`, `SignalDefinition`, `ContentPattern`, `AgenticProfile`. [R1, R2]
- [ ] **T2**: Implement `signalCatalog.ts` with all signal definitions across 9 categories (`prompts`, `rules`, `mcp`, `agent-methodologies`, `tools`, `skills`, `agent-scripts`, `memory`, `context-identity`). Each definition is a declarative data object with globs + optional content heuristics. [R5–R13]
- [ ] **T3**: Implement `signalScanner.ts` — `scanAllCategories(rootUri)` that runs VS Code `findFiles` for each signal in parallel, applies content heuristics, caps at 200 files per category, excludes build dirs (`node_modules/`, `.git/`, `dist/`, `build/`, `.venv/`, `__pycache__/`, `out/`, `coverage/`), returns `SignalCategoryResult[]`. [R1, R2, R3, R51, R52, R53]
- [ ] **T4**: Implement file watcher in `signalScanner.ts` — subscribe to VS Code's `workspace.onDidCreateFiles`, `onDidDeleteFiles`, `onDidRenameFiles`, filter by signal globs, re-scan affected category within 5 seconds. [R4, R20]
- [ ] **T5**: Write unit tests for `signalScanner.ts` — fixture workspace with known signal files, verify all 9 categories, verify 200-file cap, verify excluded dirs, verify content heuristics, verify file watcher triggers. [TEST R1–R13, R51–R53]

## Phase 2 — Classification: Maturity + Patterns (All Layers)

- [ ] **T6**: Implement `maturityClassifier.ts` — `classify(profile: AgenticProfile): MaturityInfo` based on the three-layer algorithm: count L1 CLIs, count L2 signal categories with organized dirs, check L3 methodology. Map to L0–L5. [R18, R19]
- [ ] **T7**: Implement maturity re-classification on change events — wire to file watcher so maturity updates when signals change. [R20]
- [ ] **T8**: Implement `patternAnalyzer.ts` — `analyze(categories, allMatches): PatternMatch[]` with 8 architecture patterns and confidence formulas based on signal combinations. [R21, R22]
- [ ] **T9**: Implement confidence threshold — patterns below 70% get `status: 'tentative'`. [R23]
- [ ] **T10**: Write unit tests for `maturityClassifier.ts` — test all 6 levels with controlled Layer-1 + Layer-2 + Layer-3 fixture combinations. [TEST R18–R20]
- [ ] **T11**: Write unit tests for `patternAnalyzer.ts` — test all 8 patterns with fixture combinations, verify confidence formula, verify tentative boundary at 70%. [TEST R21–R23]

## Phase 3 — Advisory Engine (All Layers)

- [ ] **T12**: Implement `advisoryEngine.ts` — `generate(profile): Suggestion[]` with 15+ suggestion rules, each with `id`, `title`, `description`, `impact`, `effort`, `layer`, `category`, `maturityTrigger`, optional `actionType` and `actionPayload`. [R24, R25]
- [ ] **T13**: Implement suggestion dedup — filter out `dismissedSuggestionIds` from results. Persist dismissal via VS Code `workspaceState`. [R26]
- [ ] **T14**: Implement maturity-gated suggestions — each suggestion declares which maturity levels trigger it (R27–R34). Ensure L0→L5 progressive disclosure. [R27–R34]
- [ ] **T15**: Write unit tests for `advisoryEngine.ts` — test each suggestion rule with controlled profiles at every maturity level, test dismissal persistence, test priority ordering. [TEST R24–R34]

## Phase 4 — Integration: AgenticDetector + Layer Integrator

- [ ] **T16**: Implement `layerIntegrator.ts` — combines data from all three layers:
  - Queries `adapterRegistry.ts` for detected CLI installs (Layer 1)
  - Runs `signalScanner.scanAllCategories()` (Layer 2, includes Harness signals)
  - Checks for SDD methodology (Layer 3): `feature_list.json` with lifecycle statuses + `specs/**/{requirements,design,tasks}.md` + `progress/{current,history}.md`
  - Returns a unified `AgenticProfile` with separate detection of Harness (L2) and SDD (L3) [R14–R18]

- [ ] **T17**: Implement `agenticDetector.ts` — singleton orchestrator that runs layerIntegrator → maturityClassifier → patternAnalyzer → advisoryEngine in sequence, caches `AgenticProfile` in memory, provides `getProfile()`, `refresh()`, `onDidChangeProfile()`. [R3, R20, R46]

- [ ] **T18**: Wire in `extension.ts` — construct AgenticDetector at activation, call `refresh()` on first activation, subscribe to file watchers, pass profile to webview via message protocol. [R50]

- [ ] **T19**: Register command `harness-dashboard.scanAgenticProfile` — triggers `refresh()` and logs full results (per-category counts + layer breakdown) to OutputChannel. [R48, R49]

- [ ] **T20**: Wire deduplication with existing adapters — check if a file path is already claimed by a known adapter before creating a discovered node (R55). Adapter nodes stay in Layer 1; discovered nodes go to Layer 2. [R55]

- [ ] **T21**: Wire Harness adoption event — listen for `onDidCreateFiles` for `.agents/agentic.json`, add `[HARNESS]` badge to Layer 2, update maturity. Also listen for SDD adoption: `feature_list.json` creation with lifecycle fields, add `[SDD]` badge to Layer 3. When both Harness+SDD are active, re-classify to L5. [R58]

- [ ] **T22**: Write integration tests for `agenticDetector.ts` — full pipeline with mock workspaces at different maturity levels; verify three layers combined; verify dedup; verify methodology adoption triggers re-classification. [TEST R3, R14–R17, R46, R50, R55, R56]

## Phase 5 — Whiteboard: Layer Visualization + Discovered Nodes

- [ ] **T23**: Extend `HarnessNode` type in `src/types.ts` — add `layer: AgenticLayer`, add node types `'discovered-agent'`, `'discovered-skill'`, `'discovered-tool'`, `'discovered-resource'`, add `acknowledged: boolean`, `evidence: SignalMatch | null`. [R35, R37]

- [ ] **T24**: Add `HarnessEdge` type for inferred edges — `edgeType: 'inferred'`, `inferenceRule: string`, style with `stroke-dasharray: 5,5`. [R40]

- [ ] **T25**: Implement node layer badges — render `[CLI]` (blue, Layer 1), `[IMPL]` (green, Layer 2 generic), `[HARNESS]` (emerald-green, Layer 2 Harness), `[SDD]` (teal, Layer 3) badge on each node's top-left corner, colored per badge type. [R37, R38]

- [ ] **T26**: Implement discovered node visual style — dashed border, muted pastel palette, `?` icon for unacknowledged, `✓` for acknowledged, pulsing indicator for unacknowledged nodes. Tooltip: "Heuristically detected — click for evidence". [R37, R38, R41]

- [ ] **T27**: Transform `AgenticProfile` signal matches into discovered `HarnessNode[]` + inferred `HarnessEdge[]` — aggregate files into logical nodes (agent per script/root, skill per knowledge file, tool per definition, resource per prompt/rules/context dir). [R37, R40]

- [ ] **T28**: Implement click handler for discovered nodes — show evidence popup (file path, matched pattern, confidence, evidence line). On close, mark as acknowledged. [R39]

- [ ] **T29**: Persist `acknowledgedNodeIds` per workspace via VS Code `workspaceState`. [R38]

- [ ] **T30**: Implement Layer Legend toggle (collapsible) in the whiteboard toolbar — explains all four badge types (`[CLI]`, `[IMPL]`, `[HARNESS]`, `[SDD]`), discovered node styles (`?`/`✓`), and inferred edge style (dashed). [R44]

- [ ] **T31**: Write tests for discovered node rendering — verify node creation from profile, verify aggregation logic, verify style application, verify acknowledgment flow, verify layer badge assignment, verify inferred edge creation. [TEST R35–R42]

## Phase 6 — Agentic Profile Tab

- [ ] **T32**: Create `AgenticProfileTab.tsx` React component with sections:
  - Maturity badge (color-coded L0–L5, with description + "next level" hint)
  - Three-layer status summary (CLI installs per L1, Harness active + categories per L2, SDD active per L3, with gap indicators)
  - Signal strength bar chart (9 categories, percentage bars, no external chart library)
  - Architecture patterns list (detected/tentative with confidence %)
  - Top suggestions (expandable cards with dismiss button + optional action button)
  [R43, R44, R45]

- [ ] **T33**: Implement custom SVG bar chart for signal strength — horizontal bars, labeled per category, colored by category, percentage width. Pure React SVG (no chart dependencies). [R44]

- [ ] **T34**: Implement "Apply Harness+SDD" scaffold action button in suggestions — when clicked:
  1. Detect current CLI from Layer 1 (or default to Claude Code)
  2. Generate `.agents/agentic.json` with minimal Harness template based on detected Layer 2 signals
  3. Generate minimal `feature_list.json` with a sample SDD feature entry
  4. Generate minimal `specs/` structure with placeholder requirements/design/tasks
  5. Show success notification: "Harness+SDD scaffolded. Re-scanning..."
  6. Trigger `refresh()` to detect Harness (L2) + SDD (L3) → re-classify to L5
  [R49]

- [ ] **T35**: Wire profile tab updates — subscribe to `AgenticDetector.onDidChangeProfile`, update all sections within 5 seconds. [R46]

- [ ] **T36**: Add "Agentic Profile" as a third tab in the webview tab bar, alongside "Whiteboard" and "SDD Panel". Highlight tab if new profile differs from last seen. [R43]

- [ ] **T37**: Write tests for `AgenticProfileTab` — render with mock profiles at all 6 maturity levels, verify maturity badge color, verify signal chart rendering, verify suggestion display + dismiss + action button, verify "Apply Harness SDD" scaffold action. [TEST R43–R47]

## Phase 7 — Verification & Polish

- [ ] **T38**: End-to-end smoke test — open a workspace without any known framework but with prompt files + rules file, verify discovered nodes appear on whiteboard with layer badges, verify Agentic Profile tab shows correct maturity, verify inferred edges present. [All requirements integration]

- [ ] **T39**: Performance benchmark — measure full scan on workspace with 10,000 files (including excluded dirs), verify <5s. [R52]

- [ ] **T40**: Update README.md with "Agentic Profile" feature description + layer model explanation. [docs]

- [ ] **T41**: Update CHANGELOG.md with FEAT-029 entry. [docs]

- [ ] **T42**: Final `./check.sh` — ensure all checks pass. [governance]

---

## Summary

| Phase | Tasks | Requirements | New Test Files |
|-------|-------|-------------|----------------|
| 1 — Signal Scanner | T1–T5 (5 tasks) | R1–R13, R51–R53 | `signalScanner.test.ts` |
| 2 — Classification | T6–T11 (6 tasks) | R18–R23 | `maturityClassifier.test.ts`, `patternAnalyzer.test.ts` |
| 3 — Advisory Engine | T12–T15 (4 tasks) | R24–R34 | `advisoryEngine.test.ts` |
| 4 — Layer Integration | T16–T22 (7 tasks) | R3, R14–R17, R46, R48–R50, R55–R56 | `agenticDetector.test.ts`, `layerIntegrator.test.ts` |
| 5 — Whiteboard | T23–T31 (9 tasks) | R35–R42 | Whiteboard render + edge tests |
| 6 — Profile Tab | T32–T37 (6 tasks) | R43–R47 | `AgenticProfileTab.test.tsx` |
| 7 — Verification | T38–T42 (5 tasks) | All | Smoke + perf |
| **Total** | **42 tasks** | **56 requirements** | **~210 new tests expected** |

---

## Key Milestones

| Milestone | Phase | Trigger |
|-----------|-------|---------|
| First scan works | Phase 1 | T3 green |
| First maturity computed | Phase 2 | T6 green |
| First suggestion generated | Phase 3 | T12 green |
| Three layers combined | Phase 4 | T16 green |
| Discovered node on whiteboard | Phase 5 | T27 green |
| New tab visible | Phase 6 | T36 green |
| Feature complete | Phase 7 | T42 green |
