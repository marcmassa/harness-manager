// FEAT-047 T1 (R1, R2) — native controls replace the deprecated toolkit.
import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Badge, Button, CONTROLS_CSS, Spinner, TextArea } from './controls.js';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('native controls (FEAT-047 R1, R2)', () => {
    it('renders a native, keyboard-reachable button that reflects disabled to assistive technology', () => {
        expect(html(React.createElement(Button, { onClick: () => undefined }, 'Run'))).toMatch(/^<button type="button" class="hd-btn hd-btn-primary">Run<\/button>$/);
        const off = html(React.createElement(Button, { appearance: 'secondary', disabled: true }, 'Run'));
        expect(off).toContain('disabled=""');
        expect(off).toContain('aria-disabled="true"');
        expect(off).toContain('hd-btn-secondary');
    });

    it('renders a badge, a labelled text area and a labelled progress indicator', () => {
        expect(html(React.createElement(Badge, null, 'active'))).toBe('<span class="hd-badge">active</span>');
        const area = html(React.createElement(TextArea, { 'aria-label': 'Description', readOnly: true, value: 'x', onChange: () => undefined }));
        expect(area).toMatch(/<textarea[^>]*aria-label="Description"[^>]*readonly=""/i);
        const spin = html(React.createElement(Spinner, { label: 'Scanning' }));
        expect(spin).toContain('role="progressbar"');
        expect(spin).toContain('aria-label="Scanning"');
    });

    it('styles focus from the theme focus border and respects reduced motion', () => {
        expect(CONTROLS_CSS).toMatch(/:focus-visible[^}]*var\(--vscode-focusBorder\)/);
        expect(CONTROLS_CSS).toContain('prefers-reduced-motion');
        for (const v of ['--vscode-button-background', '--vscode-badge-background', '--vscode-input-background']) expect(CONTROLS_CSS).toContain(v);
    });

    it('leaves no toolkit tag in the webview and no toolkit dependency', () => {
        const offenders: string[] = [];
        const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(p) && !p.endsWith('controls.test.ts') && /<vscode-[a-z]/.test(readFileSync(p, 'utf8'))) offenders.push(p); } };
        walk('src');
        expect(offenders).toEqual([]);
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
        const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        expect(deps.filter(d => d === '@vscode/webview-ui-toolkit' || d.startsWith('@microsoft/fast'))).toEqual([]);
    });
});
