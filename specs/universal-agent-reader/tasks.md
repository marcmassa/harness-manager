# Tasks — Universal Agent Architecture Reader (FEAT-015)

> Implementation plan. Each task references the requirement(s) it satisfies.
> Execute sequentially. Mark `[x]` as completed.

---

## Phase 1 — Adapter Foundation

- [ ] **T1** — Create `src/adapters/IAgentAdapter.ts` with the `IAgentAdapter` interface (`id`, `detect`, `parse`, `watchGlobs`) and the `mergeResults()` helper function. **(R1, R2)**

- [ ] **T2** — Create `src/adapters/AdapterRegistry.ts`: holds an ordered array of `IAgentAdapter`, runs `detect()` on each, calls `parse()` on matching adapters, merges results via `mergeResults()`, populates `ParserResult.detectedFrameworks: string[]`. **(R2, R10)**

- [ ] **T3** — Extend `ParserResult` in `src/types.ts` with `detectedFrameworks?: string[]`. **(R2, R10)**

- [ ] **T4** — Refactor `HarnessParser` into `src/adapters/HarnessSddAdapter.ts` implementing `IAgentAdapter`. `extension.ts` switches from `new HarnessParser()` to `new AdapterRegistry([...adapters])`. **(R3)**

---

## Phase 2 — Per-Format Adapters

- [ ] **T5** — Implement `src/adapters/ClaudeCodeAdapter.ts`: detect `CLAUDE.md || .claude/agents/`, parse `CLAUDE.md` → root `agent` node, parse `.claude/agents/*.md` YAML frontmatter → `subagent` nodes, add `manages` edges. Use `gray-matter`. **(R4)**

- [ ] **T6** — Implement `src/adapters/GeminiCliAdapter.ts`: detect `GEMINI.md`, parse it as root `agent` node (H1 title → label), parse `.gemini/commands/*.toml` → `skill` nodes via minimal key-value TOML reader (no external dep). **(R5)**

- [ ] **T7** — Implement `src/adapters/CursorAdapter.ts`: detect `.cursor/rules/ || .cursorrules`, parse `*.mdc` files via `gray-matter`; `alwaysApply: true` or no `globs` → `agent` node; others → `subagent` node. **(R6)**

- [ ] **T8** — Implement `src/adapters/CopilotAdapter.ts`: detect `.github/copilot-instructions.md || .github/instructions/*.instructions.md || .vscode/prompts/*.prompt.md`; instructions files → `subagent` nodes (using `applyTo` frontmatter as description); `.prompt.md` files → `skill` nodes; `.github/copilot-instructions.md` → root `agent` node. **(R7)**

- [ ] **T9** — Implement `src/adapters/OpenCodeAdapter.ts`: detect `opencode.json || opencode.jsonc`; parse `subagents[]` array → `subagent` nodes; workspace name → root `agent` node. **(R8)**

- [ ] **T10** — Implement `src/adapters/WindsurfAdapter.ts`: detect `.windsurf/rules/*.md || .windsurfrc`; parse `.windsurf/rules/*.md` → `subagent` nodes with `_discovery: 'windsurf-heuristic'`; create synthetic root `agent` node. **(R9)**

- [ ] **T11** — In each adapter (T5–T10): prefix all node ids with `${adapterId}::` to prevent multi-framework collisions; add `_framework` and `_frameworkLabel` to every node's metadata. **(R11)**

---

## Phase 3 — Error Handling & File Watching

- [ ] **T12** — Wrap each `adapter.parse()` call in `AdapterRegistry` with try/catch; on error log `this._log.warn(\`[${adapter.id()}] parse failed: ${err.message}\`)` and skip that adapter's result. **(R12)**

- [ ] **T13** — Extend `extension.ts` `activate()` to collect `adapter.watchGlobs()` from all registered adapters, union with existing globs, and update `createFileSystemWatcher` patterns. **(R14)**

---

## Phase 4 — UI

- [ ] **T14** — Add `detectedFrameworks?: string[]` to the `init` message payload passed to the webview. **(R10)**

- [ ] **T15** — Add `FrameworkBadge` inline component in `index.tsx` toolbar: renders a pill per framework name, positioned between "Suggestions ✓" and "Add Entity". Display only when `frameworks.length > 0`. **(R10)**

- [ ] **T16** — Extend `CustomNode` in `CustomNode.tsx`: when `data.metadata._framework` is set, render a 4px left-border color accent derived from a framework→color map (7 colors, one per adapter). **(R11)**

- [ ] **T17** — Add `EmptyState` inline component in `index.tsx`: rendered when `data.graph.nodes.length === 0`. Shows a table of supported frameworks + their required file signatures. **(R13)**

---

## Phase 5 — Tests

- [ ] **T18** — Unit tests for `HarnessSddAdapter`: verify existing 96 passing tests still pass after refactor (no regression). **(R3)**

- [ ] **T19** — Unit test `ClaudeCodeAdapter`: mock `.claude/agents/impl.md` with YAML frontmatter → expect `subagent` node with correct label and `manages` edge. **(R4)**

- [ ] **T20** — Unit test `GeminiCliAdapter`: mock `GEMINI.md` + `.gemini/commands/status.toml` → expect `agent` node + `skill` node + `uses` edge. **(R5)**

- [ ] **T21** — Unit test `CursorAdapter`: mock `.cursor/rules/global.mdc` (`alwaysApply: true`) + `.cursor/rules/ts.mdc` (`globs: "**/*.ts"`) → expect `agent` node + `subagent` node. **(R6)**

- [ ] **T22** — Unit test `CopilotAdapter`: mock `.github/copilot-instructions.md` + `.vscode/prompts/refactor.prompt.md` → expect `agent` + `skill` nodes. **(R7)**

- [ ] **T23** — Unit test `AdapterRegistry.mergeResults()`: two adapters both emit node id `"agent"` → deduplicated to one node (first-wins). **(R2)**

- [ ] **T24** — Unit test error path: adapter `parse()` throws → registry continues, `detectedFrameworks` does not include failing adapter. **(R12)**

---

## Traceability Matrix

| Req | Tasks |
|-----|-------|
| R1 | T1 |
| R2 | T1, T2, T3, T23 |
| R3 | T4, T18 |
| R4 | T5, T11, T19 |
| R5 | T6, T11, T20 |
| R6 | T7, T11, T21 |
| R7 | T8, T11, T22 |
| R8 | T9, T11 |
| R9 | T10, T11 |
| R10 | T2, T3, T14, T15 |
| R11 | T11, T16 |
| R12 | T12, T24 |
| R13 | T17 |
| R14 | T13 |
