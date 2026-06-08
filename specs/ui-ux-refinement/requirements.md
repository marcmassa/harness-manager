# Requirements: ui-ux-refinement (FEAT-006)

## Ubiquitous
R1: The whiteboard SHALL display the `primary` agent node as the root of the hierarchy.
R2: The whiteboard SHALL display all `subagent` nodes registered in `agentic.json`.
R3: The whiteboard SHALL display all `skill` nodes found in the `.agents/skills` directory.
R4: The UI SHALL use `100%` of the available panel height instead of fixed `vh` units.
R5: The system SHALL implement a split-view or adjustable layout to ensure the Detail Panel is visible alongside the whiteboard.

## Event-driven
R6: When a node is selected, the system SHALL ensure the Detail Panel scrolls into view or occupies a fixed portion of the screen.
R7: When the window is resized, the system SHALL call React Flow's `fitView` to re-center the graph.

## State-driven
R8: While the whiteboard is active, the layout SHALL provide a minimum of `200px` vertical space for the Detail Panel when a node is selected.

## Unwanted Behavior
R9: If an agent entry in `agentic.json` points to a non-existent `role_file`, the system SHALL still render the node but SHALL show a warning icon or label.
