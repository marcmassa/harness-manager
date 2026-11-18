# Feature migration inventory

Baseline is extension 0.8.2 at 990470d. Each row classifies the primary responsibility. The last column identifies behavior that needs an adapter or a migration decision even when the primary responsibility is shared. Wave identifiers refer to the proposed spec revisions below.

| ID | Feature | Class | Migration decision |
|---|---|---|---|
| FEAT-001 | Webview foundation | shared-core | Transport normalized data and adapter attribution. |
| FEAT-002 | Harness parser | adapter-specific | Move SDD defaults for file lookup behind the SDD reader (B). |
| FEAT-003 | Whiteboard | shared-core | Render every detected graph, including an empty graph. |
| FEAT-004 | Graph editor | adapter-specific | Route writes through the owner of the target node (C). |
| FEAT-005 | Progress timeline | adapter-specific | Accept optional milestones. SDD owns progress log parsing (B). |
| FEAT-006 | Layout and UX | shared-core | Use graph dimensions independently of source format. |
| FEAT-007 | Subagent and skill links | shared-core | Preserve the provider and direction of each relationship (B). |
| FEAT-008 | Visual design | shared-core | Keep common navigation and selection. |
| FEAT-009 | Relationship editor and source viewer | adapter-specific | Read source URIs from provenance. Require an edit operation for mutations (C). |
| FEAT-010 | Semantic suggestions | shared-core | Generate suggestions across normalized text. Persist acceptance via the owner (C). |
| FEAT-011 | Skill idoneity | shared-core | Score available skill and ownership data. Missing inputs give no score. |
| FEAT-012 | Entity and cross-reference intelligence | shared-core | Resolve links relative to their actual originating document (B). |
| FEAT-013 | Skill toggles | shared-core | Keep view preferences workspace-local. Route persisted links to the owner (C). |
| FEAT-014 | Open source in editor | shared-core | Open an attributed URI. Omit the action for entities without source (B). |
| FEAT-015 | Universal reader | adapter-specific | Introduce registration and stable owner identity (B). |
| FEAT-016 | Edge visualization | shared-core | Style normalized edge types and preserve unknown labels. |
| FEAT-017 | Layout persistence and linking | shared-core | Preserve existing position keys. Gate link creation by owner (B/C). |
| FEAT-018 | CI | repository-development | Run compatibility checks on changes to integration coverage. |
| FEAT-019 | Governance | repository-development | Include source ownership in the architecture and spec review. |
| FEAT-020 | VSIX repository cleanup | repository-development | Keep build outputs outside source control. |
| FEAT-021 | Extension host integration suite | repository-development | Add non-SDD and mixed workspace coverage (B). |
| FEAT-022 | Repository naming | repository-development | ADR-002 continues to identify the repository. |
| FEAT-023 | Adapter paths and whiteboard polish | adapter-specific | Apply overrides per workspace and adapter. Layout stays shared (B). |
| FEAT-024 | Steering and hook observability | adapter-specific | Show the source, trigger and owner when known. Discovery only reads (B). |
| FEAT-025 | SDD panel | adapter-specific | Require the SDD lifecycle operation for feature/spec edits (C). |
| FEAT-026 | Hook and steering discovery | adapter-specific | Resolve ambiguous root files without assigning them to every adapter (B). |
| FEAT-027 | KISS and DRY | repository-development | Retain contributor checks, retire installed save hooks and settings (A). |
| FEAT-028 | AI provider | optional-integration | Resolve model availability separately from harness detection. |
| FEAT-029 | Detection and advisory | adapter-specific | Attribute findings to a provider. Treat absent SDD files as normal (B/D). |
| FEAT-030 | Hardening and typed messages | shared-core | Validate owner and operation at host message dispatch (C). |
| FEAT-031 | Advisory live sync | shared-core | Refresh affected providers when their inputs change (B). |
| FEAT-032 | Suggestion actions | optional-integration | Scope scaffolds and commands to explicit provider actions (C/D). |
| FEAT-033 | Run and architecture studio | optional-integration | Separate installed CLI availability from target ownership and scaffold formats (D). |
| FEAT-034 | Optimizer | optional-integration | Apply rules only when their inputs exist in the detected format (D). |
| FEAT-035 | Assisted fixes | optional-integration | Route edits to the source owner and delegation to an available runner (C/D). |
| FEAT-036 | Supply-chain health | optional-integration | Detect package metadata independently of harness identity. Audit remains user-triggered. |
| FEAT-037 | React Flow migration | shared-core | Keep rendering and stable layout IDs across migration. |
| FEAT-038 | VSIX size gate | repository-development | Keep the packaged artifact below 400,000 bytes. |

## Features added during migration

| ID | Feature | Class | Migration decision |
|---|---|---|---|
| FEAT-039 | BYOH product architecture | shared-core | Define the adapter contract and track migration of every registered feature. |
| FEAT-040 | Repository quality hooks | repository-development | Proposed successor to FEAT-027 (A). Review before changing installed behavior. |

## Order of follow-up specs

A. **Repository quality checks.** Review the FEAT-027 amendment first. Current activation registers its verifier for the first workspace. Save can invoke workspace scripts before any harness has been selected.

B. **Discovery, identity and adapter contract.** Establish source ownership before migrating writers. Exercise SDD-only, foreign-only, unrecognized and mixed roots. Preserve saved positions when assigning IDs. Introduce workspace profiles and extension registration after built-in parity.

C. **Writes and lifecycle.** Inventory host commands and webview messages, then authorize each operation against its owner. Test that editing a foreign node never creates an SDD manifest, including via a stale UI message. Handle cross-provider links as view data until a provider can persist them.

D. **Advisory, runs and optional tools.** Use per-operation capability checks for optimizer findings, terminal launches and scaffolds. A generic “open in editor” fallback does not count as agent execution. Offer available actions with their prerequisites.

Every wave requires its own reviewed spec before runtime changes. Rows without a wave need regression coverage when their inputs change. The same inventory columns belong in future feature reviews.
