# FEAT-029 — Universal Agentic Architecture Detection & Advisory — Design

---

## 0. Three-Layer Domain Model

This is the foundational design decision for FEAT-029. The entire implementation SHALL be organized around these three layers:

```
┌─────────────────────────────────────────────────────┐
│  Layer 3 — METHODOLOGY                              │
│  El proceso y ciclo de vida del trabajo con agentes │
│  Ej: SDD (Spec Driven Development):                 │
│      feature_list.json con estados lifecycle,       │
│      specs (requirements → design → tasks),         │
│      progress/ (current, history, decisions)        │
│  Detección: feature_list.json + specs/**/*.md       │
├─────────────────────────────────────────────────────┤
│  Layer 2 — AGENTIC IMPLEMENTATION                   │
│  Cómo está organizado el trabajo de los agentes     │
│  Ej: prompts/, rules/, tools/, skills/, mcp.json,   │
│      agent scripts, memory files                    │
│  ┌── HARNESS es una implementación concreta ──────┐ │
│  │  .agents/agentic.json, subagents/, steering/,  │ │
│  │  skills/, commands/, hooks/, AGENTS.md          │ │
│  │  Define estructura y relaciones entre agentes  │ │
│  └─────────────────────────────────────────────────┘ │
│  Detección: FEAT-029 signal scanner                  │
├─────────────────────────────────────────────────────┤
│  Layer 1 — AGENTIC CLI / INSTALL                    │
│  El runtime que ejecuta los agentes                 │
│  Ej: Claude Code, Kiro, Cursor, Gemini CLI,         │
│      Copilot, OpenCode, Windsurf                    │
│  Detección: Existing adapters (FEAT-015, FEAT-023)  │
└─────────────────────────────────────────────────────┘
```

**Key principle:** These layers are independent. A project can have:
- **Layer 1 only**: Claude Code installed but no custom prompts or rules
- **Layer 2 only**: Prompt files, rules, MCP config but no CLI configured yet
- **Layer 1 + 2**: Full agentic setup without formal methodology
- **Layer 2 + Harness**: Agentic structure with `.agents/` but no SDD process
- **All three layers**: The ideal state — CLI + Harness implementation + SDD governance

**Important distinction (per the domain model):**
- **Harness** is Layer 2 — an **implementation framework** that organizes agents (`.agents/agentic.json`, subagents, steering, skills, commands, `AGENTS.md`). It's the *structure* of agentic work.
- **SDD (Spec Driven Development)** is Layer 3 — a **methodology** that defines the lifecycle (feature_list.json with statuses, specs with requirements/design/tasks, progress tracking). It's the *process* of development.
- The Harness+SDD template bundles both, but they are separable: you can have Harness without SDD (structured agents without spec lifecycle) and theoretically SDD without Harness.

---

## 1. Architecture Overview

The feature introduces a new module tree `src/agentic-detector/` with 5 sub-modules that plug into the existing pipeline: scan → classify → analyze → advise → visualize.

```
┌──────────────────────────────────────────────────────────────┐
│                   Extension Activation                        │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────┐  │
│  │              AgenticDetector (singleton)                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Signal   │ │ Maturity │ │ Pattern  │ │ Advisory │  │  │
│  │  │ Scanner  │ │Classifier│ │ Analyzer │ │ Engine   │  │  │
│  │  │ (Layer2) │ │(All 3)   │ │ (All 3)  │ │(All 3)   │  │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │  │
│  │       │            │            │            │         │  │
│  │       ▼            ▼            ▼            ▼         │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │           AgenticProfile (data model)             │  │  │
│  │  │  { layers: { L1: CLIDetection[],                 │  │  │
│  │  │           L2: SignalResult[],                     │  │  │
│  │  │           L3: MethodologyInfo } }                 │  │  │
│  │  └──────────────────────┬───────────────────────────┘  │  │
│  └─────────────────────────┼──────────────────────────────┘  │
└────────────────────────────┼──────────────────────────────────┘
                             │
             ┌───────────────┼───────────────────┐
             ▼               ▼                   ▼
    ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
    │   Whiteboard   │ │  Agentic     │ │  Output      │
    │   + Layer vis  │ │  Profile Tab │ │  Channel     │
    │   + Badges     │ │  (Webview)   │ │  Log         │
    │   + Legend     │ │  + Chart     │ │              │
    │   + Inferred   │ │  + Actions   │ │              │
    │     Edges      │ │              │ │              │
    └────────────────┘ └──────────────┘ └──────────────┘
```

