# Requirements: graph-editor (FEAT-004)

## Ubiquitous
R1: The system SHALL allow users to create new `subagent` and `skill` nodes directly from the whiteboard UI.
R2: The system SHALL allow users to delete existing `subagent` and `skill` nodes from the whiteboard UI.
R3: The system SHALL allow users to create connections (edges) between `agent` and `subagent` or `subagent` and `skill`.
R4: The system SHALL implement a persistence layer to write visual changes back to the local file system.

## Event-driven
R5: When a new `subagent` node is created, the system SHALL update `.agents/agentic.json` and create a corresponding `.agents/subagents/<name>/SUBAGENT.md` file.
R6: When a new `skill` node is created, the system SHALL create a corresponding `.agents/skills/<name>/SKILL.md` file.
R7: When an edge is created between a `subagent` and a `skill`, the system SHALL update the sub-agent's configuration to include the skill (e.g., via `agentic.json` or steering metadata).
R8: When a node is deleted, the system SHALL remove its entry from `.agents/agentic.json` and optionally archive/delete its Markdown file after a confirmation.

## State-driven
R9: While editing a node's metadata (e.g., mission or description), the system SHALL provide an inline form or a sidebar editor.
R10: While a connection is being dragged, the system SHALL highlight valid target nodes based on Harness relationship rules.

## Unwanted Behavior
R11: The system SHALL NOT allow creating circular dependencies between agents.
R12: The system SHALL NOT allow deleting the `primary` agent node.
R13: If a file write operation fails, the system SHALL show an error message and SHALL NOT update the whiteboard state.
