# FEAT-015 Implementation Traceability — universal-agent-reader
## Scope Delivered
- Added a universal adapter architecture (`IAgentAdapter` + `AdapterRegistry`) that detects multiple agent frameworks and merges results into a single `ParserResult`.
- Encapsulated existing Harness parsing as `HarnessSddAdapter` to preserve prior behavior.
- Implemented framework adapters for Claude Code, Gemini CLI, Cursor, GitHub Copilot, OpenCode, and Windsurf.
- Extended parser/webview contract with `detectedFrameworks` and framework metadata (`_framework`, `_frameworkLabel`, `_filePath`).
- Updated webview UX with framework badge, framework node accent, and supported-framework empty state.
- Extended file watching using adapter-provided globs.

## R<n> Coverage
- **R1**: `src/adapters/IAgentAdapter.ts` defines `id`, `detect`, `parse`; `watchGlobs` added for R14.
- **R2**: `src/adapters/AdapterRegistry.ts` iterates adapters in order and merges via `mergeResults`.
- **R3**: `src/adapters/HarnessSddAdapter.ts` preserves Harness SDD parsing and relationships.
- **R4**: `src/adapters/ClaudeCodeAdapter.ts` parses `CLAUDE.md` and `.claude/agents/*.md`.
- **R5**: `src/adapters/GeminiCliAdapter.ts` parses `GEMINI.md` and `.gemini/commands/*.toml`.
- **R6**: `src/adapters/CursorAdapter.ts` classifies `.mdc` rules into agent/subagent by `alwaysApply`/`globs`.
- **R7**: `src/adapters/CopilotAdapter.ts` parses copilot instructions/prompts into agent/subagent/skill nodes.
- **R8**: `src/adapters/OpenCodeAdapter.ts` parses `opencode.json/jsonc` and `subagents[]`.
- **R9**: `src/adapters/WindsurfAdapter.ts` parses `.windsurf/rules/*.md` and sets `_discovery: windsurf-heuristic`.
- **R10**: `src/types.ts`, `src/adapters/AdapterRegistry.ts`, `src/webview/index.tsx` expose and render detected frameworks.
- **R11**: Adapter nodes carry `_framework` metadata; `src/webview/components/CustomNode.tsx` renders framework accent.
- **R12**: `AdapterRegistry.parse()` catches adapter parse failures, logs warn, continues merge.
- **R13**: `src/webview/index.tsx` renders a dedicated empty state listing supported framework signatures.
- **R14**: `src/extension.ts` creates watchers from `HarnessParser.getWatchGlobs()` (adapter union).

## Tests
- `npx vitest run src/adapters/adapterRegistry.test.ts` — **8 passed**.
- `npm test` — **120 passed**.
- `npm run build` — **passed**.
- `./check.sh` — **passed**.

## Key Files Changed
- `src/adapters/IAgentAdapter.ts`
- `src/adapters/AdapterRegistry.ts`
- `src/adapters/HarnessSddAdapter.ts`
- `src/adapters/ClaudeCodeAdapter.ts`
- `src/adapters/GeminiCliAdapter.ts`
- `src/adapters/CursorAdapter.ts`
- `src/adapters/CopilotAdapter.ts`
- `src/adapters/OpenCodeAdapter.ts`
- `src/adapters/WindsurfAdapter.ts`
- `src/adapters/adapterUtils.ts`
- `src/adapters/index.ts`
- `src/frameworks.ts`
- `src/harnessParser.ts`
- `src/extension.ts`
- `src/parserLogic.ts`
- `src/types.ts`
- `src/webview/index.tsx`
- `src/webview/components/CustomNode.tsx`
- `src/adapters/adapterRegistry.test.ts`

