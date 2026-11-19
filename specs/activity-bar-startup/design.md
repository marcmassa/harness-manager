# Design — Activity Bar redesign and lazy startup

FEAT-045 moves data into native tree views, keeps the rich Dashboard as one restorable editor panel, and defers every scan until the user looks. It changes no analysis result: the trees and the panel read the same shared `AdapterRegistry` scan (FEAT-041), Advisory profile and Optimizer report.

### Layout

```
Activity Bar: Harness (media/icon.svg, monochrome)
└─ Sources   [Refresh] [Open Dashboard] [… Settings · Local configuration]
   ├─ Claude Code — 3 resources
   │   ├─ CLAUDE.md            agent · always
   │   └─ .claude/agents/reviewer.md   subagent · delegated
   └─ Team guides (profile) — 2 resources
└─ Findings (badge: errors)
   └─ Claude Code › reviewer.md
       └─ OPT-S04 description has no trigger   warning
Editor: Harness Dashboard panel (whiteboard, timeline, specs, advisory, optimizer, run)
```

Load mode and capability columns render when FEAT-044 and FEAT-041 T3 provide them; until then the item shows only provider, type and path. Users may drag either view to the Secondary Sidebar; both views declare icons for that case.

### Host structure

- `src/views/sourcesTree.ts` and `src/views/findingsTree.ts`: `TreeDataProvider`s over the cached scan. `findingsTree` replaces the unregistered `AgenticDetectorProvider`, which is deleted; its reusable label and icon helpers move into the new file.
- `src/startup/scanScheduler.ts`: owns "first scan", "stale" and "visible" state. Inputs: view visibility (`TreeView.onDidChangeVisibility`), panel visibility, commands needing data, watcher events, registry changes. Output: one debounced call to the existing refresh (`_sendData` + detector scan + optimizer refresh). It also sets the context key `harnessDashboard.state` (`noFolder` | `scanning` | `empty` | `ready`) used by `viewsWelcome`.
- `src/HarnessDashboardProvider.ts` becomes a panel controller: one `WebviewPanel`, `reveal(tab)`, `registerWebviewPanelSerializer('harness-dashboard.fullDashboard')`, tab state through webview `setState`. Its message handler and coordinators are unchanged.
- `activate()`: registers commands, trees, serializer, config and registry listeners, returns the API. No `harnessConfig.read`, no `startWatching`, no initial `scan`. Without a folder it still registers every command; workspace commands answer with one information message.

### Manifest

- `activationEvents`: `["onWebviewPanel:harness-dashboard.fullDashboard"]`; views and commands activate implicitly (engine `^1.85` ≥ 1.74).
- `views.harness-dashboard`: `harness-dashboard.sources`, `harness-dashboard.findings` (`type: tree`, `icon`).
- `viewsWelcome` for the four `harnessDashboard.state` values.
- `menus.view/title`, `menus.view/item/context`, `menus.commandPalette` (`when: workspaceFolderCount > 0`).
- `commands[]`: `category: "Harness Dashboard"`, codicon `icon` for toolbar commands, titles such as `Open Dashboard`, `Refresh`, `Optimize Components`, `Scaffold Harness SDD Files` (provider named, FEAT-039 R8).
- `walkthroughs`: one, five steps — Open the Dashboard, Review detected sources, Declare a profile for a custom layout, Review findings, Explore context cost (step hidden until FEAT-044 ships via `when`).

### Webview loading

esbuild `splitting: true, format: 'esm'` for the webview entry (already loaded as `type="module"`). Tabs become `React.lazy` imports; the whiteboard chunk holds React Flow. The CSP keeps the nonce; chunk URLs resolve under `dist/` already in `localResourceRoots`. The VSIX gate must still pass; splitting adds a few KB of loader code, it does not shrink the total.

### Alternatives and risks

Keeping the sidebar webview and only deferring the scan was discarded: it leaves an 820 KB app in a narrow view and conflicts with the Views and Webviews guidelines. A status-bar maturity item was discarded as noise (status bar left side is for workspace state the user acts on often). Starting on `workspaceContains` for known markers was discarded: it activates on startup and privileges the listed formats, against BYOH.

Risks: users lose the sidebar whiteboard they knew — the Sources view title offers Open Dashboard and the panel opens beside the editor; CHANGELOG notes the move. Webview chunk loading under the CSP must be verified in the Extension Host on macOS and in CI. Tree refresh on large workspaces is bounded by the existing scan limits and debounced in `scanScheduler`.
