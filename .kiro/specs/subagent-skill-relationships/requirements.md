# Requirements: subagent-skill-relationships (FEAT-007)

## Ubiquitous
R1: The system SHALL display edges between subagent nodes and their associated skill nodes in the whiteboard.
R2: The system SHALL read subagent-skill relationships from the `skills` array in each subagent entry in `.agents/agentic.json`.
R3: The system SHALL read subagent-skill relationships from the `## Skills` section in each `SUBAGENT.md` file.
R4: The whiteboard layout SHALL position subagent nodes at a higher rank (north/above) than their skill nodes.

## Event-driven
R5: When the webview receives updated graph data, the system SHALL render edges labeled "uses" from subagents to skills.
R6: When a subagent has no skills defined, the system SHALL still render the subagent node without skill edges.

## State-driven
R7: While the whiteboard is active, the system SHALL maintain the hierarchical layout with primary agent (rank 0) → subagents (rank 1) → skills (rank 2) → features (rank 3).

## Unwanted Behavior
R8: If a skill referenced in `agentic.json` or `SUBAGENT.md` does not exist as a skill node, the system SHALL NOT create a broken edge but SHALL log a warning.
R9: The system SHALL NOT duplicate edges if the same relationship is defined in both `agentic.json` and `SUBAGENT.md`.