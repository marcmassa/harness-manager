# FEAT-023 — adapter-config-paths-and-kiro-and-whiteboard-polish

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Registry/Kiro/overlap unit tests exist. detectAndFixOverlaps reads metadata._position at parse time; parser comments and implementation report say these coordinates are absent then. Actual canvas collision prevention is not established by that unit test.

Evidence sources:

- [src/adapters/ConfigurationRegistry.ts](../../src/adapters/ConfigurationRegistry.ts)
- [src/adapters/ConfigurationRegistry.test.ts](../../src/adapters/ConfigurationRegistry.test.ts)
- [src/adapters/KiroAdapter.test.ts](../../src/adapters/KiroAdapter.test.ts)
- [src/parserLogic.test.ts](../../src/parserLogic.test.ts)
- [progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md](../../progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T0](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L12) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `src/adapters/ConfigurationRegistry.ts` |
| [T1](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L18) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/ConfigurationRegistry.ts` |
| [T2](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L29) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/IAgentAdapter.ts` |
| [T3](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L35) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/index.ts` |
| [T4](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L41) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/ConfigurationRegistry.ts`, `src/adapters/ConfigurationRegistry.test.ts` |
| [T5](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L50) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `package.json` |
| [T6](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L56) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/ConfigurationRegistry.test.ts`, `src/adapters/adapterRegistry.test.ts` |
| [T7](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L62) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/adapterRegistry.test.ts` |
| [T8](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L69) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/KiroAdapter.ts` |
| [T9](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L82) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/index.ts` |
| [T10](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L88) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/frameworks.ts` |
| [T11](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L91) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `README.md` |
| [T12](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L102) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/KiroAdapter.test.ts` |
| [T13](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L109) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `README.md` |
| [T14](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L116) | D | Pure overlap utility exists, but parser has no canvas coordinates at this point. | `src/parserLogic.ts` |
| [T15](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L128) | D | Parser call is explicitly documented as a no-op without metadata._position. | `src/adapters/ConfigurationRegistry.ts`, `src/adapters/ConfigurationRegistry.test.ts` |
| [T16](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L132) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/parserLogic.test.ts` |
| [T17](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L140) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/WhiteboardCanvas.tsx` |
| [T18](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L144) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/CustomNode.tsx` |
| [T19](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L150) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/index.tsx` |
| [T20](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L159) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `./check.sh` |
| [T21](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L164) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/ConfigurationRegistry.ts`, `src/adapters/ConfigurationRegistry.test.ts` |
| [T22](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L167) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/adapters/ConfigurationRegistry.ts`, `src/adapters/ConfigurationRegistry.test.ts` |
| [T23](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L175) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md` |
| [T24](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L179) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `docs/configuration.md` |
| [T25](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L187) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/backlog.md` |
| [T26](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L198) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T27](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L200) | V | feature_list.json already records this feature as done; no transition performed. | `feature_list.json` |
| [T28](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L202) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `progress/progress.md` |
| [T29](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L205) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/current.md` |
| [T30](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L206) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `src/adapters/ConfigurationRegistry.ts`, `src/adapters/ConfigurationRegistry.test.ts` |
| [T31](../../.kiro/specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md#L211) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `src/adapters/ConfigurationRegistry.ts`, `src/adapters/ConfigurationRegistry.test.ts` |
