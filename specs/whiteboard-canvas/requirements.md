# Requirements: whiteboard-canvas (FEAT-003)

## Ubiquitous
R1: The system SHALL integrate the `reactflow` library into the React Webview.
R2: The system SHALL render `agent` nodes with a distinct visual style (e.g., specific color or icon).
R3: The system SHALL render `subagent` nodes with a distinct visual style.
R4: The system SHALL render `skill` nodes with a distinct visual style.
R5: The system SHALL render `feature` nodes with a distinct visual style.
R6: The system SHALL render edges between nodes to represent "manages" or "uses" relationships.

## Event-driven
R7: When the Webview receives the `HarnessGraph` data, the system SHALL transform it into React Flow's `nodes` and `edges` format.
R8: When a node is selected, the system SHALL display its metadata (mission, description) in a detail panel or tooltip.

## State-driven
R9: While the whiteboard is active, the system SHALL allow users to pan and zoom the canvas.
R10: The system SHALL implement an automatic layout (e.g., using `dagre`) to position nodes if no coordinates are provided.

## Unwanted Behavior
R11: If the graph data is empty, the system SHALL display a "No Harness data found" placeholder message.
