# FEAT-009 — relationship-editor-md-viewer-side-panel

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Writer-named tests import parserLogic and reconstruct input; they do not invoke writer persistence or click the UI. Do not equate their pass with deletion/save integration coverage.

Evidence sources:

- [src/harnessWriter.ts](../../src/harnessWriter.ts)
- [src/harnessWriter.test.ts](../../src/harnessWriter.test.ts)
- [src/harnessParser.ts](../../src/harnessParser.ts)
- [src/coordinators/WhiteboardCoordinator.ts](../../src/coordinators/WhiteboardCoordinator.ts)
- [src/webview/components/EntitySidePanel.tsx](../../src/webview/components/EntitySidePanel.tsx)
- [progress/impl_feat-009.md](../../progress/impl_feat-009.md)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L7) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/types.ts` |
| [T2](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L8) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessWriter.ts` |
| [T3](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L9) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessParser.ts` |
| [T4](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L10) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/extension.ts` |
| [T5](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L11) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/EdgeContextMenu.tsx` |
| [T6](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L12) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/MDViewer.tsx` |
| [T7](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L13) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/components/EntitySidePanel.tsx` |
| [T8](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L14) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/WhiteboardCanvas.tsx` |
| [T9](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L15) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/index.tsx` |
| [T10](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L19) | G | Parser-only test does not exercise harnessWriter.deleteEdge persistence. | `src/harnessWriter.ts`, `src/harnessWriter.test.ts` |
| [T11](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L20) | G | Parser-only test does not exercise harnessWriter.updateEdgeLabel persistence. | `src/harnessWriter.ts`, `src/harnessWriter.test.ts` |
| [T12](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L21) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessWriter.ts`, `src/harnessWriter.test.ts` |
| [T13](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L22) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessWriter.ts`, `src/harnessWriter.test.ts` |
| [T14](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L23) | U | No dedicated rendered EdgeContextMenu test located. | `src/harnessWriter.ts`, `src/harnessWriter.test.ts` |
| [T15](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L24) | U | No full click-confirm-persist-rebuild test located. | `src/harnessWriter.ts`, `src/harnessWriter.test.ts` |
| [T16](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L25) | U | No full MD-viewer DOM integration test located. | `src/harnessWriter.ts`, `src/harnessWriter.test.ts` |
| [T21](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L29) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/harnessWriter.ts`, `src/harnessWriter.test.ts` |
| [T17](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L35) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/impl_feat-009.md` |
| [T18](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L36) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T19](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L37) | V | feature_list.json already records this feature as done; no transition performed. | `feature_list.json` |
| [T20](../../.kiro/specs/relationship-editor-md-viewer-side-panel/tasks.md#L38) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `progress/progress.md` |
