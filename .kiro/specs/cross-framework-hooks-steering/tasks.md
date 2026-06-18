# Tasks — Cross-framework Hooks & Steering Discovery

> Feature FEAT-026. Implements R1–R19. Execute in order. KISS: every task is
> essential, none are bookkeeping.

## 1. Config (R1–R4)

- [ ] **T1** — Register command `harness-dashboard.openLocalConfig` in `package.json#contributes.commands`. _(R3)_
- [ ] **T2** — Implement `HarnessConfig` reader in `src/config/harnessConfig.ts`: read `.harness-dashboard/config.json`, cache invalidation on file change, malformed-JSON warning to OutputChannel. _(R2, R4)_
- [ ] **T3** — Wire the command in `extension.ts`: open or create `.harness-dashboard/config.json` (with empty schema) and reveal it in the editor. _(R3)_
- [ ] **T4** — In `package.json#contributes.configuration`, add only the 3 settings (`<id>.discovery`, `discovery.root`); remove the 6 obsolete settings (per-adapter `hooksPath`/`steeringPath`/`discoverHooks`/`discoverSteering` + global `rootHooks`/`rootSteering`). _(R1)_

## 2. Discovery (R5–R17)

- [ ] **T5** — Implement `discover()` in `src/discovery/hooksAndSteering.ts` per design §4: return `{ nodes, edges }` for hooks + steering, with skip-when-disabled (R5, R9, R19), filename event inference (R11), H1 description fallback (R12), applies_to inference (R15), `_filePath` (R16), and content reading (preview for hooks, full body for steering). _(R5, R6, R7, R8, R9, R10, R11, R12, R14, R15, R16)_
- [ ] **T6** — In `discover()`, implement `seen` set for R13: project-root results skip files already in the set. _(R13)_

## 3. Adapter wiring (R5, R17, R18, R19)

- [ ] **T7** — Wire `discover()` into the 6 configurable adapters (`KiroAdapter`, `ClaudeCodeAdapter`, `CursorAdapter`, `GeminiCliAdapter`, `CopilotAdapter`, `WindsurfAdapter`) at the end of their `parse()`. _(R5, R18)_
- [ ] **T8** — Update each of the 6 adapters' `watchGlobs()` to include the resolved hook and steering globs. _(R17)_

## 4. Tests (R1–R19)

- [ ] **T9** — Unit tests for `HarnessConfig`: empty file, valid file, malformed JSON. _(R2, R4)_
- [ ] **T10** — Unit tests for `discover()` on a fixture with framework hooks + steering: nodes, edges, `_filePath`, event inference, applies_to inference. _(R5, R11, R12, R14, R15, R16)_
- [ ] **T11** — Unit tests for `discover()`: project-root scan toggled on/off; per-adapter kill switch; overrides and extras; same-file deduplication. _(R6, R7, R8, R9, R10, R13)_
- [ ] **T12** — Regression tests: `HarnessSddAdapter` and `OpenCodeAdapter` are unaffected (no nodes, no errors). _(R18, R19)_

## 5. Verification

- [ ] **T13** — `npm test`, `npm run build`, `./check.sh` all green. _(all)_
- [ ] **T14** — Manual: open a Kiro-only project, see `.kiro/hooks/` and `.kiro/steering/` on the whiteboard. _(R5)_
- [ ] **T15** — Manual: invoke `Harness Dashboard: Open Local Configuration`, edit the JSON to add an `adapters.kiro.hooksPath` override, save, refresh — the override is picked up. _(R3, R6)_
- [ ] **T16** — Manual: edit a discovered hook file — the whiteboard re-parses. _(R17)_
