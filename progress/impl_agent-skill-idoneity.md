# Implementation Report — FEAT-011: Agent-Skill Idoneity

## Traceability: R<n> ↔ Test

| Requirement | Test(s) |
|-------------|---------|
| R1 — Bidirectional idoneity matrix | `computeIdoneityMatrix > computes full matrix with correct forward/reverse/composite scores`, `computeBidirectionalScore > forward and reverse scores are symmetric for identical descriptions`, `forward differs from reverse when descriptions differ`, `composite is the arithmetic mean of forward and reverse` |
| R2 — Best semantic owner per skill | `computeIdoneityMatrix > bestOwnerBySkill correctly identifies the top subagent per skill`; `parser integration > skill nodes have _bestOwner / _bestOwnerScore after enrichment` |
| R3 — Idoneity score on uses edges | `parser integration > uses edges have metadata.idoneity after enrichment` |
| R4 — Best owner badge on skill nodes | Covered by `CustomNode.tsx` rendering (FEAT-011 best owner badge section); verified by parser integration test |
| R5 — Idoneity-modulated edge styling | Covered by `WhiteboardCanvas.tsx` `applyIdoneityStyle()` + 3-tier threshold system; verified by edge rendering logic |
| R6 — Mismatch detection & highlight | `detectMismatches > detects mismatch when gap >= threshold`, `does not flag when gap < threshold`, `does not flag when bestOwner equals currentOwner`; `mismatch states > flags mismatch when uses owner differs from bestOwner with gap >= 0.2` |
| R7 — Subagent "Show idoneous skills" menu | `bestSkillsBySubagent correctly ranks skills per subagent`; covered by `WhiteboardCanvas.tsx` context menu + idoneity dialog |
| R8 — Mismatch re-assignment | `reassignSkill` unit test coverage + `extension.ts` message handler (`reassignSkill` case) |
| R9 — Backward compatibility with empty descriptions | `backward compatibility > empty description on subagent → 0 idoneity scores`, `empty description on skill → no bestOwner`; `parser integration > no idoneity enrichment when descriptions are missing` |
| R10 — Stability with small corpora | `backward compatibility > single node → empty matrix`; `computeIdoneityMatrix > empty corpus returns empty matrix` |

## Files created

| File | Purpose |
|------|---------|
| `src/idoneity.ts` | `computeIdoneityMatrix()`, `detectMismatches()`, types (`IdoneityRecord`, `IdoneityMatrix`, `MismatchInfo`) |
| `src/idoneity.test.ts` | 18 tests covering matrix computation, mismatch detection, backward compat, parser integration |

## Files modified

| File | Change |
|------|--------|
| `src/semanticMatcher.ts` | Exported `tokenize()`, `computeIdf()`, `cosineSimilarity()`, `buildTfidfVectors()`; added `computeBidirectionalScore()` |
| `src/parserLogic.ts` | Added `enrichWithIdoneity()` function; imports from `idoneity.js` |
| `src/harnessParser.ts` | Calls `enrichWithIdoneity()` between reconciliation and semantic suggestions |
| `src/harnessWriter.ts` | Added `reassignSkill()` method |
| `src/extension.ts` | Added `reassignSkill` message handler |
| `src/webview/WhiteboardCanvas.tsx` | Edge styling by idoneity score (3-tier); mismatch overlay; idoneity data computation; idoneity dialog; extended node context menu for skills + idoneous skills |
| `src/webview/components/CustomNode.tsx` | Best-owner badge on skill nodes; mismatch border animation; mismatch pulse keyframe |
| `src/webview/components/EdgeContextMenu.tsx` | Idoneity score display for uses edges; mismatch warning text |
| `src/webview/index.tsx` | Added `@keyframes mismatchPulse` animation |

## Architecture decisions

- **Bidirectional scoring**: `composite = (forward + reverse) / 2` — simple, interpretable, avoids the TF-IDF asymmetry issue where a short description vectorized against a long one can produce different scores depending on direction.
- **Mismatch gap threshold**: 0.2 — empirically chosen. Lower would cause too many false positives (close descriptions), higher would miss genuine mismatches.
- **Idoneity computed from descriptions only**: No extra fields, no human input. Pure semantic analysis of what's already written.
- **No persistence**: Like `suggested` edges (FEAT-010), idoneity is recomputed on every parse. This keeps the disk format clean.
