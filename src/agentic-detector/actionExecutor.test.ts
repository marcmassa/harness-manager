/**
 * Unit tests for ActionExecutor (FEAT-032 T15).
 *
 * Strategy: mock the `vscode` module entirely so every VS Code API call
 * (workspace.fs, window.showTextDocument, window.createTerminal) is a
 * vitest spy.  The module under test is imported *after* vi.mock runs, so
 * the mocked module is already in place when ActionExecutor is constructed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock vscode before importing the module under test ───────────────────────

vi.mock('vscode', () => {
    const joinPath = vi.fn().mockImplementation((_base: unknown, ...parts: string[]) => ({
        _path: parts.join('/'),
    }));

    return {
        Uri: { joinPath },
        workspace: {
            fs: {
                createDirectory: vi.fn().mockResolvedValue(undefined),
                writeFile: vi.fn().mockResolvedValue(undefined),
                stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
            },
        },
        window: {
            showTextDocument: vi.fn().mockResolvedValue(undefined),
            createTerminal: vi.fn().mockReturnValue({
                sendText: vi.fn(),
                show: vi.fn(),
            }),
        },
    };
});

import * as vscode from 'vscode';
import { ActionExecutor } from './actionExecutor.js';
import type { SuggestionAction } from './types.js';
// FEAT-036 T15: dependabot scaffold reuse + rescan integration
import { DEPENDABOT_TEMPLATE, DEPENDABOT_TEMPLATE_REL_PATH } from '../supply-chain/dependabotTemplate.js';
import { scanWorkspace, type SupplyChainFsDeps } from '../supply-chain/scanner.js';
import { generate } from './advisoryEngine.js';
import { makeProfile } from './testUtils.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeExecutor() {
    const root = { _path: '/workspace' } as unknown as vscode.Uri;
    const detector = { scheduleScan: vi.fn() } as any;
    const log = {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    } as any;
    return { executor: new ActionExecutor(root, detector, log), detector, log };
}

// Reset all mocks before each test, then re-apply the default stat rejection
beforeEach(() => {
    vi.clearAllMocks();
    // Default: stat rejects (file / dir does not yet exist)
    vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('ENOENT'));
    // Default: createDirectory, writeFile, showTextDocument succeed
    vi.mocked(vscode.workspace.fs.createDirectory).mockResolvedValue(undefined);
    vi.mocked(vscode.workspace.fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(vscode.window.showTextDocument).mockResolvedValue(undefined as any);
    vi.mocked(vscode.window.createTerminal).mockReturnValue({
        sendText: vi.fn(),
        show: vi.fn(),
    } as any);
});

// ─── create-directory ─────────────────────────────────────────────────────────

describe('ActionExecutor — create-directory', () => {
    it('calls createDirectory with the resolved URI', async () => {
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-directory',
            payload: { relPath: 'prompts' },
        };
        const result = await executor.execute(action);
        expect(result).toEqual({ ok: true });
        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledOnce();
    });

    it('calls scheduleScan after success', async () => {
        const { executor, detector } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-directory',
            payload: { relPath: 'prompts' },
        };
        await executor.execute(action);
        expect(detector.scheduleScan).toHaveBeenCalledOnce();
    });
});

// ─── create-file ──────────────────────────────────────────────────────────────

describe('ActionExecutor — create-file', () => {
    it('creates parent dir and writes file when it does not exist', async () => {
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-file',
            payload: { relPath: 'CLAUDE.md', template: '# Hello\n' },
        };
        const result = await executor.execute(action);
        expect(result).toEqual({ ok: true });
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledOnce();
        expect(vscode.window.showTextDocument).toHaveBeenCalledOnce();
    });

    it('skips write and opens the file in the editor when it already exists (R5)', async () => {
        vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({} as any);
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-file',
            payload: { relPath: 'CLAUDE.md', template: '# Hello\n' },
        };
        const result = await executor.execute(action);
        expect(result).toEqual({ ok: true });
        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        expect(vscode.window.showTextDocument).toHaveBeenCalledOnce();
    });

    it('writes Buffer with UTF-8 encoded template content', async () => {
        const { executor } = makeExecutor();
        const template = '# System Prompt\n\nYou are a helpful AI assistant.\n';
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-file',
            payload: { relPath: 'prompts/system.md', template },
        };
        await executor.execute(action);
        const [, buf] = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0];
        expect(buf).toEqual(Buffer.from(template, 'utf8'));
    });
});

// ─── open-file ────────────────────────────────────────────────────────────────

describe('ActionExecutor — open-file', () => {
    it('opens the resolved URI in the editor', async () => {
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'open-file',
            payload: { filePath: 'README.md' },
        };
        const result = await executor.execute(action);
        expect(result).toEqual({ ok: true });
        expect(vscode.window.showTextDocument).toHaveBeenCalledOnce();
    });
});

// ─── scaffold-agent ───────────────────────────────────────────────────────────

describe('ActionExecutor — scaffold-agent', () => {
    it('creates the .agents/subagents/<name> directory', async () => {
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'scaffold-agent',
            payload: { name: 'main-agent', description: 'Main agent.' },
        };
        const result = await executor.execute(action);
        expect(result).toEqual({ ok: true });
        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledOnce();
    });

    it('writes SUBAGENT.md containing the agent name', async () => {
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'scaffold-agent',
            payload: { name: 'main-agent', description: 'Main agent.' },
        };
        await executor.execute(action);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledOnce();
        const [, buf] = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0];
        const content = buf.toString('utf8');
        expect(content).toContain('main-agent');
        expect(content).toContain('Main agent.');
    });

    it('skips writeFile when SUBAGENT.md already exists', async () => {
        vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({} as any);
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'scaffold-agent',
            payload: { name: 'main-agent', description: 'Main agent.' },
        };
        await executor.execute(action);
        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
});

// ─── scaffold-skill ───────────────────────────────────────────────────────────

describe('ActionExecutor — scaffold-skill', () => {
    it('creates the .agents/skills/<name> directory', async () => {
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'scaffold-skill',
            payload: { name: 'my-first-skill', description: 'A reusable skill.' },
        };
        const result = await executor.execute(action);
        expect(result).toEqual({ ok: true });
        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledOnce();
    });

    it('writes SKILL.md containing the skill name', async () => {
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'scaffold-skill',
            payload: { name: 'my-first-skill', description: 'A reusable skill.' },
        };
        await executor.execute(action);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledOnce();
        const [, buf] = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0];
        const content = buf.toString('utf8');
        expect(content).toContain('my-first-skill');
        expect(content).toContain('A reusable skill.');
    });
});

// ─── run-command ─────────────────────────────────────────────────────────────

describe('ActionExecutor — run-command', () => {
    it('creates a terminal and sends the command text', async () => {
        const mockTerminal = { sendText: vi.fn(), show: vi.fn() };
        vi.mocked(vscode.window.createTerminal).mockReturnValue(mockTerminal as any);

        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'run-command',
            payload: { command: 'echo hello' },
        };
        const result = await executor.execute(action);
        expect(result).toEqual({ ok: true });
        expect(vscode.window.createTerminal).toHaveBeenCalledOnce();
        expect(mockTerminal.sendText).toHaveBeenCalledWith('echo hello');
        expect(mockTerminal.show).toHaveBeenCalledOnce();
    });
});

// ─── Error handling (R19) ────────────────────────────────────────────────────

describe('ActionExecutor — error handling', () => {
    it('returns { ok: false, error } without throwing when createDirectory fails', async () => {
        vi.mocked(vscode.workspace.fs.createDirectory).mockRejectedValue(new Error('Permission denied'));
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-directory',
            payload: { relPath: 'protected' },
        };
        const result = await executor.execute(action);
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Permission denied');
    });

    it('NEVER throws even when the underlying operation rejects', async () => {
        vi.mocked(vscode.workspace.fs.createDirectory).mockRejectedValue(new Error('Oops'));
        const { executor } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-directory',
            payload: { relPath: 'fails' },
        };
        // Must resolve, not reject
        await expect(executor.execute(action)).resolves.toBeDefined();
    });

    it('logs the error message via the log channel', async () => {
        vi.mocked(vscode.workspace.fs.createDirectory).mockRejectedValue(new Error('disk full'));
        const { executor, log } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-directory',
            payload: { relPath: 'dir' },
        };
        await executor.execute(action);
        expect(log.error).toHaveBeenCalledOnce();
        expect((log.error as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('disk full');
    });

    it('does NOT call scheduleScan when the action fails', async () => {
        vi.mocked(vscode.workspace.fs.createDirectory).mockRejectedValue(new Error('fail'));
        const { executor, detector } = makeExecutor();
        const action: SuggestionAction = {
            id: 'test',
            label: 'Test',
            type: 'create-directory',
            payload: { relPath: 'dir' },
        };
        await executor.execute(action);
        expect(detector.scheduleScan).not.toHaveBeenCalled();
    });
});

// ─── FEAT-036 T15: dependabot scaffold — R5 non-destructive, reuse-unchanged ─

describe('ActionExecutor — FEAT-036 dependabot scaffold (R5)', () => {
    function dependabotAction(): SuggestionAction {
        return {
            id: 'create-dependabot-yml',
            label: 'Create .github/dependabot.yml',
            type: 'create-file',
            payload: {
                relPath: DEPENDABOT_TEMPLATE_REL_PATH,
                template: DEPENDABOT_TEMPLATE,
            },
        };
    }

    it('writes the file when it does not exist (create-file reused unchanged)', async () => {
        const { executor } = makeExecutor();
        const result = await executor.execute(dependabotAction());
        expect(result).toEqual({ ok: true });
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledOnce();
        const [uri, buf] = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0];
        expect((uri as unknown as { _path: string })._path).toBe(DEPENDABOT_TEMPLATE_REL_PATH);
        expect(buf.toString('utf8')).toBe(DEPENDABOT_TEMPLATE);
    });

    it('is NON-DESTRUCTIVE when .github/dependabot.yml already exists (R5)', async () => {
        // stat resolves → the existing file is left untouched AND opened in
        // the editor instead (R5 second clause — the executor's create-file
        // case was extended by one line for this; write/skip semantics from
        // FEAT-032 are unchanged).
        vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({} as any);
        const { executor } = makeExecutor();
        const result = await executor.execute(dependabotAction());
        expect(result).toEqual({ ok: true });
        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        expect(vscode.workspace.fs.createDirectory).not.toHaveBeenCalled();
        expect(vscode.window.showTextDocument).toHaveBeenCalledOnce();
    });

    it('a re-scan after the file lands clears SC-01 (integration, R3)', async () => {
        // In-memory fs: dependabot file absent first, then present.
        const pkgJson = JSON.stringify({ name: 'x', dependencies: { react: '^18.0.0' } });
        let dependabotExists = false;
        const deps: SupplyChainFsDeps = {
            async readFile(rel) {
                if (rel === 'package.json') return pkgJson;
                if (rel === '.github/dependabot.yml' && dependabotExists) return DEPENDABOT_TEMPLATE;
                return null;
            },
            async exists(rel) {
                if (rel === 'package.json') return true;
                return rel === '.github/dependabot.yml' && dependabotExists;
            },
        };

        const before = await scanWorkspace(deps, null, 'not-run');
        expect(generate(makeProfile({ supplyChain: before })).some(s => s.id === 'sc-add-update-bot')).toBe(true);

        dependabotExists = true; // the create-file action landed on disk
        const after = await scanWorkspace(deps, null, 'not-run');
        expect(generate(makeProfile({ supplyChain: after })).some(s => s.id === 'sc-add-update-bot')).toBe(false);
    });
});