### 1.1 — Module placement

```
src/
├── agentic-detector/
│   ├── agenticDetector.ts       # Singleton orchestrator
│   ├── signalScanner.ts         # R1–R13: 8-category Layer-2 detection
│   ├── signalScanner.test.ts
│   ├── maturityClassifier.ts    # R18–R20: L0–L5 (all 3 layers)
│   ├── maturityClassifier.test.ts
│   ├── patternAnalyzer.ts       # R21–R23: 8 architecture patterns
│   ├── patternAnalyzer.test.ts
│   ├── advisoryEngine.ts        # R24–R34: suggestion generation
│   ├── advisoryEngine.test.ts
│   ├── types.ts                 # AgenticProfile, Layer types, etc.
│   ├── signalCatalog.ts         # All Layer-2 signal definitions
│   └── layerIntegrator.ts       # Combines L1 (adapters) + L2 (scanner) + L3 (methodology)
├── extension.ts                 # Wire AgenticDetector + commands
├── webview/
│   ├── AgenticProfileTab.tsx    # R43–R47: dedicated profile tab
│   └── whiteboard/
│       ├── WhiteboardCanvas.tsx  # Extended for layer badges + discovered nodes
│       └── LayerLegend.tsx      # R42: three-layer legend toggle
└── types.ts                     # Extend HarnessNode for discovered type + layer info
```

### 1.2 — Layer Integrator

The critical new module `layerIntegrator.ts` is responsible for combining all three layers into a single `AgenticProfile`:

```
AgenticDetector.refresh():
  1. Query adapterRegistry for installed agentic CLIs (Layer 1) → CLIInstall[]
  2. Run signalScanner.scanAllCategories() (Layer 2) → SignalCategoryResult[]
     Note: Harness signals (.agents/agentic.json, subagents/, etc.) are
     detected as a Layer-2 signal category alongside prompts, rules, tools, etc.
  3. Check for SDD methodology (Layer 3):
     - feature_list.json with lifecycle statuses (pending/spec_ready/in_progress/done)
     - specs/**/{requirements,design,tasks}.md existence
     - progress/{current,history}.md existence
     → MethodologyInfo { name: 'sdd', isActive: true/false }
  4. Combine into AgenticProfile { layers: { 1: ..., 2: ..., 3: ... } }
  5. Run maturityClassifier → MaturityInfo
  6. Run patternAnalyzer → PatternMatch[]
  7. Run advisoryEngine → Suggestion[]
  8. Cache and emit onDidChangeProfile
```

---

## 2. Data Model (`src/agentic-detector/types.ts`)

