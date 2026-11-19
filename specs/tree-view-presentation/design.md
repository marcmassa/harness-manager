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
| `media/tree/<icon>-{light,dark}.svg` | create | Type, provider and Dashboard icons (R1–R4). |
| `src/views/treeIcons.ts` | create | Pure map from type to icon name, and from name to light/dark `Uri` (R1, R2). |
| `src/views/treeModels.ts` | modify | Description and Markdown tooltip builders, number formatting, joining in the score, tokens and cost (R5–R7). |
| `src/views/harnessTrees.ts` | modify | Dashboard entry nodes, icons, `MarkdownString` tooltips (R3–R5). |
| `package.json` | modify | Open Dashboard title action on Findings; `openDashboard` takes an optional tab (R4). |
| `src/extension.ts` | modify | `openDashboard` takes an optional tab (R4). |

### Signatures

```ts
// treeIcons.ts
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

- Each icon is a 16×16 stroke drawing at 1.5 px.
- Each type has its own accent in a light and a dark file. The two variants differ only in colour.
- Target size is under 400 bytes each; about 20 files in total.
- Tree item `iconPath` images do not inherit `currentColor` or theme variables, so the light/dark pair is the documented way to follow the theme.

### Discarded alternatives

- **Product icons only (codicons).** No codicon shows a steering wheel or a hook, and the maintainer asked for distinct drawings per type. Codicons stay where VS Code conventions expect them: severity icons and the toolbar.
- **One SVG using `currentColor`.** Tree item images render outside the theme, so the stroke would be black in dark themes.
- **`FileDecorationProvider` badges for scores.** Badges hold at most two characters and apply to URIs, not to items without a file. The description carries the score instead.
- **Restoring a webview in the sidebar for the Dashboard.** This contradicts FEAT-045 R1. A first tree item plus the toolbar action makes the Dashboard visible without loading the webview.

### Risks

- A description can be cut off in a narrow sidebar. The parts are ordered by importance, and everything is repeated in the tooltip.
- The VSIX has about 9.7 KB of headroom. The icons must stay within the R9 limit; the gate enforces the total.
