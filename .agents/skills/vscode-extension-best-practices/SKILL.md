# Skill: VS Code Extension Best Practices (2026 Edition)

This skill provides the architectural, performance, and AI-integration standards for developing high-quality VS Code extensions in 2026.

## 1. Architectural Standards

### Modern Tooling
- **Bundler:** Use `esbuild` for builds. It is faster and produces smaller bundles than Webpack.
- **TypeScript:** Use TypeScript 5.x+ with `strict: true`. Leverage Template Literal Types for command IDs and the `satisfies` operator for configuration.
- **Testing:**
  - **Unit Tests:** Use `Vitest` for fast, logic-only tests.
  - **Integration Tests:** Use `@vscode/test-electron` for actual VS Code API testing.

### Performance & Lifecycle
- **Activation Events:** Be surgical. Use specific events like `onCommand`, `onLanguage`, or `onFileSystem` instead of `*`.
- **Lazy Loading:** Keep activation time < 500ms. Use dynamic `import()` or `require()` inside command handlers, not at the top level.
- **Disposables:** Always register every disposable (`commands.registerCommand`, `window.createStatusBarItem`, etc.) in `context.subscriptions`.

## 2. AI & Agentic Integration

### Language Model API (`vscode.lm`)
- Use the built-in `vscode.lm` API to interact with AI models. This respects user privacy, uses their preferred model, and requires no custom API keys.

### Chat Participants
- If the extension provides complex logic or assistance, register as a `ChatParticipant`. This allows users to trigger your extension's logic via `@extensionName` in the Copilot Chat.

### Context Providers
- Use `vscode.chat.registerChatVariableResolver` to feed custom workspace context (e.g., specific file patterns, documentation) to the chat models.

## 3. User Experience (UX)

### Native Look & Feel
- Use the **@vscode/webview-ui-toolkit** for all Webview-based UIs.
- Respect the user's theme. Never hardcode colors; use CSS variables (e.g., `var(--vscode-editor-background)`).

### Feedback & Logging
- **Progress:** Use `vscode.window.withProgress` for operations taking > 1s.
- **Logging:** Use `vscode.window.createOutputChannel({ log: true })`. This provides a standard log view with severity filtering.

## 4. Security & Workspace Trust

### Secrets Storage
- Never use `globalState` or `.env` for user tokens/keys. Always use `vscode.SecretStorage`.

### Workspace Trust
- Declare your extension's trust requirements in `package.json`. Handle cases where the workspace is untrusted gracefully by disabling sensitive features.

## 5. Implementation Checklist

- [ ] `strict: true` in `tsconfig.json`.
- [ ] `esbuild` configured for production.
- [ ] Activation events are specific.
- [ ] No heavy top-level imports.
- [ ] All disposables registered in `context.subscriptions`.
- [ ] Using `vscode.lm` for AI features.
- [ ] SecretStorage used for sensitive data.
- [ ] OutputChannel (log: true) implemented for debugging.