```typescript
// === Layer types ===

export type AgenticLayer = 1 | 2 | 3;

// === Layer 1: CLI/Install (from adapters) ===

export interface CLIInstall {
  cliId: string;            // 'claude-code' | 'kiro' | 'cursor' | 'gemini-cli' | ...
  cliName: string;          // Display name: "Claude Code", "Kiro IDE", etc.
  detectedBy: string;       // Which adapter detected it
  configFiles: string[];    // Paths to config files
  isActive: boolean;        // Whether the CLI is currently usable
  layer: 1;                 // Always 1
}

// === Layer 2: Signal categories ===

export type SignalCategory =
  | 'prompts'
  | 'rules'
  | 'mcp'
  | 'agent-methodologies'   // was 'agent-frameworks' — renamed to avoid confusion
  | 'tools'
  | 'skills'
  | 'agent-scripts'
  | 'memory'
  | 'context-identity';

export interface SignalMatch {
  filePath: string;          // Absolute path
  category: SignalCategory;
  matchedPattern: string;    // Which glob/heuristic matched
  confidence: 'high' | 'medium' | 'low';
  evidence: string;          // The line or frontmatter that matched
  layer: 2;                  // Always 2
}

export interface SignalCategoryResult {
  category: SignalCategory;
  label: string;
  matches: SignalMatch[];
  count: number;
  truncated: boolean;        // true if >200 matches, capped
}

// === Layer 3: Methodology ===

export interface MethodologyInfo {
  hasMethodology: boolean;
  methodologyName: string | null;     // 'harness-sdd' | null
  methodologyVersion: string | null;
  configFile: string | null;          // e.g. '.agents/agentic.json'
  isActive: boolean;                  // true if methodology is fully operational
  layer: 3;                           // Always 3
}

// === Maturity ===

export type MaturityLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export const MATURITY_DEFINITIONS: Record<MaturityLevel, {
  label: string;
  description: string;
  color: string;            // CSS color for badge
  conditions: string;
}> = {
  L0: { label: 'None',      description: 'No agentic signals detected',                    color: '#888',    conditions: '0 signals across all layers' },
  L1: { label: 'Ad-hoc',    description: 'Sparse agentic files, no structure',              color: '#d4a017', conditions: '1–2 signal categories (L2) or CLI present but no implementation (L1 only)' },
  L2: { label: 'Structured', description: 'Organized agentic implementation',               color: '#88cc33', conditions: '3+ signal categories (L2) with organized directories' },
  L3: { label: 'Integrated', description: 'CLI install + structured implementation',        color: '#3399ff', conditions: 'L1 CLI installed + L2 structured (3+ categories)' },
  L4: { label: 'Managed',   description: 'Full agentic ecosystem: CLI + impl + tools + skills + MCP', color: '#aa66ff', conditions: 'L3 + tools + skills + MCP categories active' },
  L5: { label: 'Governed',  description: 'Methodology-driven: Harness SDD active on top',   color: '#22bb66', conditions: 'L4 + L3 methodology (Harness SDD) active' },
};

export interface MaturityInfo {
  level: MaturityLevel;
  label: string;
  description: string;
  color: string;
  nextLevel: {
    level: MaturityLevel;
    whatIsNeeded: string;    // What would advance to the next level
  } | null;
}

// === Architecture patterns ===

export type ArchitecturePattern =
  | 'tool-using-single-agent'
  | 'pipeline'
  | 'orchestrator-worker'
  | 'multi-agent-collaboration'
  | 'evaluator-optimizer'
  | 'router'
  | 'reflection'
  | 'plan-and-execute';

export interface PatternMatch {
  pattern: ArchitecturePattern;
  label: string;
  confidence: number;         // 0–1
  status: 'detected' | 'tentative';
  evidence: string[];         // Which signals support this
}

// === Suggestions ===

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  layer: AgenticLayer;        // Which layer the suggestion addresses
  category: SignalCategory | 'cli' | 'methodology';
  maturityTrigger: MaturityLevel[];  // When to show this
  actionType?: 'scaffold' | 'navigate' | 'link';
  actionPayload?: string;      // e.g., '.agents/agentic.json template content'
}

// === Composite profile ===

export interface AgenticProfile {
  workspaceRoot: string;
  scanTimestamp: number;
  layers: {
    '1': { cliInstalls: CLIInstall[] };
    '2': { categories: SignalCategoryResult[] };
    '3': { methodology: MethodologyInfo };
  };
  maturity: MaturityInfo;
  patterns: PatternMatch[];
  suggestions: Suggestion[];
  dismissedSuggestionIds: string[];
  acknowledgedNodeIds: string[];
}
```

---

## 3. Signal Catalog (`src/agentic-detector/signalCatalog.ts`)

Each signal is defined declaratively with glob patterns and optional content checks:

```typescript
interface SignalDefinition {
  id: string;
  category: SignalCategory;
  label: string;
  globs: string[];                     // File globs for VS Code findFiles
  contentPatterns?: ContentPattern[];  // Optional content-based detection
  maxFiles?: number;                   // Default 200
}

interface ContentPattern {
  description: string;
  type: 'yaml-frontmatter' | 'json-key' | 'import-statement' | 'shell-command' | 'regex';
  pattern: RegExp | string;
}
```

**Catalog entries** (all in Layer 2):

