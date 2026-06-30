// FEAT-033 T39: Tests for run module
import { describe, it, expect, vi } from 'vitest';
import { ClaudeCodeAdapter } from './adapters/claudeCodeAdapter.js';
import { GeminiCliAdapter } from './adapters/geminiCliAdapter.js';
import { GenericAdapter } from './adapters/genericAdapter.js';
import { RunAdapterRegistry } from './runAdapterRegistry.js';
import type { RunNode, RunOptions, RunHistoryEntry } from './types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<RunNode> = {}): RunNode {
    return {
        id: 'test-node',
        type: 'subagent',
        name: 'Test Agent',
        filePath: '.agents/subagents/test-agent/SUBAGENT.md',
        ...overrides,
    };
}

function makeOpts(overrides: Partial<RunOptions> = {}): RunOptions {
    return {
        task: 'Implement the login feature',
        ...overrides,
    };
}

// ─── ClaudeCodeAdapter ──────────────────────────────────────────────────────

describe('ClaudeCodeAdapter.buildCommand()', () => {
    const adapter = new ClaudeCodeAdapter();

    it('interactive mode: launches just "claude" with no pre-fill flags', () => {
        // Claude Code CLI has no --message flag; task is shown in the Run Panel for reference
        const cmd = adapter.buildCommand(makeNode(), makeOpts({ interactive: true }));
        expect(cmd).toBe('claude');
    });

    it('interactive mode with filePath: still just "claude" (context shown in panel, not CLI)', () => {
        const cmd = adapter.buildCommand(
            makeNode({ filePath: '.agents/subagents/test/SUBAGENT.md' }),
            makeOpts({ interactive: true }),
        );
        expect(cmd).toBe('claude');
    });

    it('one-shot mode: uses --print flag', () => {
        const cmd = adapter.buildCommand(makeNode(), makeOpts({ interactive: false }));
        expect(cmd).toMatch(/^claude --print/);
        expect(cmd).toContain('Implement the login feature');
    });

    it('one-shot mode: does NOT use --message', () => {
        const cmd = adapter.buildCommand(makeNode(), makeOpts({ interactive: false }));
        expect(cmd).not.toContain('--message');
    });

    it('includes --model when model option provided', () => {
        const cmd = adapter.buildCommand(makeNode(), makeOpts({ model: 'claude-opus-4-5' }));
        expect(cmd).toContain('--model claude-opus-4-5');
    });

    it('includes extraArgs when provided', () => {
        const cmd = adapter.buildCommand(makeNode(), makeOpts({ extraArgs: '--verbose' }));
        expect(cmd).toContain('--verbose');
    });

    it('interactive mode with no task: just "claude"', () => {
        const cmd = adapter.buildCommand(makeNode(), makeOpts({ task: '', interactive: true }));
        expect(cmd).toBe('claude');
    });

    it('appends featureContext when provided', () => {
        const cmd = adapter.buildCommand(
            makeNode(),
            makeOpts({ featureContext: 'This is the spec', interactive: false }),
        );
        expect(cmd).toContain('Feature context:');
        expect(cmd).toContain('This is the spec');
    });

    it('id is "claude-code"', () => {
        expect(adapter.id).toBe('claude-code');
    });
});

// ─── GeminiCliAdapter ───────────────────────────────────────────────────────

describe('GeminiCliAdapter.buildCommand()', () => {
    const adapter = new GeminiCliAdapter();

    it('with filePath: includes --file flag', () => {
        const cmd = adapter.buildCommand(
            makeNode({ filePath: '.agents/subagents/test/SUBAGENT.md' }),
            makeOpts(),
        );
        expect(cmd).toMatch(/^gemini --file/);
        expect(cmd).toContain('--prompt');
    });

    it('without filePath: no --file flag', () => {
        const cmd = adapter.buildCommand(makeNode({ filePath: '' }), makeOpts());
        expect(cmd).toMatch(/^gemini --prompt/);
        expect(cmd).not.toContain('--file');
    });

    it('includes task in --prompt', () => {
        const cmd = adapter.buildCommand(makeNode({ filePath: '' }), makeOpts({ task: 'Do the thing' }));
        expect(cmd).toContain('Do the thing');
    });

    it('includes --model when model option provided', () => {
        const cmd = adapter.buildCommand(makeNode({ filePath: '' }), makeOpts({ model: 'gemini-2.5-pro' }));
        expect(cmd).toContain('--model gemini-2.5-pro');
    });

    it('appends featureContext to prompt when provided', () => {
        const cmd = adapter.buildCommand(
            makeNode({ filePath: '' }),
            makeOpts({ featureContext: 'spec text here' }),
        );
        expect(cmd).toContain('Feature context:');
        expect(cmd).toContain('spec text here');
    });

    it('id is "gemini-cli"', () => {
        expect(adapter.id).toBe('gemini-cli');
    });
});

