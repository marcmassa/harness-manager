# Adapter capabilities and source ownership

This is the target contract for the next implementation specs. Today the parser and detector each construct an AdapterRegistry. Both must see the same registrations and disposals before the extension exposes a public API. The current IAgentAdapter reads files. Writes, CLI launches and validations have separate call paths.

## Coverage baseline

Source review of src/adapters, src/discovery/hooksAndSteering.ts, src/harnessWriter.ts and src/run/adapters at 990470d. The table records available behavior. Real-workspace verification is tracked separately. Discovery covers the signatures listed below. Hooks and steering mean observation. Commands means reading definitions. Editing means a Dashboard write back to a native format. Validation means validating that harness's native configuration.

| Adapter | Discovery | Hooks | Steering | Commands | Agent runs | Editing | Validation |
|---|---|---|---|---|---|---|---|
| harness-sdd | supported | supported | supported | unsupported | unsupported | partial | unsupported |
| claude-code | supported | partial | partial | unsupported | partial | partial | unsupported |
| gemini-cli | supported | partial | partial | partial | partial | partial | unsupported |
| cursor | supported | partial | partial | unsupported | unsupported | partial | unsupported |
| copilot | supported | partial | partial | unsupported | unsupported | partial | unsupported |
| opencode | partial | unsupported | unsupported | unsupported | unsupported | unsupported | unsupported |
| kiro | partial | partial | partial | unsupported | unsupported | partial | unsupported |
| windsurf | partial | partial | partial | unsupported | unsupported | partial | unsupported |

FEAT-041 T3 implements this table in `src/adapters/capabilities.ts` and the operation list in `src/operations/operations.ts`; a unit test keeps both equal to this page. Editing for the file-based formats other than Harness SDD is `partial` because they accept only `editing.reviewedTextEdit`: an Optimizer fix shown as a diff and confirmed before it lands. Structural writes (create, delete, link, relabel, lifecycle) exist only for Harness SDD; a relationship between owners that cannot persist it stays view data. Profiles declare no operation.

Harness SDD reads declared manifest hooks and steering. Its writer covers specific entities and links. Claude and Gemini terminal runners additionally need an installed CLI and a compatible target. Gemini imports TOML commands as skills. Cursor reads MDC rules, Copilot reads instructions and prompts, Kiro reads Markdown agents and skills, and legacy Windsurf reads rules. The shared directory scanner covers only its supported extensions and configured paths. OpenCode reads the root JSON/JSONC and a subagents array. These limits matter when a native format has other representations.

## Action contract

A provider declares a stable ID, seven capability levels and a list of implemented operations. A supported capability covers the documented operation set. Partial support lists exactly which operations work and their prerequisites. Unsupported capabilities have no callable operations. Examples include hooks.list, commands.read, editing.linkSkill and agentRuns.launch. The UI reads these declarations and the host rechecks the target owner, workspace root, operation and prerequisites at dispatch. For a mixed selection, evaluate each affected source. Preserve provenance as (workspace URI, adapter ID, native entity ID, source URI). Identity must survive rescan. Ambiguous or missing ownership makes a mutation unavailable. Keep a single source visible with multiple provider attributions where appropriate.

## Profile v1 proposal

An optional entry in .harness-dashboard/config.json describes a native Markdown layout. An example profile follows.

```json
{"profiles":[{"version":1,"id":"team-guides","label":"Team guides",
  "markers":["team/agents/index.md"],
  "entities":[{"glob":"team/agents/*.md","type":"agent","idField":"id","labelField":"title"},
              {"glob":"team/skills/*.md","type":"skill","idField":"id","labelField":"title"}],
  "relationships":[{"fromType":"agent","field":"skills","toType":"skill","label":"uses"}]}]}
```

An entity may also declare `loadMode` (`always`, `on-trigger`, `delegated`, `on-event`, `manual`); omitting it keeps the profile valid and the resources `unknown` (FEAT-044). A companion declares the same per node as `metadata._loadMode`.

Match a marker under the current workspace folder, parse frontmatter with the existing reader, then resolve references within that profile. Reject paths outside the root, including resolved symlink targets. Report duplicate native IDs, unknown versions and unresolved references with their source URI. Skip the affected entry and keep other providers available. The profile only describes reads. Scans must be cancellable and bounded. Existing adapters and extraPaths fields retain their meanings.

## Companion extension API v1 proposal

Activation exports apiVersion 1 and registerAdapter(provider), returning a disposable. The provider supplies id, label, capabilities, detect(root), parse(root) and watchGlobs(). Use the current ParserResult shape with explicit source ownership and isolate errors per provider. Reject ID collisions. On disposal remove watches and invalidate affected results in both consumers. An extension implements this contract as installed code. A workspace profile cannot name a JS module to load. A future write or run provider needs an independently reviewed operation contract. Never infer write permission from a successful read.

## Real-workspace smoke procedure

Use a disposable copy of each source below. Record its upstream/ref and commit, plus hashes for untracked marker files. Before launch record the expected entity from the native file and a file manifest. In an Extension Development Host open that folder, show Harness Dashboard, rescan, locate the expected entity, inspect its owner and open its source. Repeat the scan and check stable identity, unchanged files and absence of hook execution. Repeat with two source sets in the same root. Record actual results, Dashboard commit, host version and evidence. Fixtures in adapterRegistry.test.ts exercise regression paths separately.

| Advertised adapter | Representative source for a run | Expected native input |
|---|---|---|
| Harness SDD | harness-sdd-template, local checkout 83d5ff3 | .agents/agentic.json and a declared subagent |
| Claude Code | harness-sdd-template working copy | rendered CLAUDE.md (record file hash separately) |
| Gemini CLI | harness-sdd-template working copy | rendered GEMINI.md (record file hash separately) |
| OpenCode | harness-sdd-template working copy at 83d5ff3 | local opencode.json (record file hash separately) |
| Kiro | harness-manager at 990470d | .kiro/steering and a tracked Markdown steering document. JSON hook declarations alone do not establish script discovery. |
| Cursor | [cursor-agents](https://github.com/farhaanshareef/cursor-agents) | .cursor/rules/test-strategy.rules.mdc |
| Copilot | [VS Code](https://github.com/microsoft/vscode) | .github/copilot-instructions.md |

Local rendered examples exercise real mixed workspaces. Also exercise a foreign-only root before asserting independence from Harness SDD. Pin and confirm the public samples before recording results. This table specifies runs, not passes.
