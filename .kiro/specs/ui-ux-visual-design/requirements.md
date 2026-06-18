# Requirements: ui-ux-visual-design (FEAT-008)

## Ubiquitous
R1: The system SHALL apply a consistent spacing scale (4px, 8px, 16px, 24px) across all webview components.
R2: The system SHALL distinguish node types visually through shape and color: agent (square, accent border), subagent (rounded rect, button bg), skill (pill shape, remote accent), feature (badge style).
R3: The system SHALL display edge labels with distinct visual styling per relationship type: "manages" (solid), "uses" (dashed), "executing" (animated dots).
R4: The system SHALL show a hover scale effect (transform: scale(1.03)) on all interactive nodes.
R5: The system SHALL provide an empty state illustration when no milestones exist in the timeline.
R6: The system SHALL apply CSS variable theming for all colors (`--vscode-*`) to support Light, Dark, and High Contrast themes.

## Event-driven
R7: When a node is selected, the system SHALL display a focus ring using `--vscode-focusBorder` with a smooth transition.
R8: When the detail panel opens, the system SHALL show a slide-up animation and a close button with icon.
R9: When creating an edge via the "+" dropdown, the system SHALL visually confirm the action with a brief edge highlight animation.

## State-driven
R10: While the whiteboard is loading (no data), the system SHALL display a centered skeleton or progress indicator.

## Unwanted Behavior
R11: If the theme changes dynamically, the system SHALL NOT require a page refresh to apply new CSS variable values.
