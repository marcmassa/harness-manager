# Current Session State

## Active Feature
- FEAT-017 — node-position-persistence-and-pill-linking — **done**

## Completed This Session
- FEAT-015 — Universal Agent Architecture Reader — **implementation completed and validated**
- FEAT-017 — Node Position Persistence & Handle-Pill Linking — **implementation completed and validated**

## Summary
- FEAT-017 now persists manual node positions in-session by capturing final drag coordinates and merging them over Dagre layout output during graph refreshes.
- Handle-pill linking UX was improved by enlarging and centering source/target handle hit areas directly on visible pills, preserving drag-to-connect behavior.
- Suggestion noise was reduced by tightening semantic suggestion generation (higher threshold, per-subagent cap, cross-framework filtering), hiding suggested edge labels, and defaulting suggestion visibility to off.
- Added and updated tests for node position merge safety and suggestion noise constraints.
- Validation passed: `npm test`, `npm run build`, and `./check.sh`.

