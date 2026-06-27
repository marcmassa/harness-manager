# Handoff — Transferable State

Current project state for continuity between sessions/agents.

## Last Action

Completed **FEAT-030: Tech Debt & Security Hardening** (v0.6.0, 2026-06-27).

- WebView CSP nonce + sandbox hardened
- `_handleWebviewMessage` delegated to three domain coordinators (`WhiteboardCoordinator`, `SddCoordinator`, `AdvisoryCoordinator`)
- `FeatureSpecPanel.tsx` (1 994 lines) split into 5 focused files
- `NodeMetadata` typed discriminated union replacing `Record<string, any>`
- `dagre` moved to `devDependencies`
- `DESIGN.md` updated
- 15 new tests (372 total)
- README and CHANGELOG updated for v0.6.0
- All progress/ files updated

## Current State

- **Active feature:** None. All 30 features in `feature_list.json` are `done`.
- **Version:** 0.6.0
- **Tests:** 372 (25 files) — all pass
- **Build:** Clean (`npm run build` — 0 errors)
- **Branch:** `main`
- **Uncommitted changes:** Yes — all FEAT-030 work is unstaged (full diff visible with `git status`)

## Key files changed in FEAT-030

### Created
- `src/coordinators/WhiteboardCoordinator.ts`
- `src/coordinators/SddCoordinator.ts`
- `src/coordinators/AdvisoryCoordinator.ts`
- `src/verifier/codeQualitySetup.ts`
- `src/webview/FeatureList.tsx`
- `src/webview/SpecEditor.tsx`
- `src/webview/AiAssistBar.tsx`
- `src/webview/SpecWizard.tsx`
- `src/webview/layoutUtils.test.ts`
- `src/messageDiscriminator.test.ts`
- `progress/impl_tech-debt-and-security-hardening.md`
- `.kiro/specs/tech-debt-and-security-hardening/` (requirements, design, tasks — all `[x]`)

### Modified
- `src/extension.ts` — coordinators, CSP nonce, sandbox, message guard, 340 exec lines
- `src/types.ts` — `WebviewMessageType`, `WebviewMessage`, `isKnownWebviewMessage`, `NodeMetadata` union + 7 metadata interfaces
- `src/parserLogic.ts` — typed casts for metadata
- `src/webview/FeatureSpecPanel.tsx` — reduced to 192-line orchestrator
- `package.json` — version 0.6.0, dagre → devDependencies
- `DESIGN.md` — §4/§6 gray-matter → yaml + frontmatter.ts
- `feature_list.json` — FEAT-030 status → done
- `README.md` — badge 0.6.0, "What's new in 0.6.0" section
- `CHANGELOG.md` — v0.6.0 entry

## Pending for Next Session

1. **Adapter drift** — `CLAUDE.md`, `.claude/agents/`, `.gemini/commands/` are missing (pre-existing, unrelated to FEAT-030). Run `./.agents/bootstrap.sh claude` and `./.agents/bootstrap.sh gemini` to regenerate.
2. **Manual smoke test** — open the extension in VS Code with a real Harness SDD workspace. Verify: whiteboard renders, SDD panel (now `FeatureList` + `SpecEditor` + `SpecWizard`) works, Advisory tab still displays maturity/suggestions.
3. **Commit and tag v0.6.0** — `git commit` all FEAT-030 changes, then `git tag v0.6.0` to trigger the `publish.yml` VSIX workflow.
4. **Validate adapters** — backlog P1 item: smoke-test each of the 7 advertised adapters against a real workspace.

## Architecture Overview (current)

```
src/
├── extension.ts              340 exec lines — activate(), HarnessDashboardProvider
├── coordinators/
│   ├── WhiteboardCoordinator.ts   graph/node/edge messages (13 cases)
│   ├── SddCoordinator.ts          SDD spec messages (10 cases)
│   └── AdvisoryCoordinator.ts     advisory messages (2 cases)
├── webview/
│   ├── FeatureSpecPanel.tsx   192 lines — orchestrator
│   ├── FeatureList.tsx        221 lines — sidebar
│   ├── SpecEditor.tsx         314 lines — tabs + content
│   ├── AiAssistBar.tsx         96 lines — action bar
│   └── SpecWizard.tsx         372 lines — generation wizard
├── verifier/
│   ├── codeQualityRunner.ts   FEAT-027 KISS/DRY runner
│   └── codeQualitySetup.ts    VS Code wiring (extracted from extension.ts)
├── types.ts                   NodeMetadata union, WebviewMessageType guard
└── agentic-detector/          FEAT-029 — signal scanner, classifier, advisory engine
```

## Risks / Notes

- `allow-same-origin` removed from webview sandbox in v0.5.1 (security patch). v0.6.0 confirms this holds in both sidebar and full-window panel options.
- The `SpecWizard.tsx` component (372 lines) has no line-count constraint in the spec — it was extracted to keep `FeatureSpecPanel.tsx` small, not as a listed deliverable.
- `CUSTOM_USES_EDGES_KEY` and `CustomUsesEdge` are now exported from `WhiteboardCoordinator.ts` and imported in `extension.ts` (used in `_sendDataTo` to merge custom edges into graph data).
- The `path` import was removed from `extension.ts` — no longer used after the coordinator extraction.
