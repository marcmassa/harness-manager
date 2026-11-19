// FEAT-043 T3 — fixes and delegation revalidate before any side effect (R5–R7).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = { diff: 0, terminals: 0 };
let modalChoice: string | undefined = 'Apply';
vi.mock('vscode', () => ({
    Uri: {
        parse: (s: string) => ({ toString: () => s }),
        joinPath: (base: { path: string }, ...parts: string[]) => ({ path: [base.path, ...parts].join('/'), fsPath: [base.path, ...parts].join('/') }),
    },
    commands: { executeCommand: vi.fn(async () => { calls.diff += 1; }) },
    window: {
        showInformationMessage: vi.fn(async () => modalChoice),
        showWarningMessage: vi.fn(async (_m: string, _o: unknown, choice: string) => choice),
        createTerminal: vi.fn(() => { calls.terminals += 1; return { show: vi.fn(), sendText: vi.fn() }; }),
        onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() })),
    },
}));

import * as vscode from 'vscode';
import { previewAndWrite, secondaryFileProblem, type PreviewWriteDeps } from './optimizerWrite.js';
import { delegateFindings } from './optimizerDelegation.js';
import type { ComponentSource, OptimizerFinding } from '../optimizer/types.js';
import { BUILTIN_OPERATIONS, decide, type GateContext } from '../operations/operations.js';

const RAW = '---\nname: lint\n---\nBody.';
const source: ComponentSource = {
    nodeId: 'harness-sdd::lint', nodeType: 'skill', label: 'lint', filePath: '.agents/skills/lint/SKILL.md',
    raw: RAW, frontmatter: { name: 'lint' }, body: 'Body.', exists: true, pathKind: 'file', tokenEstimate: 5,
    source: { workspaceUri: 'w', providerId: 'harness-sdd', nativeId: 'lint' },
};

function harness(reads: Array<string | null>, decision: { ok: boolean; reason?: string } = { ok: true }) {
    const written: string[] = [];
    const results: Array<Record<string, unknown>> = [];
    const deps: PreviewWriteDeps = {
        diffProvider: { stage: vi.fn(), clear: vi.fn() } as never,
        workspaceRoot: { path: '/w', fsPath: '/w' } as never,
        writer: { writeFileAtPath: vi.fn(async (p: string) => { written.push(p); }) } as never,
        readFile: vi.fn(async (rel: string) => (rel !== source.filePath ? null : reads.length > 1 ? reads.shift()! : reads[0])),
        authorize: vi.fn(async () => (decision.ok ? { ok: true, mode: 'persist', owners: ['harness-sdd'] } : { ok: false, reason: decision.reason! })) as never,
        log: { error: vi.fn() } as never,
    };
    const run = (extraFile?: { relPath: string; content: string }) => previewAndWrite({
        source, ruleId: 'OPT-B02', content: 'new', extraFile, title: 't', prompt: 'p', resultType: 'quickFixResult',
        postMessage: m => { results.push(m as Record<string, unknown>); },
    }, deps);
    return { deps, run, written, results };
}

beforeEach(() => { calls.diff = 0; calls.terminals = 0; modalChoice = 'Apply'; vi.clearAllMocks(); });

describe('reviewed fixes (R5)', () => {
    it('writes a confirmed, authorized edit to its own file and secondary file', async () => {
        const h = harness([RAW]);
        await h.run({ relPath: '.agents/skills/lint/references/details.md', content: 'moved' });
        expect(h.written).toEqual(['.agents/skills/lint/SKILL.md', '.agents/skills/lint/references/details.md']);
        expect(h.results.at(-1)).toMatchObject({ ok: true });
    });

    it('rejects a source that changed while the preview was open, writing nothing', async () => {
        const h = harness([RAW, RAW + '\nEdited meanwhile.']);
        await h.run();
        expect(h.written).toEqual([]);
        expect(h.results.at(-1)).toMatchObject({ ok: false, reason: expect.stringContaining('changed while the preview was open') });
    });

    it('rejects a stale scan before staging anything', async () => {
        const h = harness(['something else']);
        await h.run();
        expect(calls.diff).toBe(0);
        expect(h.written).toEqual([]);
    });

    it('rejects a secondary file the component\'s owner cannot be confirmed for', async () => {
        const h = harness([RAW]);
        await h.run({ relPath: 'docs/elsewhere.md', content: 'moved' });
        expect(calls.diff).toBe(0);
        expect(h.written).toEqual([]);
        expect(secondaryFileProblem(source, '../outside.md')).toContain('escapes');
    });

    it('rejects when ownership is revoked after the confirmation', async () => {
        const h = harness([RAW], { ok: false, reason: 'Claude Code resources are read-only' });
        await h.run();
        expect(h.written).toEqual([]);
        expect(h.results.at(-1)).toMatchObject({ ok: false, reason: 'Claude Code resources are read-only' });
    });
});

