# Requirements: webview-foundation (FEAT-001)

## Ubiquitous
R1: The extension SHALL register a unique Activity Bar icon for the "Harness Manager".
R2: The extension SHALL contribute a `harness-manager.openDashboard` command to the VS Code Command Palette.
R3: The system SHALL use `esbuild` to bundle both the Extension Host (TypeScript) and the Webview (React) code.
R4: The system SHALL include the `@vscode/webview-ui-toolkit` for all UI components to ensure a native look and feel.

## Event-driven
R5: When the user clicks the Activity Bar icon, the system SHALL open a new Webview panel titled "Harness Dashboard".
R6: When the Webview panel is initialized, the system SHALL send an `init` message from the Extension Host to the React frontend.
R7: When the React frontend receives an `init` message, the system SHALL render a "Hello Harness" message using the `VSCodeHeading` component.

## State-driven
R8: While the Webview panel is visible, the system SHALL maintain an active message port for two-way communication.

## Unwanted Behavior
R9: If the user attempts to open the dashboard while it is already visible, the system SHALL reveal the existing panel instead of creating a new one.
R10: If the bundling process fails for either the Extension Host or the Webview, the system SHALL report an error and SHALL NOT proceed with the extension execution.
