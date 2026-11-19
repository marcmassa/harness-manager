// FEAT-048 R6 — webview helpers have one definition each.
//
// The AI icon buttons, context-menu styles, duplicated button styles, tier
// colours and keyframes used to be copied across files. Each now lives in one
// place (components/AiIconButton.tsx or styles.ts) and every user imports it.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiIconButton } from './components/AiIconButton.js';
import { askHostBase } from './components/AskHostButton.js';
import { btnBase } from './optimizerControls.js';
import { harnessActionBtnStyle } from './dashboardChrome.js';
import { TIER_COLORS as OPTIMIZER_TIER_COLORS } from './OptimizerPanel.js';
import { DASHBOARD_CSS } from './dashboardStyles.js';
import { ACTION_BUTTON, BUTTON_BASE, CONTEXT_MENU, KEYFRAMES, TIER_COLORS } from './styles.js';

const WEBVIEW_ROOT = 'src/webview';

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
        else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
    }
    return out;
}

const sources = sourceFiles(WEBVIEW_ROOT).map((p) => ({ rel: relative(WEBVIEW_ROOT, p), src: readFileSync(p, 'utf8') }));
const definers = (test: (src: string) => boolean) => sources.filter((f) => test(f.src)).map((f) => f.rel);

describe('FEAT-048 R6 — AiIconButton', () => {
    const render = (kind: 'generate' | 'refine', disabled: boolean) =>
        renderToStaticMarkup(React.createElement(AiIconButton, { kind, disabled, title: `t-${kind}`, onClick: () => {} }));

    it('renders the generate (sparkle) icon, dimmed but never HTML-disabled', () => {
        const on = render('generate', false);
        const off = render('generate', true);
        expect(on).toContain('title="t-generate"');
        expect(on).toContain('<circle');
        expect(on).toContain('opacity:0.7');
        expect(off).toContain('opacity:0.5');
        expect(off).toContain('cursor:default');
        expect(off).not.toMatch(/disabled=""/);
    });

    it('renders the refine (pencil) icon and sets disabled when disabled', () => {
        const on = render('refine', false);
        const off = render('refine', true);
        expect(on).toContain('M17 3a2.83');
        expect(on).not.toContain('<circle');
        expect(on).not.toMatch(/disabled=""/);
        expect(off).toMatch(/disabled=""/);
        expect(off).toContain('opacity:0.3');
    });

    it('is the only definition of the AI icon SVGs', () => {
        expect(definers((s) => s.includes('M12 2l2.4 7.2h7.6'))).toEqual(['components/AiIconButton.tsx']);
        expect(definers((s) => s.includes('M17 3a2.83 2.83'))).toEqual(['components/AiIconButton.tsx']);
    });
});

describe('FEAT-048 R6 — shared style constants live in styles.ts', () => {
    it('only styles.ts defines the tier colour table', () => {
        expect(definers((s) => s.includes("'#0ca30c'") && s.includes("'#d03b3b'"))).toEqual(['styles.ts']);
        expect(OPTIMIZER_TIER_COLORS).toBe(TIER_COLORS);
    });

    it('only styles.ts defines the context-menu style object', () => {
        expect(definers((s) => s.includes("padding: '4px 16px 8px'"))).toEqual(['styles.ts']);
        expect(definers((s) => /boxShadow: '0 8px 32px rgba\(0,0,0,0\.4\)',\s*zIndex: 9999,/.test(s))).toEqual(['styles.ts']);
        expect(Object.keys(CONTEXT_MENU).sort()).toEqual(['header', 'item', 'menu']);
        // Position and width belong to each call site.
        expect(CONTEXT_MENU.menu.position).toBeUndefined();
        expect(CONTEXT_MENU.menu.minWidth).toBeUndefined();
    });

    it('the button constants are one object each', () => {
        expect(askHostBase).toBe(btnBase);
        expect(btnBase).toBe(BUTTON_BASE);
        expect(harnessActionBtnStyle).toBe(ACTION_BUTTON);
        expect(definers((s) => s.includes("padding: '5px 13px'"))).toEqual(['styles.ts']);
    });

    it('KEYFRAMES is interpolated once into the dashboard stylesheet, with no re-declared copy', () => {
        expect(DASHBOARD_CSS.split(KEYFRAMES).length - 1).toBe(1);
        const names = [...KEYFRAMES.matchAll(/@keyframes ([\w-]+) /g)].map((m) => m[1]);
        expect(names.length).toBeGreaterThan(0);
        for (const name of names) {
            expect(DASHBOARD_CSS.split(`@keyframes ${name} `).length - 1, name).toBe(1);
        }
        expect(definers((s) => s.includes('${KEYFRAMES}'))).toEqual(['dashboardStyles.ts']);
    });
});
