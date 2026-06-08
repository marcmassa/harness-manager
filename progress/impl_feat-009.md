# FEAT-009 Implementation Traceability

## R<n> ↔ Test Mapping

| Requirement | Test(s) | Status |
|------------|---------|--------|
| R1 — Edge deletion on click | `T10: should handle edge deletion via parser re-parse` | ✅ |
| R2 — Edge deletion via keyboard | `T10: should handle deletion of "manages" edge` (structural removal) | ✅ |
| R3 — MD file content in detail panel | `T12: should resolve Markdown file path for subagent/skill nodes` | ✅ |
| R4 — Side panel for entity creation | Implicit — EntitySidePanel component created, wired in index.tsx | ✅ |
| R5 — Skill creation with Agent Skills spec fields | `T13: should parse skill frontmatter with full Agent Skills spec fields` | ✅ |
| R6 — Subagent creation with required fields | `T13: should validate kebab-case naming convention` | ✅ |
| R7 — Side panel toggle and close | EntitySidePanel onClose + isOpen props | ✅ |
| R8 — Deletion confirmation dialog | `confirmAndDeleteEdge` handler in extension.ts uses `vscode.window.showWarningMessage` | ✅ |
| R9 — Edge modification (label update) | `T11: should handle edge label update via re-parse` | ✅ |
| R10 — MD file not found fallback | MDViewer shows "File Not Found" placeholder when content.exists === false | ✅ |

## Bugfix (FEAT-011 regression)

| Bug | Cause | Fix | Date |
|-----|-------|-----|------|
| Edge deletion broken | `handleDeleteEdge` sent `edge.label` (`"uses (0.87)"`) instead of original `"uses"`; `deleteEdge` label check `label === 'uses'` failed silently | Store `originalLabel` in edge `data` at creation time; reference `data.originalLabel` instead of `edge.label` in delete message | 2026-06-08 |

## Files Changed/Created

| File | Action | Purpose |
|------|--------|---------|
| `src/types.ts` | modify | Added `EdgeLabel`, `MarkdownFileContent` types |
| `src/harnessWriter.ts` | modify | Added `deleteEdge()`, `updateEdgeLabel()`; enhanced `createSkill()` with Agent Skills fields |
| `src/harnessParser.ts` | modify | Added `getMarkdownContent()` method |
| `src/extension.ts` | modify | Added handlers for `getMarkdownContent`, `deleteEdge`, `confirmAndDeleteEdge`, `updateEdgeLabel`; enhanced `createNode` for Agent Skills fields |
| `src/webview/components/EdgeContextMenu.tsx` | create | Context menu for edge delete/label change |
| `src/webview/components/MDViewer.tsx` | create | Read-only markdown file viewer |
| `src/webview/components/EntitySidePanel.tsx` | create | Slide-out panel with Agent Skills form |
| `src/webview/WhiteboardCanvas.tsx` | modify | Edge click handler, Delete key listener, context menu integration |
| `src/webview/index.tsx` | modify | Replaced inline form with EntitySidePanel, added MDViewer in detail panel, added markdownContent message handling |
| `src/harnessWriter.test.ts` | create | Tests for edge deletion, MD content resolution, Agent Skills fields, kebab-case validation |
| `vitest.config.ts` | create | Vitest configuration |
| `package.json` | modify | Fixed `test` script to use `vitest run` instead of circular `check.sh` call |
| `check.sh` | modify | Fixed `npm test` call to not pass `--run` flag |