```typescript
const SIGNAL_CATALOG: SignalDefinition[] = [
  // Prompts
  { id: 'prompt-files', category: 'prompts', label: 'Prompt Files',
    globs: ['**/*.prompt.md', '**/*.instruction.md'] },
  { id: 'prompt-dirs', category: 'prompts', label: 'Prompt Directories',
    globs: ['**/prompts/**', '**/instructions/**', '**/system-prompts/**'] },

  // Rules
  { id: 'dot-rules-files', category: 'rules', label: 'Rules Files',
    globs: ['**/.cursorrules', '**/.windsurfrules', '**/.clinerules'] },
  { id: 'rules-dirs', category: 'rules', label: 'Rules Directories',
    globs: ['**/rules/**/*.md', '**/.rules/**'] },
  { id: 'cursor-mdc', category: 'rules', label: 'Cursor MDC Rules',
    globs: ['**/*.mdc'] },

  // MCP
  { id: 'mcp-config', category: 'mcp', label: 'MCP Config Files',
    globs: ['**/mcp.json', '**/mcp-servers.json'] },
  { id: 'mcp-dir', category: 'mcp', label: 'MCP Directories',
    globs: ['**/.mcp/**', '**/mcp/**'] },

  // Agent Methodologies (Layer-2 methodology implementations, NOT Layer-3 governance)
  { id: 'methodology-configs', category: 'agent-methodologies', label: 'Methodology Configs',
    globs: ['**/langgraph.json', '**/langchain-*.json', '**/crewai*.yaml',
            '**/crewai*.yml', '**/autogen*.yaml', '**/autogen*.yml'] },
  { id: 'methodology-root-files', category: 'agent-methodologies',
    label: 'Agent Root Files',
    globs: ['AI_AGENT.md', 'AGENTS.md', 'AGENT.md'] },
  { id: 'methodology-imports', category: 'agent-methodologies',
    label: 'Methodology Imports',
    globs: ['**/*.py', '**/*.ts', '**/*.js'], maxFiles: 200,
    contentPatterns: [{ type: 'import-statement', description: 'agent framework import',
      pattern: /(from|import)\s+(openai|anthropic|langchain|crewai|autogen)/ }] },

  // Tools
  { id: 'tool-dirs', category: 'tools', label: 'Tool Directories',
    globs: ['**/tools/**', '**/tool_definitions/**'] },
  { id: 'tool-files', category: 'tools', label: 'Tool Files',
    globs: ['**/*_tool.py', '**/*_tool.ts', '**/*_tool.js'] },

  // Skills
  { id: 'skill-files', category: 'skills', label: 'SKILL.md Files',
    globs: ['**/SKILL.md', '**/*_SKILL.md'] },
  { id: 'skill-dirs', category: 'skills', label: 'Skill Directories',
    globs: ['**/skills/**'] },

  // Agent scripts
  { id: 'agent-files', category: 'agent-scripts', label: 'Agent Script Files',
    globs: ['**/*.agent.py', '**/*.agent.ts'] },
  { id: 'cli-invocations', category: 'agent-scripts', label: 'CLI Agent Invocations',
    globs: ['**/*.sh', '**/*.bash'], maxFiles: 200,
    contentPatterns: [{ type: 'shell-command', description: 'agent CLI call',
      pattern: /\b(opencode|claude|gemini|cursor)\b/ }] },

  // Memory
  { id: 'memory-files', category: 'memory', label: 'Memory Files',
    globs: ['**/memory.json', '**/*.memory.md'] },

  // Context/Identity
  { id: 'context-files', category: 'context-identity', label: 'Context Files',
    globs: ['CONTEXT.md', 'SOUL.md', 'CHARACTER.md'] },
];
```

---

## 4. Maturity Classification Logic (`maturityClassifier.ts`)

The maturity model considers ALL three layers, not just Layer 2 signals:

```
L0 (None)        → 0 Layer-1 CLIs + 0 Layer-2 categories + no Layer-3 SDD
L1 (Ad-hoc)      → Any 1–2 of these: L1 CLI install, L2 signals (any categories)
L2 (Structured)  → L2 signals in 3+ categories WITH organized directories
                   (prompts/, rules/, skills/, tools/ — at least one structured dir)
                   OR: Harness detected (.agents/agentic.json with subagents)
L3 (Integrated)  → L1 CLI install + L2 structured (3+ categories)
L4 (Managed)     → L3 + L2 tools + skills + mcp all present
L5 (Governed)    → L4 + L3 SDD methodology active
                   (feature_list.json with lifecycle + specs/ + progress/)
```

