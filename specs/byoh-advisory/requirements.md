# FEAT-042 — BYOH Advisory findings, maturity and actions

Proposed for Harness Dashboard v0.9.0.

### R1 — Existing resources

WHEN an adapter has identified a native resource, Advisory SHALL count that evidence when evaluating whether the resource is missing.

### R2 — Rule scope

WHEN Advisory displays a suggestion, it SHALL identify its provider and evidence or label the finding as workspace-wide.

### R3 — Maturity

WHEN two providers expose equivalent workflow evidence, Advisory SHALL assign the same shared maturity assessment regardless of native paths or SDD adoption.

### R4 — Insufficient evidence

IF a workspace exposes insufficient evidence for an assessment, THEN Advisory SHALL display which inputs are unavailable.

### R5 — Scaffolding

WHILE the user is browsing a foreign harness, Advisory SHALL restrict scaffold recommendations to operations declared by that harness.

### R6 — Execution

WHEN a user invokes an Advisory action, the host SHALL dispatch it only for an authorized current target under FEAT-041.

### R7 — Refresh and dismissal

WHEN a provider rescans, Advisory SHALL preserve dismissals for the same finding and source while keeping other owners’ findings independently actionable.

## Acceptance coverage

See the numbered test cases in [the implementation tasks](tasks.md).
