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

    it('does not offer a provider entry point that already exists', () => {
        const claudeCli = makeProfile({ cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code', detectedBy: 't', configFiles: ['.claude'], isActive: true }] });
        expect(actionsOf(withProviders(claudeCli, []), 'add-claude-md')).toEqual(['create-claude-md']);
    });
});

describe('the host decides each resolved action (R6)', () => {
    it('maps Advisory actions to operations', () => {
        expect(requestForAction({ type: 'open-file', payload: { filePath: 'a.md' } })).toBeNull();
        expect(requestForAction({ type: 'create-file', payload: { relPath: 'CLAUDE.md' } })).toEqual({ op: 'adoption.scaffold', targets: 'workspace', format: 'claude-code' });
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

    it('refuses to recreate an existing provider entry point and every action when untrusted', () => {
        const claudeMd = requestForAction({ type: 'create-file', payload: { relPath: 'CLAUDE.md' } })!;
        expect(decide(claudeMd.op, claudeMd.targets, gate(['claude-code']), { format: claudeMd.format })).toMatchObject({ ok: false });
        expect(decide(claudeMd.op, claudeMd.targets, gate([], false), { format: claudeMd.format })).toMatchObject({ ok: false, reason: 'This workspace is not trusted.' });
    });

    it('keeps the explicit supply-chain audit available in any harness', () => {
        for (const detected of [[], ['claude-code'], ['harness-sdd', 'cursor']]) {
            expect(decide('workspace.audit', 'workspace', gate(detected))).toMatchObject({ ok: true });
        }
    });
});
