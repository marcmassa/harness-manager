# Requirements: harness-parser (FEAT-002)

## Ubiquitous
R1: The system SHALL implement a `HarnessParser` service in the Extension Host.
R2: The system SHALL parse `.agents/agentic.json` to extract the primary agent and sub-agents configuration.
R3: The system SHALL parse `.agents/subagents/**/SUBAGENT.md` files to extract missions and metadata for each sub-agent.
R4: The system SHALL parse `.agents/skills/**/SKILL.md` files to identify available skills and their descriptions.
R5: The system SHALL parse `feature_list.json` to extract the current list of features and their statuses.

## Event-driven
R6: When requested by the Webview, the system SHALL return a unified `HarnessGraph` object containing Nodes (Agents, Skills, Features) and Edges (Relationships).
R7: When a file in `.agents/` or `feature_list.json` is modified, the system SHALL re-parse the data and notify the Webview.

## State-driven
R8: While parsing Markdown files, the system SHALL extract the Frontmatter and use it as part of the node's metadata.

## Unwanted Behavior
R9: If a required file (like `agentic.json`) is missing or invalid, the system SHALL return an error message to the Webview instead of crashing.
R10: The system SHALL NOT include the `_template_*` or scaffolded entries in the final graph data unless specifically requested.