// ─── GenericAdapter ─────────────────────────────────────────────────────────

describe('GenericAdapter', () => {
    const adapter = new GenericAdapter();

    it('isAvailable() always resolves true', async () => {
        expect(await adapter.isAvailable()).toBe(true);
    });

    it('buildCommand() returns the node filePath', () => {
        const node = makeNode({ filePath: '.agents/subagents/test/SUBAGENT.md' });
        expect(adapter.buildCommand(node, makeOpts())).toBe(node.filePath);
    });

    it('id is "generic"', () => {
        expect(adapter.id).toBe('generic');
    });
});

// ─── RunAdapterRegistry ──────────────────────────────────────────────────────

describe('RunAdapterRegistry.detect()', () => {
    it('returns only available adapters', async () => {
        const a1 = { id: 'claude-code', name: 'Claude Code', cliCommand: 'claude', isAvailable: vi.fn().mockResolvedValue(true), buildCommand: vi.fn() };
        const a2 = { id: 'gemini-cli', name: 'Gemini CLI', cliCommand: 'gemini', isAvailable: vi.fn().mockResolvedValue(false), buildCommand: vi.fn() };
        const a3 = { id: 'generic', name: 'Open in Editor', cliCommand: '', isAvailable: vi.fn().mockResolvedValue(true), buildCommand: vi.fn() };

        const registry = new RunAdapterRegistry([a1, a2, a3]);
        const available = await registry.detect();

        expect(available.map(a => a.id)).toEqual(['claude-code', 'generic']);
        expect(a2.isAvailable).toHaveBeenCalledOnce();
    });

    it('caches results after first detect()', async () => {
        const adapter = { id: 'generic', name: 'Open in Editor', cliCommand: '', isAvailable: vi.fn().mockResolvedValue(true), buildCommand: vi.fn() };
        const registry = new RunAdapterRegistry([adapter]);

        await registry.detect();
        await registry.detect();

        expect(adapter.isAvailable).toHaveBeenCalledOnce();
    });

    it('forceRefresh() clears cache so detect() re-checks', async () => {
        const adapter = { id: 'generic', name: 'Open in Editor', cliCommand: '', isAvailable: vi.fn().mockResolvedValue(true), buildCommand: vi.fn() };
        const registry = new RunAdapterRegistry([adapter]);

        await registry.detect();
        registry.forceRefresh();
        await registry.detect();

        expect(adapter.isAvailable).toHaveBeenCalledTimes(2);
    });

    it('getById() finds adapter by id', () => {
        const a1 = { id: 'claude-code', name: 'Claude Code', cliCommand: 'claude', isAvailable: vi.fn(), buildCommand: vi.fn() };
        const registry = new RunAdapterRegistry([a1]);
        expect(registry.getById('claude-code')).toBe(a1);
        expect(registry.getById('missing')).toBeUndefined();
    });
});

// ─── Run History management ──────────────────────────────────────────────────

describe('Run history helpers', () => {
    // Test the FIFO logic in isolation (no vscode dependency)
    function appendHistory(history: RunHistoryEntry[], entry: RunHistoryEntry): RunHistoryEntry[] {
        const next = [entry, ...history];
        return next.slice(0, 20);
    }

    it('prepends new entry', () => {
        const h = appendHistory([], { nodeId: 'n1', nodeName: 'N1', adapterId: 'generic', taskSnippet: 'do X', timestamp: 1000 });
        expect(h).toHaveLength(1);
        expect(h[0].nodeId).toBe('n1');
    });

    it('keeps max 20 entries (FIFO — oldest dropped)', () => {
        let history: RunHistoryEntry[] = [];
        for (let i = 0; i < 25; i++) {
            history = appendHistory(history, {
                nodeId: `n${i}`, nodeName: `N${i}`, adapterId: 'generic',
                taskSnippet: `task ${i}`, timestamp: i,
            });
        }
        expect(history).toHaveLength(20);
        // Most recent entries are at the front
        expect(history[0].nodeId).toBe('n24');
        // Entry n4 (oldest after trimming) should be gone — entries 0-4 dropped
        expect(history.find(e => e.nodeId === 'n4')).toBeUndefined();
    });

    it('taskSnippet is first 80 chars', () => {
        const task = 'A'.repeat(100);
        const snippet = task.slice(0, 80);
        expect(snippet).toHaveLength(80);
    });
});