**Note on Harness vs SDD at L5:** The presence of Harness alone (.agents/agentic.json) is a strong Layer-2 signal that can bump a project to L2 or higher depending on breadth, but L5 specifically requires SDD methodology — the spec-driven lifecycle layer — not just the implementation structure. If Harness is present but SDD is absent, the project is capped at L4 (Managed) with a suggestion to adopt SDD for governance.

**Algorithm:**
1. Count Layer-1 CLI installs
2. Count non-empty Layer-2 signal categories
3. Check for organized directory structures (prompts/, rules/, skills/, tools/)
4. Check for tools + skills + mcp all present
5. Check for Layer-3 methodology (.agents/agentic.json)
6. Resolve to highest matching level

**Edge cases:**
- A project with ONLY a `.clinerules` file (L2) → L1 (1 category, no structure)
- A project with `.cursorrules` + `prompts/` + `mcp.json` + no CLI (L2: 3 categories + organized) → L2
- A project with `.claude/settings.json` (L1) + scattered prompt files (L2:1 cat) → L1 (CLI detected but implementation is ad-hoc)

---

## 5. Pattern Inference Logic (`patternAnalyzer.ts`)

| Pattern | Signal Combination (Layer 2) | Confidence |
|---------|------------------------------|------------|
| Tool-Using Single Agent | MCP + tools + agent script with LLM imports | 0.9 |
| Pipeline | Agent scripts with sequential IO patterns, no MCP | 0.7 |
| Orchestrator-Worker | Multi-agent methodology config (LangGraph, CrewAI) + agent scripts | 0.85 |
| Multi-Agent Collaboration | Multiple agent scripts + shared context/memory files | 0.75 |
| Evaluator-Optimizer | Test files + reflection patterns in prompts | 0.7 |
| Router | Multiple Cursor/Kiro rules with `globs` or `filetypes` | 0.7 |
| Reflection | Self-critique prompts + multi-turn agent scripts | 0.65 |
| Plan-and-Execute | Plan files + execution scripts separated | 0.7 |

**Confidence formula:** `baseConfidence × (1 - 0.1 × missingCorroboratingSignals)`. Each pattern has primary signals that must be present, plus corroborating signals that boost confidence. If confidence < 0.7 → `tentative`.

---

## 6. Advisory Engine (`advisoryEngine.ts`)

Decision-tree mapping (maturity, signals, patterns, dismissedIds) → Suggestion[].

**Priority order:** impact=high + effort=low first, then impact=high, then by maturity ascending (help users at lower levels first).

**Suggestion catalog (20+ rules):**

| ID | Layer | Maturity | Condition | Suggestion |
|----|-------|----------|-----------|------------|
| S01 | L2 | L1 | prompts detected but not organized | "Organize prompt files into a prompts/ directory" |
| S02 | L2 | L1 | rules detected but not organized | "Consolidate rules into rules/ for maintainability" |
| S03 | L1 | L1 | CLI config found but no implementation | "You have Claude Code installed — add custom prompts and rules to define how it works" |
| S04 | L2 | L2 | structured impl but no CLI config | "You have structured agentic files but no CLI install detected — consider configuring Claude Code, Kiro, or Cursor" |
| S05 | L1 | L2 | CLI + impl but no MCP | "Add MCP servers to give your agents access to tools and data sources" |
| S06 | L2 | L2 | rules exist but are CLI-specific | "Migrate .cursorrules to platform-agnostic steering files so they work with any CLI" |
| S07 | L2 | L3 | MCP without agent definitions | "Define agents that explicitly consume your MCP server tools" |
| S08 | L2 | L3 | tools without skill docs | "Document each tool as a skill file for reusability" |
| S09 | L2 | L3 | single agent script with many tools | "Consider splitting into specialized subagents, each with focused tools" |
| S10 | L2 | L3 | scripts share prompt patterns | "Extract shared prompts into reusable skill files" |
| S11 | L2 | L4 | no memory layer | "Add memory/state files for agent continuity across sessions" |
| S12 | L2 | L4 | no tests for agent logic | "Add test coverage for your agent scripts" |
| S13 | L3 | L1–L4 | methodology absent | "Apply Harness SDD to govern your agentic workflow with specs, traceability, and lifecycle management" |
| S14 | L3 | L4 | methodology absent + L4 conditions met | "Your project is ready for Harness SDD — add a methodology layer to achieve L5 governance" |
| S15 | L3 | L5 | Harness SDD active but incomplete | (delegate to existing harness-sdd advisory) |

