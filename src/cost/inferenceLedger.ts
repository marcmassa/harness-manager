// FEAT-044 T4 — local record of the Dashboard's own model usage (R11, R12).
// Stores counts and labels only: never a prompt, a response or a file path.
// Kept in workspace state; nothing leaves the machine.

import { AsyncLocalStorage } from 'node:async_hooks';
import type * as vscode from 'vscode';

export interface InferenceEntry {
    ts: number;
    /** What the user asked for: ai-refine, spec-draft, semantic-match, … */
    action: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    /** True when the provider reported or counted the tokens; false for a local estimate. */
    reported: boolean;
}

export type InferenceUsage = Omit<InferenceEntry, 'ts' | 'action'>;

export const INFERENCE_LEDGER_KEY = 'harness-dashboard.inferenceLedger';
export const MAX_LEDGER_ENTRIES = 500;

const actionContext = new AsyncLocalStorage<string>();
let recorder: ((entry: InferenceEntry) => void) | undefined;

/** Label every model call made inside `fn` with `action`. */
export function withInferenceAction<T>(action: string, fn: () => Promise<T>): Promise<T> {
    return actionContext.run(action, fn);
}

/** The action label of the current call; capture it when a request starts. */
export function currentInferenceAction(): string {
    return actionContext.getStore() ?? 'ai-assist';
}

/** Called by the model providers in lmUtils after each completed request. */
export function recordInference(usage: InferenceUsage, action = currentInferenceAction()): void {
    const entry: InferenceEntry = {
        ts: Date.now(),
        action,
        provider: String(usage.provider),
        model: String(usage.model),
        inputTokens: Math.max(0, Math.round(usage.inputTokens)),
        outputTokens: Math.max(0, Math.round(usage.outputTokens)),
        reported: usage.reported === true,
    };
    try { recorder?.(entry); } catch { /* recording must never break an AI action */ }
}

export function setInferenceRecorder(fn: ((entry: InferenceEntry) => void) | undefined): void {
    recorder = fn;
}

export interface InferenceSummary {
    actions: number;
    inputTokens: number;
    outputTokens: number;
    /** How many entries carry provider-reported counts rather than local estimates. */
    reportedEntries: number;
}

export class InferenceLedger {
    public constructor(private readonly state: vscode.Memento, private readonly cap = MAX_LEDGER_ENTRIES) {}

    public entries(): InferenceEntry[] {
        return this.state.get<InferenceEntry[]>(INFERENCE_LEDGER_KEY, []);
    }

    public async record(entry: InferenceEntry): Promise<void> {
        const next = [...this.entries(), entry];
        await this.state.update(INFERENCE_LEDGER_KEY, next.slice(Math.max(0, next.length - this.cap)));
    }

    public summary(): InferenceSummary {
        const list = this.entries();
        return {
            actions: list.length,
            inputTokens: list.reduce((s, e) => s + e.inputTokens, 0),
            outputTokens: list.reduce((s, e) => s + e.outputTokens, 0),
            reportedEntries: list.filter(e => e.reported).length,
        };
    }
}
