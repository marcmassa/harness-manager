# Tasks — Activity Bar redesign and lazy startup

- [x] **T1** — Implement `scanScheduler` and slim `activate()`. Test with the mocked host that activation reads no file, spawns nothing and starts no scan; that view visibility, panel opening and a data command each start the first scan once; that hidden file changes mark stale and one rescan runs on show; that progress uses the view location; and that the context key follows `noFolder`, `scanning`, `empty`, `ready`. _(R11, R12, R13, R14, R15, R16)_
- [ ] **T2** — Register all commands without a folder, add categories, titles, icons and palette `when` clauses. Test the manifest: every command has the category and no prefixed title, provider-specific commands name their provider, workspace commands are hidden without a folder, and a folderless invocation shows one message. _(R17, R18)_
- [ ] **T3** — Implement the Sources and Findings trees, delete `AgenticDetectorProvider`, add view toolbar and item menus. Test grouping by provider and owner, native-path opening at the reported line, the error badge and its absence at zero, at most three item actions, and denied operations absent as actions but listed with their reason in the tooltip. _(R1, R2, R3, R4, R7)_
- [ ] **T4** — Turn the provider into a single editor panel with a serializer, tab reveal and webview state; remove the webview view from the manifest. Test reveal instead of duplicate, restore with the last tab, no `retainContextWhenHidden`, and that existing workspace-state keys still drive positions, dismissals and disabled connections. _(R5, R6, R20)_
- [ ] **T5** — Add `viewsWelcome` for the four states and the walkthrough with theme-aware SVG media. Test the manifest for state coverage, at most one button per welcome, no framework recommended, at most five steps with actions and completion events, and that nothing opens on activation. _(R8, R9, R10, R11)_
- [ ] **T6** — Split the webview bundle by tab with `React.lazy`. Test in the Extension Host that the shell and active tab render before other chunks load, that each tab loads on first display under the CSP, and that the VSIX gate passes. _(R19)_
- [ ] **T7** — Extend the Extension Host suite to measure activation and time to first Sources content in an empty folder, a Claude-only folder and a custom-profile folder. Assert activation under 500 ms and no scan or file read from activation alone. Update README screenshots, DESIGN.md startup constraints and the CHANGELOG. _(R13, R21)_

Record the R-to-test results before independent review. Run build, unit tests, integration, packaging and project checks on the implementation candidate.

## Traceability

| R | Tasks |
|---|---|
| R1 | T3 |
| R2 | T3 |
| R3 | T3 |
| R4 | T3 |
| R5 | T4 |
| R6 | T4 |
| R7 | T3 |
| R8 | T5 |
| R9 | T5 |
| R10 | T5 |
| R11 | T1, T5 |
| R12 | T1 |
| R13 | T1, T7 |
| R14 | T1 |
| R15 | T1 |
| R16 | T1 |
| R17 | T2 |
| R18 | T2 |
| R19 | T6 |
| R20 | T4 |
| R21 | T7 |