---

## 7. Whiteboard Integration

### 7.1 — Layer visualization (R35–R36)

The whiteboard SHALL visually encode all three layers:

```
┌─────────────────────────────────────────────────────────┐
│             Whiteboard Canvas                            │
│                                                          │
│  ┌─── L3 Overlay ────────────────────────────────────┐  │
│  │  [SDD] Spec Driven Development                     │  │
│  │  feature_list.json → specs/ → progress/            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─── L2 Main Graph ─────────────────────────────────┐  │
│  │  [HARNESS] agentic.json  [HARNESS] Subagents       │  │
│  │       ╲                    ╱                       │  │
│  │        ╲                  ╱                        │  │
│  │  [IMPL] prompts/    [IMPL] .cursorrules            │  │
│  │       ╲            ╱                              │  │
│  │        ╲          ╱ [inferred edge]               │  │
│  │         [IMPL] myscript.agent.py                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─── L1 Zone ───────────────────────────────────────┐  │
│  │  [CLI] Claude Code   [CLI] Kiro IDE               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [toggle] Layer Legend                                   │
└─────────────────────────────────────────────────────────┘
```

**Node badges:**
| Badge | Layer | Meaning | Color |
|-------|-------|---------|-------|
| `[CLI]` | 1 | Agentic CLI/install detected by adapter | `#3399ff` (blue) |
| `[IMPL]` | 2 | Implementation file (generic) | `#88cc33` (green) |
| `[HARNESS]` | 2 | Harness implementation framework (`.agents/`) | `#44aa55` (emerald-green) |
| `[SDD]` | 3 | SDD methodology (spec lifecycle) | `#22bb66` (teal) |

Each node SHALL display its layer badge in the top-left corner of the node, colored per type.

### 7.2 — Discovered nodes (R37–R41)

The `AgenticDetector` produces `HarnessNode[]` with:
- `type`: one of `'discovered-agent'`, `'discovered-skill'`, `'discovered-tool'`, `'discovered-resource'`
- `metadata._discovery`: `'agentic-signal'`
- `metadata._layer`: `2` (always — discovered nodes are Layer 2)
- `metadata._acknowledged`: boolean
- `metadata._evidence`: Signal evidence for click-to-show

**Aggregation strategy:** Not one node per file — one node per logical element:
- **1 discovered-agent node** per agent script or methodology root
- **1 discovered-skill node** per skill/knowledge file
- **1 discovered-tool node** per tool definition file or MCP server
- **1 discovered-resource node** per prompt/rules/context directory aggregating multiple files

**Visual style:**
- Dashed border: `border: 1px dashed var(--vscode-list-deemphasizedForeground)`
- Muted color palette (pastel tints)
- Badge: `?` icon for unacknowledged, `✓` for acknowledged (R38)
- Tooltip: "Heuristically detected — click for evidence"

### 7.3 — Inferred edges (R40)

When relationships between discovered nodes can be inferred, the whiteboard SHALL render dashed edges:

| Source | Target | Relationship | Inference Rule |
|--------|--------|-------------|----------------|
| .prompt.md | agent script | `references` | Script filename appears in prompt, or prompt is in the same `prompts/` subdirectory |
| .cursorrules | agent script | `constrains` | Rules file exists and agent script is in the same workspace |
| mcp.json | tool file | `defines` | MCP config references a tool by name that matches a tool file |
| skill file | agent script | `used-by` | Agent script imports or references the skill |
| CLI install | agent script | `runs` | Agent script invokes the CLI (shell pattern match) |
| CLI install | methodology config | `governed-by` | Harness SDD active + CLI installed |

