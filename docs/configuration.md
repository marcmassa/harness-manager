# Configuration — Per-adapter detection path overrides

The Harness Dashboard extension ships with a **Configuration
Registry** that lets you override each adapter's detection
directory via VS Code's settings UI. This is useful when
your agent framework's files live in a non-standard location
(e.g., a custom Kiro IDE install, a symlinked `.claude/`
directory, a workspace-internal `.cursor/` subfolder, etc.).

## Quick start

Open VS Code's settings (Cmd+, on macOS, Ctrl+, on Windows),
search for **"Harness-Dashboard: Adapters"**, and edit the
**Path** field for the adapter you want to override. The
extension reads the new value on the next parse (no restart
needed).

Workspace-scoped overrides (`.vscode/settings.json`):

```json
{
  "harness-dashboard.adapters.kiro.path": ".kiro",
  "harness-dashboard.adapters.claude-code.path": ".claude",
  "harness-dashboard.adapters.cursor.path": ".cursor",
  "harness-dashboard.adapters.gemini-cli.path": ".gemini",
  "harness-dashboard.adapters.copilot.path": ".github",
  "harness-dashboard.adapters.windsurf.path": ".windsurf"
}
```

## Which adapters are configurable?

| Adapter ID | Configurable? | Default path | Notes |
|---|---|---|---|
| `harness-sdd` | **No** | `.agents/agentic.json` | Canonical framework entry point. |
| `opencode` | **No** | `opencode.json` / `opencode.jsonc` | Canonical opencode CLI config. |
| `claude-code` | Yes | `.claude` | `CLAUDE.md` (root) is not affected. |
| `cursor` | Yes | `.cursor` | `.cursorrules` (root) is not affected. |
| `gemini-cli` | Yes | `.gemini` | `GEMINI.md` (root) is not affected. |
| `copilot` | Yes | `.github` | `.vscode/prompts/` is not affected. |
| `windsurf` | Yes | `.windsurf` | `.windsurfrc` (root) is not affected. |
| `kiro` | Yes | `.kiro` | First consumer (FEAT-023). |

### Why are `harness-sdd` and `opencode` not configurable?

Both adapters' detection files are **the framework's own
canonical config**:

- `harness-sdd` reads `.agents/agentic.json` (and the
  surrounding `.agents/`) — that's the manifest that
  describes the subagents, skills, and commands for THIS
  extension itself. Changing the path would break the
  framework's own tooling (e.g., a Kiro plugin that reads
  `.agents/agentic.json` would fail if the path were
  remapped).
- `opencode` reads `opencode.json` / `opencode.jsonc` —
  that's the canonical config file the opencode CLI itself
  creates. Same reasoning.

If a future maintainer needs to make one of these
configurable, the registry is designed to support it: it's
a one-line change (`isPathConfigurable() === true` + add
the adapter id to `DEFAULT_PATHS`).

### Why is only `.github/` configurable for `copilot`?

The Copilot adapter watches **two** root paths:

1. `.github/copilot-instructions.md` and
   `.github/instructions/**/*.instructions.md` — the
   GitHub Copilot convention.
2. `.vscode/prompts/**/*.prompt.md` — the VS Code extension
   prompts system (this is the VS Code convention, not
   GitHub's).

The first root is registered with the registry as
`copilot → .github`. The second root (`.vscode/prompts/`)
stays fixed at its canonical location because changing it
would be confusing (the VS Code extension prompts system
is a VS Code convention, not a user choice).

## Edge cases

### Empty string

An empty or whitespace-only value is treated as "no
override" and falls back to the framework's default. The
extension does not throw.

### Non-existent path

If the configured path does not exist on disk, the
extension:

1. Logs a one-line warning to the **Harness Dashboard**
   output channel:
   ```
   [ConfigurationRegistry] Configured path '.my-custom-kiro' for adapter 'kiro' does not exist or is not a directory; using default detection ('.kiro').
   ```
2. Falls back to the framework's default path (e.g.,
   `.kiro`).
3. Does not throw. The adapter simply reports `detect() =
   false` for the framework in this parse cycle.

