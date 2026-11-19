# Design — BYOH Optimizer applicability, scores and assisted fixes

FEAT-043 revises FEAT-034 and the fixes and delegation in FEAT-035. It consumes the FEAT-041 operation boundary. The current loader reads the native path but drops provider identity, and scan filters rules by node type. OPT-S02 then compares a Claude agent name with its parent directory. For .claude/agents/reviewer.md this suggests renaming the agent to agents.

### Rule evaluation and presentation

Extend src/optimizer/{types,componentLoader,optimizerEngine,scorer}.ts, the existing rule catalog, src/coordinators/OptimizerCoordinator.ts and src/webview/OptimizerPanel.tsx. Carry the FEAT-041 source reference and format semantics into ComponentSource. Classify each rule by required evidence, including explicit provider conventions for directory naming, frontmatter and section requirements. Shared content rules can run on readable sources. Distinguish an optional field from a required but missing field. Keep the pure scan, severity ceilings and user-disabled rules. Calculate coverage independently of finding count. An applicable check with zero findings earns its ordinary score. A skipped dimension contributes neither a penalty nor a perfect score. Display coverage beside score and show available source actions for read-only findings.

### Fix dispatch and handoff

Reuse the existing diff preview and confirmation. Resolve host finding, owner and current content before staging and again after confirmation. Reject stale proposals. Route supported edits through the owner, including any secondary file. Offer a multi-file operation only if consistent application is available. A delegated terminal run requires a compatible target, runner and explicit confirmation. Check each source before constructing a prompt or exposing file content. Host chat uses its own explicit user-triggered handoff capability. Keep read-only scan and local prompt preparation independent of an installed CLI.

### Alternative and risks

Turning off Optimizer for all foreign adapters would hide useful format-neutral checks. A per-framework rule engine would duplicate shared rules. Keep one table with input prerequisites. Mixed-provider corpus statistics can distort relative thresholds, so compare like evidence and show unavailable calibration where the cohort is insufficient.
