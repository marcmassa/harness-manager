// FEAT-046 T1 (R1–R3) — one icon definition, generated light/dark files, contrast.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { ICONS, TREE_ICON_NAMES, iconForType, svgFor } from './typeIcons.js';

const NODE_TYPES = ['agent', 'subagent', 'skill', 'feature', 'steering', 'hook',
    'discovered-agent', 'discovered-skill', 'discovered-tool', 'discovered-resource', 'cli-install'];

function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

describe('type icons (FEAT-046 R1–R3)', () => {
    it('maps every node type, discovered types to their kind and unknown types to a document', () => {
        expect(NODE_TYPES.map(iconForType)).toEqual(['agent', 'subagent', 'skill', 'feature', 'steering', 'hook',
            'agent', 'skill', 'terminal', 'document', 'terminal']);
        expect(iconForType('something-new')).toBe('document');
    });

    it('keeps each accent at 3:1 or more against the default light and dark sidebars', () => {
        for (const name of TREE_ICON_NAMES) {
            expect(contrast(ICONS[name].light, '#F3F3F3'), `${name} light`).toBeGreaterThanOrEqual(3);
            expect(contrast(ICONS[name].dark, '#252526'), `${name} dark`).toBeGreaterThanOrEqual(3);
        }
    });

    it('builds both files per icon from the one definition, differing only in colour', () => {
        execSync('node esbuild.js', { stdio: 'ignore' });
        for (const name of TREE_ICON_NAMES) {
            for (const theme of ['light', 'dark'] as const) {
                const file = `dist/icons/${name}-${theme}.svg`;
                expect(existsSync(file), file).toBe(true);
                expect(readFileSync(file, 'utf8')).toBe(svgFor(name, theme));
            }
            expect(svgFor(name, 'light').replace(ICONS[name].light, 'X')).toBe(svgFor(name, 'dark').replace(ICONS[name].dark, 'X'));
        }
    }, 60_000);
});
