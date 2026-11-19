// FEAT-044 T4 — inference ledger (R11, R12).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
    LanguageModelChatMessage: { User: vi.fn().mockReturnValue({}) },
    CancellationTokenSource: vi.fn().mockImplementation(function () { return { token: {} }; }),
    lm: { selectChatModels: vi.fn() },
}));
const { mockHttpsRequest } = vi.hoisted(() => ({ mockHttpsRequest: vi.fn() }));
vi.mock('https', () => ({ default: { request: mockHttpsRequest }, request: mockHttpsRequest }));

import { openAiCompatibleRequest, sendChatRequest } from '../lmUtils.js';
import { InferenceLedger, setInferenceRecorder, withInferenceAction, MAX_LEDGER_ENTRIES, type InferenceEntry } from './inferenceLedger.js';

const PROMPT = 'Rewrite this secret skill: TOP-SECRET-PROMPT-TEXT';
const RESPONSE = 'Here is RESPONSE-BODY-TEXT for you';

function respond(statusCode: number, body: string): void {
    const cb = mockHttpsRequest.mock.calls[0]?.[1] as (res: unknown) => void;
    const res = { statusCode, on: vi.fn((e: string, h: (c?: string) => void) => { if (e === 'data') h(body); if (e === 'end') h(); return res; }) };
    cb(res);
}
function model(countTokens?: (text: string) => Promise<number>) {
    return {
        vendor: 'copilot', family: 'fam-x', id: 'm1',
        ...(countTokens ? { countTokens } : {}),
        sendRequest: vi.fn(async () => ({ text: { async *[Symbol.asyncIterator]() { yield RESPONSE; } } })),
    };
}

let recorded: InferenceEntry[] = [];
beforeEach(() => {
    recorded = [];
    setInferenceRecorder(e => { recorded.push(e); });
    mockHttpsRequest.mockReset();
    mockHttpsRequest.mockReturnValue({ write: vi.fn(), end: vi.fn(), on: vi.fn() });
});

describe('recording usage (R11)', () => {
    it('records the usage an OpenAI-compatible provider reports, labelled with the action', async () => {
        const pending = withInferenceAction('ai-refine', () => openAiCompatibleRequest('https://api.example.test/v1/chat', 'k', 'model-a', PROMPT));
        respond(200, JSON.stringify({ choices: [{ message: { content: RESPONSE } }], usage: { prompt_tokens: 42, completion_tokens: 7 } }));
        await pending;
        expect(recorded).toEqual([expect.objectContaining({ action: 'ai-refine', provider: 'api.example.test', model: 'model-a', inputTokens: 42, outputTokens: 7, reported: true })]);
    });

    it('estimates locally, and says so, when no usage is reported', async () => {
        const pending = openAiCompatibleRequest('https://api.example.test/v1/chat', 'k', 'model-a', PROMPT);
        respond(200, JSON.stringify({ choices: [{ message: { content: RESPONSE } }] }));
        await pending;
        expect(recorded[0]).toMatchObject({ action: 'ai-assist', reported: false });
        expect(recorded[0].inputTokens).toBeGreaterThan(0);
    });

    it('uses countTokens when the editor model offers it, and the local estimate otherwise', async () => {
        await withInferenceAction('semantic-match', () => sendChatRequest(model(async t => t.length) as never, PROMPT));
        expect(recorded[0]).toMatchObject({ action: 'semantic-match', provider: 'copilot', model: 'fam-x', inputTokens: PROMPT.length, outputTokens: RESPONSE.length, reported: true });
        await sendChatRequest(model() as never, PROMPT);
        expect(recorded[1]).toMatchObject({ reported: false });
        await sendChatRequest(model(async () => { throw new Error('unsupported'); }) as never, PROMPT);
        expect(recorded[2]).toMatchObject({ reported: false });
    });
});

describe('ledger storage (R11, R12)', () => {
    const memento = () => {
        const state = new Map<string, unknown>();
        return { get: (k: string, d?: unknown) => (state.has(k) ? state.get(k) : d), update: async (k: string, v: unknown) => { state.set(k, v); }, keys: () => [...state.keys()] } as never;
    };
    const entry = (i: number): InferenceEntry => ({ ts: i, action: 'ai-refine', provider: 'p', model: 'm', inputTokens: 10, outputTokens: 2, reported: i % 2 === 0 });

    it('keeps the newest 500 entries', async () => {
        const ledger = new InferenceLedger(memento());
        for (let i = 0; i < MAX_LEDGER_ENTRIES + 3; i++) await ledger.record(entry(i));
        const list = ledger.entries();
        expect(list).toHaveLength(MAX_LEDGER_ENTRIES);
        expect(list[0].ts).toBe(3);
        expect(ledger.summary()).toMatchObject({ actions: 500, inputTokens: 5000, outputTokens: 1000 });
    });

    it('stores counts and labels only, never prompt or response content', async () => {
        const ledger = new InferenceLedger(memento());
        setInferenceRecorder(e => { void ledger.record(e); });
        const pending = openAiCompatibleRequest('https://api.example.test/v1/chat', 'secret-key', 'model-a', PROMPT);
        respond(200, JSON.stringify({ choices: [{ message: { content: RESPONSE } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
        await pending;
        await new Promise(r => setTimeout(r, 0));
        const stored = JSON.stringify(ledger.entries());
        expect(Object.keys(ledger.entries()[0]).sort()).toEqual(['action', 'inputTokens', 'model', 'outputTokens', 'provider', 'reported', 'ts']);
        for (const secret of ['TOP-SECRET-PROMPT-TEXT', 'RESPONSE-BODY-TEXT', 'secret-key']) expect(stored).not.toContain(secret);
    });
});
