# Design — Tree view presentation and Dashboard access

FEAT-046 changes only the rendering of the two FEAT-045 tree views. It uses three inputs that already exist: the cached graph (`DashboardData`), the Optimizer report (`ComponentScore`, `OptimizerFinding`, `CostSection`) and the FEAT-041 ownership decisions. It adds no scan, no read, and no state.

### Layout

```
Sources            [Refresh] [Open Dashboard] [… Settings · Local configuration]
├─ ▦ Open Dashboard
├─ ◈ Claude Code                3 resources · ~2.4k tok/session
│   ├─ 👤 CLAUDE.md              agent · always · ~1.1k tok · 74
│   ├─ 🤖 reviewer               subagent · delegated · ~640 tok · 88
│   └─ ⚡ release-notes          skill · on-trigger · ~900 tok · 61
└─ ◈ Team guides                2 resources · cost not evaluated
Findings           [Refresh] [Open Dashboard]
├─ ▦ Open Dashboard
└─ ◈ Claude Code
    └─ ⚡ release-notes          2 findings
        ├─ ⚠ Description has no trigger      OPT-S04
        └─ ⓘ Body exceeds the median         OPT-B01
```

### Files

| File | Action | Reason |
|---|---|---|
| `src/shared/typeIcons.ts` | create | The one definition: each icon's 16×16 path data, light and dark accents, and the type-to-icon map. Imported by the host, the webview and the build (R1–R3). |
| `esbuild.js` | modify | Writes `dist/icons/<name>-{light,dark}.svg` from `typeIcons.ts` on every build. `dist/` is already packaged and pruned (R3, R12). |
| `src/views/treeIcons.ts` | create | Maps an icon name to its light/dark `Uri` under `dist/icons/` (R1, R2). |
| `src/webview/components/CustomNode.tsx` | modify | The type badge renders the same icon inline, as an SVG using the accent for the current theme (R3). |
| `src/views/treeModels.ts` | modify | Description and Markdown tooltip builders, token formatting, sorting, and joining in the score, tokens and cost (R6–R10). |
| `src/views/harnessTrees.ts` | modify | Dashboard entry nodes, icons, accessibility labels, `MarkdownString` tooltips (R4, R5, R10). |
| `package.json` | modify | Open Dashboard title action on Findings (R5). |
| `src/extension.ts` | modify | `openDashboard` takes an optional tab (R5). |

### Signatures

```ts
// shared/typeIcons.ts — no vscode or DOM imports
export interface IconDef { paths: string[]; light: string; dark: string }   // stroke paths, 16×16 viewBox
export const ICONS: Record<TreeIconName, IconDef>;
export function svgFor(name: TreeIconName, theme: 'light' | 'dark'): string;

// views/treeIcons.ts
export type TreeIconName = 'agent' | 'subagent' | 'skill' | 'steering' | 'hook' | 'feature' | 'terminal' | 'document' | 'provider' | 'dashboard';
export function iconForType(type: string): TreeIconName;            // discovered-agent → agent, unknown → document
export function iconPath(extensionUri: Uri, name: TreeIconName): { light: Uri; dark: Uri };

// treeModels.ts
export function formatTokens(n: number): string;                     // 640 → "~640 tok", 1234 → "~1.2k tok"
export function resourceDescription(r: ResourceItem): string;       // "skill · on-trigger · ~900 tok · 61"
export function resourceTooltip(r: ResourceItem): string;           // Markdown
export function providerDescription(g: ProviderGroup): string;      // "3 resources · ~2.4k tok/session"
export function providerTooltip(g: ProviderGroup): string;
export function findingTooltip(f: FindingItem): string;
```

`ResourceItem` gains `tokens?`, `score?`, `tier?`, `findingCount?`, `ownerLabel?`, `capabilities?` and `denied?` as structured data instead of a ready-made tooltip string. `ProviderGroup` gains `cost?: { baseline; catalog; onDemand; unpriced; evaluated; reason? }`. `FindingItem` gains `ruleId`, `dimension?` and `path?`. `buildSources` takes the Optimizer report as an extra argument.

All Markdown is escaped: provider labels, names and paths come from user files. `MarkdownString.isTrusted` stays false, with `supportThemeIcons` only.

### Icons

- Each icon is a 16×16 stroke drawing at 1.5 px, defined once as path data in `typeIcons.ts`.
- The build writes one light and one dark file per icon. The two variants differ only in colour.
- Target size is under 400 bytes each; ten icons give twenty files.
- Tree item `iconPath` images do not inherit `currentColor` or theme variables, so a light/dark pair is the documented way to follow the theme.
- In the webview, the badge inlines the same paths and picks the accent from `body.vscode-light` / `body.vscode-dark` (and the high-contrast classes) through a CSS variable.

### Discarded alternatives

- **Product icons only (codicons).** No codicon shows a steering wheel or a hook, and the maintainer asked for distinct drawings per type. Codicons stay where VS Code conventions expect them: severity icons and the toolbar.
- **One SVG using `currentColor`.** Tree item images render outside the theme, so the stroke would be black in dark themes.
- **`FileDecorationProvider` badges for scores.** Badges hold at most two characters and apply to URIs, not to items without a file. The description carries the score instead.
- **Hand-maintained SVG files next to a separate webview icon set.** Two copies of each drawing would drift apart (DRY steering). Generating the files from one module keeps them identical at no runtime cost.
- **Restoring a webview in the sidebar for the Dashboard.** This contradicts FEAT-045 R1. A first tree item plus the toolbar action makes the Dashboard visible without loading the webview.

### Risks

- A description can be cut off in a narrow sidebar. The parts are ordered by importance, and everything is repeated in the tooltip.
- The VSIX has about 9.7 KB of headroom today. A separate package-slimming feature is proposed to widen it; until then the R12 limit and the gate enforce the total.
- Generated files live in `dist/`, so a stale icon cannot linger: the build prunes and rewrites `dist/`.
