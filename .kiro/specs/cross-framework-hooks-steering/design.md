# Design — Cross-framework Hooks & Steering Discovery

> Feature FEAT-026. Auto-discover hook and steering files under each
> configurable adapter's root (and optionally the project root) and render
> them as first-class whiteboard nodes.
>
> KISS principle: one command, one JSON file, three global settings. No new
> UI, no forms, no dynamic panels. The user edits a local JSON file.

## 1. Configuration — three global settings + one local file

**Three global VS Code settings:**

| Setting | Default | Purpose |
|---------|---------|---------|
| `harness-dashboard.adapters.<id>.path` | varies | Root path of an adapter (from FEAT-023) |
| `harness-dashboard.adapters.<id>.discovery` | `true` | Kill switch for discovery on this adapter |
| `harness-dashboard.discovery.root` | `true` | Kill switch for project-root discovery |

**One local file:** `<workspace>/.harness-dashboard/config.json`

```jsonc
{
    "adapters": {
        "<id>": {
            "hooksPath": "<relative path>",     // optional override
            "steeringPath": "<relative path>"   // optional override
        }
    },
    "extraPaths": {
        "<id>": {
            "hooks":    ["<glob>", ...],         // additional hook dirs
            "steering": ["<glob>", ...]          // additional steering dirs
        }
    }
}
```

That's the entire configuration surface. No more knobs.

## 2. One command

`Harness Dashboard: Open Local Configuration` — opens `.harness-dashboard/config.json` in the editor, creating the file with empty schema if it does not exist.

That's the entire UI.

## 3. The two modules

### 3.1 `src/config/harnessConfig.ts` — read the local file

```typescript
export interface HarnessDashboardConfig {
    adapters?: Record<string, { hooksPath?: string; steeringPath?: string }>;
    extraPaths?: Record<string, { hooks?: string[]; steering?: string[] }>;
}

export class HarnessConfig {
    public read(root: vscode.Uri): HarnessDashboardConfig;
    public onDidChange(listener: () => void): vscode.Disposable;
}
```

- Empty file → empty config. No defaults inside the file.
- Malformed JSON → log warning, return empty config. The user fixes it themselves.
- File watcher invalidates cache on change.

### 3.2 `src/discovery/hooksAndSteering.ts` — do the scanning

```typescript
export async function discover(
    adapterId: string,
    root: vscode.Uri,
    config: HarnessDashboardConfig,
    discoveryEnabled: boolean,
    rootDiscoveryEnabled: boolean,
    rootAgentId: string,
    subagentIds: string[],
): Promise<{ nodes: HarnessNode[]; edges: HarnessEdge[] }>;
```

Returns nodes + edges; the adapter merges them into its own result.

## 4. The algorithm

```
For each adapter that opts in (isPathConfigurable() === true):
    If discovery is disabled (R9): skip this adapter.

    basePath = ConfigurationRegistry.getPathFor(adapterId)
    adapterCfg = config.adapters?.[adapterId]  // may be undefined
    extras = config.extraPaths?.[adapterId]     // may be undefined

    hooksGlobs = [
        adapterCfg?.hooksPath ?? `${basePath}/hooks`,   // R5, R6
        ...(extras?.hooks ?? []),                        // R7
    ]
    steeringGlobs = [
        adapterCfg?.steeringPath ?? `${basePath}/steering`,
        ...(extras?.steering ?? []),
    ]
    If rootDiscoveryEnabled (R8, R10):
        hooksGlobs.push('hooks')
        steeringGlobs.push('steering')

    seen = Set<absolutePath>()
    For each hookGlob in hooksGlobs:
        For each file matching `<hookGlob>/**/*.{sh,js,ts}`:
            if seen.has(file.absolute): continue          // R13
            seen.add(file.absolute)
            create hook node + triggers edge to rootAgentId  // R11, R14, R16

    For each steeringGlob in steeringGlobs:
        For each file matching `<steeringGlob>/**/*.md`:
            if seen.has(file.absolute): continue
            seen.add(file.absolute)
            create steering node + governs edge(s)         // R12, R15, R16
```

That's the whole feature. No `discoverHooksAndSteering` orchestrator function, no `DiscoveryOptions` interface, no `buildDiscoveryGlobs` helper. One function, one loop.

## 5. Field derivation (R11, R12)

**Hook event**: frontmatter `event` if present, else strip extension and normalise hyphens to underscores.

**Steering description**: frontmatter `description` if present, else first `# H1` line.

**Steering applies_to**: if filename stem matches a subagent ID, `=[that id]`. Otherwise `=['*']`.

## 6. File content (R16)

- Hook: read content, store first 500 chars in `_preview`.
- Steering: read content, store full body in `_body`. Missing file → `_fileMissing: true` and one parser warning.

Both get `_filePath` set so the existing "Open in editor" button works.

## 7. Wiring (R5, R17, R18, R19)

Each configurable adapter calls `discover()` at the end of its `parse()`. Each adapter's `watchGlobs()` includes the resolved globs. `HarnessSddAdapter` and `OpenCodeAdapter` are untouched.

## 8. Discarded (kept brief on purpose)

- **More settings** — they were the original anti-pattern this spec was rewritten to remove.
- **A settings UI form** — JSON in a tab is faster, supports comments, and the schema is dynamic.
- **Merging with FEAT-024's `agentic.json` parser** — different semantics (manifest vs heuristic); keep them separate.

## 9. Tests

Fixtures at `temp/<id>/` with `.kiro/hooks/*.sh`, `.kiro/steering/*.md`, `hooks/*.sh`, `steering/*.md`, and a sample `.harness-dashboard/config.json`. Tests verify R5–R19 by inspection of nodes/edges in the result.