describe('FEAT-043 review fixes', () => {
    it('refuses a second file in a format without per-component folders', () => {
        const flat = { ...source, filePath: '.claude/agents/reviewer.md', label: 'reviewer' };
        expect(secondaryFileProblem(flat, '.claude/agents/references/x.md')).toContain('no per-component folder');
        expect(secondaryFileProblem(source, '.agents/skills/lint/references/x.md')).toBeNull();
    });

    it('rejects when the secondary file appears while the preview is open', async () => {
        const h = harness([RAW]);
        (h.deps.readFile as ReturnType<typeof vi.fn>).mockImplementation(async () => RAW);
        await h.run({ relPath: '.agents/skills/lint/references/details.md', content: 'moved' });
        expect(h.written).toEqual([]);
        expect(h.results.at(-1)).toMatchObject({ ok: false, reason: expect.stringContaining('appeared while the preview was open') });
    });
});

describe('delegation (R6, R7)', () => {
    const finding = (nodeId: string): OptimizerFinding => ({ ruleId: 'OPT-S03', nodeId, nodeType: 'skill', filePath: `${nodeId}.md`, severity: 'warning', dimension: 'structure', title: 't', detail: 'd' });
    const ctx = (owners: Record<string, string>): GateContext => ({
        owners: new Map(Object.entries(owners)), detected: Object.values(owners), trusted: true,
        providerLabel: id => id, providerOperations: id => new Set(BUILTIN_OPERATIONS[id] ?? []),
    });

    it('refuses a mixed scope that includes a read-only owner', () => {
        expect(decide('agentRuns.delegate', ['a', 'b'], ctx({ a: 'cursor', b: 'opencode' }), { runnerAvailable: true }))
            .toMatchObject({ ok: false, reason: expect.stringContaining('opencode resources cannot be edited') });
        expect(decide('agentRuns.delegate', ['a'], ctx({ a: 'cursor' }), { runnerAvailable: true })).toMatchObject({ ok: true });
    });

    const delegateDeps = (over: Record<string, unknown>) => ({
        assistAllowed: () => true,
        runRegistry: { detect: async () => [{ id: 'claude-code', name: 'Claude', isAvailable: async () => true, buildCommand: () => 'x' }], getById: () => ({ id: 'generic', name: 'Open in Editor', buildCommand: () => 'x' }) } as never,
        findings: [finding('a')], workspaceRoot: { fsPath: '/w' } as never,
        authorize: async () => ({ ok: true as const, mode: 'persist' as const, owners: ['cursor'] }),
        log: { error: vi.fn() } as never, ...over,
    });

    it('chooses the runner from installed CLIs only', async () => {
        const results: Array<Record<string, unknown>> = [];
        await delegateFindings({ type: 'delegateFinding', scope: 'finding', nodeId: 'a', ruleId: 'OPT-S03', adapterId: 'generic' } as never, m => { results.push(m as never); }, delegateDeps({}));
        expect(calls.terminals).toBe(0);
        expect(results.at(-1)).toMatchObject({ ok: false, reason: expect.stringContaining('is not installed') });
    });

    it('hands no agent a component whose file changed since the scan', async () => {
        const results: Array<Record<string, unknown>> = [];
        await delegateFindings({ type: 'delegateFinding', scope: 'finding', nodeId: 'a', ruleId: 'OPT-S03' } as never, m => { results.push(m as never); },
            delegateDeps({ staleSource: async () => 'a.md changed since the last scan — re-scan and try again' }));
        expect(calls.terminals).toBe(0);
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(results.at(-1)).toMatchObject({ ok: false, reason: expect.stringContaining('changed since the last scan') });
    });

    it('opens no terminal when the resolved scope is refused', async () => {
        const results: unknown[] = [];
        await delegateFindings({ type: 'delegateFinding', scope: 'rule', ruleId: 'OPT-S03' } as never, m => { results.push(m); }, {
            assistAllowed: () => true,
            runRegistry: { detect: async () => [{ id: 'claude-code', name: 'Claude', isAvailable: async () => true, buildCommand: () => 'x' }], getById: () => undefined } as never,
            findings: [finding('a'), finding('b')],
            workspaceRoot: { fsPath: '/w' } as never,
            authorize: async () => ({ ok: false, reason: 'opencode resources cannot be edited, so they cannot be delegated.' }),
            log: { error: vi.fn() } as never,
        });
        expect(calls.terminals).toBe(0);
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(results).toEqual([expect.objectContaining({ ok: false, reason: expect.stringContaining('cannot be delegated') })]);
    });
});
