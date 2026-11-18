# FEAT-041 implementation evidence

## T1 — Source identity

Activation constructs one configured adapter registry for the active workspace folder. The parser and detector receive that same instance. The graph exposes `node.source`, the Advisory profile exposes `sources`, and Optimizer component scores include `source`. A resolved identity carries workspace URI, provider ID, provider-local ID and native source URI. SDD entities declared in a manifest retain their declaration path when a separate native file is unavailable.

| Requirement | Verification |
|---|---|
| R1 | The macOS Extension Host suite in src/test/integration/sourceOwnership.ts reads a Claude workspace and a steering file in a custom directory. It checks identical provenance on the graph, Advisory and Optimizer and compares workspace contents after scanning. |
| R2 | src/adapters/adapterRegistry.test.ts scans two providers with the same node ID and same source file, in both registration orders. Each retains its attribution and correctly routed edge on a second scan. |
| R8 | The mixed SDD/Claude collision test preserves the SDD node’s previous layout key while routing the Claude relationship to its own node. The Extension Host test also exercises an unchanged Claude layout key and the configured steering path. |

## T2 — Profile v1 and companion registration

`AdapterRegistry` is now the single mutable provider set: fixed built-ins, companions added through `register()` (returns a disposable), and profile providers rebuilt from `config.json#profiles` by `setProfiles()`. Every change fires `onDidChange`; activation wires that one event to the dashboard watchers, the detector watchers, a data refresh and the shared scan, replacing the previous config-only listener. `activate()` returns `{ apiVersion: 1, registerAdapter }` (also without a workspace folder, as a no-op). `validateProfiles` (src/adapters/profileV1.ts) is pure; `ProfileAdapter` reads only, is bounded (2 000 files, 256 KB per file) and honours a cancellation token, and resolves real paths (Node `realpath` on `file:`; symlinks refused on other schemes). Companion results are sanitised: malformed nodes and edges with unknown endpoints are dropped with diagnostics, and `_framework` is forced to the registering provider. A provider disposed during a scan is neither called again nor kept in that scan's result.

| Requirement | Verification |
|---|---|
| R1 | byohProviders.test.ts: profile nodes carry workspace URI, profile ID, native ID and source URI. Extension Host suite byohProviders.ts checks the profile provider ID on a real filesystem. |
| R5 | Unit: declared entities, labels and `uses` relationships; no marker → nothing read; watch globs; discovery-only capabilities. Extension Host: profile discovered through `HarnessConfig` with workspace contents unchanged after the scan. |
| R6 | Unit: register/dispose updates parse output and watch globs and notifies twice; idempotent dispose; in-flight disposal. Extension Host: a companion registered before the Dashboard opens is scanned; opening the Dashboard and a later registration are scanned; after disposal neither is called again. |
| R7 | Unit: unknown version, reserved/duplicate provider IDs, absolute/home/drive/scheme/`..` patterns, symlink target outside the root, oversized file, duplicate native IDs, unresolved references, throwing `detect`/`watchGlobs`/`parse` providers and malformed companion output — each skipped with a scoped diagnostic while other providers keep working. Extension Host: a real symlink to a file outside the workspace is not read; version 9 is reported. |

Verified locally: 838 unit tests, four Extension Host runs on macOS (VS Code 1.147.0), build, package gate 375,174 of 400,000 bytes (93%), 35 project checks.

## T3 — Visible operations and the host decision

`src/operations/operations.ts` holds the operation catalog, the built-in operation table, the mapping from every mutating webview message to an operation and its targets, and `decide()` (pure). `OperationGate` applies it in the host against the latest scan, workspace trust and installed runners. `HarnessDashboardProvider` asks before dispatching any coordinator message, discards a client-supplied `operationMode`, and answers a denial with `operationDenied` and a warning. The Whiteboard and Optimizer coordinators ask again after each modal confirmation (relationship delete, reviewed fix, delegation). The scaffold, filesystem-sync and npm-audit commands ask too, and scaffolding lists only resources whose owner writes that format. Every `init` message carries the provider, native path, capability levels and operation availability (with the reason when unavailable) per resource; the whiteboard detail panel renders them, and disables Delete and description editing when the host would refuse.

Behaviour changes, all following the approved design:
- Structural writes (create, delete, metadata, link, relabel, lifecycle) need a provider that implements them. Today only Harness SDD does, so editing a Claude, Cursor or profile resource can no longer create or change an SDD manifest.
- A skill link across owners that cannot persist it is stored as view data (`customUsesEdges`), never sent to the writer. Non-`uses` relationships stay view data, and deleting them no longer touches the writer.
- An agent CLI launches only on resources its own provider owns (Claude Code, Gemini CLI), and only with the CLI installed. The generic "open in editor" runner is not an agent run and needs no decision.
- Delegation needs an installed agent CLI and current targets. Every mutation and launch needs a trusted workspace.
- `docs/byoh/adapter-capabilities.md`: editing for Claude Code, Gemini CLI, Cursor, Copilot, Kiro and Windsurf is now `partial`, because the Optimizer's reviewed text edits write back to those files. A unit test keeps the page equal to `BUILTIN_CAPABILITIES`.

