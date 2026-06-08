# Changelog

All notable changes to Harness Dashboard are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.0] — 2026-06-08

> Renamed from *Harness Manager* to *Harness Dashboard* (identifier prefix: `harness-dashboard`).


### Added

- **Whiteboard canvas** — interactive React Flow graph of agents, subagents, skills and features
- **Edge types** — `manages` (smoothstep, blue), `uses` (dashed teal), `suggested` (animated amber flow), `discovered` (straight grey)
- **Per-type edge glow** — hover and selection states match the edge's own color; no more generic blue shadow
- **Semantic skill discovery** — TF-IDF cosine similarity suggests missing subagent↔skill connections
- **Idoneity scoring** — best semantic owner per skill; mismatch highlighting for misrouted skills
- **Inline Markdown viewer** — read SUBAGENT.md / SKILL.md in the detail panel without leaving the whiteboard
- **Edit in editor** — "✏ Edit File" button opens the Markdown file in the VS Code text editor
- **Toggle connections** — disable/enable skill connections; state persisted per workspace
- **Dismiss suggestions** — permanently hide unwanted suggestions (persisted across reloads)
- **Detail side panel** — slides in from the right; active node shows pulsing ring + "▶ Viewing" badge
- **Progress timeline** — SDD feature lifecycle (pending → spec_ready → in_progress → done)
- **Entity creation panel** — add agents, subagents and skills from the activity bar side panel
- **Cross-reference detection** — scans Markdown bodies for explicit skill references
- **Orphan detection** — surfaces subagents/skills present on disk but not registered in `agentic.json`
- **Custom icon** — monochrome SVG for activity bar; full-colour SVG for gallery
- **Output channel** — extension logs appear in *Output > Harness Dashboard* with severity levels

### Technical

- Extension Host: TypeScript strict mode, esbuild bundle, `vscode.LogOutputChannel`
- Webview: React 18 + React Flow 11 + `@vscode/webview-ui-toolkit`
- Test suite: 112 unit tests (Vitest), zero integration test dependencies
- Adapter pattern for future multi-framework support (FEAT-015 in progress)
