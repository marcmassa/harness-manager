# Tasks: subagent-skill-relationships (FEAT-007)

| Task | Description | Requirements |
| :--- | :--- | :--- |
| **T1** | Add `skills` array to each subagent in `.agents/agentic.json` with their associated skill IDs. | R2 | [x] |
| **T2** | Add `## Skills` section to each `SUBAGENT.md` file listing the skills that subagent uses. | R3 | [x] |
| **T3** | Update `parserLogic.ts` to deduplicate edges (same source, target, label) when creating from both sources. | R9 | [x] |
| **T4** | Update `parserLogic.ts` to validate target skill node exists before creating edge; log warning if missing. | R8 | [x] |
| **T5** | Verify `layoutUtils.ts` correctly positions subagents (rank 1) above skills (rank 2). | R4, R7 | [x] |
| **T6** | Add feature_list.json features to timeline as milestones with status indicators. | R1, R5, R6 | [x] |
| **T7** | Fix `createEdge` to persist skill-subagent links to both agentic.json and SUBAGENT.md. | R2, R3 | [x] |
| **T8** | Fix `_sendData()` to be called immediately after all write mutations. | R1 | [x] |
| **T9** | Add "+" button on agent/subagent nodes with inline dropdown to select and link skills. | R1, R5 | [x] |
| **T10** | Run `./check.sh` and perform visual validation. | R1-R9 | [x] |

## Skill Mapping for Current Project

Based on the SUBAGENT.md files and available skills:

| Subagent | Skills (from agentic.json + SUBAGENT.md) |
| :--- | :--- |
| `harness-vscode` | `harness-sdd` |
| `spec-author-vscode` | `ears-requirements`, `vscode-extension-best-practices` |
| `typescript-implementer` | `vscode-extension-best-practices` |
| `reviewer-vscode` | (none explicitly, but could use `harness-sdd` for check.sh validation) |

Available skills in `.agents/skills/`:
- `harness-sdd`
- `ears-requirements`
- `vscode-extension-best-practices`
- `ui-ux-design-standards`