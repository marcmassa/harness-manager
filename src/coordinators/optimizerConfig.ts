// FEAT-034 — vscode-free helpers for the Component Optimizer coordinator.
//
// These live outside OptimizerCoordinator.ts on purpose: that file imports
// `vscode` at module scope, so anything importing it is unloadable under
// Vitest. Keeping the pure logic here (T40's config reader, T38's key format,
// R50's disabled report) makes all three unit-testable without a vscode mock,
// the same separation the src/optimizer/ module maintains.

import type { OptimizerConfig, OptimizerReport } from '../optimizer/types.js';

export const DISMISSED_FINDINGS_KEY = 'harness-dashboard.dismissedOptimizerFindings';
export const OPTIMIZER_DIFF_SCHEME = 'harness-optimizer';

/** Minimal shape of vscode.WorkspaceConfiguration used by readOptimizerConfig. */
export interface ConfigReader {
    get<T>(section: string, defaultValue: T): T;
}

/**
 * T40 — read the seven `harness-dashboard.optimizer.*` settings (R49).
 *
 * `tokenBudget.agent` intentionally mirrors the subagent budget: an agent and a
 * subagent are the same kind of artefact for budgeting purposes, and a seventh
 * setting for it would be a knob nobody tunes independently.
 */
export function readOptimizerConfig(config: ConfigReader): OptimizerConfig {
    const subagentBudget = config.get<number>('optimizer.tokenBudget.subagent', 2500);
    return {
        enabled: config.get<boolean>('optimizer.enabled', true),
        tokenBudget: {
            skill: config.get<number>('optimizer.tokenBudget.skill', 1500),
            subagent: subagentBudget,
            agent: subagentBudget,
            steering: config.get<number>('optimizer.tokenBudget.steering', 1500),
            agentRollup: config.get<number>('optimizer.tokenBudget.agentRollup', 12000),
        },
        budgetMedianMultiple: config.get<number>('optimizer.budgetMedianMultiple', 2.5),
        overlapThreshold: config.get<number>('optimizer.overlapThreshold', 0.8),
        disabledRules: config.get<string[]>('optimizer.disabledRules', []),
        assistedFixes: {
            enabled: config.get<boolean>('optimizer.assistedFixes.enabled', true),
            mode: config.get<'both' | 'ai-only' | 'delegate-only'>('optimizer.assistedFixes.mode', 'both'),
        },
    };
}

/** T38 — the persisted dismissal key format. */
export function dismissalKey(ruleId: string, nodeId: string): string {
    return `${ruleId}::${nodeId}`;
}

/** R50 — the report returned when the optimizer is switched off. */
export function disabledReport(): OptimizerReport {
    return {
        ok: true,
        scanTimestamp: Date.now(),
        architectureScore: 0,
        totalComponents: 0,
        truncated: false,
        components: [],
        findings: [],
        dismissedCount: 0,
        findingCounts: {
            bySeverity: { error: 0, warning: 0, info: 0 },
            byDimension: { structure: 0, clarity: 0, budget: 0, integration: 0, hygiene: 0, consistency: 0 },
        },
    };
}

/**
 * FEAT-035 — split AI options across the two providers in the chain.
 *
 * These are two different namespaces and conflating them is a real failure mode,
 * observed in smoke testing: `vscodeLmProvider` passes `options.model` to
 * `vscode.lm.selectChatModels({ family })`, so feeding it the OpenAI-compatible
 * default ("gpt-4o-mini") selects a family that Copilot and Kiro do not publish.
 * The primary provider then matches nothing and the chain falls through to an
 * HTTP fallback that usually has no API key — surfacing as "All providers
 * failed" even though the editor had a perfectly good model available.
 *
 * Only an explicit panel selection (a real family id from `getOptimizerAiModels`)
 * may reach the chain. The HTTP provider keeps `ai.model` as its own default.
 */
export function buildRefineProviderOptions(input: {
    selectedFamily: string;
    apiKey: string;
    endpoint: string;
    httpModel: string;
}): {
    chainOptions: { apiKey: string; endpoint: string; model?: string };
    httpOptions: { apiKey: string; endpoint: string; model: string };
} {
    const { selectedFamily, apiKey, endpoint, httpModel } = input;
    return {
        chainOptions: {
            apiKey,
            endpoint,
            ...(selectedFamily ? { model: selectedFamily } : {}),
        },
        httpOptions: { apiKey, endpoint, model: httpModel },
    };
}
