# Handoff — Transferable State

Current project state for continuity between sessions/agents.

## Last Action
Implemented FEAT-007: subagent-skill-relationships visualization.
Added `skills` arrays to agentic.json, `## Skills` sections to SUBAGENT.md files,
and enhanced parserLogic.ts with edge deduplication and missing skill validation.

## Current State
- Active feature: None (all 7 features done)
- Git branch: (main/master)
- Pending commits: no

## Modified Files
- `.agents/agentic.json` (skills arrays added)
- `.agents/subagents/*/SUBAGENT.md` (## Skills sections added)  
- `src/parserLogic.ts` (edgeExists, nodeExists helpers, dedup + validation)
- `src/extension.ts` (sandbox config)
- `src/parserLogic.test.ts` (3 new test cases)
- `specs/subagent-skill-relationships/` (new spec: requirements, design, tasks)
- `feature_list.json` (FEAT-007 added)
- `progress/current.md`, `progress/progress.md`, `progress/handoff.md` (session notes)
- `/Users/thejugger/Documents/Projects/hypermove/.agents/agentic.json` (created)
- `/Users/thejugger/Documents/Projects/hypermove/.agents/subagents/hypermove-harness/SUBAGENT.md` (created)
- `/Users/thejugger/Documents/Projects/hypermove/.agents/subagents/{front,qa}-agent/SUBAGENT.md` (## Skills added)

## Pending for Next Session
1. T6: Open dashboard on a project with subagents and skills to visually verify edges appear.
2. If user reports issues with `local-network-access` warning, update webview sandbox further.
3. Consider adding tests for the bridge/webview communication.

## Risks / Notes
- The `local-network-access` warning in console comes from the Antigravity IDE's Electron version, not from our code.
- Our extension's webview only uses `postMessage` for communication (no network requests), so it's unaffected.
- The hypermove project now has an agentic.json manifest that matches our extension's parser format.
- Skills in hypermove SUBAGENT.md frontmatter (for CLI use) coexist with `## Skills` sections (for our parser).
