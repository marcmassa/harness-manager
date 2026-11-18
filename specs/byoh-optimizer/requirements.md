# FEAT-043 — BYOH Optimizer applicability, scores and assisted fixes

Proposed for Harness Dashboard v0.9.0.

### R1 — Native applicability

WHEN analyzing a component, Optimizer SHALL run only rules whose evidence and native format prerequisites are satisfied for its owner.

### R2 — Score coverage

WHEN scoring a component or workspace, Optimizer SHALL aggregate only evaluated dimensions and components.

### R3 — Unavailable scores

IF no dimension can be evaluated, THEN Optimizer SHALL display an unscored result with the missing evidence.

### R4 — Attribution

WHEN a finding is shown, Optimizer SHALL identify its native source, owner and applicable rule in the panel.

### R5 — Fixes

WHEN a user confirms a mechanical or AI-assisted fix, the host SHALL revalidate all destination owners, operation permissions and source versions before applying the reviewed change.

### R6 — Delegation

WHEN a user requests a handoff or terminal delegation, the host SHALL limit its scope to current sources authorized for the selected operation and destination.

### R7 — Mixed and stale targets

IF any target in a requested operation has stale, ambiguous or unsupported ownership, THEN Optimizer SHALL reject the operation with a reason before any side effect.

## Acceptance coverage

See the numbered test cases in [the implementation tasks](tasks.md).
