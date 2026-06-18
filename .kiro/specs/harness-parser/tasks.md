# Tasks: harness-parser (FEAT-002)

| Task | Description | Requirements |
| :--- | :--- | :--- |
| **T1** | Install `gray-matter` for Markdown frontmatter parsing. | R3, R4, R8 | [x]
| **T2** | Define the `HarnessGraph` and `Node/Edge` TypeScript interfaces. | R6 | [x]
| **T3** | Implement `JSON` parsing logic for `agentic.json` and `feature_list.json`. | R2, R5, R9 | [x]
| **T4** | Implement `Markdown` parsing logic for Sub-agents and Skills. | R3, R4, R8 | [x]
| **T5** | Implement the graph constructor that links Agents to their Sub-agents and Skills. | R6, R10 | [x]
| **T6** | Integrate the parser into `HarnessDashboardProvider` to handle `getData` requests. | R6 | [x]
| **T7** | Set up `FileSystemWatcher` to trigger data updates on file changes. | R7 | [x]
| **T8** | Add unit tests for the parser with mock file contents. | R1, R9 | [x]
| **T9** | Verify traceability and run `./check.sh`. | R1-R10 | [x]

