// ============================================================================
// lmUtils.ts — FEAT-028: Universal AI Provider
//
// Provider chain: vscode.lm → OpenAI-compatible API (configurable).
// The chain tries each provider in order; first success wins.
// Zero new npm dependencies — uses Node.js built-in `https` for the
// fallback provider.
// ============================================================================

import * as vscode from 'vscode';
import * as https from 'https';

// ============================================================================
// Types
// ============================================================================

export type AiResult =
    | { ok: true; text: string }
    | { ok: false; error: string };

/** Runtime options that can be passed to a provider or to the chain. */
export interface AiProviderOptions {
    apiKey?: string;
    endpoint?: string;
    model?: string;
}

/** A single AI provider in the chain (Chain of Responsibility pattern). */
export interface AiProvider {
    readonly name: string;
    tryGenerate(prompt: string, options?: AiProviderOptions): Promise<AiResult>;
}

// ============================================================================
// Provider 1 — vscode.lm (primary)
// ============================================================================

export async function selectFirstChatModel(): Promise<vscode.LanguageModelChat | undefined> {
    try {
        const models = await vscode.lm.selectChatModels();
        if (!models || models.length === 0) return undefined;
        return models[0];
    } catch {
        return undefined;
    }
}

export async function sendChatRequest(
    model: vscode.LanguageModelChat,
    prompt: string,
    token?: vscode.CancellationToken,
): Promise<string | undefined> {
    try {
        const messages = [vscode.LanguageModelChatMessage.User(prompt)];
        const response = await model.sendRequest(
            messages,
            {},
            token ?? new vscode.CancellationTokenSource().token,
        );
        let result = '';
        for await (const chunk of response.text) {
            result += chunk;
        }
        return result;
    } catch {
        return undefined;
    }
}

/** Provider that uses the VS Code `vscode.lm` API (GitHub Copilot, etc.). */
export const vscodeLmProvider: AiProvider = {
    name: 'vscode.lm',
    async tryGenerate(prompt: string): Promise<AiResult> {
        try {
            const model = await selectFirstChatModel();
            if (!model) {
                return { ok: false, error: 'No language model available via vscode.lm' };
            }
            const text = await sendChatRequest(model, prompt);
            if (text === undefined) {
                return { ok: false, error: 'vscode.lm request failed (no response)' };
            }
            return { ok: true, text };
        } catch (e: any) {
            return { ok: false, error: `vscode.lm error: ${e?.message ?? String(e)}` };
        }
    },
};

// ============================================================================
// Provider 2 — OpenAI-compatible API (fallback)
// ============================================================================

/**
 * Raw HTTP request to an OpenAI-compatible chat completions endpoint.
 * Uses Node.js built-in `https` — zero npm dependencies.
 * Exported for testing (mock via `vi.mock('https')`).
 */
export function openAiCompatibleRequest(
    endpoint: string,
    apiKey: string,
    model: string,
    prompt: string,
): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const url = new URL(endpoint);
        const body = JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
        });

        const options: https.RequestOptions = {
            hostname: url.hostname,
            port: url.port || undefined,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        const content: string | undefined =
                            parsed?.choices?.[0]?.message?.content;
                        if (content !== undefined) {
                            resolve(content);
                        } else {
                            reject(
                                new Error(
                                    `Unexpected API response (no content in choice): ${data.slice(0, 200)}`,
                                ),
                            );
                        }
                    } catch {
                        reject(
                            new Error(
                                `Invalid JSON response (status ${res.statusCode}): ${data.slice(0, 200)}`,
                            ),
                        );
                    }
                } else {
                    reject(
                        new Error(
                            `API returned status ${res.statusCode}: ${data.slice(0, 200)}`,
                        ),
                    );
                }
            });
        });

        req.on('error', (err) => reject(new Error(`Request failed: ${err.message}`)));
        req.write(body);
        req.end();
    });
}

/**
 * Factory that creates an OpenAI-compatible provider.
 * Supplies defaults, but options passed to `tryGenerate` take precedence.
 */
