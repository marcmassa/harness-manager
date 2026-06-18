# Current Session State

## Active Feature
- Maintenance / patch release v0.4.1

## Completed This Session — v0.4.1 patch

### What was done

**Whiteboard layout overhaul**
- Feature nodes and `executing` edges removed from the whiteboard canvas. They belong in the SDD panel; keeping them on the architecture graph obscured the core value and caused sectors to grow uncontrollably.
- Replaced dagre-based layout with a manual TB hierarchy + row-wrap algorithm in `layoutUtils.ts`. Each rank (agent → subagent → skill/steering/hook) wraps at `MAX_NODES_PER_ROW = 4`, keeping sector width bounded regardless of node count.
- Removed `import dagre` from `layoutUtils.ts` (dependency kept in package.json).

**Specs discovery — recursive glob**
- Replaced `WORKSPACE_BASES` hardcoded list with `findSpecsRoot()`: uses `vscode.workspace.findFiles('**/specs/FEATURE/requirements.md')` to discover `specs/` wherever it lives in the workspace tree.
- Added `invalidateSpecsRootCache()` exported for post-write cache reset.

**Code quality hooks path migration**
- Moved `hooks/` scripts to `.kiro/hooks/` (kiss_check.py, dry_check.py, .sh wrappers).
- Updated `codeQualityRunner.ts` `HOOK_SCRIPTS`, `agentic.json#hooks[]`, and test fixtures.
- Created five Kiro v1 hook JSON files under `.kiro/hooks/`.

**FEAT-028 R4 diagnostic**
- `generateText` returns actionable error with `harness-dashboard.ai.apiKey` and `GitHub Copilot` hint when no provider is available.

### Test results
- **228 tests** (16 files) — all pass.
- **`npm run build`** — clean.

## Previous Sessions
- **v0.4.0**: FEAT-025–028 (SDD panel, code quality hooks, cross-framework discovery, universal AI provider).
- **v0.3.0**: FEAT-023 (ConfigurationRegistry, Kiro adapter, whiteboard polish).
- **v0.1.0–0.2.0**: Foundation through CI/governance/E2E tests.

## Next
- `Cmd+Shift+P` → `Developer: Reload Window` to pick up layout changes.
- Capture updated whiteboard screenshot for README (`media/screenshots/whiteboard.png`).
- Tag `v0.4.1` and publish VSIX when ready.
