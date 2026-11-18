# FEAT-025 — enhanced-sdd-panel

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Provider/prompt tests exist, while sidebar/render/save/read-only/model-availability scenarios include manual acceptance steps. Test existence is not a substitute for those scenarios.

Evidence sources:

- [src/sddManagerProvider.ts](../../src/sddManagerProvider.ts)
- [src/sddManagerProvider.test.ts](../../src/sddManagerProvider.test.ts)
- [src/sdd/specPrompts.test.ts](../../src/sdd/specPrompts.test.ts)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L7) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/lmUtils.ts` |
| [T2](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L11) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/extension.ts` |
| [T3](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L12) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T4](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L13) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/extension.ts` |
| [T5](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L14) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `feature_list.json` |
| [T6](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L18) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/SDDManagerPanel.tsx` |
| [T7](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L19) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/webview/styles.ts` |
| [T8](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L23) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `feature_list.json` |
| [T9](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L24) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T10](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L25) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T11](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L26) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T12](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L27) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T13](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L31) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T14](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L32) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T15](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L33) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T16](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L34) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T17](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L35) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
| [T18](../../.kiro/specs/enhanced-sdd-panel/tasks.md#L36) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/sddManagerProvider.ts`, `src/sddManagerProvider.test.ts` |
