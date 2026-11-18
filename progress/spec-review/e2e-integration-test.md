# FEAT-021 — e2e-integration-test

Reviewed 2026-11-17 against main 990470d + PR #30. [Classification key](README.md).

Current macOS launch issue is resolved. The critical-path test directly opens/shows the fixture document; it does not drive a webview node click. Passing e2e is not proof of that specified UI interaction.

Evidence sources:

- [src/test/integration/criticalPath.test.ts](../../src/test/integration/criticalPath.test.ts)
- [src/test/integration/runIntegrationTests.ts](../../src/test/integration/runIntegrationTests.ts)
- [progress/impl_e2e-integration-test.md](../../progress/impl_e2e-integration-test.md)
- [docs/security/2026-11-16-maintenance.md](../../docs/security/2026-11-16-maintenance.md)

## Task dispositions

Source task links retain the complete acceptance text. E is evidence navigation, **not a completion claim**.

| Task | Class | Finding / next verification | Evidence location |
|---|---|---|---|
| [T0](../../.kiro/specs/e2e-integration-test/tasks.md#L8) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
| [T1](../../.kiro/specs/e2e-integration-test/tasks.md#L14) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
| [T2](../../.kiro/specs/e2e-integration-test/tasks.md#L19) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
| [T3](../../.kiro/specs/e2e-integration-test/tasks.md#L25) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `design.md`, `src/test/fixtures/harness-sdd-minimal/.agents/subagents/demo-subagent/SUBAGENT.md`, `.agents/subagents/spec-author-vscode/SUBAGENT.md` |
| [T4](../../.kiro/specs/e2e-integration-test/tasks.md#L30) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/test/integration/runIntegrationTests.ts`, `src/test/integration/criticalPath.test.ts`, `dist/extension.cjs` |
| [T5](../../.kiro/specs/e2e-integration-test/tasks.md#L36) | D | Current critical path uses fixture/document ground truth rather than actual node DOM click. | `src/test/integration/criticalPath.test.ts`, `design.md` |
| [T6](../../.kiro/specs/e2e-integration-test/tasks.md#L41) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `vitest.config.ts`, `src/test/integration/criticalPath.test.ts` |
| [T7](../../.kiro/specs/e2e-integration-test/tasks.md#L47) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `.github/workflows/ci.yml`, `design.md` |
| [T8](../../.kiro/specs/e2e-integration-test/tasks.md#L57) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
| [T9](../../.kiro/specs/e2e-integration-test/tasks.md#L62) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
| [T10](../../.kiro/specs/e2e-integration-test/tasks.md#L67) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
| [T11](../../.kiro/specs/e2e-integration-test/tasks.md#L70) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
| [T12](../../.kiro/specs/e2e-integration-test/tasks.md#L73) | U | Intentional failing integration-test experiment was not rerun. | `src/extension.ts` |
| [T13](../../.kiro/specs/e2e-integration-test/tasks.md#L79) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
| [T14](../../.kiro/specs/e2e-integration-test/tasks.md#L88) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/impl_e2e-integration-test.md` |
| [T15](../../.kiro/specs/e2e-integration-test/tasks.md#L92) | E | Related source/test/report found; complete acceptance of every clause is not established by static location. | `progress/backlog.md`, `feature_list.json` |
| [T16](../../.kiro/specs/e2e-integration-test/tasks.md#L101) | V | Current build / 819-test suite / packaging / 36-check verification; see summary. | `./check.sh` |
| [T17](../../.kiro/specs/e2e-integration-test/tasks.md#L103) | V | feature_list.json already records this feature as done; no transition performed. | `feature_list.json` |
| [T18](../../.kiro/specs/e2e-integration-test/tasks.md#L105) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `progress/progress.md` |
| [T19](../../.kiro/specs/e2e-integration-test/tasks.md#L108) | U | Maintainer-notification/issue evidence is not established by local test success. | `progress/impl_e2e-integration-test.md`, `.github/workflows/ci.yml` |
| [T20](../../.kiro/specs/e2e-integration-test/tasks.md#L116) | H | Historical action or pre-change state; current files cannot certify it retroactively. | `src/test/integration/criticalPath.test.ts`, `src/test/integration/runIntegrationTests.ts` |
