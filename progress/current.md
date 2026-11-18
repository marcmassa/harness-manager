# Current session state

FEAT-041 is in progress on spec/byoh-0.9-advisory-optimizer. T1 wires the configured registry into the parser and detector, preserves source ownership and legacy layout keys, and carries identity through the analysis results. Evidence is in progress/impl_byoh-source-capabilities.md.

T2 is implemented: profile v1 providers, the apiVersion 1 companion registration returned by activate(), and one registry change event that refreshes watchers and both panels. T3 is implemented: one operation decision in the host for webview messages, commands and post-modal rechecks, with owner, path and operation availability shown for the selected resource. Next is T4, the workspace matrix in the Extension Host. FEAT-042 and FEAT-043 have approvals and depend on this contract.

FEAT-040 is blocked on independent closing review on PR #31. FEAT-039 awaits architecture review. Real-workspace checks for the seven advertised adapters remain outstanding.

FEAT-044 (byoh-context-cost: load modes, session token cost, unpriced unknowns, cost findings, inference ledger, git HEAD diff) was approved by the maintainer on 2026-11-18 and stays at spec_ready until FEAT-041 closes (one feature in progress). It depends on the FEAT-041 source record.

FEAT-045 (activity-bar-startup: native Sources/Findings views, one restorable editor panel, neutral welcome and walkthrough, lazy first scan, code-split webview, measured activation) is at spec_ready and awaits maintainer approval.
