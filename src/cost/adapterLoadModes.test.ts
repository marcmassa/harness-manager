// FEAT-044 review — load modes from what the real adapters emit (R1, R2).
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROOT, seedWorkspace } from '../test/vscodeMock.js';

vi.mock('vscode', async () => (await import('../test/vscodeMock.js')).createVscodeMock());

import * as vscode from 'vscode';
import { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../adapters/index.js';

const root = vscode.Uri.file(ROOT);
const seed = seedWorkspace;
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
