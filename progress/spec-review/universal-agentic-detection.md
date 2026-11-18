# FEAT-029 — universal-agentic-detection

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Detector pipeline, profileToNodes and AdvisoryPanel implement the current architecture instead of the original layerIntegrator/AgenticProfileTab filenames. No 10,000-file timing evidence was located; mock scan tests do not establish that benchmark.

Evidence sources:

- [src/agentic-detector/agenticDetector.ts](../../src/agentic-detector/agenticDetector.ts)
- [src/agentic-detector/agenticDetector.test.ts](../../src/agentic-detector/agenticDetector.test.ts)
- [src/agentic-detector/signalScanner.test.ts](../../src/agentic-detector/signalScanner.test.ts)
- [src/agentic-detector/profileToNodes.test.ts](../../src/agentic-detector/profileToNodes.test.ts)
- [src/webview/AdvisoryPanel.tsx](../../src/webview/AdvisoryPanel.tsx)
- [src/webview/AdvisoryPanel.test.ts](../../src/webview/AdvisoryPanel.test.ts)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/universal-agentic-detection/tasks.md#L10) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/types.ts`, `src/agentic-detector/types.ts` |
| [T2](../../.kiro/specs/universal-agentic-detection/tasks.md#L11) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/signalCatalog.ts` |
| [T3](../../.kiro/specs/universal-agentic-detection/tasks.md#L12) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/signalScanner.ts`, `.git/` |
| [T4](../../.kiro/specs/universal-agentic-detection/tasks.md#L13) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/signalScanner.ts` |
| [T5](../../.kiro/specs/universal-agentic-detection/tasks.md#L14) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/signalScanner.ts` |
| [T6](../../.kiro/specs/universal-agentic-detection/tasks.md#L18) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/maturityClassifier.ts` |
| [T7](../../.kiro/specs/universal-agentic-detection/tasks.md#L19) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T8](../../.kiro/specs/universal-agentic-detection/tasks.md#L20) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/patternAnalyzer.ts` |
| [T9](../../.kiro/specs/universal-agentic-detection/tasks.md#L21) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T10](../../.kiro/specs/universal-agentic-detection/tasks.md#L22) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/maturityClassifier.ts` |
| [T11](../../.kiro/specs/universal-agentic-detection/tasks.md#L23) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/patternAnalyzer.ts` |
| [T12](../../.kiro/specs/universal-agentic-detection/tasks.md#L27) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/advisoryEngine.ts` |
| [T13](../../.kiro/specs/universal-agentic-detection/tasks.md#L28) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T14](../../.kiro/specs/universal-agentic-detection/tasks.md#L29) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T15](../../.kiro/specs/universal-agentic-detection/tasks.md#L30) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/advisoryEngine.ts` |
| [T16](../../.kiro/specs/universal-agentic-detection/tasks.md#L34) | D | Layer integration is in agenticDetector.ts; named layerIntegrator.ts is absent, so filename absence alone is not missing functionality. | `feature_list.json` |
| [T17](../../.kiro/specs/universal-agentic-detection/tasks.md#L40) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts` |
| [T18](../../.kiro/specs/universal-agentic-detection/tasks.md#L42) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/extension.ts` |
| [T19](../../.kiro/specs/universal-agentic-detection/tasks.md#L44) | D | Registered rescan command is harness-dashboard.rescanAgentic, not the named scanAgenticProfile. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T20](../../.kiro/specs/universal-agentic-detection/tasks.md#L46) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T21](../../.kiro/specs/universal-agentic-detection/tasks.md#L48) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `.agents/agentic.json`, `feature_list.json` |
| [T22](../../.kiro/specs/universal-agentic-detection/tasks.md#L50) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts` |
| [T23](../../.kiro/specs/universal-agentic-detection/tasks.md#L54) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/types.ts` |
| [T24](../../.kiro/specs/universal-agentic-detection/tasks.md#L56) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T25](../../.kiro/specs/universal-agentic-detection/tasks.md#L58) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T26](../../.kiro/specs/universal-agentic-detection/tasks.md#L60) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T27](../../.kiro/specs/universal-agentic-detection/tasks.md#L62) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T28](../../.kiro/specs/universal-agentic-detection/tasks.md#L64) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T29](../../.kiro/specs/universal-agentic-detection/tasks.md#L66) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T30](../../.kiro/specs/universal-agentic-detection/tasks.md#L68) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T31](../../.kiro/specs/universal-agentic-detection/tasks.md#L70) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T32](../../.kiro/specs/universal-agentic-detection/tasks.md#L74) | D | Current view is AdvisoryPanel.tsx, not AgenticProfileTab.tsx. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T33](../../.kiro/specs/universal-agentic-detection/tasks.md#L82) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T34](../../.kiro/specs/universal-agentic-detection/tasks.md#L84) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `.agents/agentic.json`, `feature_list.json` |
| [T35](../../.kiro/specs/universal-agentic-detection/tasks.md#L93) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T36](../../.kiro/specs/universal-agentic-detection/tasks.md#L95) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T37](../../.kiro/specs/universal-agentic-detection/tasks.md#L97) | D | Current AdvisoryPanel tests are not evidence for every original rendered-tab acceptance scenario. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T38](../../.kiro/specs/universal-agentic-detection/tasks.md#L101) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T39](../../.kiro/specs/universal-agentic-detection/tasks.md#L103) | U | No recorded 10,000-file / <5s benchmark located. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T40](../../.kiro/specs/universal-agentic-detection/tasks.md#L105) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T41](../../.kiro/specs/universal-agentic-detection/tasks.md#L107) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/agentic-detector/agenticDetector.ts`, `src/agentic-detector/agenticDetector.test.ts` |
| [T42](../../.kiro/specs/universal-agentic-detection/tasks.md#L109) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
