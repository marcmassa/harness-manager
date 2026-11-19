// FEAT-046 R1–R3 — the one definition of every type icon. The host's tree
// views use the generated dist/icons/<name>-{light,dark}.svg files (built from
// this module by esbuild.js); the webview inlines the same paths. No vscode or
// DOM imports: this module is shared by the host, the webview and the build.

export type TreeIconName =
    | 'agent' | 'subagent' | 'skill' | 'steering' | 'hook' | 'feature'
    | 'terminal' | 'document' | 'provider' | 'dashboard';

export interface IconDef {
    /** Stroke paths on a 16×16 view box, drawn at 1.5 px with round caps and joins. */
    paths: string[];
    /** Accent on the default light sidebar (#F3F3F3); contrast ≥ 3:1 (R2). */
    light: string;
    /** Accent on the default dark sidebar (#252526); contrast ≥ 3:1 (R2). */
    dark: string;
}

export const ICONS: Record<TreeIconName, IconDef> = {
    // A person.
    agent: { paths: ['M8 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z', 'M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5'], light: '#0063B1', dark: '#6CB6FF' },
    // A robot: head, antenna, eyes, mouth.
    subagent: { paths: ['M4 5.5h8a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V7A1.5 1.5 0 0 1 4 5.5z', 'M8 5.5V3', 'M8 1.8v.2', 'M6 9h.01', 'M10 9h.01', 'M6.5 11h3'], light: '#7B3FB5', dark: '#C9A2FF' },
    // A lightning bolt.
    skill: { paths: ['M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z'], light: '#A65300', dark: '#F2B15C' },
    // A steering wheel: rim, hub and three spokes.
    steering: { paths: ['M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z', 'M8 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z', 'M8 9.5V14', 'M6.6 7.5 2.3 6.2', 'M9.4 7.5l4.3-1.3'], light: '#00796B', dark: '#4FD1C5' },
    // A hook: eye, shank, bend and barb.
    hook: { paths: ['M10 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z', 'M10 3.5v6a3.5 3.5 0 0 1-7 0V7.5', 'M3 7.5 1.5 9'], light: '#B0306A', dark: '#F28DB8' },
    // A flag.
    feature: { paths: ['M3.5 14.5V1.5', 'M3.5 2.5h8.5l-2 3 2 3H3.5'], light: '#2E7D32', dark: '#7FD18B' },
    // A terminal window with a prompt.
    terminal: { paths: ['M2.5 2.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z', 'M4.5 6 6.5 8l-2 2', 'M8 10.5h3.5'], light: '#5A5A5A', dark: '#BDBDBD' },
    // A document with a folded corner.
    document: { paths: ['M4 1.5h5l3.5 3.5v9.5H4z', 'M9 1.5V5h3.5', 'M6 8.5h4.5', 'M6 11h4.5'], light: '#616161', dark: '#BDBDBD' },
    // Stacked layers: one source of resources.
    provider: { paths: ['M8 1.5 14.5 5 8 8.5 1.5 5z', 'M1.5 8 8 11.5 14.5 8', 'M1.5 11 8 14.5 14.5 11'], light: '#3B5BA5', dark: '#9FB4E8' },
    // A dashboard grid.
    dashboard: { paths: ['M2 2h5v5H2z', 'M9 2h5v3H9z', 'M9 7h5v7H9z', 'M2 9h5v5H2z'], light: '#0063B1', dark: '#6CB6FF' },
};

export const TREE_ICON_NAMES = Object.keys(ICONS) as TreeIconName[];

const BY_TYPE: Record<string, TreeIconName> = {
    agent: 'agent', 'discovered-agent': 'agent',
    subagent: 'subagent',
    skill: 'skill', 'discovered-skill': 'skill',
    steering: 'steering',
    hook: 'hook',
    feature: 'feature',
    'cli-install': 'terminal', 'discovered-tool': 'terminal',
};

/** R1: the icon for a node type; anything unknown is a document. */
export function iconForType(type: string): TreeIconName {
    return BY_TYPE[type] ?? 'document';
}

/** The SVG file for one icon and theme. The two variants differ only in colour. */
export function svgFor(name: TreeIconName, theme: 'light' | 'dark'): string {
    const { paths } = ICONS[name];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="${ICONS[name][theme]}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths.map(d => `<path d="${d}"/>`).join('')}</svg>\n`;
}

/**
 * CSS custom properties `--hd-icon-<name>` with the accent for the current
 * theme, for inline SVG in the webview (VS Code sets these body classes).
 */
export function iconThemeCss(): string {
    const vars = (theme: 'light' | 'dark') => TREE_ICON_NAMES.map(n => `--hd-icon-${n}: ${ICONS[n][theme]};`).join(' ');
    return `body { ${vars('dark')} } body.vscode-light, body.vscode-high-contrast-light { ${vars('light')} }`;
}
