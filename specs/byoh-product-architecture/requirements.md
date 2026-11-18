# Requirements — BYOH product architecture

> Feature FEAT-039. This is a macro product change: Harness Dashboard adapts to the harness each user already has. It does not require users to adopt Harness SDD or another canonical file layout. Existing and future product capabilities are classified as shared, adapter-specific, optional, or repository-development tooling.

## Requirements

### R1 — Harness-neutral core
- **Pattern:** Ubiquitous
- The shared Dashboard core SHALL consume the common graph model without requiring `.agents/agentic.json`, `feature_list.json`, or another vendor-specific manifest.

### R2 — Explicit adapter capabilities
- **Pattern:** Ubiquitous
- Every built-in or registered adapter SHALL declare its support level for discovery, hooks, steering, commands, agent runs, editing, and validation.

### R3 — Capability vocabulary
- **Pattern:** Ubiquitous
- Each declared capability SHALL use one of `supported`, `partial`, or `unsupported`.

### R4 — Capability-aware behavior
- **Pattern:** State
- WHILE a product action depends on a harness-specific capability, the Dashboard SHALL enable that action only when the selected adapter declares the required capability as `supported` or `partial`.

### R5 — User-owned source of truth
- **Pattern:** Ubiquitous
- The Dashboard SHALL preserve each user's existing harness files as the source of truth and SHALL NOT require migration to a Dashboard-owned format.

### R6 — Read-only discovery
- **Pattern:** Ubiquitous
- Adapter detection and parsing SHALL NOT modify workspace files or execute workspace scripts.

### R7 — Additive adapter integration
- **Pattern:** Ubiquitous
- BYOH support SHALL allow a workspace profile for common file-based layouts and a versioned extension API for formats that require a custom parser.

### R8 — Adapter-specific product features
- **Pattern:** Optional
- WHERE a product feature applies only to one harness, the Dashboard SHALL label the feature with that adapter and SHALL NOT present it as a capability of unrelated adapters.

### R9 — Multi-harness workspaces
- **Pattern:** Event
- WHEN a workspace contains more than one supported harness, the Dashboard SHALL show the discovered harnesses together while keeping their nodes and edges attributable to their adapter.

### R10 — Support visibility
- **Pattern:** Event
- WHEN an adapter is detected, the UI SHALL show its capability levels and identify partial or unsupported actions.

### R11 — Existing feature audit
- **Pattern:** Ubiquitous
- The migration plan SHALL classify every existing feature as shared-core, adapter-specific, optional integration, or repository-development tooling.

### R12 — Spec-first migration
- **Pattern:** Ubiquitous
- Each existing feature whose requirements assume one harness SHALL receive an approved spec revision before its implementation changes.

### R13 — Built-in adapter compatibility
- **Pattern:** Ubiquitous
- Existing built-in adapters SHALL retain their current detection and parsing behavior unless their own approved migration spec changes it.

### R14 — Repository-only KISS/DRY checks
- **Pattern:** Ubiquitous
- The KISS and DRY hooks for this repository SHALL remain developer tooling and SHALL NOT run automatically in users' workspaces through the installed extension.

### R15 — Adapter validation
- **Pattern:** Ubiquitous
- Each advertised built-in adapter SHALL have a repeatable smoke test against a representative workspace in its framework.

## Traceability with Acceptance Criteria

| Acceptance Criterion | Covered by |
|---|---|
| Shared Dashboard core works without Harness SDD files | R1, R5 |
| Every feature is clearly shared or adapter-specific | R2–R4, R8, R11, R12 |
| Users can bring common or custom harness formats | R7 |
| Workspace files remain user-owned and unchanged by discovery | R5, R6 |
| Multiple harnesses appear together with clear attribution | R9, R10 |
| Existing integrations remain stable during the migration | R13, R15 |
| KISS/DRY remains a repository development control | R14 |
