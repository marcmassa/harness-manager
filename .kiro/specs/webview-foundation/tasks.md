# Tasks: webview-foundation (FEAT-001)

| Task | Description | Requirements |
| :--- | :--- | :--- |
| **T1** | Initialize `package.json` with metadata, Activity Bar contribution, and commands. | R1, R2 | [x]
| **T2** | Set up `tsconfig.json` and basic project structure (`src/`, `src/webview/`). | R3 | [x]
| **T3** | Install dependencies (`vscode`, `react`, `@vscode/webview-ui-toolkit`, `esbuild`). | R3, R4 | [x]
| **T4** | Implement the `esbuild` build script for EH and Webview. | R3, R10 | [x]
| **T5** | Implement the `WebviewProvider` class and Extension entry point. | R5, R9 | [x]
| **T6** | Implement the React frontend entry point and messaging bridge. | R6, R8 | [x]
| **T7** | Create a "Hello Harness" component using the UI Toolkit. | R7 | [x]
| **T8** | Add an integration test to verify the Webview opens and receives the `init` message. | R6, R7 | [x]
| **T9** | Run `./check.sh` and verify environment consistency. | R10 | [x]

