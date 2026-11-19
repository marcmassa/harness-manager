// FEAT-048 T1 (R5) — the delegation dirty check goes through the guarded git runner.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const { spawnSpy } = vi.hoisted(() => ({ spawnSpy: vi.fn() }));
vi.mock('child_process', async orig => ({ ...(await orig<object>()), spawn: spawnSpy }));
vi.mock('vscode', () => ({ window: {}, workspace: {}, Uri: {} }));

const { gitState } = await import('./optimizerDelegation.js');

function child(result: { code?: number; out?: string; error?: boolean }) {
    const c = Object.assign(new EventEmitter(), { stdout: new EventEmitter() });
    setTimeout(() => {
        if (result.error) { c.emit('error', new Error('ENOENT')); return; }
        if (result.out) c.stdout.emit('data', Buffer.from(result.out));
        c.emit('close', result.code ?? 0, null);
    }, 0);
    return c;
}

describe('gitState (FEAT-048 R5)', () => {
    beforeEach(() => spawnSpy.mockReset());

    it('runs git without a shell and with core.fsmonitor disabled', async () => {
        spawnSpy.mockImplementation(() => child({ out: '' }));
        expect(await gitState({ fsPath: '/w' } as never)).toBe('clean');
        const [cmd, args, opts] = spawnSpy.mock.calls[0];
        expect(cmd).toBe('git');
        expect(args).toEqual(['-c', 'core.fsmonitor=false', 'status', '--porcelain']);
        expect(opts).toMatchObject({ cwd: '/w', shell: false });
    });

    it('reports a dirty tree, and a non-repository or missing git as no-vcs', async () => {
        spawnSpy.mockImplementationOnce(() => child({ out: ' M a.md\n' }));
        expect(await gitState({ fsPath: '/w' } as never)).toBe('dirty');
        spawnSpy.mockImplementationOnce(() => child({ code: 128 }));
        expect(await gitState({ fsPath: '/w' } as never)).toBe('no-vcs');
        spawnSpy.mockImplementationOnce(() => child({ error: true }));
        expect(await gitState({ fsPath: '/w' } as never)).toBe('no-vcs');
    });

    it('leaves no hand-written git spawn in the host', async () => {
        const { readFileSync, readdirSync, statSync } = await import('node:fs');
        const { join } = await import('node:path');
        const hits: string[] = [];
        const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(p) && !p.includes('.test.') && !p.includes('/test/') && p !== join('src', 'cost', 'gitRunner.ts') && /spawn\(\s*['"]git['"]|exec(File)?\(\s*['"]git/.test(readFileSync(p, 'utf8'))) hits.push(p); } };
        walk('src');
        expect(hits).toEqual([]);
    });
});
