# FEAT-044 — BYOH context cost, optimization and inference usage

Proposed for Harness Dashboard v0.9.0. Depends on FEAT-041 source identity and fits FEAT-043 coverage reporting.

### R1 — Declared load mode

WHEN discovery resolves a native resource, the Dashboard SHALL record the load mode declared by its owning provider as one of `always`, `on-trigger`, `delegated`, `on-event`, `manual` or `unknown`.

### R2 — No inferred load mode

The Dashboard SHALL NOT derive a load mode from a provider name, product branding or file extension alone; WHERE the owner declares none, the load mode SHALL be `unknown`.

### R3 — Declaration paths

The built-in adapters, profile v1 entities and the companion API v1 provider result SHALL each be able to declare a load mode per resource, and an omitted field SHALL keep existing profiles and companions valid.

### R4 — Session cost model

WHEN a provider is detected, the Dashboard SHALL estimate its per-session context cost as the sum of its `always` resources, the descriptions of its `on-trigger` resources, and, separately, the body cost of each `on-trigger` and `delegated` resource.

### R5 — Unknown is unpriced

IF a resource's load mode is `unknown`, THEN the Dashboard SHALL list it with its token estimate as unpriced and SHALL NOT count it as zero in any total.

### R6 — Estimation

The Dashboard SHALL compute token estimates with the existing local estimator and SHALL apply a model-family calibration factor only where the user configures one.

### R7 — Money estimates

WHERE the user configures a price table, the Dashboard SHALL show money estimates labelled as estimates, together with the calibration factor and the price table date, and SHALL NOT fetch prices over the network.

### R8 — Neutral cost findings

WHEN analyzing context cost, the Dashboard SHALL report duplicated content across `always` resources of different owners, the share of the session baseline held by each `always` resource, and `always` resources whose owner declares an `on-trigger` alternative, using deterministic rules only.

### R9 — Finding attribution

WHEN a cost finding is shown, the Dashboard SHALL identify every affected source and owner and SHALL offer only operations authorized for those targets under FEAT-041.

### R10 — Cost coverage

IF a provider has no resource with a declared load mode, THEN the Dashboard SHALL display its cost as unevaluated with the missing evidence and SHALL NOT include it in workspace totals.

### R11 — Inference ledger

WHEN an AI-assisted action of the Dashboard completes, the host SHALL record the provider, model, input and output tokens, whether each count is reported or estimated, and the action type in workspace state.

### R12 — Ledger privacy

The inference ledger SHALL NOT store prompt or response content and SHALL NOT leave the machine.

### R13 — Baseline diff

WHEN the user requests a cost comparison, the Dashboard SHALL compare the current session cost of each provider with the same sources at git `HEAD` and SHALL report the change per resource.

### R14 — Comparison without git

IF the workspace is not a git repository or a source is untracked, THEN the Dashboard SHALL report that resource as new or the comparison as unavailable without failing the analysis.

### R15 — Read-only analysis

Cost analysis, findings and the baseline diff SHALL NOT modify workspace files or execute workspace scripts.

## Acceptance coverage

See the numbered test cases in [the implementation tasks](tasks.md).
