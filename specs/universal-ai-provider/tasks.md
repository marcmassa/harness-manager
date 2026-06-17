# Tasks — Universal AI Provider

> Discrete steps in order. The implementer marks `[x]` upon completing each one. Each task references the R<n> it covers.

## Implementation

- [ ] **T1** — Add 3 new VS Code settings to `package.json#contributes.configuration.properties`: `harness-dashboard.ai.apiKey` (string, default `""`), `harness-dashboard.ai.endpoint` (string, default `"https://api.openai.com/v1/chat/completions"`), `harness-dashboard.ai.model` (string, default `"gpt-4o-mini"`). Add `harness-dashboard.checkLM` to `commands[]`. _(R3, R6)_
- [ ] **T2** — Define the `AiProvider` interface and implement the provider-chain logic in `src/lmUtils.ts`. Export `generateText` as the chain entry point. _(R1, R8)_
- [ ] **T3** — Implement `vscodeLmProvider` that calls `vscode.lm.selectChatModels()` and `sendRequest()`. This is the existing logic extracted into the provider shape. _(R2)_
- [ ] **T4** — Implement `openAiCompatibleProvider` that reads settings, builds the HTTP request with `https.request()`, sends it, and parses the OpenAI chat completions response. Only included in the chain when `apiKey` is non-empty. _(R3, R5, R7)_
- [ ] **T5** — Wire the `harness-dashboard.checkLM` command in `src/extension.ts`: read LM status + API key config, show result in `window.showInformationMessage()`. _(R6)_

## Tests

- [ ] **T6** — Unit test: provider chain calls providers in order, stops at first success. _(R1, R2, R8)_
- [ ] **T7** — Unit test: when vscodeLmProvider returns ok:false and apiKey is empty, generateText returns diagnostic error. _(R4)_
- [ ] **T8** — Unit test: when apiKey is set and vscodeLmProvider returns ok:false, the openAiCompatibleProvider is called. Mock the `https.request` call to return a valid response. _(R3)_
- [ ] **T9** — Unit test: when the API call returns HTTP 401, generateText returns `ok: false` with the status code in the error message. _(R5)_
- [ ] **T10** — Existing tests in `src/lmUtils.test.ts` still pass (they mock `generateText` at module level — verify no regression). _(R1)_

## Closure

- [ ] **T11** — Document traceability `R<n> ↔ test` in `progress/impl_universal-ai-provider.md`
- [ ] **T12** — Run `./check.sh` and verify all tests pass
- [ ] **T13** — Update `feature_list.json`: set `status` to `"done"`
- [ ] **T14** — Log summary in `progress/progress.md`
