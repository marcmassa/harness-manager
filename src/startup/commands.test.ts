// FEAT-045 T2 — command metadata and folderless registration (R17, R18).
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const registered: Array<[string, () => void]> = [];
vi.mock('vscode', () => ({
    commands: { registerCommand: (id: string, fn: () => void) => { registered.push([id, fn]); return { dispose() {} }; } },
    window: { showInformationMessage: vi.fn() },
}));

import { FOLDERLESS_MESSAGE, FOLDERLESS_OK, registerFolderlessCommands } from './folderless.js';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const commands: Array<{ command: string; title: string; category?: string }> = pkg.contributes.commands;
const palette: Array<{ command: string; when?: string }> = pkg.contributes.menus.commandPalette;

describe('command metadata (R18)', () => {
    it('gives every command the category and a title without a prefix', () => {
        for (const c of commands) {
            expect(c.category, c.command).toBe('Harness Dashboard');
            expect(c.title, c.command).not.toMatch(/^Harness( Dashboard)?\s*:/);
        }
    });

    it('names the provider of provider-specific commands', () => {
        const title = (id: string) => commands.find(c => c.command === id)!.title;
        expect(title('harness-dashboard.scaffoldMissing')).toContain('Harness SDD');
        expect(title('harness-dashboard.syncFromFilesystem')).toContain('Harness SDD');
    });
});

describe('commands without a folder (R17)', () => {
    it('hides every workspace command from the palette without a folder', () => {
        for (const c of commands) {
            if (FOLDERLESS_OK.has(c.command)) continue;
            expect(palette.find(p => p.command === c.command)?.when, c.command).toBe('workspaceFolderCount > 0');
        }
    });

    it('registers every workspace command and answers with one message', () => {
        const show = vi.fn();
        registerFolderlessCommands({ subscriptions: [] } as never, commands.map(c => c.command), show);
        const ids = registered.map(([id]) => id);
        expect(ids.sort()).toEqual(commands.map(c => c.command).filter(id => !FOLDERLESS_OK.has(id)).sort());
        registered[0][1]();
        expect(show).toHaveBeenCalledTimes(1);
        expect(show).toHaveBeenCalledWith(FOLDERLESS_MESSAGE);
    });
});
