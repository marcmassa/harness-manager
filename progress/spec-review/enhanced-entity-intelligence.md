# FEAT-012 — enhanced-entity-intelligence

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Implementation report documents additive name boosting instead of the vector-injection sketch; orphan handling is labelled structural evidence. Preserve this distinction.

Evidence sources:

- [src/parserLogic.ts](../../src/parserLogic.ts)
- [src/parserLogic.test.ts](../../src/parserLogic.test.ts)
- [src/semanticMatcher.test.ts](../../src/semanticMatcher.test.ts)
- [progress/impl_feat-012.md](../../progress/impl_feat-012.md)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L7) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/types.ts` |
| [T2](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L8) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts` |
| [T3](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L9) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts` |
| [T4](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L13) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts` |
| [T5](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L14) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts` |
| [T6](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L15) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts` |
| [T7](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L16) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts` |
| [T8](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L17) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts` |
| [T9](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L21) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts` |
| [T10](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L27) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T11](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L28) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T12](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L29) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/WhiteboardCanvas.tsx` |
| [T13](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L33) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T14](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L34) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T15](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L35) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T16](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L39) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessParser.ts` |
| [T17](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L40) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/WhiteboardCanvas.tsx` |
| [T18](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L41) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/index.tsx` |
| [T19](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L42) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/extension.ts` |
| [T20](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L46) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T21](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L47) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T22](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L48) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T23](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L49) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T24](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L50) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T25](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L51) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T26](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L52) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T27](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L53) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T28](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L54) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T29](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L58) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/impl_feat-012.md` |
| [T30](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L59) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T31](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L60) | V | feature_list.json already records this feature as done; no transition performed. | `feature_list.json` |
| [T32](../../.kiro/specs/enhanced-entity-intelligence/tasks.md#L61) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `progress/progress.md` |
