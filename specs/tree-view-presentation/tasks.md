# Tasks — Tree view presentation and Dashboard access

- [x] **T1** — Define the icons in `src/shared/typeIcons.ts`, generate `dist/icons/` from esbuild, and add `treeIcons.ts`.
  - Test that every `NodeType` maps to an icon and that both generated files exist after a build.
  - Test that each pair differs only in colour.
  - Test each accent's contrast against `#F3F3F3` (light) and `#252526` (dark).
  - Test that the generated SVG equals `svgFor()`.
  - _(R1, R2, R3)_
- [x] **T2** — Render the whiteboard type badge from `typeIcons.ts` in `CustomNode.tsx`. Test that each type's badge uses the same paths as its tree icon and that no type keeps its old emoji or glyph. _(R3)_
- [x] **T3** — Extend `treeModels.ts` with structured resource, provider and finding data, and the description and Markdown tooltip builders.
  - Test the field order and that unknown parts are left out.
  - Test token formatting.
  - Test cost when evaluated and when not evaluated.
  - Test that Markdown is escaped for hostile names and paths.
  - Test that no framework name appears unless a provider label supplies it.
  - Test the sort order.
  - _(R6, R7, R8, R9, R10, R11)_
- [x] **T4** — Render in `harnessTrees.ts`: Dashboard entry items, type and provider icons, severity icons with theme colours, `MarkdownString` tooltips. Add the Findings title action, and an optional tab argument for `openDashboard`.
  - Test with the mocked host that the first item opens the Dashboard (on Advisory from Findings).
  - Test that the entry is absent when a view has no data.
  - Test the icon paths per type.
  - Test that both views carry the title action.
  - Test that every item has an accessibility label and that tooltips are not trusted.
  - _(R4, R5, R10)_
- [x] **T5** — Run the package gate and the Extension Host suites. Record the size of the icon set and the VSIX in the progress file. _(R12)_

## Traceability

| R | Tasks |
|---|---|
| R1 | T1 |
| R2 | T1 |
| R3 | T1, T2 |
| R4 | T4 |
| R5 | T4 |
| R6 | T3 |
| R7 | T3 |
| R8 | T3 |
| R9 | T3 |
| R10 | T3, T4 |
| R11 | T3 |
| R12 | T5 |
