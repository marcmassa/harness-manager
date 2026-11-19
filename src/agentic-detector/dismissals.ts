// Advisory dismissals in workspace state (FEAT-031 T20; FEAT-042 R7).
// FEAT-042 makes finding IDs owner-qualified (`<ruleId>@<providerId>`). A
// dismissal stored before that names a bare rule ID; it is migrated once,
// to the single instance it unambiguously meant, and never re-interpreted.
import type * as vscode from 'vscode';
import type { Suggestion } from './types.js';

export const AGENTIC_DISMISSED_KEY = 'agenticDetector.dismissedSuggestionIds';
export const DISMISSALS_MIGRATED_KEY = 'agenticDetector.dismissalsOwnerQualified';

export function readDismissed(state?: vscode.Memento): string[] {
    return state ? state.get<string[]>(AGENTIC_DISMISSED_KEY, []) : [];
}

export async function updateDismissed(state: vscode.Memento, change: (ids: Set<string>) => void): Promise<void> {
    const ids = new Set(readDismissed(state));
    change(ids);
    await state.update(AGENTIC_DISMISSED_KEY, Array.from(ids));
}

/**
 * Map pre-FEAT-042 bare IDs onto current instances. `instances` are the
 * suggestions generated without dismissals.
 * - One instance: the dismissal moves to that instance's ID.
 * - A workspace-wide instance with the bare ID: kept as is.
 * - Several owner instances and no workspace one: ambiguous, so dropped —
 *   hiding one owner's finding because of another's would be wrong.
 * - The rule does not fire now: kept, matching only a future workspace instance.
 */
export function migrateLegacyDismissals(dismissed: readonly string[], instances: readonly Suggestion[]): string[] {
    const out = new Set<string>();
    for (const id of dismissed) {
        if (id.includes('@')) { out.add(id); continue; }
        const own = instances.filter(s => (s.ruleId ?? s.id) === id);
        if (own.length === 0 || own.some(s => s.id === id)) out.add(id);
        else if (own.length === 1) out.add(own[0].id);
    }
    return Array.from(out);
}

/** Run the migration once per workspace; later scans use stored IDs verbatim. */
export async function migrateDismissalsOnce(state: vscode.Memento | undefined, generateAll: () => Suggestion[]): Promise<void> {
    if (!state || state.get<boolean>(DISMISSALS_MIGRATED_KEY, false)) return;
    const current = readDismissed(state);
    if (current.some(id => !id.includes('@'))) {
        await state.update(AGENTIC_DISMISSED_KEY, migrateLegacyDismissals(current, generateAll()));
    }
    await state.update(DISMISSALS_MIGRATED_KEY, true);
}
