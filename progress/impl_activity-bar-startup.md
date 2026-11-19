# FEAT-045 implementation evidence

## T1 — Scan scheduler and slim activation

`activate()` now registers and returns the companion API; it does no work. The scheduler (`src/startup/scanScheduler.ts`, pure, with injected effects) and its host wiring (`startupWiring.ts`) own when work happens.

What changed in activation:
- **Removed:** the profile read, the detector's watchers and the initial Advisory scan.
- **First scan:** starts when a Dashboard surface (sidebar view or editor panel) becomes visible, or when a command that needs results runs (`ensureScanned`).
- **Watchers:** start only after the first scan.
- **What the scan does:** loads profiles, parses, runs Advisory and refreshes the Optimizer.
- **While nothing is visible:** file, profile and provider-set changes only mark results stale; one rescan runs when a surface is shown again.
- **Visible changes:** debounced and coalesced into one scan.
- **Progress:** shown in the view (`withProgress` with a view location), never as a notification.
- **State:** the `harnessDashboard.state` context key moves through `scanning` → `ready` or `empty`.

The Dashboard provider no longer keeps watchers of its own; it reports visibility to the scheduler. The detector exposes `watchGlobs()` for the shared watchers. The FEAT-041 companion Extension Host test now expects no scan before the Dashboard opens (R15), and the first scan on opening to reach the early registration.

| Requirement | Verification |
|---|---|
| R11, R12, R13 | activation.test.ts runs the real `activate()` against a recording `vscode` proxy and asserts no file read, stat or search, no watcher, no process, no webview, walkthrough, notification or progress, and the API returned. A deliberate regression (reading the profile at activation) makes it fail. |
| R14 | scanScheduler.test.ts: the first scan starts once on view or panel visibility, or on a command; watchers start after it; changes before the first scan do nothing. Extension Host: no parse before the Dashboard opens, and the first parse after it opens. |
| R15 | scanScheduler.test.ts: hidden changes mark stale and one rescan runs on show; visible changes are debounced. |
| R16 | scanScheduler.test.ts: progress wraps every scan; the state follows `scanning` → `ready` or `empty`. |

Verified: 987 unit tests; fifteen Extension Host runs; build.

## T2 — Commands with and without a folder

The manifest and command changes:
- Every contributed command has category `Harness Dashboard` and a title without a prefix ("Open Dashboard", "Optimize Components", …).
- Toolbar commands carry product icons: Open Dashboard, the new Refresh, Open Local Configuration.
- Commands that write Harness SDD files name it: "Scaffold Missing Harness SDD Files", "Sync Harness SDD Agents from Filesystem".
- `menus.commandPalette` hides every workspace command with `workspaceFolderCount > 0`. Only "Check AI Provider Status" works without a folder.

With no folder open, `activate()` still:
- registers every contributed command; each answers with one information message;
- sets the `noFolder` state for the welcome view;
- returns the companion API.

Refresh scans immediately, visible or not, through the scheduler.

| Requirement | Verification |
|---|---|
| R17 | commands.test.ts: every workspace command is hidden from the palette without a folder; folderless registration covers every contributed command and answers once with the message. |
| R18 | commands.test.ts: category and unprefixed title on every command; provider-specific commands name Harness SDD. scanScheduler.test.ts: explicit refresh. |

Verified: 1002 unit tests, build.

## T3 — Sources and Findings views

Two native tree views join the Harness container. They are built from pure models in `src/views/treeModels.ts` and rendered by `src/views/harnessTrees.ts`.

- **Sources** lists each provider with its resource count, then each resource with its native path, type and load mode (when known). The tooltip carries the FEAT-041 owner, path, capability levels and every denied operation with its reason.
- **Findings** groups Optimizer findings and Advisory suggestions by owner (workspace-wide last) and resource, without dismissed suggestions. Its badge counts error findings, with no badge at zero.
- Selecting a resource or finding opens the native source at the reported line (`harness-dashboard.openSource`).
- Item operations are menu actions: one inline "Open Dashboard" on resources. The view toolbar offers Refresh and Open Dashboard, with Open Local Configuration in the overflow.
- Both views report their visibility to the scan scheduler, and refresh after every scan and every Advisory scan. Progress now shows on the Sources view.

The unregistered `AgenticDetectorProvider` (579 lines) is deleted.

The Dashboard webview view stays in the container until T4 moves the Dashboard into the editor panel.

| Requirement | Verification |
|---|---|
| R1 | treeModels.test.ts: the manifest contributes both tree views with icons. The webview view's removal is T4. |
| R2 | treeModels.test.ts: providers, resources, native paths, type and load mode. |
| R3 | treeModels.test.ts: grouping by owner and resource; error badge count and zero. |
| R4 | treeModels.test.ts: denied operations with reasons in the tooltip; at most three item actions. |
| R7 | treeModels.test.ts: at most three title actions per view. |

Verified: 1008 unit tests; fifteen Extension Host runs; build.

## T4 — One restorable editor panel

The Dashboard is now one editor panel:
- `openFullWindowPanel(tab?)` reveals an open panel, posting `activateTab` when a tab is requested, instead of creating another.
- "Open Dashboard" and "Optimize Components" both open or reveal it; the latter on the Optimizer tab.

Restore after a reload:
- `registerWebviewPanelSerializer('harness-dashboard.fullDashboard')` re-adopts the panel.
- The webview saves its tab with `setState`, and the host passes a restored panel's tab into the page. Only a plain lowercase identifier ever reaches the inline script.
- Panels use `enableScripts` and `localResourceRoots`, not `retainContextWhenHidden`.
- Panel visibility drives the scan scheduler.

