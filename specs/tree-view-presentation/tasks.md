# Tasks — Tree view presentation and Dashboard access

- [ ] **T1** — Draw the icon set (`media/tree/`) and add `treeIcons.ts`.
  - Test that every `NodeType` maps to an icon whose two files exist.
  - Test that each pair differs only in colour.
  - Test each accent's contrast against `#F3F3F3` (light) and `#252526` (dark).
  - _(R1, R2)_
- [ ] **T2** — Extend `treeModels.ts` with structured resource, provider and finding data, and the description and Markdown tooltip builders.
  - Test the field order and that unknown parts are left out.
  - Test token formatting.
  - Test cost when evaluated and when not evaluated.
  - Test that Markdown is escaped for hostile names and paths.
  - Test that no framework name appears unless a provider label supplies it.
  - _(R5, R6, R7, R8)_
- [ ] **T3** — Render in `harnessTrees.ts`: Dashboard entry items, type and provider icons, severity icons with theme colours, `MarkdownString` tooltips. Add the Findings title action, and an optional tab argument for `openDashboard`.
  - Test with the mocked host that the first item opens the Dashboard (on Advisory from Findings).
  - Test that the entry is absent when a view has no data.
  - Test the icon paths per type.
  - Test that both views carry the title action.
  - _(R3, R4)_
- [ ] **T4** — Run the package gate and the Extension Host suites. Record the size of the icon set and the VSIX in the progress file. _(R9)_

## Traceability

| R | Tasks |
|---|---|
| R1 | T1 |
| R2 | T1 |
| R3 | T3 |
| R4 | T3 |
| R5 | T2 |
| R6 | T2 |
| R7 | T2 |
| R8 | T2 |
| R9 | T4 |
