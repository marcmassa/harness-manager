// FEAT-041 T3 — the host decision (R3, R4).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILTIN_CAPABILITIES, CAPABILITY_KEYS } from '../adapters/capabilities.js';
import { SUPPORTED_FRAMEWORKS } from '../frameworks.js';
import {
    BUILTIN_OPERATIONS, bindRunTarget, decide, OPERATIONS, operationForMessage,
    type GateContext, type OperationId,
} from './operations.js';

function ctx(owners: Record<string, string | undefined>, overrides: Partial<GateContext> = {}): GateContext {
    const map = new Map(Object.entries(owners));
    return {
        owners: map,
        detected: [...new Set([...map.values()].filter((v): v is string => !!v))],
        trusted: true,
        providerLabel: id => ({ 'harness-sdd': 'Harness', 'claude-code': 'Claude Code', cursor: 'Cursor' } as Record<string, string>)[id] ?? id,
        providerOperations: id => new Set(BUILTIN_OPERATIONS[id] ?? []),
        ...overrides,
    };
}

const MIXED = ctx({ 'sdd-agent': 'harness-sdd', 'sdd-skill': 'harness-sdd', 'claude-code::reviewer': 'claude-code', 'cursor::rule': 'cursor', orphan: undefined });

describe('decide (R4)', () => {
    it('allows a supported operation on its owner (positive control)', () => {
        expect(decide('editing.deleteEntity', ['sdd-agent'], MIXED)).toEqual({ ok: true, mode: 'persist', owners: ['harness-sdd'] });
        expect(decide('editing.linkSkill', ['sdd-agent', 'sdd-skill'], MIXED)).toMatchObject({ ok: true, mode: 'persist' });
    });

    it('denies writes on a read-only owner', () => {
        expect(decide('editing.deleteEntity', ['claude-code::reviewer'], MIXED))
            .toEqual({ ok: false, reason: 'Claude Code resources are read-only for "Delete".' });
    });

    it('denies stale and unknown targets', () => {
        expect(decide('editing.updateMetadata', ['gone'], MIXED)).toMatchObject({ ok: false, reason: expect.stringContaining('no longer in the current scan') });
        expect(decide('editing.updateMetadata', ['orphan'], MIXED)).toMatchObject({ ok: false, reason: expect.stringContaining('no known owner') });
        expect(decide('editing.deleteEntity', [], MIXED)).toMatchObject({ ok: false });
    });

    it('keeps cross-owner links view-local and denies other mixed writes', () => {
        expect(decide('editing.linkSkill', ['claude-code::reviewer', 'sdd-skill'], MIXED))
            .toEqual({ ok: true, mode: 'view-local', owners: ['claude-code', 'harness-sdd'] });
        expect(decide('editing.unlinkSkill', ['cursor::rule', 'claude-code::reviewer'], MIXED)).toMatchObject({ ok: true, mode: 'view-local' });
        expect(decide('editing.relabelEdge', ['claude-code::reviewer', 'sdd-skill'], MIXED))
            .toMatchObject({ ok: false, reason: expect.stringContaining('different owners (Claude Code, Harness)') });
    });

    it('requires a trusted workspace for every mutation, not for view data', () => {
        const untrusted = ctx({ 'sdd-agent': 'harness-sdd' }, { trusted: false });
        for (const op of Object.keys(OPERATIONS) as OperationId[]) {
            const result = decide(op, op.startsWith('adoption') || op === 'workspace.audit' ? 'workspace' : ['sdd-agent'], untrusted, { runnerAvailable: true });
            expect(result.ok).toBe(op === 'view.localRelation');
        }
    });

    it('creates entities only through a single detected owner of that format', () => {
        expect(decide('editing.createEntity', 'workspace', ctx({ 'claude-code::root': 'claude-code' })))
            .toEqual({ ok: false, reason: 'No detected provider supports "Create entities".' });
        expect(decide('editing.createEntity', 'workspace', MIXED)).toMatchObject({ ok: true, owners: ['harness-sdd'] });
        const two = ctx({ a: 'harness-sdd', b: 'acme' }, { providerOperations: () => new Set(['editing.createEntity']) });
        expect(decide('editing.createEntity', 'workspace', two)).toMatchObject({ ok: false, reason: expect.stringContaining('More than one provider') });
    });

    it('launches only the owner runner when its CLI is installed', () => {
        const claude = ['claude-code::reviewer'];
        expect(decide('agentRuns.launch', claude, MIXED, { runnerId: 'claude-code', runnerAvailable: true })).toMatchObject({ ok: true });
        expect(decide('agentRuns.launch', claude, MIXED, { runnerId: 'gemini-cli', runnerAvailable: true })).toMatchObject({ ok: false, reason: expect.stringContaining('Only the Claude Code runner') });
        expect(decide('agentRuns.launch', claude, MIXED, { runnerId: 'claude-code', runnerAvailable: false })).toMatchObject({ ok: false, reason: expect.stringContaining('not installed') });
        expect(decide('agentRuns.launch', ['cursor::rule'], MIXED, { runnerId: 'cursor', runnerAvailable: true })).toMatchObject({ ok: false, reason: expect.stringContaining('read-only') });
    });

    it('delegates only with an installed agent CLI and current targets', () => {
        expect(decide('agentRuns.delegate', 'workspace', MIXED, { runnerAvailable: false })).toMatchObject({ ok: false });
        expect(decide('agentRuns.delegate', ['cursor::rule'], MIXED, { runnerAvailable: true })).toMatchObject({ ok: true });
        expect(decide('agentRuns.delegate', ['gone'], MIXED, { runnerAvailable: true })).toMatchObject({ ok: false });
    });
});

