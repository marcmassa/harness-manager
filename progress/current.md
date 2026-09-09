# Current Session State

## Active Feature
_(none active — spec phase only)_

- **FEAT-036 supply-chain-health: SHIPPED & CLOSED** — PRs #3 / #12 merged,
  Dependabot at 0 alerts, version 0.8.1 prepared (not yet tagged/published).
- **FEAT-037 react-flow-12-migration: `spec_ready`** — spec drafted this
  session by `spec-author-vscode` at `.kiro/specs/react-flow-12-migration/`
  (requirements.md R1–R13, design.md, tasks.md T1–T15). **Shared release
  decision encoded**: FEAT-037 ships in the same unreleased **0.8.1** as
  FEAT-036 (`sprint: "0.8.1"`; CHANGELOG [0.8.1] to be extended, not a new
  [0.9.0]; version not bumped).

## Status
- `./check.sh`: green (see end of session — re-run after spec authoring).
- Key spec decisions: target `@xyflow/react@^12.11.6` (peers verified
  `react/react-dom >=17`), React `^19`, **nodeDragThreshold=1 adopted
  explicitly** (click-jitter no longer persists bogus manual positions),
  measured-dimensions change verified inert (layoutUtils uses constants).
- Next: **human review of the FEAT-037 spec** (approval gate). On approval →
  `in_progress`, implementer executes T1–T15 on branch `feat/react-flow-12`.

## Notes
- FEAT-036 R5 collision **resolved** (carried over): requirements win over the
  design's factual claim; ActionExecutor's create-file existing-file branch
  opens the file (ADR-004); reviewer-vscode pass recorded PASSED [2026-09-09].
- No src/ or package.json changes were made in this session (spec-only, per
  AGENTS.md §3).
