# Design — Package slimming and scope alignment

FEAT-047 makes four independent cuts. Each can be reviewed alone and none changes an analysis result:
- replace a deprecated web-component library with native controls;
- recompress an image;
- remove a feature outside the product's purpose;
- delete unreachable code.

### Files

| File | Action | Reason |
|---|---|---|
| `src/webview/controls.tsx` | create | `Button`, `Badge`, `TextArea`, `Spinner`: small React components over `<button>`, `<span>`, `<textarea>` and a CSS spinner, styled with `--vscode-button-*`, `--vscode-badge-*`, `--vscode-input-*` and `--vscode-focusBorder` (R1, R2). |
| `src/webview/dashboardStyles.ts` | modify | The controls' CSS, including `:focus-visible` and `[disabled]` (R2). |
| 6 webview files using `<vscode-*>` | modify | Use the controls (R1). |
| `src/webview/index.tsx`, `environment.d.ts`, `package.json` | modify | Drop the design-system registration, the JSX declarations and the dependency (R1). |
| `scripts/gen-icon.cjs` | modify | After drawing, quantise to an indexed palette of at most 256 colours and write the PNG with zlib level 9. Plain Node, no new dependency (R3). |
| `src/supply-chain/**`, `src/agentic-detector/supplyChainRules.ts`, `src/webview/SupplyChainSection.tsx`, `src/test/fixtures/supply-chain/**` | delete | R4. |
| `agenticDetector.ts`, `advisoryEngine.ts`, `workspaceDetection.ts`, `types.ts`, `AdvisoryCoordinator.ts`, `operations.ts`, `extension.ts`, `HarnessDashboardProvider.ts`, `App.tsx`, `AdvisoryPanel.tsx`, `useDashboardState.ts`, `useDashboardActions.ts`, `package.json` | modify | Remove the wiring, the command, the operation and the message types (R4). |
| `src/webview/App.tsx`, `useDashboardState.ts` | modify | `specsAvailable = milestones.length > 0 \|\| specs.length > 0`. Hide the tab and fall back to the whiteboard (R5). |
| `SDDManagerPanel.tsx`, `TimelineView.tsx`, `components/EntitySidePanel.tsx`, the `SDDManagerProvider` class and its tests | delete | R6. The pure helpers in `sddManagerProvider.ts` that `SddCoordinator` uses stay. |
| `src/test/reachability.test.ts` | create | Builds both entry points with an esbuild metafile and fails on any source file outside them (R6). |

### Control contract

```tsx
<Button appearance="primary" | "secondary" | "icon" disabled? onClick title?>…</Button>
<Badge>{count}</Badge>
<TextArea value onInput rows? placeholder? disabled? aria-label />
<Spinner label="Scanning" size?="small" />      // role="progressbar", aria-label
```

A `disabled` button sets the `disabled` attribute, so it cannot be focused or clicked, and `aria-disabled` comes with it. `Spinner` is a CSS animation that respects `prefers-reduced-motion`.

### Dismissal migration

Advisory dismissals are stored as owner-qualified ids. Ids for supply-chain rules match no rule after the removal. The engine already skips dismissals with no matching rule, and a test confirms it.

### Discarded alternatives

- **Keep the toolkit, tree-shaken by component.** `allComponents` registration pulls in the whole FAST runtime. Registering only four components still needs `fast-foundation` and `fast-element`, about 140 KB minified, and the package stays deprecated.
- **Another web-component library, such as `@vscode-elements/elements`.** It is a new dependency for four simple controls (DESIGN.md requires a discarded-alternative entry for any new dependency). Native elements with theme variables cost almost nothing.
- **Replace `yaml` with a hand-written frontmatter parser** (~36 KB). Real frontmatter uses lists and multi-line scalars, and the writer needs `stringify`. Correctness risk outweighs the gain; not in scope.
- **Preact instead of React** (~65 KB). React Flow 12 and React 19 do not guarantee `preact/compat` support. Not in scope.
- **Hide supply-chain behind a setting instead of removing it.** Code that ships but is off still costs bytes and maintenance, and it remains outside the product's purpose.

### Risks

- Look and feel of the replaced controls. Mitigation: a side-by-side check of each control in light, dark and high-contrast themes, recorded in the progress file.
- A user relying on the audit command loses it. The CHANGELOG says so and points to `npm audit`.