Manifest changes:
- The sidebar webview view is removed.
- `activationEvents` is only `onWebviewPanel:harness-dashboard.fullDashboard`; views and commands activate implicitly (engine `^1.85`).

Workspace-state keys are unchanged: dismissed suggestions, disabled connections, view-only relationships. Manual node positions live in the canvas and in node metadata, not in workspace state, so the move to the editor does not affect them.

| Requirement | Verification |
|---|---|
| R1 | panel.test.ts: the manifest contributes no webview view. |
| R5 | panel.test.ts: opening twice creates one panel and reveals it. |
| R6 | panel.test.ts: the serializer restores the saved tab, refuses a forged tab value, and the options omit `retainContextWhenHidden`. |
| R12 | panel.test.ts: the activation events contain only `onWebviewPanel`; no `*`, `onStartupFinished` or `workspaceContains`. |
| R20 | panel.test.ts: the workspace-state keys are unchanged. |

Extension Host: the fifteen suites pass with the panel as the only Dashboard surface. "Open Dashboard" triggers the first scan in the FEAT-041 companion suite.

Verified: 1012 unit tests; fifteen Extension Host runs; build.

## T5 — Welcome content and walkthrough

`viewsWelcome`:

| View | State | Content |
|---|---|---|
| Sources | `noFolder`, or `workbenchState == empty` before activation | the single button, Open Folder |
| Sources | `scanning` | a short notice |
| Sources | `empty` | detection is automatic; inline links to declare a harness profile and to the BYOH guide; no button |
| Findings | `ready` and not yet scanned | a one-line note, with an inline Refresh link when not yet scanned |

No text names or recommends a framework.

One walkthrough, "Get started with Harness Dashboard", has five steps: open the Dashboard, review detected sources, declare a profile for a custom layout, review findings, explore context cost. Each step has a verb-led command link, a command or view completion event, and a small SVG (`media/walkthrough/*.svg`, 2.2 KB in total) drawn with `var(--vscode-*)` colours, so it follows the theme. Nothing in the source opens the walkthrough or a webview by itself.

VSIX budget: with T1–T5 the package reached 397,659 bytes (99 % of 400,000). Releases 0.1.0–0.7.0 moved from `CHANGELOG.md` to `docs/changelog/0.1-0.7.md`, which is not packaged; `CHANGELOG.md` links to it. The package is now 385,374 bytes (96 %).

| Requirement | Verification |
|---|---|
| R8 | onboarding.test.ts: the three Sources states are covered; at most one button per welcome; the empty state uses links. |
| R9 | onboarding.test.ts: welcome and walkthrough text names no framework; the empty state links to the profile and the BYOH guide. |
| R10 | onboarding.test.ts: one walkthrough of at most five steps, each with a verb-led action, completion events and a theme-aware SVG that exists. |
| R11 | onboarding.test.ts: no source file opens a walkthrough. activation.test.ts: no webview, walkthrough or notification on activation. |

Verified: 1017 unit tests; package gate 385,374 bytes; 35 project checks.

## T6 — Tabs load on first display

- `lazyTabs.tsx` wraps each tab in `React.lazy`: whiteboard (React Flow, via `WhiteboardTab.tsx`), timeline, Advisory and Optimizer. The overlays (run agent, templates, wizard) are lazy too. `TabBoundary` mounts a tab the first time it is shown and keeps it mounted, so its state survives tab switches.
- esbuild builds the webview with `splitting: true`; chunks go to `dist/webview-chunks/`. The shell (`dist/webview.js`, 445,675 bytes minified: React, the toolkit and the tab bar) loads first; every tab is a separate chunk.
- CSP: `script-src` adds `webview.cspSource` so chunks load from the extension's own resource root; inline script still needs the nonce.
- A mounted tab posts `tabReady`; the host keeps the set as `readyTabs` for Extension Host evidence only.
- VSIX: 389,365 bytes (97 % of 400,000).

| Requirement | Verification |
|---|---|
| R19 | lazyTabs.test.ts: an unseen tab renders nothing; App.tsx imports no tab or React Flow; splitting is on. webviewChunks (Extension Host): in a real panel the whiteboard chunk loads first; Optimizer and Advisory load only when shown, under the CSP. |

Verified: 1019 unit tests; sixteen Extension Host runs; package gate 389,365 bytes.

## T7 — Activation measured in the Extension Host; docs

`startupTiming` runs one Extension Host per layout (`STARTUP_ROOT`). For each it:
1. writes the layout;
2. checks the extension is not active;
3. times `activate()`;
4. registers probe companions whose `detect` and `parse` count calls, and waits one second to confirm no scan started;
5. shows Sources and times until the first scan has completed (Refresh resolves after it).

| Layout | Activation | Sources content after shown |
|---|---|---|
| empty | 55 ms | 321 ms |
| Claude-only | 53 ms | 635 ms |
| custom profile | 51 ms | 566 ms |

Budget: activation under 500 ms, asserted.

Docs:
- **DESIGN.md §6 Performance** records the measured activation, the activation events, deferred scans and watchers, native views, the single restorable panel and lazy tabs.
- **README** Getting started describes the Harness container, Open Dashboard and the walkthrough; the feature table row now reads "Editor Dashboard".
- **CHANGELOG** has an Unreleased entry.

README screenshots are not retaken. That needs a real window capture, which an agent cannot produce here, and is listed for the human reviewer.

| Requirement | Verification |
|---|---|
| R13 | startupTiming (Extension Host, three layouts): activation under 500 ms; no `detect` or `parse` call from activation alone. activation.test.ts (unit). |
| R21 | Measured in an empty, a Claude-only and a custom-profile folder; DESIGN.md, README and CHANGELOG updated. |

Verified: nineteen Extension Host runs; 1019 unit tests.
