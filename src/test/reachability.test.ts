// FEAT-047 R6 — every source file is reachable from a build entry point.
// Exempt: tests and test helpers, declaration files, and type-only modules
// (their transpiled output is empty, so no bundle records them).
import { describe, expect, it } from 'vitest';
import * as esbuild from 'esbuild';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ENTRIES: Array<[string, esbuild.Platform, esbuild.Format]> = [
    ['src/extension.ts', 'node', 'cjs'],
    ['src/webview/index.tsx', 'browser', 'esm'],
];
const TEST_HELPER = /(\.test\.tsx?$|\/test\/|TestHarness\.ts$|\/testUtils\.ts$|\.d\.ts$)/;

function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) sources(path, out);
        else if (/\.tsx?$/.test(path) && !TEST_HELPER.test(path)) out.push(path);
    }
    return out;
}

describe('reachability (FEAT-047 R6)', () => {
    it('reaches every non-test source file from the extension or the webview entry', async () => {
        const reached = new Set<string>();
        for (const [entry, platform, format] of ENTRIES) {
            const result = await esbuild.build({
                entryPoints: [entry], bundle: true, write: false, metafile: true, platform, format,
                external: ['vscode'], loader: { '.css': 'css' }, outdir: 'out/reachability', splitting: format === 'esm', logLevel: 'silent',
            });
            for (const input of Object.keys(result.metafile.inputs)) reached.add(input);
        }
        const unreachable: string[] = [];
        for (const file of sources('src')) {
            if (reached.has(file)) continue;
            const js = (await esbuild.transform(readFileSync(file, 'utf8'), { loader: file.endsWith('x') ? 'tsx' : 'ts' })).code;
            if (js.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '').trim() === '') continue;   // type-only module
            unreachable.push(file);
        }
        expect(unreachable).toEqual([]);
    }, 60_000);
});
