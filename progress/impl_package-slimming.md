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
