// FEAT-048 T3 (R3) — one finding() helper and one optimizable-type list.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPTIMIZABLE_TYPES } from '../types.js';
import { finding } from './ruleUtils.js';
import { ALL_TYPES } from '../../webview/optimizerParts.js';

const sources = (dir: string) => readdirSync(dir).filter(f => f.endsWith('.ts') && !f.includes('.test.')).map(f => [f, readFileSync(join(dir, f), 'utf8')] as const);

describe('Optimizer rule helpers (FEAT-048 R3)', () => {
    it('defines finding() once, in ruleUtils', () => {
        const owners = sources('src/optimizer/rules').filter(([, s]) => /\bfunction finding\(/.test(s)).map(([f]) => f);
        expect(owners).toEqual(['ruleUtils.ts']);
        const ctx = { source: { nodeId: 'n', nodeType: 'skill', filePath: 'a.md' } } as never;
        expect(finding('OPT-X01', ctx, { severity: 'info', dimension: 'hygiene', title: 't', detail: 'd' }))
            .toEqual({ ruleId: 'OPT-X01', nodeId: 'n', nodeType: 'skill', filePath: 'a.md', severity: 'info', dimension: 'hygiene', title: 't', detail: 'd' });
    });

    it('writes the full optimizable-type list only once', () => {
        const literal = /\[\s*'agent',\s*'subagent',\s*'skill',\s*'steering',\s*'hook'\s*\]/;
        const hits = [...sources('src/optimizer'), ...sources('src/optimizer/rules'), ...sources('src/webview')]
            .filter(([, s]) => literal.test(s)).map(([f]) => f);
        // layoutUtils' ARCH_TYPES is the whiteboard's layout tiering, a different concept
        // that happens to list the same types (kept apart by the duplication review).
        expect(hits).toEqual(['types.ts', 'layoutUtils.ts']);
        expect(ALL_TYPES).toBe(OPTIMIZABLE_TYPES);
    });
});
