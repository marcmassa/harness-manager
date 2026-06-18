# Design — Universal AI Provider

> Technical decisions to implement feature FEAT-028. Extends `lmUtils.ts` with a provider-chain pattern so the extension works in any IDE. The webview is unaffected — `generateText()` remains the single entry point for all AI calls.

## Summary

Currently `generateText()` calls `vscode.lm.selectChatModels()` exclusively. If no models are registered (Kiro, VS Code without Copilot, etc.), AI features are completely blocked. This design adds a **provider chain** — an ordered list of `AiProvider` implementations that are tried in sequence until one succeeds. The chain is:

```
vscodeLmProvider → openAiCompatibleProvider → [error]
```

Each provider implements the same interface. The chain is tested at runtime: if the first provider returns `{ ok: false }` (no models), the next is tried. If all fail, the last error is returned. This is the **Chain of Responsibility** pattern — simple, testable, zero-dependency.

Two new VS Code settings (`harness-dashboard.ai.apiKey`, `harness-dashboard.ai.endpoint`) control the fallback. A new command (`harness-dashboard.checkLM`) lets the user diagnose availability on demand.

## Affected Files

| File | Action | Reason |
|------|--------|--------|
| `src/lmUtils.ts` | modify | Add `AiProvider` interface, `vscodeLmProvider`, `openAiCompatibleProvider`, provider-chain logic |
| `src/lmUtils.test.ts` | modify | Add tests for provider chain, API fallback, and error propagation |
| `src/extension.ts` | modify | Register new `harness-dashboard.checkLM` command |
| `package.json` | modify | Add 2 new settings under `configuration.properties`, add 1 new command |

## Signatures and Structures

### AiProvider interface (TypeScript)

```typescript
interface AiProvider {
    readonly name: string;
    tryGenerate(prompt: string, log?: vscode.LogOutputChannel): Promise<{ ok: true; text: string } | { ok: false; error: string; diagnostic?: string }>;
}
```

### providerChain function

```typescript
async function generateTextWithChain(
    prompt: string,
    providers: AiProvider[],
    log?: vscode.LogOutputChannel
): Promise<{ ok: true; text: string } | { ok: false; error: string }>
```

### OpenAI-compatible request/response

**Request** (POST to configured endpoint):
```json
{
  "model": "gpt-4o-mini",
  "messages": [{"role": "user", "content": "<prompt>"}],
  "temperature": 0.7,
  "max_tokens": 4096
}
```

**Response** (OpenAI chat completions format):
```json
{
  "choices": [{"message": {"content": "..."}}]
}
```

### New settings

| Setting | Type | Default | Scope | Description |
|---------|------|---------|-------|-------------|
| `harness-dashboard.ai.apiKey` | `string` | `""` | `resource` | API key for the OpenAI-compatible fallback endpoint. Empty string disables the fallback. |
| `harness-dashboard.ai.endpoint` | `string` | `"https://api.openai.com/v1/chat/completions"` | `resource` | Base URL of the OpenAI-compatible chat completions endpoint. |
| `harness-dashboard.ai.model` | `string` | `"gpt-4o-mini"` | `resource` | Model identifier to use in the request body. |

### New command

| Command | Title | When |
|---------|-------|------|
| `harness-dashboard.checkLM` | `Harness Dashboard: Check AI Provider Status` | Always |

## Algorithm / Flow

```
1. generateText(prompt, log) is called
2. Build provider chain:
   a. vscodeLmProvider
   b. openAiCompatibleProvider (only if apiKey is non-empty)
3. For each provider in chain:
   a. Call provider.tryGenerate(prompt, log)
   b. If result.ok === true → return result immediately
   c. If result.ok === false → log warning, try next provider
4. If all providers failed → return last error with diagnostics
```

## Provider implementations

### vscodeLmProvider
- Calls `vscode.lm.selectChatModels()`
- If models found: sends request via `model.sendRequest()`, collects text stream
- If no models: returns `{ ok: false, error }` with diagnostic info
- No change from current behavior

### openAiCompatibleProvider
- Reads `harness-dashboard.ai.apiKey`, `.endpoint`, `.model` from VS Code config
- Uses `https.request()` (Node.js built-in) to POST to the endpoint
- Sets `Authorization: Bearer <apiKey>` header
- Parses `choices[0].message.content` from response
- On non-2xx: extracts error message from response body, returns `{ ok: false, error }`
- On network error: catches exception, returns `{ ok: false, error }`

## Error Handling

| Condition | Response |
|-----------|----------|
| vscode.lm has 0 models + no API key | Error: "No AI provider available. Configure harness-dashboard.ai.apiKey or install GitHub Copilot." + diagnostics |
| API key is wrong or expired | HTTP 401 — error: "API returned 401: Unauthorized. Check your apiKey." |
| Network timeout | Caught exception — error: "Network error: connect ETIMEDOUT" |
| Malformed API response | Error: "Unexpected API response format: <first 200 chars>" |
| All providers fail | Last error message is returned as the final error |

## Discarded Alternative

**Single provider with fallback built into generateText (if-else).** Rejected because the provider-chain pattern is more testable (each provider is an independent unit), more extensible (adding a third provider like Anthropic or Ollama is one more entry in the array), and follows the same pattern as VS Code's own LM provider registry. The if-else approach would couple all backends into one function, making testing harder and extension brittle.

## Risks and Edge Cases

- **API key in settings is not encrypted.** VS Code stores settings in cleartext (`settings.json`). Users should be aware that the API key is visible in the file. Acceptable trade-off for v1; a future version could use VS Code's `secrets` API (`context.secrets`).
- **OpenAI-compatible endpoint may differ in response shape.** Some OpenAI-compatible services (Ollama, vLLM, Azure OpenAI) use slightly different response schemas. The parser reads `choices[0].message.content` which is standard across all major implementations. If the endpoint returns a non-standard schema, the error message will show the raw response for debugging.
- **Rate limiting.** If the API endpoint rate-limits the user, the error is surfaced as a 429 status code. The caller (generateText) does not implement retry logic — that belongs in a future feature if needed.
- **`https` module is not available in browser webworkers.** The extension runs in Node.js extension host, not in the browser webview. `https.request()` is always available in the extension host context.
