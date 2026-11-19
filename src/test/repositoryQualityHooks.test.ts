import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const catalog = JSON.parse(readFileSync('.kiro/hooks/code-quality-checks.json', 'utf8'));
const body = Array.from({ length: 82 }, (_, i) => '  const value' + i + ' = 47;').join('\n');
const definition = 'interface Repeated { firstName: string; lastName: string; }';
const flagged = [
    'function first(unused: string) {', body, '            return true;', '}',
    'function second(unused: string) {', body, '            return true;', '}',
    ...Array(3).fill('try { work("repeated-long-message"); } catch (err) {}'),
    definition, definition, ...Array(401).fill('// fixture'),
].join('\n');

function invoke(kind: string, source: string) {
    const dir = mkdtempSync(join(tmpdir(), 'dashboard-hooks-'));
    try {
        const file = join(dir, 'sample file.ts');
        writeFileSync(file, source);
        const stdout = execFileSync('bash', ['hooks/run-hooks.sh', 'on_file_saved_' + kind], {
            encoding: 'utf8', env: { ...process.env, FILE: file },
        });
        // The runner may exit zero for ignored hook failures. Require the report and success.
        expect(stdout).toMatch(/^  PASSED$/m);
        const json = stdout.match(/^\{[\s\S]*?^\}$/m);
        expect(json).not.toBeNull();
        const report = JSON.parse(json![0]);
        expect(report.hook).toBe('harness-' + kind);
        return report.issues.map((issue: { id: string }) => issue.id);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe.each(['kiss', 'dry'])('repository %s hook', kind => {
    it('emits all catalog rule IDs for the positive fixture', () => {
        const expected = catalog[kind].rules.map((rule: { id: string }) => rule.id);
        expect(expected).toHaveLength(kind === 'kiss' ? 5 : 4);
        expect(new Set(invoke(kind, flagged))).toEqual(new Set(expected));
    });
    it('emits an empty report for a clean source', () => {
        expect(invoke(kind, 'export const ok = true;\n')).toEqual([]);
    });
});
