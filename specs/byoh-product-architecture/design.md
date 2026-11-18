# Design — BYOH product architecture

> Feature FEAT-039. Establishes the product rule that Harness Dashboard adapts to user-owned harnesses, and defines the staged migration needed to apply that rule to current functionality.

## Summary

The Dashboard is a local visualization and workflow layer across harnesses the user already operates. The common graph and shared UI belong to the product core; file formats, hook semantics, command execution, editing, and validation belong to adapters. A capability contract makes those boundaries visible and allows the UI to gate harness-specific actions without implying universal support.

The change has two outputs: a capability-based architecture and a migration inventory covering every existing feature. The inventory identifies which features are shared, adapter-specific, optional integrations, or repository-only tooling. Features that currently assume Harness SDD receive their own spec revisions and human approval before implementation changes.

## Affected Files

| File | Action | Reason |
|---|---|---|
| `DESIGN.md` | modify | Establish BYOH as a product-level architecture principle |
| `.kiro/specs/byoh-product-architecture/requirements.md` | create | Define the macro product requirements |
| `.kiro/specs/byoh-product-architecture/design.md` | create | Document boundaries, migration and risks |
| `.kiro/specs/byoh-product-architecture/tasks.md` | create | Stage inventory, design, and migration work |
| `docs/byoh/feature-compatibility-matrix.md` | create | Classify all 38 existing features and map adapter dependencies |
| `docs/byoh/adapter-capabilities.md` | create | Define capability vocabulary and adapter contract |
| `.kiro/specs/code-quality-on-save-hooks/*` | revise | Reclassify KISS/DRY as repository development tooling only |
| `.kiro/specs/<affected-feature>/*` | revise in follow-up approved work | Remove harness assumptions from affected features |
| `src/adapters/IAgentAdapter.ts` | revise in follow-up approved work | Add capability declarations after the taxonomy is approved |
| `src/adapters/AdapterRegistry.ts` | revise in follow-up approved work | Support custom adapters in a compatible boundary |
| `src/config/harnessConfig.ts` | revise in follow-up approved work | Support user-owned adapter profiles |
| `src/webview/*` | revise in follow-up approved work | Show per-adapter capabilities and gated actions |

## Product Boundaries

### Shared core

The shared graph, visualization, search, layout, and cross-framework comparison operate on normalized entities and remain independent of any harness manifest.

### Adapter-owned behavior

Adapters own detection, parsing, file watching, hooks, steering, commands, agent runs, validation, and edit operations. Each adapter reports a capability level for each operation. A capability level means the Dashboard's integration coverage; it does not assess the external harness's quality or security.

### BYOH extension paths

1. Built-in adapters support common harnesses and remain additive.
2. A declarative workspace profile maps common Markdown/frontmatter layouts without executing user code.
3. A versioned VS Code extension API allows a companion extension to parse nonstandard formats.

The declarative profile and external API are implemented only after this macro spec is approved and the inventory confirms their boundaries.

### Repository development controls

KISS/DRY scripts, test fixtures, and developer hooks remain in the Harness Dashboard repository's development workflow. They are not activated by the installed extension in user workspaces and do not impose repository rules on BYOH users.

## Migration Algorithm

1. Inventory all existing features and classify them as shared-core, adapter-specific, optional integration, or repository-development tooling.
2. Record adapter dependencies and user-visible assumptions in `docs/byoh/feature-compatibility-matrix.md`.
3. Define the capability vocabulary and target adapter boundary in `docs/byoh/adapter-capabilities.md`.
4. Identify features whose approved requirements require a specific harness. Create a separate revision spec for each affected feature; do not change implementation before human approval.
5. Preserve built-in adapter behavior while the new contract is introduced.
6. Validate each advertised adapter with a repeatable representative workspace.
7. Implement the profile format, public adapter API, and UI support reporting in separately reviewable tasks after the design decision.

## Capability Vocabulary

```ts
export type CapabilityLevel = 'supported' | 'partial' | 'unsupported';

export interface HarnessCapabilities {
    discovery: CapabilityLevel;
    hooks: CapabilityLevel;
    steering: CapabilityLevel;
    commands: CapabilityLevel;
    agentRuns: CapabilityLevel;
    editing: CapabilityLevel;
    validation: CapabilityLevel;
}
```

Adapters retain stable IDs. The graph stores adapter attribution in node and edge metadata; the UI uses the capability map to label actions and avoid presenting unsupported behavior as universal.

## Error Handling

| Condition | Response |
|---|---|
| Adapter does not implement a capability | Keep shared visualization available and disable or label the dependent action |
| Adapter parse failure | Report the adapter-specific error and continue loading other adapters |
| Invalid user profile | Report a scoped configuration error and continue with built-in adapters |
| Feature spec assumes Harness SDD | Classify it for an approved spec revision before code changes |
| No adapter recognizes a workspace | Keep generic graph/import affordances visible and explain the missing adapter capability |

## Discarded Alternatives

- **Require every workspace to adopt Harness SDD files:** rejected because it contradicts users bringing their own harness and makes the Dashboard's format a new source of truth.
- **Hard-code a separate product feature for every agent framework:** rejected because each new framework would duplicate core UI and leave the advertised support list permanently incomplete.
- **Execute arbitrary workspace scripts from declarative profiles:** rejected because discovery must remain read-only and predictable.

## Risks and Edge Cases

- Some current features are deeply tied to Harness SDD; they may need to move behind an adapter capability or become optional integrations.
- A normalized graph can hide distinctions between harnesses; preserve source paths and adapter identity.
- Public adapter registration becomes a compatibility surface; version and document it before release.
- A declarative profile cannot model every proprietary format; retain the extension API for custom parsers.
- Adapter support tests require representative workspaces; synthetic fixtures alone do not prove real-world compatibility.
- The 400,000-byte VSIX budget limits bundled parsers and libraries; prefer existing dependencies and host APIs.
