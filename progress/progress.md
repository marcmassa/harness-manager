# Progress Log

## [2026-06-08] FEAT-016: relationship-visual-refinement (COMPLETED)
- **Objective:** Improve edge visual quality and interaction: per-type routing, per-type CSS shadows/glows, label pill borders colored by edge type, animated `suggested` edges, handle-pill accent colors, Z-index layering for hovered/selected edges.
- **Outcome:** Implemented T1→T15 across three files. Removed global blue `drop-shadow` rules; added per-type `.harness-edge--<type>` CSS blocks with normal/hover/selected states. Added `@keyframes dash-scroll` for `suggested` edges. Added `EDGE_TYPE_ROUTING` constant and applied `type` + `className` to all edge objects. Fixed `labelStyle.border` to use edge stroke color (triple condition: mismatch / disabled / normal). Added `hoveredEdgeId` state + handlers and unified `edgesWithZIndex` memo (highlight flash now #4ec9b0). Updated `handleChangeLabel` and `onAddSkill` to propagate `type`, `className`, and colored border. Added `HANDLE_ACCENT` lookup in `CustomNode` and applied accent color to handle pills on hover.
- **Tests:** 16 new unit tests in `src/webview/edgeMapping.test.ts` (T13: EDGE_TYPE_ROUTING R1, T14: labelStyle/className R2+R5, T15: HANDLE_ACCENT R7). Total: 112 tests passing.
- **Traceability:**

| Req | Test(s) |
|-----|---------|
| R1  | T13 (edgeMapping.test.ts — EDGE_TYPE_ROUTING), T16 (manual smoke) |
| R2  | T14 (edgeMapping.test.ts — className), CSS per-type blocks in index.tsx |
| R3  | CSS `:hover` rules per type in index.tsx |
| R4  | `edgesWithZIndex` memo, CSS `.selected` rules in index.tsx |
| R5  | T14 (edgeMapping.test.ts — labelStyle.border), initialEdges map |
| R6  | `@keyframes dash-scroll`, `.harness-edge--suggested` CSS |
| R7  | T15 (edgeMapping.test.ts — HANDLE_ACCENT), CustomNode accent pills |
| R8  | `edgesWithZIndex` highlight override (#4ec9b0), onAddSkill newEdge |
| R9  | `hoveredEdgeId` state, onEdgeMouseEnter/Leave, zIndex in memo |

- **Reviewer:** typescript-implementer (PASSED — `npm run build` + `npx vitest run` all green)


- **Outcome:** Successfully implemented VS Code extension with React Webview, esbuild bundling, and two-way messaging.
- **Traceability:** R1-R10 verified via manual build and unit tests with `@requirement` tags.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-002: harness-parser (COMPLETED)
- **Objective:** Implement the backend logic to parse Harness artifacts into a graph model.
- **Outcome:** Created a robust `HarnessParser` with JSON and Markdown (gray-matter) support. Integrated `FileSystemWatcher` for real-time updates.
- **Traceability:** R1-R10 verified via unit tests in `src/parserLogic.test.ts`.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-003: whiteboard-canvas (COMPLETED)
- **Objective:** Visualize the Harness structure interactively using React Flow.
- **Outcome:** Integrated React Flow and Dagre for auto-layout. Implemented custom VS Code-themed nodes for Agents, Sub-agents, Skills, and Features. Added a detail panel for metadata exploration.
- **Traceability:** R1-R11 verified via visual build and framework checks.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-004: graph-editor (COMPLETED)
- **Objective:** Enable visual editing (creation/linking) of agents and skills with persistent updates.
- **Outcome:** Implemented `HarnessWriter` with immediate disk persistence. Added visual node creation, edge linking (connecting skills to agents), and an editable detail panel.
- **Traceability:** R1-R13 verified via interactive testing and file system validation.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-005: progress-timeline (COMPLETED)
- **Objective:** Visualize the project's SDD history in a git-style timeline.
- **Outcome:** Enhanced `HarnessParser` to read `progress.md`. Implemented a `TimelineView` with chronological milestones and a tabbed navigation system to switch from the Whiteboard.
- **Traceability:** R1-R9 verified via visual verification and log parsing.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-05] FEAT-006: ui-ux-refinement (COMPLETED)
- **Objective:** Fix missing nodes, optimize layout height, and improve detail panel visibility.
- **Outcome:** Refactored parser to ensure all agents from `agentic.json` are always visible. Implemented 100% height flex-layout. Added a fixed, scrollable detail footer. Integrated automatic `fitView`.
- **Traceability:** R1-R9 verified via visual layout audit and parser verification.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-007: subagent-skill-relationships (COMPLETED)
- **Objective:** Visualize subagent-skill relationships in the whiteboard with proper hierarchical layout.
- **Outcome:** Added `skills` arrays to all subagents in `agentic.json` and `## Skills` sections to SUBAGENT.md files in both harness-manager and hypermove projects. Enhanced `parserLogic.ts` with edge deduplication (R9) and missing skill validation (R8). All 6 tests pass.
- **Traceability:** R1-R9 verified via unit tests and check.sh.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-008: ui-ux-visual-design (COMPLETED)
- **Objective:** Improve node styling, edge clarity, spacing consistency, hover/selection feedback, empty states, and detail panel layout.
- **Outcome:** Redesigned CustomNode with distinct shapes/colors per type, fixed hover (outline+box-shadow instead of transform), improved edge visibility (high-contrast hardcoded colors, thicker strokes, glow filter), redesigned handles (14px colored ports), popIn (+) button, consistent 4px spacing scale, skeleton loading, empty state timeline, slide-up detail panel animation. All colors use `--vscode-*` CSS variables.
- **Traceability:** R1-R11 verified via visual inspection and `./check.sh`.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-009: relationship-editor-md-viewer-side-panel (COMPLETED)
- **Objective:** Allow edge deletion/modification, view SUBAGENT.md/SKILL.md on node click, side panel for entity creation with Agent Skills spec fields.
- **Outcome:** Implemented edge context menu (Delete + Change Label) with VS Code confirmation dialog (R1/R2/R8/R9). MD file viewer in detail panel showing raw content with file-not-found fallback (R3/R10). Replaced inline "Add Entity" form with a side panel featuring full Agent Skills spec fields: name (kebab-case), description, license, compatibility, author, version (R4/R5/R6/R7). All 14 tests pass.
- **Traceability:** R1-R10 verified via 7 new unit tests (14 total across 3 test files).
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-010: semantic-skill-discovery (COMPLETED)
- **Objective:** Infers subagent↔skill relationships from description texts using TF-IDF cosine similarity, rendered as suggested edges on the whiteboard. User can accept to convert to hard-linked uses edges. Optional vscode.lm LLM re-ranking.
- **Outcome:** Created `src/semanticMatcher.ts` with TF-IDF vectorizer, cosine similarity, and LLM re-ranking (via dependency injection). Added `suggested` edge type (amber dashed #d4a84a) visually distinct from `uses`, `discovered`, `manages`, `executing`. EdgeContextMenu shows "Accept Suggestion → uses" for suggested edges. Node right-click shows "Show skill suggestions" dialog with score-per-skill list. 💡 badge on subagent nodes with pending suggestions. All 41 tests pass.
- **Traceability:** R1-R10 verified via 20 new tests in `src/semanticMatcher.test.ts`.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-011: agent-skill-idoneity (COMPLETED)
- **Objective:** Refactors subagent↔skill relationships to be driven by bidirectional semantic idoneity. Computes composite TF-IDF scores for all (subagent, skill) pairs in both directions, assigns a best semantic owner per skill, highlights mismatches where current `uses` differs from the best owner by ≥0.2 gap, and modulates edge styling by idoneity score.
- **Outcome:** Created `src/idoneity.ts` with `computeIdoneityMatrix()` (forward+reverse+composite), `detectMismatches()` (0.2 gap threshold). Skill nodes show `→ subagentX (score)` best-owner badge. Uses edges styled by idoneity (high ≥0.7 thick/opaque, medium ≥0.4, low <0.4 thin/faded). Mismatched skills have orange pulsing border + ⚠️ MISMATCH badge. Subagent context menu shows "Show idoneous skills (N)" with ranked list + score bars. Re-assignment support via "Suggest as subagent of <bestOwner>". Edge labels show idoneity score. All 59 tests pass (41 old + 18 new).
- **Traceability:** R1-R10 verified via 18 new tests in `src/idoneity.test.ts`.
- **Reviewer:** reviewer-vscode (PASSED)

## [2026-06-08] FEAT-012: enhanced-entity-intelligence (COMPLETED)
- **Objective:** Improve subagent/skill detection and agent-skill relationship inference with full-body semantic signal (instead of only frontmatter description), cross-reference scanning from markdown bodies, name-boosted TF-IDF scoring, n-gram support for phrase-level matching, orphan subagent detection, and elimination of the arbitrary 500-char body truncation.
- **Outcome:** Stored full body in `metadata._fullBody` (kept `metadata.body` at 500 chars for display). Added `scanCrossReferences()` for markdown/wiki-link detection → generates `suggested` edges with `🔗` prefix. Added `extractNameTokens()` for name-boost (R4: 1.2x cosine multiplier, R5: +0.05 per name token cap +0.2). Added `nGramSize` parameter for bigram support. Orphan subagent detection flags SUBAGENT.md files not in agentic.json with dashed/grayscale style + Activate button. Fix: edge deletion was broken by idoneity score in labels — stored `originalLabel` in edge `data`. All 88 tests pass.
- **Traceability:** R1-R10 verified via 29 new tests across `parserLogic.test.ts` (16) and `semanticMatcher.test.ts` (15).
- **Reviewer:** reviewer-vscode (PASSED)

# MVP Summary
The Harness Manager Visualizer MVP is now complete and refined. 
- Integrated VS Code Webview with React + esbuild.
- Automatic Harness graph parsing (JSON + Markdown).
- Interactive Whiteboard with hierarchical auto-layout.
- Visual editing (Create/Link agents and skills) with disk persistence.
- SDD Progress Timeline.
- Responsive design optimized for VS Code sidebar.
