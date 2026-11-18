# Real-workspace adapter results — 2026-11-19

Run of the [smoke procedure](adapter-capabilities.md#real-workspace-smoke-procedure) for the seven advertised adapters. FEAT-041 T4.

## How it was run

- Dashboard: branch `spec/byoh-0.9-advisory-optimizer` after `d446cb5` (FEAT-041 T3), development bundle.
- Host: VS Code 1.147.0, darwin-arm64, through `@vscode/test-electron`.
- Each source was copied to a disposable folder (no `.git`, no `.env`) and opened as the only workspace folder. Command: `HARNESS_FIELD_ROOT=<folder of copies> npm run test:integration` (suite `src/test/integration/fieldValidation.ts`).
- Each run parses twice through the production `AdapterRegistry`/`HarnessParser`, runs an Advisory scan, stats the entity's source URI, and compares SHA-256 hashes of every file before and after.
- Scripted, not clicked. The webview steps (locate the entity on the canvas, open its source from the detail panel) were not performed by hand. The data those steps display was checked: graph node, owner, source URI and Advisory evidence.

| Adapter | Source (ref) | Expected native input | Entity found | Owned nodes | Source opens | Stable on rescan | In Advisory | Files unchanged | Result |
|---|---|---|---|---|---|---|---|---|---|
| Harness SDD | harness-sdd-template, local `83d5ff3` | a subagent declared in `.agents/agentic.json` | `templates` → `.agents/subagents/templates/SUBAGENT.md` | 24 | yes | yes | yes | yes | pass |
| Claude Code | harness-sdd-template, local `83d5ff3` | `CLAUDE.md` | `claude-code::root` → `CLAUDE.md` | 8 | yes | yes | yes | yes | pass |
| Gemini CLI | harness-sdd-template, local `83d5ff3` | `GEMINI.md` | `gemini-cli::root` → `GEMINI.md` | 14 | yes | yes | yes | yes | pass |
| OpenCode | harness-sdd-template, local `83d5ff3` | `opencode.json` | `opencode::root` → `opencode.json` | 1 | yes | yes | yes | yes | pass |
| Kiro | harness-manager `990470d` (`git archive .kiro`) | a Markdown steering document under `.kiro/steering` | `steering-kiro-typescript-implementer` → `.kiro/steering/typescript-implementer.md` | 11 | yes | yes | yes | yes | pass |
| Cursor | [cursor-agents](https://github.com/farhaanshareef/cursor-agents) `dde1e14` (shallow clone) | `.cursor/rules/test-strategy.rules.mdc` | `cursor::test-strategy-rules` → that file | 28 | yes | yes | yes | yes | pass |
| Copilot | [microsoft/vscode](https://github.com/microsoft/vscode) `adc7e24` (shallow, sparse `.github`) | `.github/copilot-instructions.md` | `copilot::root` → that file | 32 | yes | yes | yes | yes | pass |

## Observations

- **Nested roots.** A first attempt parsed each copy as a subfolder of one shared workspace folder. Harness SDD, Kiro and Cursor then reported paths prefixed with the subfolder name (`harness-sdd-template/.agents/...`), and their source URIs did not resolve. `toRelativePath` uses `vscode.workspace.asRelativePath`, which is relative to the containing workspace folder rather than the parsed root. Single-folder workspaces, which are the only kind the extension activates on today, are unaffected. Multi-root support must resolve paths against the parsed root. This is recorded in the backlog.
- The Harness SDD template's `.agents/subagents/templates/` folder is reported as a subagent named `templates`. Whether that folder is a real role is a question about the template, not about discovery.
- The Dashboard writes nothing during these runs. The before and after hash manifests are identical for every source.
