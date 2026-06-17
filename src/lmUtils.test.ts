// ============================================================================
// lmUtils.test.ts — FEAT-028: Universal AI Provider
//
// Tests for provider chain, HTTP fallback, and the backward-compatible
// generateText wrapper.
//
// vscode and https are mocked at the module level because lmUtils.ts
// imports both; mock factories are defined in module scope and captured
// by the hoisted vi.mock calls.
// ============================================================================

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AiProvider, AiProviderOptions } from './lmUtils.js';

// ---- Mock vscode.lm (controllable per test) ----

const mockSelectChatModels = vi.fn();

vi.mock('vscode', () => ({
    default: {
        lm: { selectChatModels: mockSelectChatModels },
        LanguageModelChatMessage: {
            User: vi.fn().mockReturnValue({}),
        },
        CancellationTokenSource: vi.fn().mockImplementation(function () {
            return { token: {} };
        }),
        LogOutputChannel: vi.fn(),
    },
    lm: { selectChatModels: mockSelectChatModels },
    LanguageModelChatMessage: {
        User: vi.fn().mockReturnValue({}),
    },
    CancellationTokenSource: vi.fn().mockImplementation(function () {
        return { token: {} };
    }),
    LogOutputChannel: vi.fn(),
}));

// ---- Mock https (controllable per test) ----

const mockHttpsRequest = vi.fn();
vi.mock('https', () => ({
    default: { request: mockHttpsRequest },
    request: mockHttpsRequest,
}));

// ---- Helpers ----

/** Simulate an HTTP response from the mocked https.request. */
function fireHttpsResponse(statusCode: number, body: string): void {
    const cb = mockHttpsRequest.mock.calls[0]?.[1] as
        | ((res: unknown) => void)
        | undefined;
    if (!cb) throw new Error('https.request was not called');

    const mockRes = {
        on: vi.fn((event: string, handler: (chunk?: string) => void) => {
            if (event === 'data') handler(body);
            if (event === 'end') handler();
            return mockRes;
        }),
        statusCode,
    };
    cb(mockRes);
}

/** Reset the https mock for a clean slate in each test. */
function resetHttpsMock(): void {
    mockHttpsRequest.mockReset();
    mockHttpsRequest.mockReturnValue({
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
    });
}

/**
 * A working mock model for when vscode.lm should succeed.
 * Uses mockReturnValue (no Promise wrapping) and a synchronous
 * async-iterable object to avoid vitest mock wrapping issues.
 */
/**
 * A working mock model for when vscode.lm should succeed.
 * Uses a plain function (not vi.fn) for sendRequest to avoid vitest
 * mock wrapper interference with Symbol.asyncIterator.
 * Returns text chunks via for-await — first call yields the value
 * (done: false), second call ends iteration (done: true).
 */
function createWorkingModel() {
    // Track iteration state per-model instance
    return {
        name: 'test-model',
        vendor: 'test',
        family: 'test',
        sendRequest: vi.fn().mockImplementation(async function () {
            let done = false;
            return {
                text: {
                    [Symbol.asyncIterator]() {
                        return {
                            next() {
                                if (!done) {
                                    done = true;
                                    return Promise.resolve({
                                        value: 'response from vscode.lm',
                                        done: false,
                                    });
                                }
                                return Promise.resolve({ value: undefined, done: true });
                            },
                        };
                    },
                },
            };
        }),
    };
}

// ============================================================================
// Tests
// ============================================================================

// ────────────────────────────────────────────────────────────────────────────
// createProviderChain — pure chain logic
// ────────────────────────────────────────────────────────────────────────────

