# Requirements: progress-timeline (FEAT-005)

## Ubiquitous
R1: The system SHALL parse the `progress/progress.md` file to extract historical milestones.
R2: The system SHALL parse the `feature_list.json` to identify current feature statuses and their positions in the SDD lifecycle.
R3: The system SHALL render a vertical or horizontal timeline in the Webview Dashboard.

## Event-driven
R4: When the user switches to the "Timeline" view, the system SHALL display a chronological sequence of completed features.
R5: When a milestone is clicked, the system SHALL display the detailed log entry from `progress.md`.

## State-driven
R6: While features are in different states (pending, done), the system SHALL use distinct colors or markers to represent their status in the timeline.
R7: The system SHALL highlight the "Current Sprint" or "Current Feature" as the active point in the timeline.

## Unwanted Behavior
R8: If `progress.md` is empty or malformed, the system SHALL display a basic timeline based on `feature_list.json` status alone.
R9: The system SHALL NOT attempt to render more than 50 historical entries at once to ensure performance (implementing pagination or "Load More" if necessary).
