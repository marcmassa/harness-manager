# Tasks — Package slimming and scope alignment

- [x] **T1** — Add `controls.tsx` and its CSS, replace the 12 `<vscode-*>` tags, and drop the toolkit (registration, JSX declarations, dependency).
  - Test with `react-dom/server` that each control renders its native element, label, `disabled` and `aria-*` attributes.
  - Test that no source contains `<vscode-`.
  - Test that the manifest lists neither the toolkit nor `@microsoft/fast-*`.
  - Check light, dark and high-contrast themes by hand.
  - _(R1, R2)_
- [x] **T2** — Quantise `media/icon.png` in `scripts/gen-icon.cjs`.
  - Test the size, the dimensions, and the per-channel difference against the current image (kept as a test fixture).
  - _(R3)_
- [x] **T3** — Remove the supply-chain feature: modules, rules, Advisory section, command, operation, message types and fixtures.
  - Test that the manifest has no audit command.
  - Test that the operation catalog has no `workspace.audit`.
  - Test that the Advisory engine has no supply-chain rule.
  - Test that a stored supply-chain dismissal is ignored.
  - _(R4)_
- [x] **T4** — Show the Specs Manager tab only with milestones or specs.
  - Test the tab list with and without them.
  - Test the fallback for a restored or requested unavailable tab.
  - _(R5)_
- [x] **T5** — Delete the unreachable files, the `SDDManagerProvider` class and its tests, and `dagre`.
  - Add `reachability.test.ts`.
  - _(R6)_
- [x] **T6** — Package and run the Extension Host suites. Update README, CHANGELOG, DESIGN.md and the compatibility matrix. Record sizes before and after. _(R7, R8)_

## Traceability

| R | Tasks |
|---|---|
| R1 | T1 |
| R2 | T1 |
| R3 | T2 |
| R4 | T3 |
| R5 | T4 |
| R6 | T5 |
| R7 | T6 |
| R8 | T6 |