describe('FEAT-028 — createProviderChain', () => {
    it('returns the first successful result from the chain', async () => {
        const { createProviderChain } = await import('./lmUtils.js');

        const p1: AiProvider = {
            name: 'fail',
            async tryGenerate() {
                return { ok: false, error: 'p1 failed' };
            },
        };
        const p2: AiProvider = {
            name: 'success',
            async tryGenerate() {
                return { ok: true, text: 'from p2' };
            },
        };
        const p3: AiProvider = {
            name: 'never-reached',
            async tryGenerate() {
                return { ok: true, text: 'should not be called' };
            },
        };

        const chain = createProviderChain([p1, p2, p3]);
        const result = await chain.tryGenerate('test prompt');
        expect(result).toEqual({ ok: true, text: 'from p2' });
    });

    it('returns the last error when all providers fail', async () => {
        const { createProviderChain } = await import('./lmUtils.js');

        const p1: AiProvider = {
            name: 'p1',
            async tryGenerate() {
                return { ok: false, error: 'p1 error' };
            },
        };
        const p2: AiProvider = {
            name: 'p2',
            async tryGenerate() {
                return { ok: false, error: 'p2 error' };
            },
        };

        const chain = createProviderChain([p1, p2]);
        const result = await chain.tryGenerate('test');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('p2 error');
        }
    });

    it('returns error for empty chain', async () => {
        const { createProviderChain } = await import('./lmUtils.js');
        const chain = createProviderChain([]);
        const result = await chain.tryGenerate('test');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('No providers configured');
        }
    });

    it('stops at the first success (short-circuit)', async () => {
        const { createProviderChain } = await import('./lmUtils.js');

        const callOrder: string[] = [];
        const p1: AiProvider = {
            name: 'first',
            async tryGenerate() {
                callOrder.push('p1');
                return { ok: true, text: 'winner' };
            },
        };
        const p2: AiProvider = {
            name: 'second',
            async tryGenerate() {
                callOrder.push('p2');
                return { ok: true, text: 'should not happen' };
            },
        };

        const chain = createProviderChain([p1, p2]);
        await chain.tryGenerate('test');
        expect(callOrder).toEqual(['p1']);
    });

    it('passes options through to each provider', async () => {
        const { createProviderChain } = await import('./lmUtils.js');

        const receivedOptions: AiProviderOptions[] = [];
        const p: AiProvider = {
            name: 'capture',
            async tryGenerate(_p, opts) {
                receivedOptions.push(opts ?? {});
                return { ok: false, error: 'nope' };
            },
        };

        const options: AiProviderOptions = { apiKey: 'test-key', model: 'gpt-4' };
        const chain = createProviderChain([p], options);
        await chain.tryGenerate('test');

        expect(receivedOptions).toHaveLength(1);
        expect(receivedOptions[0].apiKey).toBe('test-key');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// createOpenAiCompatibleProvider — fallback provider
// ────────────────────────────────────────────────────────────────────────────

describe('FEAT-028 — createOpenAiCompatibleProvider', () => {
    beforeEach(() => {
        resetHttpsMock();
    });

    it('returns error when apiKey is empty string', async () => {
        const { createOpenAiCompatibleProvider } = await import('./lmUtils.js');
        const provider = createOpenAiCompatibleProvider({ apiKey: '' });
        const result = await provider.tryGenerate('test', { apiKey: '' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('API key not configured');
        }
    });

    it('returns error when apiKey is not provided at all', async () => {
        const { createOpenAiCompatibleProvider } = await import('./lmUtils.js');
        const provider = createOpenAiCompatibleProvider({});
        const result = await provider.tryGenerate('test');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('API key not configured');
        }
    });

    it('succeeds with valid apiKey and a 200 response', async () => {
        const { createOpenAiCompatibleProvider } = await import('./lmUtils.js');

        const provider = createOpenAiCompatibleProvider({
            apiKey: 'sk-valid',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4o-mini',
        });

        const resultPromise = provider.tryGenerate('Hello');

        fireHttpsResponse(200, JSON.stringify({
            choices: [{ message: { content: 'Response from API' } }],
        }));

        await new Promise((r) => setTimeout(r, 10));
        const result = await resultPromise;

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.text).toBe('Response from API');
        }
        expect(mockHttpsRequest).toHaveBeenCalledTimes(1);
    });

    it('uses factory defaults when tryGenerate receives no options', async () => {
        const { createOpenAiCompatibleProvider } = await import('./lmUtils.js');

        const provider = createOpenAiCompatibleProvider({ apiKey: 'from-defaults' });
        const resultPromise = provider.tryGenerate('test');

        fireHttpsResponse(200, JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
        }));

        await new Promise((r) => setTimeout(r, 10));
        const result = await resultPromise;
        expect(result.ok).toBe(true);
    });

    it('prefers tryGenerate options over factory defaults', async () => {
        const { createOpenAiCompatibleProvider } = await import('./lmUtils.js');

        const provider = createOpenAiCompatibleProvider({
            apiKey: 'from-defaults',
            endpoint: 'https://default-endpoint/v1/chat/completions',
        });

        const resultPromise = provider.tryGenerate('test', {
            apiKey: 'from-options',
            endpoint: 'https://override-endpoint/v1/chat/completions',
        });

        fireHttpsResponse(200, JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
        }));

        await new Promise((r) => setTimeout(r, 10));
        const result = await resultPromise;
        expect(result.ok).toBe(true);

        const callArgs = mockHttpsRequest.mock.calls[0][0] as { hostname: string };
        expect(callArgs.hostname).toBe('override-endpoint');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// openAiCompatibleRequest — raw HTTP function
