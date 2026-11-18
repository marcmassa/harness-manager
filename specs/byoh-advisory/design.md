# Design — BYOH Advisory findings, maturity and actions

FEAT-042 revises the Advisory portions of FEAT-029, FEAT-031 and FEAT-032. It consumes FEAT-041. At d894313 the layer-two scanner removes adapter-claimed files before the rules check categories. That prevents duplicate graph nodes but also discards evidence needed to avoid false missing-file suggestions. Keep graph deduplication and pass attributed observations into rule evaluation.

### Rule and action flow

Update src/agentic-detector/{agenticDetector,types,advisoryEngine,maturityClassifier,patternAnalyzer}.ts, src/coordinators/AdvisoryCoordinator.ts, src/agentic-detector/actionExecutor.ts and src/webview/AdvisoryPanel.tsx plus the architecture summary. Classify each existing rule as shared, provider-specific or optional integration, and record its evidence prerequisites. Native instructions, agent definitions and workflow records count according to their declared semantics. An installed CLI is evidence of executable availability only when actually verified. Keep SDD-specific governance detail in the SDD section. Compare shared evidence across layouts and show unavailable inputs where the provider offers no signal. Preserve package-based supply-chain findings and the existing user-triggered audit flow.

Generate an owner-qualified finding ID and resolve the action from the current host profile. Reuse the FEAT-041 authorization decision for quick actions and direct scaffold messages. Scope dismissals by source and workspace, migrating a legacy dismissal only on an unambiguous match. Keep the existing rescan debounce. Partial or failing providers produce scoped diagnostics while other findings remain available.

### Alternative and risks

Filtering SDD labels in the panel alone would leave biased scores, duplicate suggestions and direct host actions intact. Correct the evidence before evaluation. The same root document may satisfy more than one provider. Distinguish shared evidence from independently owned recommendations.
