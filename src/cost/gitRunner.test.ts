// FEAT-044 review — git runs without a shell and with fsmonitor disabled (R15).
import { describe, expect, it, vi } from 'vitest';

const { spawnSpy } = vi.hoisted(() => ({ spawnSpy: vi.fn() }));
vi.mock('child_process', () => ({ spawn: spawnSpy }));

import { createGitRunner } from './gitRunner.js';

describe('createGitRunner', () => {
    it('never uses a shell and always disables core.fsmonitor', async () => {
        spawnSpy.mockImplementation(() => ({
            stdout: { on: () => undefined },
            on: (event: string, cb: (code: number, signal: null) => void) => { if (event === 'close') setTimeout(() => cb(0, null), 0); },
        }));
        await createGitRunner('/w')(['show', 'HEAD:./a.md']);
        expect(spawnSpy).toHaveBeenCalledWith('git', ['-c', 'core.fsmonitor=false', 'show', 'HEAD:./a.md'], expect.objectContaining({ cwd: '/w', shell: false }));
    });
});
