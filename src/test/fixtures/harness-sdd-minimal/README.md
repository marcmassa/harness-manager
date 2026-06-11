# Harness SDD — Minimal fixture (E2E test)

This directory is a **fixture workspace** used by the
end-to-end integration test introduced in FEAT-021. It is a
deliberately tiny Harness SDD project:

- one agent (declared implicitly via `agentic.json`),
- one subagent (`demo-subagent`),
- one `done` feature (so the timeline view has something to
  render).

Do not expand this fixture unless the integration test in
`src/test/integration/criticalPath.test.ts` grows. The whole
point of the fixture is to be **the smallest possible
workspace** that exercises the critical user path. A larger
fixture would slow the test down and add maintenance burden.

## Files

- `.agents/agentic.json` — declares the subagent.
- `.agents/subagents/demo-subagent/SUBAGENT.md` — the
  subagent's source. The integration test opens this file
  in a VS Code text editor (assertion R9/R10).
- `feature_list.json` — one `done` feature, so the parser
  reports a non-empty graph.

## Running the integration test against this fixture

```bash
# from the repository root
npm run test:integration
```

The test is wired to point `vscode.workspace.rootPath` at this
directory via `@vscode/test-electron`'s `launchArgs`.
