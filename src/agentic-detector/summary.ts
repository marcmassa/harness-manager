// FEAT-048 R7 — the Advisory summary shown in the Dashboard header, defined once.
import type { AgenticProfile, ArchitectureSummary, Suggestion } from './types.js';

/** Suggestions the user has not dismissed. */
export function activeSuggestions(profile: AgenticProfile): Suggestion[] {
    return profile.suggestions.filter(s => !profile.dismissedSuggestionIds.includes(s.id));
}

export function buildArchitectureSummary(profile: AgenticProfile): ArchitectureSummary {
    return {
        maturityLevel: profile.maturity.level,
        maturityLabel: profile.maturity.label,
        maturityColor: profile.maturity.color,
        activeSuggestions: activeSuggestions(profile).length,
        scanTimestamp: profile.scanTimestamp,
        isScanning: false,
    };
}