| Requirement | Verification |
|---|---|
| R3 | Extension Host suite operationGate.ts: the `init` ownership for a Claude subagent names Claude Code, its native path, Delete unavailable as read-only, reviewed fixes available and launch unavailable because the CLI is missing. operations.test.ts: the capability table equals the documentation, and no operation is declared under an unsupported capability. |
| R4 | Unit: supported positive control; read-only, stale, unknown-owner, mixed-owner and untrusted denials; single-owner rule for creation; runner-to-owner match and installed CLI; delegation prerequisites; message mapping, with reads and proposals undecided. byohProviders.test.ts: companion operations are validated against their capabilities, and profiles declare none. Extension Host: seven denied dispatches (read-only delete and metadata, stale target, creation without an owner, relabel without a writer, launch without the CLI, a forged mode), then view-local link creation and deletion, leave workspace files byte-identical and open no terminal. The positive control (after adding a Harness SDD manifest) writes `.agents/subagents/tester/SUBAGENT.md`. |

Verified locally: 850 unit tests, five Extension Host runs on macOS (VS Code 1.147.0), build, package gate 378,553 of 400,000 bytes (94%), 35 project checks.

The repository's staged-file limit (20,000 bytes, `.githooks/token_limit.py`) blocked this commit because T3 touched three oversized files. They were split by responsibility, moving code verbatim:
- `src/extension.ts` → the scaffold and sync commands moved to `src/commands/scaffoldCommands.ts`.
- `src/coordinators/OptimizerCoordinator.ts` → delegation moved to `optimizerDelegation.ts`; the AI Refine provider call and the chat handoff moved to `optimizerRefine.ts`.
- `src/webview/index.tsx` (89 KB) → an entry file plus `App.tsx`, `useDashboardState.ts` (state and host listener), `useDashboardActions.ts` (effects and handlers), `NodeDetailPanel.tsx`, `NodeDescriptionTab.tsx`, `panelChrome.tsx`, `dashboardChrome.tsx`, `vscodeApi.ts` and `dashboardStyles.ts`.

Hook order is unchanged. `tsc` reports no error in any of the new webview modules; there were none in `index.tsx` before. `NodeDetailPanel.test.ts` renders the panel through `react-dom/server` (no new dependency) and checks the R3 section together with the disabled Delete and read-only description. Verified again: 853 unit tests, five Extension Host runs, package gate 380,518 bytes, 35 project checks.

## T4 — Workspace matrix and real-workspace results

`src/test/integration/workspaceMatrix.ts` builds five roots in one Extension Host — SDD-only, Claude-only, custom profile, mixed, and unrecognized. Each SDD and Claude root carries an executable hook script that would create a sentinel file if it ran. For each root the suite:
- parses twice and checks that every ID, owner and source URI is the same on the second scan;
- checks that every attributed source appears in the Advisory profile and that every Optimizer component carries its node's source;
- reads the host decision for each node;
- compares the root's file contents before and after.

Result on VS Code 1.147.0:

| Root | Owners | Nodes | Writable nodes |
|---|---|---|---|
| SDD-only | `harness-sdd` | 4 | 4 |
| Claude-only | `claude-code` | 3 | 0 |
| Custom profile | `team-guides` | 3 | 0 |
| Mixed | `claude-code`, `harness-sdd` | 7 | only the 4 SDD nodes; the two `reviewer` agents stay distinct |
| Unrecognized | none | 0 | 0, no errors |

No file changed, and the hook sentinel was never created.

The seven advertised adapters' results are recorded separately in `docs/byoh/field-results-2026-11-19.md`. The opt-in suite `fieldValidation.ts` runs when `HARNESS_FIELD_ROOT` is set and opens each source as its own workspace. All seven pass: entity found, source opens, stable on rescan, present in Advisory, files unchanged. These were scripted runs, not webview click-throughs. The run also exposed a path-resolution limit for roots nested inside a workspace folder; it is recorded in the backlog for multi-root support.

| Requirement | T4 evidence |
|---|---|
| R1 | Matrix: graph, Advisory and Optimizer share the same identity in all five roots. Field: the source URI opens for all seven adapters. |
| R2 | Matrix: the mixed root keeps two `reviewer` agents with distinct owners across a rescan. |
| R3, R4 | Matrix: host decisions per root — SDD writable, Claude and profile read-only, mixed writable only for SDD. The dispatch path is covered by the T3 suite. |
| R5 | Matrix: the custom-profile root is discovered with no diagnostics. |
| R6 | Covered by the T2 Extension Host suite (registration before and after the Dashboard opens, disposal). |
| R7 | Matrix: hook scripts never run, and an unrecognized root yields an empty graph with no errors. |
| R8 | Field: built-in discovery of the seven adapters on real sources, stable on rescan. |

Verified: 853 unit tests; six Extension Host runs (`critical path`, `save isolation`, `source ownership`, `providers`, `operation gate`, `workspace matrix`); seven field runs; package gate; 35 project checks. Advisory rule applicability and Optimizer scoring changes belong to the approved successor features.

Verified locally with 821 unit tests, three Extension Host runs on macOS, the build, the package gate (372,121 of 400,000 bytes), and 35 project checks. The Extension Host ownership case exercises the data paths used by the panels. UI capability reporting is tracked in T3.
