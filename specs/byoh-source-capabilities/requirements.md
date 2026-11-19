# FEAT-041 — BYOH source ownership and operation capabilities

Proposed for Harness Dashboard v0.9.0.

### R1 — Source identity

WHEN discovery resolves a native resource, the Dashboard SHALL expose its workspace URI, provider ID, native ID and source URI to both analysis panels.

### R2 — Mixed workspaces

WHEN providers report the same native ID or file, the Dashboard SHALL preserve every attribution across rescans.

### R3 — Visible operations

WHEN a resource is selected, the Dashboard SHALL show its provider, native path and the availability of each relevant operation with a reason for each unavailable operation.

### R4 — Host decision

WHEN a harness-specific operation is dispatched, the host SHALL authorize all affected targets against current ownership, declared operations, workspace trust and operation prerequisites.

### R5 — Custom layouts

WHERE a workspace defines a valid v1 Markdown profile, the Dashboard SHALL discover its declared entities and relationships in both panels through read-only scans.

### R6 — Companion providers

WHEN an installed companion extension registers or disposes a version 1 adapter, the Dashboard SHALL update the graph and analysis inputs from the current registrations.

### R7 — Isolation

IF a profile entry escapes the workspace root, collides with an existing provider ID or uses an unknown schema version, THEN the Dashboard SHALL skip that entry with a scoped diagnostic.

### R8 — Compatibility

WHEN opening an existing workspace after upgrading, the Dashboard SHALL retain built-in discovery, configured paths and saved positions for unambiguously matched resources.

## Acceptance coverage

See the numbered test cases in [the implementation tasks](tasks.md).
