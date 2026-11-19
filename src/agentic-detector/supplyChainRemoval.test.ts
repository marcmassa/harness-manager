// FEAT-047 T3 — the supply-chain feature is gone (R4).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPERATIONS } from '../operations/operations.js';
import { CORE_RULES } from './advisoryRules.js';
import { METHODOLOGY_RULES } from './methodologyRules.js';
import { generate } from './advisoryEngine.js';
import { migrateLegacyDismissals } from './dismissals.js';
import { makeProfile } from './testUtils.js';

const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

const PROFILES = [
    makeProfile(),
    makeProfile({ harnessPresent: true }),
    makeProfile({ harnessPresent: true, sddActive: true }),
    makeProfile({ activeCategories: ['prompts', 'rules', 'mcp'] }),
];

describe('FEAT-047 R4 — supply-chain removal', () => {
    it('FEAT-047 R4: package.json contributes no audit or supply-chain command', () => {
        const commands: { command: string; title: string }[] = manifest.contributes.commands;
        for (const c of commands) expect(`${c.command} ${c.title}`).not.toMatch(/audit|supply/i);
        const palette: { command: string }[] = manifest.contributes.menus.commandPalette;
        for (const p of palette) expect(p.command).not.toMatch(/audit|supply/i);
    });

    it('FEAT-047 R4: the operation catalog has no workspace.audit', () => {
        expect(Object.keys(OPERATIONS)).not.toContain('workspace.audit');
    });

    it('FEAT-047 R4: the Advisory engine has no supply-chain rule or category', () => {
        for (const rule of [...CORE_RULES, ...METHODOLOGY_RULES]) expect(rule.id).not.toMatch(/^sc-/);
        for (const profile of PROFILES) {
            for (const s of generate(profile)) {
                expect(s.id).not.toMatch(/^sc-/);
                expect(s.category).not.toBe('supply-chain');
            }
        }
    });

    it('FEAT-047 R4: a stored supply-chain dismissal is ignored without error', () => {
        const stored = ['sc-missing-bot-config@workspace', 'sc-add-update-bot', 'sc-stale-override:undici'];
        for (const profile of PROFILES) {
            const dismissed = new Set(stored);
            expect(() => generate(profile, dismissed)).not.toThrow();
            const ids = generate(profile, dismissed).map(s => s.id);
            for (const id of stored) expect(ids).not.toContain(id);
            expect(ids).toEqual(generate(profile).map(s => s.id));
            expect(() => migrateLegacyDismissals(stored, generate(profile))).not.toThrow();
        }
    });
});
