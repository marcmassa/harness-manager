# FEAT-027 — code-quality-on-save-hooks

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Scripts live under .kiro/hooks rather than the old hooks path. blockOnSave awaits work before event.waitUntil and supplies an empty edit list; neither establishes save cancellation. Manual blocking acceptance remains unverified.

Evidence sources:

- [src/verifier/codeQualitySetup.ts](../../src/verifier/codeQualitySetup.ts)
- [src/verifier/codeQualityRunner.ts](../../src/verifier/codeQualityRunner.ts)
- [src/verifier/codeQualityRunner.test.ts](../../src/verifier/codeQualityRunner.test.ts)
- [.kiro/hooks/kiss_check.py](../../.kiro/hooks/kiss_check.py)
- [.kiro/hooks/dry_check.py](../../.kiro/hooks/dry_check.py)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T1](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L7) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T2](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L11) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T3](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L12) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `.kiro/hooks/kiss_check.py` |
| [T4](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L13) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T5](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L17) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T6](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L18) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `.kiro/hooks/dry_check.py` |
| [T7](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L19) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T8](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L23) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualityRunner.ts` |
| [T9](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L24) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualityRunner.test.ts` |
| [T10](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L28) | G | Async onWillSave listener calls waitUntil after await; [] is an empty edit list, not evidence of cancellation. | `src/extension.ts` |
| [T11](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L29) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/extension.ts` |
| [T12](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L30) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T13](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L34) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T14](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L35) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/extension.ts` |
| [T15](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L39) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T16](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L40) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T17](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L41) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T18](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L42) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T19](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L43) | M | Blocking-save acceptance must be demonstrated; current implementation does not establish it. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T20](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L44) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
| [T21](../../.kiro/specs/code-quality-on-save-hooks/tasks.md#L45) | M | Requires the specified UI/environment scenario; unit tests do not substitute for it. | `src/verifier/codeQualitySetup.ts`, `src/verifier/codeQualityRunner.ts` |