Inferred edges SHALL be visually distinct:
- `stroke-dasharray: 5,5`
- Arrow opacity: 0.5
- Label: `inferred` with hover tooltip showing the inference rule

### 7.4 — Layer Legend (R42)

A collapsible toggle "Layer Legend" in the whiteboard toolbar showing:

```
┌── Layer Legend ───────────────────────┐
│                                        │
│ ■ [CLI] Layer 1: Agentic CLI          │
│   Runtime that executes agents         │
│   Examples: Claude Code, Kiro          │
│                                        │
│ ■ [IMPL] Layer 2: Implementation      │
│   How agents are configured            │
│   Examples: prompts, rules, tools      │
│                                        │
│ ■ [HARNESS] Layer 2: Harness Framework │
│   Structured agentic implementation    │
│   Files: agentic.json, subagents/      │
│                                        │
│ ■ [SDD] Layer 3: SDD Methodology      │
│   Spec-driven development lifecycle    │
│   Files: feature_list.json, specs/     │
│                                        │
│ ---                                    │
│ ?  Unacknowledged node                 │
│ ✓  Acknowledged node                   │
│ -- Inferred relationship edge          │
└────────────────────────────────────────┘
```

---

## 8. Agentic Profile Tab (R43–R47)

A new tab in the webview alongside "Whiteboard" and "SDD Panel":

