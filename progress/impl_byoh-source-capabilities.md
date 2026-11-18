# FEAT-041 implementation evidence

## T1 — Source identity

Activation constructs one configured adapter registry for the active workspace folder. The parser and detector receive that same instance. The graph exposes `node.source`, the Advisory profile exposes `sources`, and Optimizer component scores include `source`. A resolved identity carries workspace URI, provider ID, provider-local ID and native source URI. SDD entities declared in a manifest retain their declaration path when a separate native file is unavailable.

| Requirement | Verification |
|---|---|
| R1 | The macOS Extension Host suite in src/test/integration/sourceOwnership.ts reads a Claude workspace and a steering file in a custom directory. It checks identical provenance on the graph, Advisory and Optimizer and compares workspace contents after scanning. |
| R2 | src/adapters/adapterRegistry.test.ts scans two providers with the same node ID and same source file, in both registration orders. Each retains its attribution and correctly routed edge on a second scan. |
| R8 | The mixed SDD/Claude collision test preserves the SDD node’s previous layout key while routing the Claude relationship to its own node. The Extension Host test also exercises an unchanged Claude layout key and the configured steering path. |

T2–T4, visible capability controls and the seven-adapter field validation remain pending. Advisory rule applicability and Optimizer scoring changes belong to the approved successor features.

Verified locally with 821 unit tests, three Extension Host runs on macOS, the build, the package gate (372,121 of 400,000 bytes), and 35 project checks. The Extension Host ownership case exercises the data paths used by the panels. UI capability reporting is tracked in T3.
