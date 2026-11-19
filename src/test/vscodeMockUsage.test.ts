// FEAT-048 T2 (R2) — unit tests share one in-memory vscode mock and one glob.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function testFiles(dir: string, out: string[] = []): string[] {
    for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) testFiles(p, out); else if (/\.test\.tsx?$/.test(p)) out.push(p); }
    return out;
}

describe('shared vscode mock (FEAT-048 R2)', () => {
    it('defines the mock glob and path normaliser only in src/test/vscodeMock.ts', () => {
        const copies = testFiles('src').filter(f => !f.endsWith('vscodeMockUsage.test.ts') && /function globToRegExp|const globToRegExp|function normalize\(|const normalize = /.test(readFileSync(f, 'utf8')));
        expect(copies).toEqual([]);
        expect(readFileSync('src/test/vscodeMock.ts', 'utf8')).toMatch(/export function globToRegExp/);
    });
});
