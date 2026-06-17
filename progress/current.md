# Current Session State

## Active Feature
- Documentation & release: v0.4.0

## Completed This Session — v0.4.0 Documentation & VSIX Release

### What was done
- **CHANGELOG.md** — added 0.4.0 entry covering FEAT-024 through FEAT-028 (5 new features, 87 new tests).
- **README.md** — updated version badge (0.4.0), expanded features table, added "What's new in 0.4.0" section, added screenshot placeholders, updated settings documentation with AI provider and code quality settings.
- **`media/screenshots/`** — created directory for screenshots (placeholders for whiteboard, SDD panel, checkLM output, code quality hooks).
- **VSIX** — built with `vsce package --no-dependencies`.

### Test results
- **228 tests** (16 files) — all pass.
- **`./check.sh`** — ✅ all checks passed.

### Screenshots needed
The README references four images in `media/screenshots/` that need to be captured from a real VS Code session:
1. `whiteboard.png` — whiteboard showing agent graph with subagents, skills, steering/hook nodes
2. `sdd-panel.png` — SDD management panel with feature list and spec files
3. `check-lm.png` — output of the `Check AI Provider Status` command
4. `code-quality.png` — KISS/DRY hooks reporting issues in the Problems panel

## Previous Sessions
- **FEAT-025 — FEAT-028 (Sprint "Next")**: Universal AI Provider, Code quality hooks, SDD panel, cross-framework discovery, steering/hooks observability.
- **FEAT-023 (Configurable paths + Kiro + whiteboard polish)**: ConfigurationRegistry, Kiro adapter, overlap/animations.
- **FEAT-001 — FEAT-022 (MVP through Next)**: Foundation, parser, whiteboard, graph editor, timeline, semantic analysis, CI, governance, E2E tests.

## Next
- Package is built at `harness-dashboard-vscode-0.4.0.vsix`.
- Ready to publish or distribute.
