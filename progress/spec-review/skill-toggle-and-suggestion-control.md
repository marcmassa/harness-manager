# FEAT-013 — skill-toggle-and-suggestion-control

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

The requested progress/impl_feat-013.md is absent. Parser and coordinator code exists; provenance and acceptance coverage still need task-level review.

Evidence sources:

- [src/parserLogic.ts](../../src/parserLogic.ts)
- [src/parserLogic.test.ts](../../src/parserLogic.test.ts)
- [src/coordinators/WhiteboardCoordinator.ts](../../src/coordinators/WhiteboardCoordinator.ts)
- [src/webview/WhiteboardCanvas.tsx](../../src/webview/WhiteboardCanvas.tsx)
- [src/webview/components/EdgeContextMenu.tsx](../../src/webview/components/EdgeContextMenu.tsx)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L11) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T2](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L13) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessParser.ts` |
| [T3](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L15) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T4](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L17) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T5](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L19) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessParser.ts` |
| [T6](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L21) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/extension.ts` |
| [T7](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L23) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T8](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L29) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/EdgeContextMenu.tsx` |
| [T9](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L31) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/EdgeContextMenu.tsx` |
| [T10](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L35) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T11](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L37) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T12](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L39) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T13](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L41) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T14](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L43) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T15](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L47) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T16](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L53) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.test.ts` |
| [T17](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L55) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.test.ts` |
| [T18](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L57) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.test.ts` |
| [T19](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L59) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/bridge.test.ts` |
| [T20](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L61) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.test.ts` |
| [T21](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L67) | G | Required progress/impl_feat-013.md is absent. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T22](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L68) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T23](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L69) | V | feature_list.json already records this feature as done; no transition performed. | `feature_list.json` |
| [T24](../../.kiro/specs/skill-toggle-and-suggestion-control/tasks.md#L70) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `progress/progress.md` |
