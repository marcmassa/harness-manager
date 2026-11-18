# FEAT-011 — agent-skill-idoneity

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Matrix and mismatch tests exist. Pure/parser assertions do not establish writer reassignment persistence or visual behavior.

Evidence sources:

- [src/idoneity.ts](../../src/idoneity.ts)
- [src/idoneity.test.ts](../../src/idoneity.test.ts)
- [src/harnessWriter.ts](../../src/harnessWriter.ts)
- [progress/impl_agent-skill-idoneity.md](../../progress/impl_agent-skill-idoneity.md)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/agent-skill-idoneity/tasks.md#L7) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/semanticMatcher.ts` |
| [T2](../../.kiro/specs/agent-skill-idoneity/tasks.md#L8) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts` |
| [T3](../../.kiro/specs/agent-skill-idoneity/tasks.md#L9) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/parserLogic.ts` |
| [T4](../../.kiro/specs/agent-skill-idoneity/tasks.md#L10) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/WhiteboardCanvas.tsx` |
| [T5](../../.kiro/specs/agent-skill-idoneity/tasks.md#L11) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/CustomNode.tsx` |
| [T6](../../.kiro/specs/agent-skill-idoneity/tasks.md#L12) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/WhiteboardCanvas.tsx` |
| [T7](../../.kiro/specs/agent-skill-idoneity/tasks.md#L13) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/idoneity.test.ts` |
| [T8](../../.kiro/specs/agent-skill-idoneity/tasks.md#L14) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessWriter.ts`, `src/extension.ts` |
| [T9](../../.kiro/specs/agent-skill-idoneity/tasks.md#L15) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/EdgeContextMenu.tsx` |
| [T10](../../.kiro/specs/agent-skill-idoneity/tasks.md#L19) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/idoneity.test.ts` |
| [T11](../../.kiro/specs/agent-skill-idoneity/tasks.md#L20) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/idoneity.test.ts` |
| [T12](../../.kiro/specs/agent-skill-idoneity/tasks.md#L21) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/idoneity.test.ts` |
| [T13](../../.kiro/specs/agent-skill-idoneity/tasks.md#L22) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/idoneity.test.ts` |
| [T14](../../.kiro/specs/agent-skill-idoneity/tasks.md#L23) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/idoneity.test.ts` |
| [T15](../../.kiro/specs/agent-skill-idoneity/tasks.md#L24) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/idoneity.test.ts` |
| [T16](../../.kiro/specs/agent-skill-idoneity/tasks.md#L25) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/idoneity.ts`, `src/idoneity.test.ts` |
| [T17](../../.kiro/specs/agent-skill-idoneity/tasks.md#L29) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/impl_agent-skill-idoneity.md` |
| [T18](../../.kiro/specs/agent-skill-idoneity/tasks.md#L30) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T19](../../.kiro/specs/agent-skill-idoneity/tasks.md#L31) | V | feature_list.json already records this feature as done; no transition performed. | `feature_list.json` |
| [T20](../../.kiro/specs/agent-skill-idoneity/tasks.md#L32) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `progress/progress.md` |