// ────────────────────────────────────────────────────────────────────────────

describe('FEAT-028 — openAiCompatibleRequest (HTTP)', () => {
    beforeEach(() => {
        resetHttpsMock();
    });

    it('parses a successful 200 response', async () => {
        const { openAiCompatibleRequest } = await import('./lmUtils.js');

        const resultPromise = openAiCompatibleRequest(
            'https://api.openai.com/v1/chat/completions',
            'sk-test',
            'gpt-4o-mini',
            'Hello',
        );

        fireHttpsResponse(200, JSON.stringify({
            choices: [{ message: { content: 'Hi there!' } }],
        }));

        const result = await resultPromise;
        expect(result).toBe('Hi there!');
    });

    it('rejects on non-2xx status', async () => {
        const { openAiCompatibleRequest } = await import('./lmUtils.js');

        const resultPromise = openAiCompatibleRequest(
            'https://api.openai.com/v1/chat/completions',
            'sk-test',
            'gpt-4o-mini',
            'Hello',
        );

        fireHttpsResponse(401, JSON.stringify({ error: { message: 'Invalid API key' } }));
        await expect(resultPromise).rejects.toThrow();
    });

    it('rejects on malformed JSON body', async () => {
        const { openAiCompatibleRequest } = await import('./lmUtils.js');

        const resultPromise = openAiCompatibleRequest(
            'https://api.openai.com/v1/chat/completions',
            'sk-test',
            'gpt-4o-mini',
            'Hello',
        );

        fireHttpsResponse(200, 'not-json-at-all{{{');
        await expect(resultPromise).rejects.toThrow();
    });

    it('rejects when choices array is empty', async () => {
        const { openAiCompatibleRequest } = await import('./lmUtils.js');

        const resultPromise = openAiCompatibleRequest(
            'https://api.openai.com/v1/chat/completions',
            'sk-test',
            'gpt-4o-mini',
            'Hello',
        );

        fireHttpsResponse(200, JSON.stringify({ choices: [] }));
        await expect(resultPromise).rejects.toThrow();
    });

    it('rejects on request-level error', async () => {
        const { openAiCompatibleRequest } = await import('./lmUtils.js');

        // Make https.request call its error handler instead of success
        const resultPromise = openAiCompatibleRequest(
            'https://api.openai.com/v1/chat/completions',
            'sk-test',
            'gpt-4o-mini',
            'Hello',
        );

        // Trigger the error handler
        const errorHandler = mockHttpsRequest.mock.calls[0]?.[2] as
            | ((err: Error) => void)
            | undefined;
        if (errorHandler) {
            errorHandler(new Error('Connection refused'));
        } else {
            // If no error handler passed, simulate via the request object's on('error')
            const mockReq = mockHttpsRequest.mock.results[0]?.value;
            const onErrorCb = mockReq?.on?.mock?.calls?.find(
                (c: [string, () => void]) => c[0] === 'error',
            )?.[1];
            if (onErrorCb) onErrorCb(new Error('Connection refused'));
        }

        await expect(resultPromise).rejects.toThrow();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// vscodeLmProvider — primary provider
// ────────────────────────────────────────────────────────────────────────────

describe('FEAT-028 — vscodeLmProvider', () => {
    beforeEach(() => {
        mockSelectChatModels.mockReset();
    });

    it('returns error when no models are available', async () => {
        mockSelectChatModels.mockResolvedValue([]);
        const { vscodeLmProvider } = await import('./lmUtils.js');
        const result = await vscodeLmProvider.tryGenerate('test');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('No language model available');
        }
    });

    it('returns error when selectChatModels returns undefined', async () => {
        mockSelectChatModels.mockResolvedValue(undefined);
        const { vscodeLmProvider } = await import('./lmUtils.js');
        const result = await vscodeLmProvider.tryGenerate('test');
        expect(result.ok).toBe(false);
    });

    it('returns text when a model is available and responds', async () => {
        const model = createWorkingModel();
        mockSelectChatModels.mockResolvedValue([model]);
        const { vscodeLmProvider } = await import('./lmUtils.js');
        const result = await vscodeLmProvider.tryGenerate('test');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.text).toBe('response from vscode.lm');
        }
    });
});

// ────────────────────────────────────────────────────────────────────────────
// generateText — backward-compatible wrapper
// ────────────────────────────────────────────────────────────────────────────

describe('FEAT-028 — generateText (backward compat)', () => {
    beforeEach(() => {
        mockSelectChatModels.mockReset();
        // Reset https to a no-op (just returns mock req, doesn't auto-respond)
        mockHttpsRequest.mockReset();
        mockHttpsRequest.mockReturnValue({
            write: vi.fn(),
            end: vi.fn(),
            on: vi.fn(),
        });
    });

    it('returns { ok: false } when vscode.lm fails and no apiKey set', async () => {
        // vscode.lm returns no models, fallback disabled (no apiKey)
        mockSelectChatModels.mockResolvedValue([]);
        const { generateText } = await import('./lmUtils.js');
        const result = await generateText('test prompt', undefined, { apiKey: '' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            // Should say something about all providers failing
            expect(result.error).toBeTruthy();
        }
    });

    it('falls back to OpenAI when vscode.lm fails and apiKey is set', async () => {
        // vscode.lm returns no models, but apiKey enables fallback
        mockSelectChatModels.mockResolvedValue([]);

        // Auto-respond when https.request is called (avoids async race)
        mockHttpsRequest.mockImplementation((_url: unknown, responseCallback: (res: unknown) => void) => {
            const mockRes = {
                on: vi.fn((event: string, handler: (chunk?: string) => void) => {
                    if (event === 'data') handler(JSON.stringify({
                        choices: [{ message: { content: 'fallback response' } }],
                    }));
                    if (event === 'end') handler();
                    return mockRes;
                }),
                statusCode: 200,
            };
            responseCallback(mockRes);
            return { write: vi.fn(), end: vi.fn(), on: vi.fn() };
        });

        const { generateText } = await import('./lmUtils.js');
        const result = await generateText('test', undefined, {
            apiKey: 'sk-fallback',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4o-mini',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.text).toBe('fallback response');
        }
    });

    it('uses vscode.lm directly when models are available (no fallback attempted)', async () => {
        const model = createWorkingModel();
        mockSelectChatModels.mockResolvedValue([model]);

        const { generateText } = await import('./lmUtils.js');
        const result = await generateText('test', undefined, { apiKey: 'sk-key' });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.text).toBe('response from vscode.lm');
        }
        // https should NOT have been called since vscode.lm succeeded
        expect(mockHttpsRequest).not.toHaveBeenCalled();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// diagnoseLmAvailability — diagnostics helper
// ────────────────────────────────────────────────────────────────────────────

describe('FEAT-028 — diagnoseLmAvailability', () => {
    beforeEach(() => {
        mockSelectChatModels.mockReset();
    });

    it('returns a summary string with diagnostic info', async () => {
        mockSelectChatModels.mockResolvedValue([]);
        const { diagnoseLmAvailability } = await import('./lmUtils.js');
        const summary = await diagnoseLmAvailability();
        expect(summary).toBeTruthy();
        expect(typeof summary).toBe('string');
        expect(summary.length).toBeGreaterThan(0);
    });

    it('includes model details when models are available', async () => {
        const model = createWorkingModel();
        mockSelectChatModels.mockResolvedValue([model]);
        const { diagnoseLmAvailability } = await import('./lmUtils.js');
        const summary = await diagnoseLmAvailability();
        expect(summary).toContain('test-model');
    });
});