### Path is a file, not a directory

Same behavior as the non-existent case. The `isValidPath`
check uses VS Code's `FileType` enum to confirm the path is
a directory before trusting it.

### Runtime changes

The registry listens to VS Code's
`onDidChangeConfiguration` event. When you change a setting
at runtime, the cache is cleared and the next parse picks
up the new value. No restart required.

## How to add a new configurable adapter

Three steps (one line each):

1. **Add the adapter to the `IAgentAdapter` interface
   implementation** — return `true` from
   `isPathConfigurable()`:
   ```typescript
   public isPathConfigurable(): boolean {
       return true;
   }
   ```
2. **Add the default path to `DEFAULT_PATHS`** in
   `src/adapters/ConfigurationRegistry.ts`:
   ```typescript
   const DEFAULT_PATHS: Record<string, string> = {
       // ... existing entries ...
       'my-new-adapter': '.my-new-adapter',
   };
   ```
3. **Add the setting to `package.json#contributes.configuration.properties`**:
   ```json
   "harness-dashboard.adapters.my-new-adapter.path": {
       "type": "string",
       "scope": "resource",
       "default": ".my-new-adapter",
       "description": "Path to the My-New-Adapter agent configuration directory (relative to workspace root)."
   }
   ```
4. **Use the registry in the adapter's `detect` / `parse` /
   `watchGlobs`** (see `ClaudeCodeAdapter.ts` for the
   canonical pattern):
   ```typescript
   private static readonly CONFIG_KEY = 'my-new-adapter';

   public watchGlobs(): string[] {
       const path = ConfigurationRegistry.getInstance()
           .getPathFor(MyNewAdapter.CONFIG_KEY);
       return [`${path}/agents/**/*.md`];
   }

   public async detect(root: vscode.Uri): Promise<boolean> {
       const path = await ConfigurationRegistry.getInstance()
           .resolvePath(MyNewAdapter.CONFIG_KEY, root);
       return fileExists(root, path);
   }
   ```
5. **Add unit tests** following the pattern in
   `ConfigurationRegistry.test.ts` (default path,
   overridden path, empty string, non-existent path, file
   path).

That's it. No need to speculatively enable
`harness-sdd` or `opencode` — only add the adapter if a
real user need emerges.

## Architecture

The `ConfigurationRegistry` is a **process-wide singleton**
constructed at extension activation and disposed in
`deactivate()`. The first call to `getInstance()` constructs
it; subsequent calls return the same instance. This is a
deliberate design choice over constructor-injection because
VS Code extensions have a tree of ad-hoc initializers and a
singleton avoids "who constructs the registry" plumbing.

```
Extension activation
       │
       ▼
ConfigurationRegistry (singleton)
       │
       ├── getPathFor(adapterId): string
       ├── isValidPath(uri, path): Promise<boolean>
       ├── isPathConfigurable(adapterId): boolean
       ├── resolvePath(adapterId, rootUri): Promise<string>
       │
       ▼
Each adapter (when isPathConfigurable)
       ├── ClaudeCodeAdapter
       ├── CursorAdapter
       ├── GeminiCliAdapter
       ├── CopilotAdapter
       ├── WindsurfAdapter
       └── KiroAdapter
```

The registry is **lazy**: it reads the VS Code setting on
the first call and caches the value. The cache is cleared
on `onDidChangeConfiguration` so a runtime setting change
is reflected on the next parse.

## Trace

- **R1–R8**: `specs/adapter-config-paths-and-kiro-and-whiteboard-polish/requirements.md`
- **Design**: `specs/adapter-config-paths-and-kiro-and-whiteboard-polish/design.md`
- **Tasks**: `specs/adapter-config-paths-and-kiro-and-whiteboard-polish/tasks.md`
- **Impl report**: `progress/impl_adapter-config-paths-and-kiro-and-whiteboard-polish.md`
- **Source**: `src/adapters/ConfigurationRegistry.ts`
- **Tests**: `src/adapters/ConfigurationRegistry.test.ts`
