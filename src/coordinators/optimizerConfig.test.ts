// FEAT-034 T40 — pure helpers of OptimizerCoordinator.
// Only the vscode-free exports are covered here; the message handling and the
// quick-fix flow need a full vscode host and are covered by the manual smoke
// test in tasks.md T62.

import { describe, it, expect } from 'vitest';
import {
    readOptimizerConfig,
    dismissalKey,
    disabledReport,
    buildRefineProviderOptions,
    type ConfigReader,
} from './optimizerConfig.js';

/** Config stub: returns the override when present, else the caller's default. */
function reader(overrides: Record<string, unknown> = {}): ConfigReader {
    return {
        get<T>(section: string, defaultValue: T): T {
            return (section in overrides ? overrides[section] : defaultValue) as T;
        },
    };
}

describe('readOptimizerConfig — T40, R49', () => {
    it('returns the documented defaults when nothing is configured', () => {
        const config = readOptimizerConfig(reader());
        expect(config.enabled).toBe(true);
        // Recalibrated after the FEAT-034 audit: the original 500/1500/800
        // flagged four of the five real skills in this repository.
        expect(config.tokenBudget.skill).toBe(1500);
        expect(config.tokenBudget.subagent).toBe(2500);
        expect(config.tokenBudget.steering).toBe(1500);
        expect(config.tokenBudget.agentRollup).toBe(12000);
        expect(config.budgetMedianMultiple).toBe(2.5);
        expect(config.overlapThreshold).toBe(0.8);
        expect(config.disabledRules).toEqual([]);
    });

    it('mirrors the subagent budget onto the agent budget', () => {
        const config = readOptimizerConfig(reader({ 'optimizer.tokenBudget.subagent': 2400 }));
        expect(config.tokenBudget.subagent).toBe(2400);
        expect(config.tokenBudget.agent).toBe(2400);
    });

    it('honours every override', () => {
        const config = readOptimizerConfig(reader({
            'optimizer.enabled': false,
            'optimizer.tokenBudget.skill': 250,
            'optimizer.tokenBudget.steering': 1200,
            'optimizer.tokenBudget.agentRollup': 20000,
            'optimizer.overlapThreshold': 0.65,
            'optimizer.disabledRules': ['OPT-H03'],
        }));
        expect(config.enabled).toBe(false);
        expect(config.tokenBudget.skill).toBe(250);
        expect(config.tokenBudget.steering).toBe(1200);
        expect(config.tokenBudget.agentRollup).toBe(20000);
        expect(config.overlapThreshold).toBe(0.65);
        expect(config.disabledRules).toEqual(['OPT-H03']);
    });

    it('treats a falsy-but-valid override as a real value, not as missing', () => {
        // 0 and false must survive; a naive `||` fallback would silently
        // replace them with the defaults.
        const config = readOptimizerConfig(reader({
            'optimizer.overlapThreshold': 0,
            'optimizer.enabled': false,
        }));
        expect(config.overlapThreshold).toBe(0);
        expect(config.enabled).toBe(false);
    });
});

describe('dismissalKey — T38, R43', () => {
    it('joins ruleId and nodeId with the persisted separator', () => {
        expect(dismissalKey('OPT-S04', 'my-skill')).toBe('OPT-S04::my-skill');
    });

    it('is stable across calls', () => {
        expect(dismissalKey('OPT-B01', 'a')).toBe(dismissalKey('OPT-B01', 'a'));
    });
});

describe('disabledReport — R50', () => {
    it('is a well-formed empty report, not an error', () => {
        const report = disabledReport();
        expect(report.ok).toBe(true);
        expect(report.totalComponents).toBe(0);
        expect(report.components).toEqual([]);
        expect(report.findings).toEqual([]);
        expect(report.truncated).toBe(false);
        expect(report.findingCounts.bySeverity).toEqual({ error: 0, warning: 0, info: 0 });
        expect(report.findingCounts.byDimension).toEqual({
            structure: 0, clarity: 0, budget: 0, integration: 0, hygiene: 0, consistency: 0,
        });
    });
});

// ─── FEAT-035 — assisted fixes (R25, R26) ──────────────────────────────────

describe('readOptimizerConfig — assistedFixes (R25, R26)', () => {
    it('defaults to enabled in both modes', () => {
        const config = readOptimizerConfig(reader());
        expect(config.assistedFixes.enabled).toBe(true);
        expect(config.assistedFixes.mode).toBe('both');
    });

    it('honours the kill switch', () => {
        const config = readOptimizerConfig(reader({ 'optimizer.assistedFixes.enabled': false }));
        expect(config.assistedFixes.enabled).toBe(false);
    });

    it('honours each mode', () => {
        for (const mode of ['both', 'ai-only', 'delegate-only'] as const) {
            const config = readOptimizerConfig(reader({ 'optimizer.assistedFixes.mode': mode }));
            expect(config.assistedFixes.mode).toBe(mode);
        }
    });
});

// ─── FEAT-035 — provider option split (smoke-test regression) ──────────────

describe('buildRefineProviderOptions — model namespaces are not interchangeable', () => {
    const base = {
        apiKey: '',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        httpModel: 'gpt-4o-mini',
    };

    it('sends NO family to vscode.lm when the user picked Auto', () => {
        // The regression: passing the HTTP default as a family made
        // selectChatModels({family:'gpt-4o-mini'}) match nothing, so a working
        // Copilot/Kiro model was skipped and the chain fell through to an
        // unconfigured HTTP provider — "All providers failed".
        const { chainOptions } = buildRefineProviderOptions({ ...base, selectedFamily: '' });
        expect('model' in chainOptions).toBe(false);
    });

    it('sends the family only when the user explicitly picked one', () => {
        const { chainOptions } = buildRefineProviderOptions({ ...base, selectedFamily: 'claude-3.5-sonnet' });
        expect(chainOptions.model).toBe('claude-3.5-sonnet');
    });

    it('never leaks the editor family into the HTTP provider', () => {
        const { httpOptions } = buildRefineProviderOptions({ ...base, selectedFamily: 'claude-3.5-sonnet' });
        expect(httpOptions.model).toBe('gpt-4o-mini');
    });

    it('keeps the HTTP model regardless of the panel selection', () => {
        for (const selectedFamily of ['', 'gpt-4o', 'claude-3.5-sonnet']) {
            const { httpOptions } = buildRefineProviderOptions({ ...base, selectedFamily });
            expect(httpOptions.model).toBe('gpt-4o-mini');
        }
    });

    it('passes credentials to both', () => {
        const withKey = { ...base, apiKey: 'sk-test', selectedFamily: '' };
        const { chainOptions, httpOptions } = buildRefineProviderOptions(withKey);
        expect(chainOptions.apiKey).toBe('sk-test');
        expect(httpOptions.apiKey).toBe('sk-test');
        expect(httpOptions.endpoint).toBe(base.endpoint);
    });
});
