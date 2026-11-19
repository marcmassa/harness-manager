// FEAT-044 review — load modes from what the real adapters emit (R1, R2).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = '/workspace';
const files = new Map<string, string>();
const sizes = new Map<string, number>();
const links = new Map<string, string>();

const normalize = (input: string) => input.replace(/\\/g, '/').replace(/\/+/g, '/');
const toUri = (path: string) => {
    const normalized = normalize(path);
    return { fsPath: normalized, path: normalized, scheme: 'file', toString: () => 'file://' + normalized };
};
const globToRegExp = (glob: string) => new RegExp('^' + glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?') + '$');

vi.mock('vscode', () => {
    class RelativePattern {
        constructor(public readonly baseUri: { path: string }, public readonly pattern: string) {}
    }
    const key = (uri: { path?: string; fsPath?: string }) => normalize(uri.path ?? uri.fsPath ?? '');
    return {
        RelativePattern,
        FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
        Uri: {
            file: (p: string) => toUri(p),
            joinPath: (base: { path: string }, ...parts: string[]) => toUri([base.path, ...parts].join('/')),
        },
        workspace: {
            fs: {
                stat: vi.fn(async (uri: { path: string }) => {
                    // A path that prefixes a seeded file is a directory (Kiro detects `.kiro/`).
                    if (!files.has(key(uri)) && [...files.keys()].some(f => f.startsWith(key(uri) + '/'))) return { type: 2, size: 0 };
                    if (!files.has(key(uri))) throw new Error('ENOENT');
                    return { type: 1, size: sizes.get(key(uri)) ?? files.get(key(uri))!.length };
                }),
                readFile: vi.fn(async (uri: { path: string }) => {
                    const value = files.get(key(uri));
                    if (value === undefined) throw new Error('ENOENT');
                    return Buffer.from(value, 'utf8');
                }),
            },
            findFiles: vi.fn(async (pattern: RelativePattern) => {
                const base = normalize(pattern.baseUri.path);
                const re = globToRegExp(pattern.pattern);
                return [...files.keys()]
                    .filter(p => p.startsWith(base + '/') && re.test(p.slice(base.length + 1)))
                    .map(toUri);
            }),
            asRelativePath: vi.fn((uri: { path: string }) => key(uri).slice(ROOT.length + 1)),
            getConfiguration: vi.fn(() => ({ get: (_k: string, fallback: unknown) => fallback })),
            onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
        },
    };
});

import * as vscode from 'vscode';
import { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../adapters/index.js';

const root = vscode.Uri.file(ROOT);
function seed(entries: Record<string, string>): void {
    files.clear(); sizes.clear(); links.clear();
    for (const [p, c] of Object.entries(entries)) files.set(normalize(`${ROOT}/${p}`), c);
}
const modes = async () => Object.fromEntries((await new AdapterRegistry(createDefaultAdapters()).parse(root)).graph.nodes
    .filter(n => n.metadata._filePath).map(n => [String(n.metadata._filePath), n.source?.loadMode]));

describe('load modes from real adapter output', () => {
    beforeEach(() => seed({}));

    it('reads Kiro steering inclusion', async () => {
        seed({
            '.kiro/steering/api.md': '---\ninclusion: fileMatch\nfileMatchPattern: "src/api/**"\n---\n# API',
            '.kiro/steering/notes.md': '---\ninclusion: manual\n---\n# Notes',
            '.kiro/steering/product.md': '# Product',
        });
        const m = await modes();
        expect(m['.kiro/steering/api.md']).toBe('on-trigger');
        expect(m['.kiro/steering/notes.md']).toBe('manual');
        expect(m['.kiro/steering/product.md']).toBe('always');
    });

    it('treats a Cursor rule without frontmatter as manual despite its display description', async () => {
        seed({ '.cursor/rules/plain.mdc': 'Use tabs.', '.cursor/rules/api.mdc': '---\ndescription: Use for API work\n---\nAPI rules.' });
        const m = await modes();
        expect(m['.cursor/rules/plain.mdc']).toBe('manual');
        expect(m['.cursor/rules/api.mdc']).toBe('on-trigger');
    });

    it('treats Copilot instructions without applyTo as attached by hand', async () => {
        seed({
            '.github/copilot-instructions.md': '# Team',
            '.github/instructions/ts.instructions.md': '---\napplyTo: "**/*.ts"\n---\nTS.',
            '.github/instructions/review.instructions.md': '# Review checklist',
        });
        const m = await modes();
        expect(m['.github/copilot-instructions.md']).toBe('always');
        expect(m['.github/instructions/ts.instructions.md']).toBe('on-trigger');
        expect(m['.github/instructions/review.instructions.md']).toBe('manual');
    });
});