export function createOpenAiCompatibleProvider(
    defaults: AiProviderOptions = {},
): AiProvider {
    return {
        name: 'openai-compatible',
        async tryGenerate(
            _prompt: string,
            options?: AiProviderOptions,
        ): Promise<AiResult> {
            const apiKey = options?.apiKey || defaults.apiKey || '';
            const endpoint = options?.endpoint || defaults.endpoint || 'https://api.openai.com/v1/chat/completions';
            const model = options?.model || defaults.model || 'gpt-4o-mini';

            if (!apiKey) {
                return { ok: false, error: 'OpenAI-compatible API key not configured' };
            }

            try {
                const text = await openAiCompatibleRequest(
                    endpoint,
                    apiKey,
                    model,
                    _prompt,
                );
                return { ok: true, text };
            } catch (e: any) {
                return {
                    ok: false,
                    error: `OpenAI-compatible error: ${e?.message ?? String(e)}`,
                };
            }
        },
    };
}

// ============================================================================
// Provider Chain
// ============================================================================

/**
 * Create a Chain-of-Responsibility provider that tries each provider
 * in order. Returns the first `{ ok: true }` result; if all fail,
 * returns the last error.
 */
export function createProviderChain(
    providers: AiProvider[],
    options?: AiProviderOptions,
): AiProvider {
    return {
        name: providers.map((p) => p.name).join(' → '),
        async tryGenerate(prompt: string): Promise<AiResult> {
            let lastError = 'No providers configured';
            for (const provider of providers) {
                const result = await provider.tryGenerate(prompt, options);
                if (result.ok) return result;
                lastError = result.error;
            }
            return { ok: false, error: `All providers failed. Last error: ${lastError}` };
        },
    };
}

// ============================================================================
// High-level convenience (backward-compatible)
// ============================================================================

/**
 * Generate text using the provider chain.
 * Tries `vscode.lm` first, then falls back to the OpenAI-compatible API
 * if `options` includes an `apiKey`.
 *
 * This is the drop-in replacement for the old `generateText`.
 */
export async function generateText(
    prompt: string,
    log?: vscode.LogOutputChannel,
    options?: AiProviderOptions,
): Promise<AiResult> {
    const chain = createProviderChain(
        [vscodeLmProvider, createOpenAiCompatibleProvider(options)],
        options,
    );
    const result = await chain.tryGenerate(prompt);
    if (!result.ok) {
        // R4: when no provider is available and no API key is configured,
        // return a diagnostic error with an actionable suggestion.
        const hasApiKey = Boolean(options?.apiKey);
        if (!hasApiKey) {
            const diagnosticError =
                'No AI provider available. ' +
                'Configure harness-dashboard.ai.apiKey to use an OpenAI-compatible endpoint, ' +
                'or install GitHub Copilot (vscode.lm). ' +
                `Diagnostic: ${result.error}`;
            if (log) log.warn(`[lmUtils] generateText failed: ${diagnosticError}`);
            return { ok: false, error: diagnosticError };
        }
        if (log) log.warn(`[lmUtils] generateText failed: ${result.error}`);
    }
    return result;
}

// ============================================================================
// Diagnostics
// ============================================================================

/**
 * Log diagnostic info about LM availability to the Harness output channel.
 * Returns a human-readable summary string.
 */
export async function diagnoseLmAvailability(
    log?: vscode.LogOutputChannel,
): Promise<string> {
    const lines: string[] = [];
    try {
        const hasLm = typeof vscode.lm !== 'undefined';
        lines.push(`vscode.lm API available: ${hasLm}`);
        if (hasLm) {
            const models = await vscode.lm.selectChatModels();
            lines.push(`Models returned: ${models?.length ?? 0}`);
            if (models && models.length > 0) {
                for (const m of models) {
                    lines.push(`  - ${m.name} (vendor: ${m.vendor}, family: ${m.family})`);
                }
            }
        }
    } catch (e: any) {
        lines.push(`Error querying LM: ${e?.message ?? String(e)}`);
    }
    const summary = lines.join('\n');
    if (log) log.info(`[lmUtils] LM diagnostics:\n${summary}`);
    return summary;
}
