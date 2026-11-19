// FEAT-044 T5 — cost against git HEAD (R13, R14, R15).
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareWithHead, readHeadVersions, type GitRunner } from './baselineDiff.js';
import { createGitRunner } from './gitRunner.js';
import type { ComponentSource } from '../optimizer/types.js';

const NOW = '# Team\n\n' + 'Run the tests before every commit. '.repeat(10);
const OLD = '# Team\n\nShort.';
const comp = (nodeId: string, filePath: string, raw: string, exists = true, providerId = 'claude-code'): ComponentSource => ({
    nodeId, nodeType: 'agent', label: nodeId, filePath, raw, body: raw, frontmatter: {}, exists, pathKind: exists ? 'file' : 'missing', tokenEstimate: 0,
    source: { workspaceUri: 'w', providerId, nativeId: nodeId },
});

describe('compareWithHead (R13)', () => {
    it('reports changed, new and deleted resources and the change per owner', () => {
        const sources = [
            comp('root', 'CLAUDE.md', NOW),                                   // changed: grew
            comp('gem', 'GEMINI.md', '# Gemini\n\nBe brief.', true, 'gemini-cli'), // new: not in HEAD
            comp('gone', '.github/copilot-instructions.md', '', false, 'copilot'),  // deleted since HEAD
        ];
        const result = compareWithHead(sources, { available: true, files: new Map([['CLAUDE.md', OLD], ['GEMINI.md', null], ['.github/copilot-instructions.md', 'Copilot rules that were here.']]) });
        if (!result.available) throw new Error('unavailable');
        expect(result.resources.map(r => [r.filePath, r.status, Math.sign(r.delta)])).toEqual([
            ['CLAUDE.md', 'changed', 1], ['GEMINI.md', 'new', 1], ['.github/copilot-instructions.md', 'deleted', -1],
        ]);
        expect(result.owners.find(o => o.owner === 'claude-code')!.delta).toBeGreaterThan(0);
    });

    it('omits unchanged resources but keeps them in the totals', () => {
        const result = compareWithHead([comp('root', 'CLAUDE.md', OLD)], { available: true, files: new Map([['CLAUDE.md', OLD]]) });
        expect(result).toMatchObject({ available: true, resources: [], owners: [{ owner: 'claude-code', delta: 0 }] });
    });
});

describe('readHeadVersions (R14, R15)', () => {
    const fake = (answers: Record<string, { code: number; stdout: string }>): GitRunner => async args => answers[args.join(' ')] ?? { code: 128, stdout: '' };

    it('reports a non-git folder or a repository without commits as unavailable', async () => {
        expect(await readHeadVersions(['a.md'], fake({}))).toMatchObject({ available: false, reason: expect.stringContaining('not a git repository') });
        expect(await readHeadVersions(['a.md'], fake({ 'rev-parse --is-inside-work-tree': { code: 0, stdout: 'true\n' } })))
            .toMatchObject({ available: false, reason: expect.stringContaining('no commit yet') });
        expect(await readHeadVersions(['a.md'], async () => { throw new Error('git not installed'); })).toMatchObject({ available: false });
    });

    it('reads tracked files from a real repository and treats an untracked file as new', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'cost-head-'));
        try {
            const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
            git('init', '-q'); git('config', 'user.email', 't@example.invalid'); git('config', 'user.name', 't');
            writeFileSync(join(dir, 'CLAUDE.md'), OLD);
            git('add', 'CLAUDE.md'); git('commit', '-q', '-m', 'init');
            writeFileSync(join(dir, 'CLAUDE.md'), NOW);
            mkdirSync(join(dir, '.github'));
            writeFileSync(join(dir, '.github/copilot-instructions.md'), 'untracked');
            const head = await readHeadVersions(['CLAUDE.md', '.github/copilot-instructions.md'], createGitRunner(dir));
            expect(head.available).toBe(true);
            if (!head.available) return;
            expect(head.files.get('CLAUDE.md')).toBe(OLD);
            expect(head.files.get('.github/copilot-instructions.md')).toBeNull();
            // R15: reading HEAD changed nothing in the working tree.
            expect(execFileSync('git', ['status', '--porcelain'], { cwd: dir }).toString()).toBe(' M CLAUDE.md\n?? .github/\n');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