```
┌─── Harness Dashboard ─────────────────────────────────┐
│ [Whiteboard] [SDD Panel] [Agentic Profile ●]           │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌── Maturity ─────────────────────────────────────┐  │
│  │  [ L4 ● Managed ]   color: #aa66ff              │  │
│  │  Level 4: Full agentic ecosystem                │  │
│  │  Next: Apply Harness SDD for L5 governance →    │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ┌── Three-Layer Status ──────────────────────────┐  │
│  │  Layer 1 (CLI)     ● Claude Code  ● Kiro IDE   │  │
│  │  Layer 2 (Impl)    ● 5/8 categories active      │  │
│  │                    prompts rules mcp tools       │  │
│  │  Layer 3 (Method)  ○ None (suggest Harness SDD) │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ┌── Signal Strength ─────────────────────────────┐  │
│  │  prompts ████████░░ 80%                         │  │
│  │  rules   ██████░░░░ 60%                         │  │
│  │  mcp     █████░░░░░ 50%                         │  │
│  │  tools   ████░░░░░░ 40%                         │  │
│  │  skills  ██░░░░░░░░ 20%                         │  │
│  │  ... (9 categories)                             │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ┌── Architecture Patterns ───────────────────────┐  │
│  │  ✓ Tool-Using Single Agent    (90% confidence) │  │
│  │  ? Orchestrator-Worker        (60% tentative)  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ┌── Top Suggestions ─────────────────────────────┐  │
│  │  [H/M] Apply Harness SDD for lifecycle          │  │
│  │  governance of your agentic workflow           │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │ [Apply Harness SDD]                 [×]  │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  [M/L] Add memory/state files for agent          │  │
│  │  continuity across sessions                  [×] │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 8.1 — "Apply Harness SDD" action (R47)

When the user clicks "Apply Harness SDD" in the suggestions area:

1. Create `.agents/agentic.json` with a minimal template:
   - Auto-detect current CLI from Layer 1 (e.g., Claude Code → generate `CLAUDE.md`)
   - Add default `harness` subagent
   - Set `subagents[]` based on detected Layer 2 signals
   - Set `commands[]` to default harness SDD commands
2. Run `./.agents/bootstrap.sh <detected-cli>` to generate the CLI adapter
3. Show success notification: "Harness SDD applied to your project. Maturity upgraded to L5."
4. Trigger re-scan → re-classify to L5

The template content SHALL be generated inline (no external dependency) based on the `agentic.json` schema from the bootstrap. The action SHALL NOT require running bootstrap.sh — it directly creates the file.

### 8.2 — Scaffold template (for R47)

```typescript
function scaffoldMinimalAgenticJson(detectedCLI: string | null, activeCategories: SignalCategory[]): string {
  // Build subagents array based on detected signals
  const subagents = [
    { name: 'harness', default: true, ... }
  ];
  if (activeCategories.includes('prompts')) {
    subagents.push({ name: 'implementer', ... });
  }
  // ...
  return JSON.stringify({
    $schema: './.agents/agentic-schema.json',
    subagents,
    commands: ['status', 'spec', 'approve', ...],
  }, null, 2);
}
```

---

## 9. Persistence

| Data | Storage | Scope |
|------|---------|-------|
| dismissedSuggestionIds | VS Code workspaceState | Per workspace |
| acknowledgedNodeIds | VS Code workspaceState | Per workspace |
| AgenticProfile (cached) | In-memory singleton | Per session |
| Scan results log | OutputChannel | Ephemeral |

---

## 10. Existing Integration Points

| Point | How |
|-------|-----|
| `extension.ts` | Wire AgenticDetector as singleton; register `scanAgenticProfile` command; pass profile to webview; listen for `onDidChangeProfile` |
| `adapterRegistry.ts` | Layer integrator queries registry for CLI installs (Layer 1) |
| `WhiteboardCanvas.tsx` | Accept discovered node types; render layer badges; render inferred edges; add Layer Legend toggle |
| `types.ts` | Extend `NodeType` with `'discovered-agent'`, `'discovered-skill'`, `'discovered-tool'`, `'discovered-resource'`; add `layer: 1\|2\|3` to HarnessNode |
| Webview tabs | Add "Agentic Profile" as third tab alongside Whiteboard and SDD Panel |
| `parserLogic.ts` | No changes needed — AgenticDetector produces parsed-like output directly |

---

## 11. Implementation Sequence

```
Phase 1 (T1–T6):   Signal Scanner + Catalog       → Foundation for Layer 2
Phase 2 (T7–T12):  Maturity + Pattern Classifier   → Analysis engine
Phase 3 (T13–T16): Advisory Engine                 → Suggestions
Phase 4 (T17–T22): AgenticDetector + Layer Integr. → Integration of all 3 layers
Phase 5 (T23–T28): Whiteboard Discovered Nodes     → Layer badges, inferred edges
Phase 6 (T29–T34): Agentic Profile Tab             → New tab + chart + scaffold action
Phase 7 (T35–T39): Verification & Polish           → Tests, perf, docs
```

---

## 12. Discarded Alternatives

| Alternative | Reason Discarded |
|-------------|-----------------|
| Use an LLM to analyze project structure | Unreliable, slow, requires API key — violates R54 (no network). Heuristic approach is deterministic, fast, and private. |
| Integrate into existing adapters as a "catch-all" adapter | The agentic detector is fundamentally different: it's heuristic, not declarative. A separate module is cleaner. Also, adapters detect Layer 1 (CLI installs); signal scanner detects Layer 2 (implementation). Different concerns. |
| Run full scan on every file change | Too expensive — per-category re-scan (R4) is sufficient. Full scans only on workspace open/reload (R3). |
| Use AST parsing for import detection | Overkill — regex import matching covers the main methodologies well enough for heuristic detection. |
| Suggest auto-migration to Harness SDD | Too aggressive — `Apply Harness SDD` is a single click action, not auto-migration. The user explicitly triggers it. |
| Merge all three layers into a single flat maturity score | Loss of information. The three layers are architecturally distinct; flattening them would hide whether a user needs a CLI, implementation, or methodology. |
| One discovered node per signal match | Too noisy. Aggregating by logical element (agent, skill, tool, resource) keeps the graph readable. |

---

## 13. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| False positives from content heuristics | Medium | `confidence` field lets UI distinguish 'high' from 'low'; user can acknowledge/dismiss |
| Large workspace scan exceeds 5s | Low | Excluded dirs + 200-file cap + parallel scanning across categories |
| Advisory suggestions feel intrusive | Medium | Dismissal persists per workspace; only top 3 shown by default; expandable |
| Pattern inference is wrong | Medium | `tentative` label for <70% confidence; evidence shown to user |
| Layer 1 (adapters) not ready when AgenticDetector runs | Low | Graceful fallback: CLI installs = empty array, continue with Layer 2 + 3 |
| Three layers confuse users | Medium | Layer Legend toggle explains encoding; tooltips on every badge |
