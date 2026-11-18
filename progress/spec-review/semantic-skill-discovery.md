# FEAT-010 — semantic-skill-discovery

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Semantic tests cover pure scoring and injected scorer fallback. UI acceptance/persistence and actual model availability are separate acceptance paths.

Evidence sources:

- [src/semanticMatcher.ts](../../src/semanticMatcher.ts)
- [src/semanticMatcher.test.ts](../../src/semanticMatcher.test.ts)
- [src/harnessParser.ts](../../src/harnessParser.ts)
- [progress/impl_semantic-skill-discovery.md](../../progress/impl_semantic-skill-discovery.md)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/semantic-skill-discovery/tasks.md#L8) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts` |
| [T2](../../.kiro/specs/semantic-skill-discovery/tasks.md#L9) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/types.ts`, `src/parserLogic.ts`, `src/harnessParser.ts` |
| [T3](../../.kiro/specs/semantic-skill-discovery/tasks.md#L10) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/WhiteboardCanvas.tsx` |
| [T4](../../.kiro/specs/semantic-skill-discovery/tasks.md#L11) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/EdgeContextMenu.tsx` |
| [T5](../../.kiro/specs/semantic-skill-discovery/tasks.md#L12) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessWriter.ts`, `src/extension.ts` |
| [T6](../../.kiro/specs/semantic-skill-discovery/tasks.md#L13) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts` |
| [T7](../../.kiro/specs/semantic-skill-discovery/tasks.md#L14) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/CustomNode.tsx` |
| [T8](../../.kiro/specs/semantic-skill-discovery/tasks.md#L18) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts`, `src/semanticMatcher.test.ts` |
| [T9](../../.kiro/specs/semantic-skill-discovery/tasks.md#L19) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts`, `src/semanticMatcher.test.ts` |
| [T10](../../.kiro/specs/semantic-skill-discovery/tasks.md#L20) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts`, `src/semanticMatcher.test.ts` |
| [T11](../../.kiro/specs/semantic-skill-discovery/tasks.md#L21) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts`, `src/semanticMatcher.test.ts` |
| [T12](../../.kiro/specs/semantic-skill-discovery/tasks.md#L22) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts`, `src/semanticMatcher.test.ts` |
| [T13](../../.kiro/specs/semantic-skill-discovery/tasks.md#L23) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/semanticMatcher.ts`, `src/semanticMatcher.test.ts` |
| [T14](../../.kiro/specs/semantic-skill-discovery/tasks.md#L27) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/impl_semantic-skill-discovery.md` |
| [T15](../../.kiro/specs/semantic-skill-discovery/tasks.md#L28) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T16](../../.kiro/specs/semantic-skill-discovery/tasks.md#L29) | V | feature_list.json already records this feature as done; no transition performed. | `feature_list.json` |
| [T17](../../.kiro/specs/semantic-skill-discovery/tasks.md#L30) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `progress/progress.md` |
