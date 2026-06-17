# Requirements — Universal AI Provider

> Feature FEAT-028 from `feature_list.json`. Adds a configurable fallback AI provider chain so the extension works in any IDE (VS Code + Copilot, Kiro, VS Code without Copilot, etc.).
>
> Each requirement is written in strict EARS and is verifiable by at least one specific test.

## EARS Patterns

| Pattern | Syntax | When to use |
|---------|--------|-------------|
| **Ubiquitous** | `SHALL ...` | Always true, permanent condition |
| **Event** | `WHEN <event> SHALL ...` | Triggered by a specific event |
| **State** | `WHILE <state> SHALL ...` | While a condition remains true |
| **Optional** | `WHERE <option> SHALL ...` | Behavior varies based on configuration |
| **Unwanted** | `IF <condition> THEN SHALL ...` | Response to failures or edge cases |

## Requirements

### R1 — Single uniform AI interface
- **Pattern:** Ubiquitous
- The system SHALL expose a single `generateText(prompt, log?)` function that abstracts all AI provider backends behind a uniform `{ ok: true, text } | { ok: false, error }` interface.

### R2 — vscode.lm is the primary provider
- **Pattern:** Event
- WHEN `generateText` is called, the system SHALL attempt to use the `vscode.lm.selectChatModels()` API first, before trying any fallback.

### R3 — Configurable OpenAI-compatible fallback
- **Pattern:** Optional
- WHERE `harness-dashboard.ai.apiKey` is set to a non-empty string, the system SHALL fall back to calling the configured `harness-dashboard.ai.endpoint` when `vscode.lm` returns zero models.

### R4 — No-provider diagnostic error
- **Pattern:** Unwanted
- IF `vscode.lm.selectChatModels()` returns zero models AND `harness-dashboard.ai.apiKey` is not configured, THEN `generateText` SHALL return `{ ok: false, error }` where `error` includes the LM availability diagnostics and a suggestion to configure an API key.

### R5 — API error propagation
- **Pattern:** Unwanted
- IF the OpenAI-compatible API call fails (network error, HTTP 4xx, or HTTP 5xx), THEN `generateText` SHALL return `{ ok: false, error }` containing the HTTP status code and the error message from the response body.

### R6 — Manual LM diagnostic command
- **Pattern:** Event
- WHEN the user invokes the `harness-dashboard.checkLM` command, the system SHALL display an information message showing whether `vscode.lm` is available, how many models are registered (with names), and whether the API key fallback is configured.

### R7 — Zero external dependencies
- **Pattern:** Ubiquitous
- The system SHALL implement the OpenAI-compatible API client using only Node.js built-in modules (`https`/`http`) or VS Code's `workspace.fs`, with zero additional npm dependencies.

### R8 — Provider-agnostic prompt handling
- **Pattern:** Ubiquitous
- The system SHALL pass the identical prompt string to every provider in the chain — the caller SHALL NOT need to know which backend handled the request.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|----------------------|-----------|
| `generateText` returns same shape for all backends | R1, R8 |
| vscode.lm is tried first | R2 |
| API key fallback works when vscode.lm has no models | R3 |
| Helpful error when no provider is available | R4 |
| API errors are surfaced to the caller | R5 |
| `checkLM` command shows provider status | R6 |
| No new npm dependencies added | R7 |
