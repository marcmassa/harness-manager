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

T3–T4, visible capability controls and the seven-adapter field validation remain pending. Built-in adapters do not yet declare `capabilities()`; T3 publishes their table. Advisory rule applicability and Optimizer scoring changes belong to the approved successor features.

Verified locally with 821 unit tests, three Extension Host runs on macOS, the build, the package gate (372,121 of 400,000 bytes), and 35 project checks. The Extension Host ownership case exercises the data paths used by the panels. UI capability reporting is tracked in T3.
