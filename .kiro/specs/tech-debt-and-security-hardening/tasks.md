# Tasks — Tech Debt & Security Hardening

> Discrete steps in order. The implementer marks `[x]` upon completing each one.
> Each task references the R<n> it covers.
> Groups A–F match the requirement groups in `requirements.md`.

---

## Group A — WebView Security

- [x] **T1** — Enumerate all current message types in the extension's `_handleWebviewMessage` `switch` and record the complete list in a comment or constant before starting any refactor _(R5)_
- [x] **T2** — Add `WebviewMessageType`, `WebviewMessage`, `isKnownWebviewMessage`, and `KNOWN_MESSAGE_TYPES` to `src/types.ts` as specified in `design.md` _(R5, R6)_
- [x] **T3** — Import `crypto` and generate a random `nonce` in `getWebviewContent()`; embed it in the `<meta CSP>` header and the `<script nonce>` attribute as specified in `design.md` _(R1, R2, R3)_
- [x] **T4** — Remove `allow-same-origin` from both `WebviewPanel` and `WebviewView` option objects in `extension.ts`; verify the webview still loads correctly _(R4)_
- [x] **T5** — Add the `isKnownWebviewMessage` guard at the top of `_handleWebviewMessage`; add a `this._log.warn(...)` branch for unknown types _(R5, R6)_

## Group B — extension.ts Decomposition

- [x] **T6** — `WhiteboardCoordinator.ts` handles 13 cases: createNode, deleteNode, updateMetadata, createEdge, deleteEdge, confirmAndDeleteEdge, getMarkdownContent, openMarkdownFile, acceptSuggestion, dismissSuggestion, reassignSkill, updateEdgeLabel, toggleSkillConnection _(R7)_
- [x] **T7** — `SddCoordinator.ts` handles 10 cases: getFeatureList, getSpecFile, saveSpecFile, generateWithAI, createSpecFile, generateSpecDraft, openInEditor, createFeature, generateFeatureDescription, deleteFeature _(R7)_
- [x] **T8** — `AdvisoryCoordinator.ts` handles 2 cases: dismissAgenticSuggestion, applyHarnessSDD _(R7)_
- [x] **T9** — Refactor `_handleWebviewMessage` in `extension.ts` to use the three coordinators in the chain described in `design.md`; retain `getData`, `ready`, `openFile`, `openExternal` as shared handlers in `extension.ts` _(R7, R8)_
- [x] **T10** — Count lines in `src/extension.ts` (excluding blank lines and comments) and confirm ≤ 400 — result: 340 executable lines _(R8)_

## Group C — FeatureSpecPanel Decomposition

- [x] **T11** — Identified three logical sub-trees: feature list sidebar, tabbed spec editor, AI action bar _(R10)_
- [x] **T12** — Extract the feature list column into `src/webview/FeatureList.tsx`; define its props interface; update `FeatureSpecPanel.tsx` to import and render `<FeatureList>` _(R10)_
- [x] **T13** — Extract the tabbed spec editor (requirements / design / tasks tabs + edit mode) into `src/webview/SpecEditor.tsx`; define its props interface _(R10)_
- [x] **T14** — Extract the AI generation button row into `src/webview/AiAssistBar.tsx`; define its props interface _(R10)_
- [x] **T15** — All 4 files confirmed ≤ 600 lines: FeatureSpecPanel(192), FeatureList(221), SpecEditor(314), AiAssistBar(96); build passes _(R10, R11)_

## Group D — Type Safety

- [x] **T16** — Add `AgentMetadata`, `SubagentMetadata`, `SkillMetadata`, `SteeringMetadata`, `HookMetadata`, `FeatureMetadata`, and `DiscoveredMetadata` interfaces to `src/types.ts`; define `NodeMetadata` as their union; update `HarnessNode.metadata` to `NodeMetadata` _(R12)_
- [x] **T17** — Fix all TypeScript compile errors caused by the narrowed type (grep `node.metadata.` across `src/`); use `as XxxMetadata` casts only at type-boundary narrowing sites _(R12)_
- [x] **T18** — Count `": any"` and `"as any"` occurrences in `src/` (excluding test files); address occurrences above the ceiling of 20 with either proper typing or a documented `// eslint-disable-next-line` comment _(R13)_

## Group E — Dependency Hygiene

- [x] **T19** — Move `dagre` and `@types/dagre` from `dependencies` to `devDependencies` in `package.json`; run `npm install` to update the lockfile; run `npm run build` and confirm bundle size is unchanged _(R14)_
- [x] **T20** — Update `DESIGN.md` §6 Global Constraints: replace the `gray-matter` reference with `yaml` + `src/frontmatter.ts` _(R15)_

## Group F — Test Coverage

- [x] **T21** — Create `src/webview/layoutUtils.test.ts`; write Vitest tests covering at least: `buildLayout` with zero nodes, with one node, and with more than `MAX_NODES_PER_ROW` nodes in a rank _(R16)_
- [x] **T22** — `profileToNodes` tests exist at `src/agentic-detector/profileToNodes.test.ts` (not `src/webview/`); verified covers main transformations — no additions needed _(R16)_
- [x] **T23** — Create `src/messageDiscriminator.test.ts`; 8 tests covering all acceptance/rejection cases for `isKnownWebviewMessage` _(R17)_

## Closure

- [x] **T24** — `npm test`: 372 tests pass (357 original + 15 new from T21–T23)
- [x] **T25** — `npm run build`: zero TypeScript errors
- [x] **T26** — `./check.sh`: build ✅ tests ✅ feature-list ✅; pre-existing adapter drift unrelated to FEAT-030
- [x] **T27** — Document R↔T traceability in `progress/impl_tech-debt-and-security-hardening.md`
- [x] **T28** — Update `feature_list.json`: set `status` to `"done"`
- [x] **T29** — Log summary entry in `progress/progress.md`
