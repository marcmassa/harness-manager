# FEAT-047 — Package slimming and scope alignment

Baseline on `main` at 8c0a784: VSIX 390,247 bytes.

## T5 — Dead code

Deleted:
- `src/webview/SDDManagerPanel.tsx`, `src/webview/TimelineView.tsx` and `src/webview/components/EntitySidePanel.tsx`, which no entry point reached.
- The unregistered `SDDManagerProvider` class. Its FEAT-025 tests now exercise the same handlers in `SddCoordinator`, which had no tests before.
- The unused `SDD_MANAGER` style tokens.
- The `dagre` and `@types/dagre` dev dependencies, which nothing imports.

Fixed along the way: the Optimizer defaults were written twice, in `DEFAULT_OPTIMIZER_CONFIG` and as `readOptimizerConfig` fallbacks. The reader now takes its fallbacks from the constant, so the runtime reaches the constant as well.

`src/test/reachability.test.ts` builds both entry points with an esbuild metafile and fails on any source file outside them. Exempt: tests, test helpers, declarations, and type-only modules, i.e. those whose transpiled output is empty.

| Requirement | Verification |
|---|---|
| R6 | reachability.test.ts; `SDDManagerProvider` and `dagre` are absent from the source and the manifest. |

Verified: 1029 unit tests; build.

## T2 — Icon image

`scripts/gen-icon.cjs` draws the icon as before. It then quantises the drawing to an indexed palette with `scripts/pngCodec.cjs` and writes the PNG at zlib level 9. The codec is plain Node, with no new dependency: a PNG decoder, median-cut quantisation weighted by pixel count, and an indexed encoder with `tRNS`.

| | 0.8 icon | FEAT-047 |
|---|---|---|
| Format | 128×128 RGBA | 128×128 indexed, 256 colours |
| Size | 16,609 B | 6,061 B |
| Largest channel difference | — | 8/255 |

The two images were compared side by side with no visible difference. The 0.8 image is kept as the test fixture `src/test/fixtures/icon-rgba-0.8.png`, which is not packaged.

| Requirement | Verification |
|---|---|
| R3 | iconImage.test.ts: 128×128, at most 8 KB, and at most 8/255 on every channel against the 0.8 fixture. |

## T3 — Supply-chain removal

Deleted:
- `src/supply-chain/**` and its fixtures;
- `supplyChainRules.ts`;
- `SupplyChainSection.tsx`.

Also removed:
- the `runSupplyChainAudit` command and its palette entry;
- the `workspace.audit` operation and its message mapping;
- the two audit message types;
- the detector's audit state and payload, and the `supplyChain` profile field and category;
- the Advisory section and its webview state.

Moved: `IconRefresh` goes to `advisoryParts.tsx`, because the re-scan button still uses it.

Kept:
- **`run-command` / `workspace.command`:** no rule produces it any more, but `ActionExecutor` still implements it under its own tests. Removing it is not clearly safe.
- **The `optional` scope fallback** for unclassified rules.
- **`yaml`:** `frontmatter.ts` still uses it.

README: the feature row is gone, and the 0.8.1 sentence is reworded with the CHANGELOG link kept.

| Requirement | Verification |
|---|---|
| R4 | supplyChainRemoval.test.ts covers four things: no audit or supply command in the manifest; no `workspace.audit` in the catalog; no `sc-` rule or `supply-chain` category; stored dismissals `sc-missing-bot-config@workspace`, `sc-add-update-bot` and `sc-stale-override:undici` ignored without error. |

The change removes 2,443 lines and 87 tests that belonged to the removed modules. Verified: 942 unit tests; build.

## T1 — Native controls

`src/webview/controls.tsx` provides `Button`, `Badge`, `TextArea` and `Spinner` over native elements. `CONTROLS_CSS` styles them from theme variables and is injected next to `DASHBOARD_CSS`. It covers:
- button primary, secondary and hover colours;
- badge, input and progress-bar colours;
- a `:focus-visible` outline from `--vscode-focusBorder`;
- a dimmed `:disabled` state;
- a slower spinner under `prefers-reduced-motion`.

What changed:
- 12 tags in 6 files were replaced.
- The Mission/Prompt text area is now an uncontrolled `<textarea>` keyed by node id, like the web component it replaces, with `readOnly` from the FEAT-041 decision.
- Removed: the design-system registration in `index.tsx`, `environment.d.ts` (the toolkit's JSX declarations), and the `@vscode/webview-ui-toolkit` dependency. Nothing else depended on `@microsoft/fast-*`.

VSIX: 334,084 bytes (83 %), down from 390,247.

| Requirement | Verification |
|---|---|
| R1 | controls.test.ts: no `<vscode-` tag in `src/`; neither the toolkit nor `@microsoft/fast-*` in the manifest. reactFlow12Migration.test.ts: the runtime dependency list. |
| R2 | controls.test.ts: native `<button type="button">` with `disabled` and `aria-disabled`; a text area with `aria-label` and `readonly`; a spinner with `role="progressbar"` and `aria-label`; focus style from `--vscode-focusBorder`; reduced motion. NodeDetailPanel.test.ts: editing is read-only when FEAT-041 denies it. |

**Pending, by hand:** a light, dark and high-contrast look at the Advisory tab, the node detail panel and the loading state. This is left for the maintainer's review, because an agent cannot view the running webview here.

## T4 — Specs Manager availability

`src/webview/tabs.ts` defines when the Specs Manager tab exists: when the scan has milestones or `feature` nodes from any provider. "Spec entry" is read as a feature node in the shared scan. Specs found only by the Specs Manager's own lazy filesystem discovery do not count, because discovering them would need a scan before the tab is shown.

`App.tsx` lists only the available tabs. It moves an unavailable tab to the whiteboard, whether that tab was restored, requested or lost after a rescan. Before the first data arrives, a restored tab is kept.

| Requirement | Verification |
|---|---|
| R5 | tabs.test.ts: the tab is hidden without data and shown with milestones or feature nodes; fallback for restored, requested and unknown tabs; a restored tab is kept before data. webviewChunks (Extension Host): in a Claude-only fixture the Specs Manager never mounts. |
