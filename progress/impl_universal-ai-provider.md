# FEAT-028 — Universal AI Provider — Traceability

## R<n> ↔ Test mapping

| Requirement | Tests | Status |
|---|---|---|
| R1 — generateText uses provider chain | `createProviderChain` (5 tests), `generateText` backward compat tests | ✅ |
| R2 — vscodeLmProvider primary | `vscodeLmProvider` (3 tests) | ✅ |
| R3 — OpenAI-compatible fallback | `createOpenAiCompatibleProvider` (5 tests) | ✅ |
| R4 — diagnostic error when no provider works | `generateText` returns `{ ok: false }` with no models and no apiKey | ✅ |
| R5 — HTTP status propagation | `openAiCompatibleRequest` rejects on 401, malformed JSON, empty choices | ✅ |
| R6 — checkLM command | `harness-dashboard.checkLM` registered, reads settings, shows result | ✅ |
| R7 — zero new npm dependencies | LmUtils uses `https` built-in, no new deps in package.json | ✅ |
| R8 — provider chain short-circuits | `createProviderChain` stops at first success | ✅ |

## Task completion

- [x] T1 — 3 settings + checkLM command in package.json
- [x] T2 — AiProvider interface + provider chain in lmUtils.ts
- [x] T3 — vscodeLmProvider implementation
- [x] T4 — createOpenAiCompatibleProvider + https request
- [x] T5 — checkLM command wired in extension.ts
- [x] T6 — Unit test: chain calls providers in order, stops at first success
- [x] T7 — Unit test: no models + empty apiKey → ok:false
- [x] T8 — Unit test: apiKey set + vscode.lm fails → fallback called
- [x] T9 — Unit test: HTTP 401 → ok:false with status code
- [x] T10 — No regression: all 228 tests pass (16 files)
- [x] T11 — This traceability document
- [x] T12 — check.sh ✅ all checks passed
- [x] T13 — feature_list.json status → "done"
- [x] T14 — Summary in progress/progress.md

## Files changed

| File | Change |
|---|---|
| `package.json` | 3 settings (`ai.apiKey`, `ai.endpoint`, `ai.model`) + `harness-dashboard.checkLM` command |
| `src/lmUtils.ts` | Rewritten: `AiProvider` interface, `vscodeLmProvider`, `createOpenAiCompatibleProvider`, `createProviderChain`, `openAiCompatibleRequest`, `generateText` (backward-compat), `diagnoseLmAvailability` |
| `src/lmUtils.test.ts` | 23 tests covering all providers, chain, HTTP, diagnostics |
| `src/extension.ts` | Import `diagnoseLmAvailability`, register `checkLM` command, `openSettings` message handler |
| `src/webview/index.tsx` | Gear settings button in header toolbar → opens extension settings |
| `feature_list.json` | FEAT-028 → `done` |
