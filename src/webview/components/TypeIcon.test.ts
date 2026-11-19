// FEAT-046 T2 (R3) — whiteboard type badges use the tree's icon definition.
import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ICONS, iconForType, iconThemeCss } from '../../shared/typeIcons.js';
import { TypeIcon } from './TypeIcon.js';

describe('whiteboard type badge (FEAT-046 R3)', () => {
    it.each(['agent', 'subagent', 'skill', 'steering', 'hook', 'feature'])('draws %s with the same paths as its tree icon', type => {
        const html = renderToStaticMarkup(React.createElement(TypeIcon, { type }));
        const name = iconForType(type);
        for (const d of ICONS[name].paths) expect(html).toContain(`d="${d}"`);
        expect(html).toContain(`stroke="var(--hd-icon-${name})"`);
    });

    it('keeps no old glyph or emoji for a type, and defines every colour variable per theme', () => {
        const node = readFileSync('src/webview/components/CustomNode.tsx', 'utf8');
        for (const old of ['⚡ Agent', '▸ Subagent', '◆ Skill', '▣ Feature', '⚙️ Steering', '🔌 Hook']) expect(node).not.toContain(old);
        const css = iconThemeCss();
        for (const name of Object.keys(ICONS)) {
            expect(css).toContain(`--hd-icon-${name}: ${ICONS[name as keyof typeof ICONS].dark}`);
            expect(css).toContain(`--hd-icon-${name}: ${ICONS[name as keyof typeof ICONS].light}`);
        }
        expect(css).toMatch(/body\.vscode-light/);
    });
});
