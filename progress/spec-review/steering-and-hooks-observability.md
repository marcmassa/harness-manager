# FEAT-024 — steering-and-hooks-observability

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Parser tests and node rendering exist. Manual visual/edit-file verification remains separate from parser assertions.

Evidence sources:

- [src/parserLogic.ts](../../src/parserLogic.ts)
- [src/parserLogic.test.ts](../../src/parserLogic.test.ts)
- [src/adapters/HarnessSddAdapter.ts](../../src/adapters/HarnessSddAdapter.ts)
- [src/webview/components/CustomNode.tsx](../../src/webview/components/CustomNode.tsx)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L7) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/types.ts` |
| [T2](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L8) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/types.ts` |
| [T3](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L9) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/styles.ts` |
| [T4](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L10) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/styles.ts` |
| [T5](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L14) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts` |
| [T6](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L15) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T7](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L16) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T8](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L17) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T9](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L18) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T10](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L19) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T11](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L23) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T12](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L24) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T13](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L28) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/CustomNode.tsx` |
| [T14](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L29) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/index.tsx` |
| [T15](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L30) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/index.tsx` |
| [T16](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L34) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T17](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L35) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T18](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L36) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T19](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L37) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T20](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L38) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T21](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L39) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T22](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L40) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T23](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L41) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T24](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L45) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T25](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L46) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
| [T26](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L47) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T27](../../.kiro/specs/steering-and-hooks-observability/tasks.md#L48) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/parserLogic.ts`, `src/parserLogic.test.ts` |
