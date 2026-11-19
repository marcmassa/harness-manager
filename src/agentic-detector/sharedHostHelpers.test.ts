// FEAT-048 T6 (R7) — summary, state keys, ownership map and integration helpers, defined once.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { activeSuggestions, buildArchitectureSummary } from './summary.js';

function files(dir: string, out: string[] = []): string[] {
    for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) files(p, out); else if (/\.tsx?$/.test(p) && !p.includes('.test.')) out.push(p); }
    return out;
}
const ALL = files('src');
const defining = (pattern: RegExp) => ALL.filter(f => pattern.test(readFileSync(f, 'utf8')));

describe('shared host helpers (FEAT-048 R7)', () => {
    it('counts only undismissed suggestions in the architecture summary', () => {
        const profile = { maturity: { level: 2, label: 'L2', color: '#0f0' }, scanTimestamp: 5, dismissedSuggestionIds: ['b'],
            suggestions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } as never;
        expect(activeSuggestions(profile).map((s: { id: string }) => s.id)).toEqual(['a', 'c']);
        expect(buildArchitectureSummary(profile)).toEqual({ maturityLevel: 2, maturityLabel: 'L2', maturityColor: '#0f0', activeSuggestions: 2, scanTimestamp: 5, isScanning: false });
    });

    it('writes the summary and the active-suggestion filter in one place on the host', () => {
        expect(defining(/maturityLabel: profile\.maturity\.label/)).toEqual([join('src', 'agentic-detector', 'summary.ts')]);
    });

    it('spells each view-state key once, in viewRelations', () => {
        for (const key of ['dismissedSuggestions', 'disabledConnections', 'customUsesEdges', 'customEdges']) {
            expect(defining(new RegExp(`'harness-dashboard\\.${key}'`)), key).toEqual([join('src', 'coordinators', 'viewRelations.ts')]);
        }
    });

    it('builds the ownership map through OperationGate.describeAll', () => {
        expect(defining(/Object\.fromEntries\([^)]*gate\.describe\(/)).toEqual([]);
    });

    it('defines snapshot and fakeContext once for the Extension Host suites', () => {
        const integration = files(join('src', 'test', 'integration'));
        for (const fn of ['async function snapshot(', 'function fakeContext(']) {
            expect(integration.filter(f => readFileSync(f, 'utf8').includes(fn)), fn).toEqual([join('src', 'test', 'integration', 'fixtures.ts')]);
        }
    });
});