describe('review fixes (R4)', () => {
    it('uses detected providers for workspace operations, even with no nodes', () => {
        const empty = ctx({}, { detected: ['harness-sdd'] });
        expect(decide('editing.createEntity', 'workspace', empty)).toMatchObject({ ok: true, owners: ['harness-sdd'] });
    });

    it('refuses to scaffold a format that is already set up', () => {
        expect(decide('adoption.scaffold', 'workspace', MIXED, { format: 'harness-sdd' }))
            .toMatchObject({ ok: false, reason: expect.stringContaining('already set up') });
        expect(decide('adoption.scaffold', 'workspace', ctx({ 'claude-code::root': 'claude-code' }), { format: 'harness-sdd' })).toMatchObject({ ok: true });
    });

    it('denies a rule-wide delegation when any resolved component is stale', () => {
        expect(decide('agentRuns.delegate', ['cursor::rule', 'gone'], MIXED, { runnerAvailable: true })).toMatchObject({ ok: false });
    });

    it('binds a run to the scanned node instead of client-sent fields', () => {
        const msg: Record<string, unknown> = { type: 'runAgent', nodeId: 'n', nodeFilePath: '../../etc/passwd', nodeName: 'x', nodeType: 'skill' };
        expect(bindRunTarget(msg, { label: 'reviewer', type: 'subagent', metadata: { _filePath: '.claude/agents/reviewer.md' } })).toBe(true);
        expect(msg).toMatchObject({ nodeFilePath: '.claude/agents/reviewer.md', nodeName: 'reviewer', nodeType: 'subagent' });
        expect(bindRunTarget({}, undefined)).toBe(false);
    });
});

describe('operationForMessage (R4)', () => {
    it('maps every mutating message and leaves reads and proposals undecided', () => {
        const cases: Array<[Record<string, unknown>, unknown]> = [
            [{ type: 'createNode' }, { op: 'editing.createEntity', targets: 'workspace' }],
            [{ type: 'deleteNode', id: 'x' }, { op: 'editing.deleteEntity', targets: ['x'] }],
            [{ type: 'createEdge', source: 'a', target: 'b' }, { op: 'editing.linkSkill', targets: ['a', 'b'] }],
            [{ type: 'createEdge', source: 'a', target: 'b', label: 'governs' }, { op: 'view.localRelation', targets: ['a', 'b'] }],
            [{ type: 'confirmAndDeleteEdge', source: 'a', target: 'b', label: 'uses' }, { op: 'editing.unlinkSkill', targets: ['a', 'b'] }],
            [{ type: 'acceptSuggestion', subagentId: 'a', skillId: 'b' }, { op: 'editing.linkSkill', targets: ['a', 'b'] }],
            [{ type: 'saveSpecFile' }, { op: 'editing.lifecycle', targets: 'workspace' }],
            [{ type: 'applyQuickFix', nodeId: 'n' }, { op: 'editing.reviewedTextEdit', targets: ['n'] }],
            [{ type: 'delegateFinding', ruleId: 'OPT-S04' }, { op: 'agentRuns.delegate', targets: 'workspace' }],
            [{ type: 'runAgent', nodeId: 'n', adapterId: 'claude-code' }, { op: 'agentRuns.launch', targets: ['n'], runnerId: 'claude-code' }],
            [{ type: 'applyHarnessSDD' }, { op: 'adoption.scaffold', targets: 'workspace', format: 'harness-sdd' }],
            [{ type: 'delegateFinding', nodeIds: ['a', 'b'] }, { op: 'agentRuns.delegate', targets: ['a', 'b'] }],
            [{ type: 'runSupplyChainAudit' }, { op: 'workspace.audit', targets: 'workspace' }],
        ];
        for (const [msg, expected] of cases) expect(operationForMessage(msg as never)).toEqual(expected);
        for (const type of ['ready', 'getMarkdownContent', 'generateSpecDraft', 'handoffToChat', 'dismissSuggestion']) {
            expect(operationForMessage({ type })).toBeNull();
        }
        expect(operationForMessage({ type: 'runAgent', nodeId: 'n', adapterId: 'generic' })).toBeNull();
    });
});

describe('declared coverage (R3)', () => {
    it('matches docs/byoh/adapter-capabilities.md for every built-in adapter', () => {
        const rows = readFileSync('docs/byoh/adapter-capabilities.md', 'utf8').split('\n')
            .filter(line => /^\| [a-z][a-z-]* \|/.test(line))
            .map(line => line.slice(1, -1).split('|').map(cell => cell.trim()));
        const fromDoc = Object.fromEntries(rows.map(([id, ...levels]) => [id, Object.fromEntries(CAPABILITY_KEYS.map((k, i) => [k, levels[i]]))]));
        expect(fromDoc).toEqual(BUILTIN_CAPABILITIES);
        expect(Object.keys(BUILTIN_OPERATIONS).sort()).toEqual(SUPPORTED_FRAMEWORKS.map(f => f.id).sort());
    });

    it('declares no operation under an unsupported capability', () => {
        for (const [id, ops] of Object.entries(BUILTIN_OPERATIONS)) {
            for (const op of ops) {
                const capability = OPERATIONS[op].capability;
                expect(capability && BUILTIN_CAPABILITIES[id][capability], `${id} ${op}`).not.toBe('unsupported');
            }
        }
    });
});
