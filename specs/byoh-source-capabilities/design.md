# Design — BYOH source ownership and operation capabilities

FEAT-041 implements the discovery and operation boundary defined in FEAT-039. Today HarnessParser and AgenticDetector construct separate registries. Activation also configures newly constructed adapter instances. Inject the same workspace-scoped registry into all consumers and use its scan results for both panels. Reuse the existing parser output, source metadata, configuration reader and watcher lifecycle.

### Data and dispatch

Use the identity tuple from docs/byoh/adapter-capabilities.md. Keep a distinct attribution for each owner of a shared file. Preserve existing display IDs where unique, remap edges and persisted positions together on collisions, and retain unresolved discoveries as view-only. Report the seven capability levels from the approved architecture. Partial support enumerates actual operations and prerequisites. A detected adapter or file extension alone grants no write operation.

Expose a host decision such as `resolveOperation(target, operation)` returning an owner-bound operation or an unavailable reason. Views use the same decision for availability. The host resolves IDs again before every effect, including palette commands, the whiteboard menu, scaffolding, SDD lifecycle, runs, Advisory and Optimizer. Recheck after a modal confirmation. Only an explicit, user-selected adoption flow may create a new harness. Keep cross-owner relations view-local unless all affected owners support persistence.

### Extensibility and affected files

Extend src/adapters/{IAgentAdapter,AdapterRegistry,index}.ts, src/config/harnessConfig.ts, src/types.ts, src/harnessParser.ts, src/extension.ts and the provider, coordinators and webview controls that dispatch or display these operations. Add profile v1 using the markers, entities, ID fields and relationship mapping already specified in docs/byoh/adapter-capabilities.md. Bound and cancel discovery, resolve real paths including symlinks, and use workspace filesystem semantics. Profiles describe reads only. Activation exports the versioned registration function returning a disposable. Registration collisions, parsing failures and disposal must leave other providers usable. Test activation and registration before the Dashboard is first opened as well as after it is visible.

### Alternative and risks

A workspace-wide active harness would assign foreign nodes to the wrong writer in mixed projects. Keep ownership per resource. Existing dismissals and positions use graph keys. Migrate only unambiguous matches and test old persisted state. New format-specific read, write or run operations require a real provider implementation.
