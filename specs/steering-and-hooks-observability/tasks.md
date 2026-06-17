# Tasks — Steering & Hooks Observability

> Feature FEAT-024. Implements R1–R11. Execute in order.

## Types & Foundation

- [ ] **T1** — Extend `NodeType` in `src/types.ts`: add `'steering' | 'hook'`. _(R1, R2, R8)_
- [ ] **T2** — Extend `EdgeLabel` in `src/types.ts`: add `'governs' | 'triggers'`. _(R6, R7)_
- [ ] **T3** — Add `NODE_STYLES['steering']` and `NODE_STYLES['hook']` entries, plus `HANDLE_ACCENT` entries in `src/webview/styles.ts`. _(R8)_
- [ ] **T4** — Add `'governs'` and `'triggers'` entries to `EDGE_GLOW_RGB` in `src/webview/styles.ts`. _(R6, R7)_

## Parser

- [ ] **T5** — Extend `parseAgenticJson()` in `src/parserLogic.ts` to read `data.steering[]` and create steering nodes with metadata (`name`, `file`, `description`, `applies_to`). _(R1)_
- [ ] **T6** — Extend `parseAgenticJson()` to read `data.hooks[]` and create hook nodes with metadata (`event`, `script`, `description`, `on_failure`). _(R2)_
- [ ] **T7** — Add `parseSteeringFile()` function: reads the steering Markdown, enriches node metadata (`_body`, `_fileMissing`, `_filePath`). _(R3, R4)_
- [ ] **T8** — Add `parseHookFile()` function: reads the hook script, enriches node metadata (`_preview`, `_filePath`). _(R5)_
- [ ] **T9** — In `parseAgenticJson()`: for each steering node, iterate `applies_to` and create `governs` edges to matching subagent nodes. If `applies_to` includes `"*"`, create edges to all subagents. _(R6, R11)_
- [ ] **T10** — In `parseAgenticJson()`: for each hook node, create a `triggers` edge to the primary agent node. _(R7, R11)_

## Adapter

- [ ] **T11** — In `HarnessSddAdapter.parse()`: after calling `parseAgenticJson`, call `parseSteeringFile()` and `parseHookFile()` for each steering/hook node. _(R3, R5)_
- [ ] **T12** — Update `HarnessSddAdapter.watchGlobs()` to include steering and hook file paths. _(R10)_

## Webview

- [ ] **T13** — In `CustomNode.tsx`: add header icon display for steering (`⚙️`) and hook (`🔌`) nodes. _(R8)_
- [ ] **T14** — In `index.tsx` detail panel: show steering-specific metadata (`applies_to`) and hook-specific metadata (`event`, `on_failure`) in the description tab. _(R1, R2)_
- [ ] **T15** — In `index.tsx` detail panel: ensure the "✏ Edit File" button appears for steering and hook nodes and opens the correct file path. _(R9)_

## Tests

- [ ] **T16** — Unit test: `parseAgenticJson` with fixture containing `steering[]` + `hooks[]` entries. Verify nodes + metadata. _(R1, R2)_
- [ ] **T17** — Unit test: `parseAgenticJson` with `applies_to: ["*"]` creates governs edges to all subagents. _(R6)_
- [ ] **T18** — Unit test: `parseSteeringFile()` with existing and missing files. _(R3, R4)_
- [ ] **T19** — Unit test: `parseHookFile()` stores preview. _(R5)_
- [ ] **T20** — Unit test: `NODE_STYLES` and `HANDLE_ACCENT` contain steering and hook entries. _(R8)_
- [ ] **T21** — Unit test: hook node has `triggers` edge to primary agent. _(R7)_
- [ ] **T22** — Unit test: `watchGlobs()` includes steering/hook paths. _(R10)_
- [ ] **T23** — Unit test: parser warning when steering `applies_to` subagent does not exist. _(R11)_

## Verification

- [ ] **T24** — `npm test`: all unit tests pass. _(all)_
- [ ] **T25** — `npm run build`: esbuild clean. _(all)_
- [ ] **T26** — `./check.sh`: all checks pass. _(all)_
- [ ] **T27** — Manual: open a workspace with steering/hooks, confirm nodes appear on whiteboard with correct visual style. _(R8, R9)_
