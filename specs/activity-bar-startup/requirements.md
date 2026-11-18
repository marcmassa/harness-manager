# FEAT-045 — Activity Bar redesign and lazy startup

Proposed for Harness Dashboard v0.9.0. Applies the VS Code UX guidelines (Activity Bar, Views, Webviews, Walkthroughs) and activation guidance to the extension's entry point. Fits BYOH: the sidebar lists whatever providers the workspace has, through the FEAT-041 source record, without recommending any framework.

## Context

Measured on `spec/byoh-0.9-advisory-optimizer` after FEAT-041 T2:

| Today | Guideline it conflicts with |
|---|---|
| The only view in the container is a webview view that loads the full 820 KB `webview.js` (React Flow and every panel) into the sidebar. | "Use a Tree View for displaying data"; "Limit the use of custom Webview Views". |
| `activate()` starts an Advisory scan, file watchers and config reads immediately, whether or not the user looks at the Dashboard. | "Activate only when a user needs your extension"; defer non-critical work. |
| With no folder open `activate()` returns before registering commands, so palette commands fail with "command not found". | Commands should always resolve. |
| No welcome views, no walkthrough, no view toolbar actions; an empty workspace shows a blank webview. | "When a view is empty, you can add content to guide users". |
| Command titles mix `Harness:` and `Harness Dashboard:`; no `category`, no icons. | Consistent palette grouping. |
| Every "Open full window" creates a new editor panel; panels are not restored after reload. | Single, restorable editor surface. |
| `AgenticDetectorProvider` (a tree data provider, 579 lines) is no longer registered. | Dead code. |

### R1 — Native views

The `harness-dashboard` view container SHALL contribute exactly two tree views, **Sources** and **Findings**, and SHALL NOT contribute a webview view.

### R2 — Sources view

WHEN a scan completes, the Sources view SHALL list each detected provider with its label and resource count, and under it each resource with its native path, type and, where known, its load mode and capability levels.

### R3 — Findings view

WHEN Advisory or Optimizer results change, the Findings view SHALL group findings by owner and resource with their severity, and its view badge SHALL show the number of error findings, with no badge at zero.

### R4 — Item behavior

WHEN the user selects a resource or finding item, the Dashboard SHALL open its native source at the reported line; every other item operation SHALL be an inline or context action, at most three per item, offered only when FEAT-041 authorizes it, and each operation FEAT-041 denies SHALL appear in the item tooltip with its reason (FEAT-041 R3).

### R5 — Editor dashboard

The whiteboard and analysis panels SHALL open in one editor webview panel only on an explicit user action, and WHEN that panel is already open the action SHALL reveal it on the requested tab instead of creating another.

### R6 — Panel restore

WHEN VS Code restores a window that had the Dashboard panel open, the extension SHALL restore the panel and its last tab through a webview panel serializer, and the panel SHALL NOT use `retainContextWhenHidden`.

### R7 — View toolbar

Each view title SHALL offer at most three icon actions using product icons — Refresh, Open Dashboard and, in an overflow menu, settings and local configuration.

### R8 — Welcome content

WHILE no folder is open, WHILE the first scan runs, and WHILE a completed scan found no provider, the Sources view SHALL show a short welcome message for that state, with links preferred to buttons and at most one button.

### R9 — Neutral onboarding

The no-provider welcome and the walkthrough SHALL state that supported formats are detected automatically and SHALL link to declaring a profile and to the BYOH documentation, without recommending one framework.

### R10 — Walkthrough

The extension SHALL contribute one walkthrough of at most five steps, each with a verb-led action, theme-aware SVG media and a command completion event.

### R11 — No unsolicited UI

The extension SHALL NOT open a webview, walkthrough or notification on activation, install or update.

### R12 — Activation events

The manifest SHALL rely on implicit view and command activation plus `onWebviewPanel` for the Dashboard panel, and SHALL NOT declare `*`, `onStartupFinished` or `workspaceContains`.

### R13 — Minimal activation

WHEN the extension activates, `activate()` SHALL register its contributions and return the companion API without reading workspace files, spawning processes or starting a scan.

### R14 — Lazy first scan

The first scan SHALL start only WHEN a Harness view becomes visible, the Dashboard panel opens, or a command that needs results runs, and file watchers SHALL start after that first scan.

### R15 — Hidden refresh

WHILE no Harness view is visible and the panel is closed, file changes SHALL mark results stale instead of rescanning, and WHEN a view or the panel becomes visible again a single rescan SHALL run.

### R16 — Progress

WHILE a scan runs, the extension SHALL report progress on the Harness views and SHALL NOT use a notification for it.

### R17 — Commands without a folder

The extension SHALL register every contributed command when no folder is open, SHALL hide workspace commands from the palette with `workspaceFolderCount > 0`, and WHEN such a command is invoked without a folder SHALL show one informational message.

### R18 — Command metadata

Every command SHALL declare the category `Harness Dashboard` and a title without that prefix; a command that applies to one provider SHALL name that provider in its title.

### R19 — Webview loading

WHEN the Dashboard panel opens, it SHALL render its shell and active tab before loading the code of other tabs, which SHALL load on first display.

### R20 — State compatibility

WHEN upgrading, saved positions, dismissals and disabled connections SHALL remain in effect in the editor panel under their existing workspace-state keys.

### R21 — Measured startup

The Extension Host suite SHALL record activation time and time to first Sources content, SHALL assert activation below the 500 ms budget in DESIGN.md, and SHALL assert that activation alone triggers no scan and no file read.

## Acceptance coverage

See the numbered test cases in [the implementation tasks](tasks.md).

## Sources

- [UX Guidelines overview](https://code.visualstudio.com/api/ux-guidelines/overview)
- [Activity Bar guidelines](https://code.visualstudio.com/api/ux-guidelines/activity-bar)
- [Views guidelines](https://code.visualstudio.com/api/ux-guidelines/views)
- [Webviews guidelines](https://code.visualstudio.com/api/ux-guidelines/webviews)
- [Walkthroughs guidelines](https://code.visualstudio.com/api/ux-guidelines/walkthroughs)
- [Activation events](https://code.visualstudio.com/api/references/activation-events)
