// FEAT-042 T3 — Advisory actions follow the owner decision (R5, R6).
import { describe, expect, it } from 'vitest';
import { generate } from './advisoryEngine.js';
import { classify } from './maturityClassifier.js';
import { makeProfile } from './testUtils.js';
import type { AgenticProfile } from './types.js';
import { BUILTIN_OPERATIONS, decide, requestForAction, type GateContext } from '../operations/operations.js';

const withProviders = (profile: AgenticProfile, providers: string[]): AgenticProfile => {
    const p = { ...profile, sources: providers.map(providerId => ({ workspaceUri: 'w', providerId, nativeId: 'root' })) };
    p.maturity = classify(p);
    return p;
};
const actionsOf = (profile: AgenticProfile, ruleId: string) =>
    (generate(profile).find(s => s.ruleId === ruleId)?.actions ?? []).map(a => a.id);
const gate = (detected: string[], trusted = true): GateContext => ({
    owners: new Map(), detected, trusted,
    providerLabel: id => ({ 'harness-sdd': 'Harness', 'claude-code': 'Claude Code' } as Record<string, string>)[id] ?? id,
    providerOperations: id => new Set(BUILTIN_OPERATIONS[id] ?? []),
});

describe('recommendations follow the present harness (R5)', () => {
    const l1 = () => makeProfile({ activeCategories: ['prompts'], categoryCounts: { prompts: 1 } });

    it('offers no Harness SDD scaffold inside another provider\'s harness', () => {
        expect(actionsOf(withProviders(l1(), ['claude-code']), 'use-skill-files')).toEqual([]);
    });

    it('offers it inside a Harness SDD harness, and as an adoption in an empty workspace', () => {
        expect(actionsOf(withProviders(l1(), ['harness-sdd']), 'use-skill-files')).toEqual(['scaffold-first-skill']);
        expect(actionsOf(withProviders(makeProfile(), []), 'no-signals-detected')).toEqual(['scaffold-main-agent']);
    });

    it('offers CLAUDE.md where Claude Code is present without it, and not inside another harness', () => {
        const claudeCli = makeProfile({ cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code', detectedBy: 't', configFiles: ['.claude'], isActive: true }] });
        expect(actionsOf(withProviders(claudeCli, ['claude-code']), 'add-claude-md')).toEqual(['create-claude-md']);
        expect(actionsOf(withProviders(claudeCli, []), 'add-claude-md')).toEqual(['create-claude-md']);
        expect(actionsOf(withProviders(claudeCli, ['cursor']), 'add-claude-md')).toEqual([]);
    });
});

describe('the host decides each resolved action (R6)', () => {
    it('maps Advisory actions to operations', () => {
        expect(requestForAction({ type: 'open-file', payload: { filePath: 'a.md' } })).toBeNull();
        expect(requestForAction({ type: 'create-file', payload: { relPath: 'CLAUDE.md' } })).toEqual({ op: 'adoption.scaffold', targets: 'workspace', adoptFormat: 'claude-code' });
        expect(requestForAction({ type: 'create-file', payload: { relPath: 'AGENTS.md' } })).toEqual({ op: 'adoption.scaffold', targets: 'workspace' });
        expect(requestForAction({ type: 'scaffold-skill', payload: {} })).toEqual({ op: 'editing.createEntity', targets: 'workspace', adoptFormat: 'harness-sdd' });
        expect(requestForAction({ type: 'run-command', payload: { command: 'npm audit fix' } })).toEqual({ op: 'workspace.command', targets: 'workspace' });
    });

    it('allows a native Harness SDD scaffold and refuses it in a foreign harness', () => {
        const scaffold = requestForAction({ type: 'scaffold-agent', payload: {} })!;
        const run = (detected: string[]) => decide(scaffold.op, scaffold.targets, gate(detected), { adoptFormat: scaffold.adoptFormat });
        expect(run(['harness-sdd'])).toMatchObject({ ok: true, owners: ['harness-sdd'] });
        expect(run([])).toMatchObject({ ok: true, owners: [] });
        expect(run(['claude-code'])).toMatchObject({ ok: false, reason: expect.stringContaining('Adopt Harness explicitly first') });
    });

    // Review H3: Claude Code detected through its agents but without CLAUDE.md must still get it.
    it('creates a provider entry point inside its own harness or none, never inside another', () => {
        const claudeMd = requestForAction({ type: 'create-file', payload: { relPath: 'CLAUDE.md' } })!;
        const run = (detected: string[], trusted = true) => decide(claudeMd.op, claudeMd.targets, gate(detected, trusted), { adoptFormat: claudeMd.adoptFormat });
        expect(run(['claude-code'])).toMatchObject({ ok: true });
        expect(run([])).toMatchObject({ ok: true });
        expect(run(['cursor'])).toMatchObject({ ok: false, reason: expect.stringContaining('Adopt Claude Code explicitly first') });
        expect(run([], false)).toMatchObject({ ok: false, reason: 'This workspace is not trusted.' });
    });

    it('keeps the explicit supply-chain audit available in any harness', () => {
        for (const detected of [[], ['claude-code'], ['harness-sdd', 'cursor']]) {
            expect(decide('workspace.audit', 'workspace', gate(detected))).toMatchObject({ ok: true });
        }
    });
});
