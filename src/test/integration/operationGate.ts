// FEAT-041 T3 — host decision at the real dispatch path (R3, R4).
// Read-only, stale, unknown and mixed targets cause zero writes and zero
// launches; a Harness SDD write is the supported positive control.
import * as assert from 'node:assert/strict';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import { HarnessConfig } from '../../config/harnessConfig.js';
import { HarnessDashboardProvider } from '../../HarnessDashboardProvider.js';
import { OperationGate, type ResourceOwnership } from '../../operations/operationGate.js';
import { RunAdapterRegistry } from '../../run/runAdapterRegistry.js';
import type { RunAdapter } from '../../run/types.js';

async function snapshot(root: string): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const entry of await nodeFs.readdir(root, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const file = path.join(entry.parentPath, entry.name);
        out[path.relative(root, file)] = await nodeFs.readFile(file, 'utf8');
    }
    return out;
}

function fakeContext(): vscode.ExtensionContext {
    const state = new Map<string, unknown>();
    const workspaceState = {
        get: (key: string, fallback?: unknown) => (state.has(key) ? state.get(key) : fallback),
        update: async (key: string, value: unknown) => { state.set(key, value); },
        keys: () => [...state.keys()],
    };
    return { workspaceState, subscriptions: [] } as unknown as vscode.ExtensionContext;
}

export async function run(): Promise<void> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    const write = async (rel: string, content: string) => {
        await nodeFs.mkdir(path.dirname(path.join(root.fsPath, rel)), { recursive: true });
        await nodeFs.writeFile(path.join(root.fsPath, rel), content);
    };
    await write('CLAUDE.md', '# Team instructions');
    await write('.claude/agents/reviewer.md', '---\nname: reviewer\ndescription: Review changes.\n---\nReview.');
    await write('.claude/agents/writer.md', '---\nname: writer\ndescription: Write docs.\n---\nWrite.');

    const log = vscode.window.createOutputChannel('Operation gate test', { log: true });
    const config = new HarnessConfig(log);
    const registry = new AdapterRegistry(createDefaultAdapters(config), log);
    const context = fakeContext();
    const provider = new HarnessDashboardProvider(vscode.Uri.file(path.resolve(__dirname, '../../..')), root, context, log, registry);
    // A runner that reports its CLI as missing: the test must never open a terminal.
    const runner: RunAdapter = { id: 'claude-code', name: 'Claude Code', cliCommand: 'claude', isAvailable: async () => false, buildCommand: () => 'exit 1' };
    const gate = new OperationGate(registry, () => provider.getCachedData() ?? undefined, new RunAdapterRegistry([runner]));
    provider.setOperationGate(gate);

    const messages: Array<Record<string, unknown>> = [];
    const post = (msg: unknown) => { messages.push(msg as Record<string, unknown>); };
    const internal = provider as unknown as {
        _sendDataTo(post: (msg: unknown) => void): Promise<void>;
        _handleWebviewMessage(msg: unknown, post: (msg: unknown) => void): Promise<void>;
    };
    const dispatch = async (msg: Record<string, unknown>) => {
        messages.length = 0;
        await internal._handleWebviewMessage(msg, post);
        return messages.filter(m => m.type === 'operationDenied');
    };

    try {
        await internal._sendDataTo(post);
        const init = messages.find(m => m.type === 'init') as { ownership: Record<string, ResourceOwnership> } | undefined;
        const reviewer = init?.ownership['claude-code::reviewer'];
        assert.ok(reviewer, 'no ownership for the Claude reviewer');
        assert.equal(reviewer.providerLabel, 'Claude Code');
        assert.equal(reviewer.nativePath, '.claude/agents/reviewer.md');
        const op = (id: string) => reviewer.operations.find(o => o.op === id);
        assert.equal(op('editing.deleteEntity')?.available, false);
        assert.match(op('editing.deleteEntity')?.reason ?? '', /read-only/);
        assert.equal(op('editing.reviewedTextEdit')?.available, true);
        assert.match(op('agentRuns.launch')?.reason ?? '', /not installed/);

        const before = await snapshot(root.fsPath);
        const terminals = vscode.window.terminals.length;
        const deniedCases: Array<[string, Record<string, unknown>, RegExp]> = [
            ['read-only delete', { type: 'deleteNode', id: 'claude-code::reviewer', nodeType: 'subagent' }, /read-only/],
            ['read-only metadata', { type: 'updateMetadata', id: 'claude-code::reviewer', nodeType: 'subagent', metadata: { description: 'x' } }, /read-only/],
            ['stale target', { type: 'deleteNode', id: 'claude-code::deleted-since', nodeType: 'subagent' }, /no longer in the current scan/],
            ['no owner for new entities', { type: 'createNode', nodeType: 'subagent', name: 'intruder', description: '' }, /No detected provider/],
            ['relabel without a writer', { type: 'updateEdgeLabel', source: 'claude-code::root', target: 'claude-code::reviewer', label: 'governs' }, /read-only/],
            ['launch without the CLI', { type: 'runAgent', nodeId: 'claude-code::reviewer', adapterId: 'claude-code', task: 'x', nodeName: 'reviewer', nodeFilePath: '', nodeType: 'subagent' }, /not installed/],
            ['forged mode is ignored', { type: 'deleteNode', id: 'claude-code::writer', nodeType: 'subagent', operationMode: 'persist' }, /read-only/],
        ];
        for (const [name, msg, reason] of deniedCases) {
            const denied = await dispatch(msg);
            assert.equal(denied.length, 1, `${name}: expected one denial`);
            assert.match(String(denied[0].reason), reason, name);
        }

        // Mixed or foreign links stay view data: allowed, but nothing is written.
        assert.equal((await dispatch({ type: 'createEdge', source: 'claude-code::reviewer', target: 'claude-code::writer', label: 'uses' })).length, 0);
        const stored = context.workspaceState.get<Array<{ source: string; target: string }>>('harness-dashboard.customUsesEdges', []);
        assert.deepEqual(stored, [{ source: 'claude-code::reviewer', target: 'claude-code::writer' }]);
        assert.equal((await dispatch({ type: 'deleteEdge', source: 'claude-code::reviewer', target: 'claude-code::writer', label: 'uses' })).length, 0);

        assert.deepEqual(await snapshot(root.fsPath), before, 'a denied or view-local operation changed workspace files');
        assert.equal(vscode.window.terminals.length, terminals, 'a terminal was launched');

        // Positive control: once Harness SDD owns the workspace format, creating an entity writes it.
        await write('.agents/agentic.json', JSON.stringify({ subagents: [], skills: [], commands: [] }));
        await internal._sendDataTo(post);
        assert.equal((await dispatch({ type: 'createNode', nodeType: 'subagent', name: 'tester', description: 'Tests.' })).length, 0);
        await nodeFs.access(path.join(root.fsPath, '.agents/subagents/tester/SUBAGENT.md'));
        // Scaffolding Harness SDD again would overwrite the manifest it now owns.
        const manifest = await nodeFs.readFile(path.join(root.fsPath, '.agents/agentic.json'), 'utf8');
        await internal._sendDataTo(post);
        const again = await dispatch({ type: 'applyHarnessSDD' });
        assert.match(String(again[0]?.reason), /already set up/);
        assert.equal(await nodeFs.readFile(path.join(root.fsPath, '.agents/agentic.json'), 'utf8'), manifest);
        console.log('FEAT-041 operation gate passed');
    } finally {
        config.dispose();
        log.dispose();
    }
}
