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
