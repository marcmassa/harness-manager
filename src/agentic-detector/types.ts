// === Three-layer domain model ===

export type AgenticLayer = 1 | 2 | 3;

// === Layer 1: CLI/Install (from adapters) ===

export interface CLIInstall {
  cliId: string;
  cliName: string;
  detectedBy: string;
  configFiles: string[];
  isActive: boolean;
  layer: 1;
}

// === Layer 2: Signal categories ===

export type SignalCategory =
  | 'prompts'
  | 'rules'
  | 'mcp'
  | 'agent-methodologies'
  | 'tools'
  | 'skills'
  | 'agent-scripts'
  | 'memory'
  | 'context-identity';

export interface SignalMatch {
  filePath: string;
  category: SignalCategory;
  matchedPattern: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
  layer: 2;
}

export interface SignalCategoryResult {
  category: SignalCategory;
  label: string;
  matches: SignalMatch[];
  count: number;
  truncated: boolean;
}

// === Layer 3: Methodology (SDD) ===

export interface MethodologyInfo {
  hasMethodology: boolean;
  methodologyName: string | null;
  methodologyVersion: string | null;
  configFile: string | null;
  isActive: boolean;
  layer: 3;
}

// === Signal definitions (catalog entries) ===

export interface ContentPattern {
  description: string;
  type: 'yaml-frontmatter' | 'json-key' | 'import-statement' | 'shell-command' | 'regex';
  pattern: string; // string form of the regex, for serialisability
}

export interface SignalDefinition {
  id: string;
  category: SignalCategory;
  label: string;
  globs: string[];
  contentPatterns?: ContentPattern[];
  maxFiles?: number;
}

// === Maturity ===

export type MaturityLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface MaturityDefinition {
  label: string;
  description: string;
  color: string;
  conditions: string;
}

export const MATURITY_DEFINITIONS: Record<MaturityLevel, MaturityDefinition> = {
  L0: { label: 'None',      description: 'No agentic signals detected',                    color: '#888',    conditions: '0 signals across all layers' },
  L1: { label: 'Ad-hoc',    description: 'Sparse agentic files, no structure',              color: '#d4a017', conditions: '1–2 signal categories (L2) or CLI present but no implementation (L1 only)' },
  L2: { label: 'Structured', description: 'Organized agentic implementation or Harness',    color: '#88cc33', conditions: '3+ signal categories (L2) or Harness detected' },
  L3: { label: 'Integrated', description: 'CLI install + structured implementation',        color: '#3399ff', conditions: 'L1 CLI installed + L2 structured (3+ categories)' },
  L4: { label: 'Managed',   description: 'Full agentic ecosystem: CLI + impl + tools + skills + MCP', color: '#aa66ff', conditions: 'L3 + tools + skills + MCP categories active' },
  L5: { label: 'Governed',  description: 'SDD methodology active on top of full stack',     color: '#22bb66', conditions: 'L4 + SDD methodology (specs + traceability)' },
};

export interface MaturityInfo {
  level: MaturityLevel;
  label: string;
  description: string;
  color: string;
  nextLevel: {
    level: MaturityLevel;
    whatIsNeeded: string;
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
  confidence: number;
  status: 'detected' | 'tentative';
  evidence: string[];
}

// === Suggestion Actions (FEAT-032) ===

export type ActionType =
  | 'open-file'
  | 'create-directory'
  | 'create-file'
  | 'scaffold-agent'
  | 'scaffold-skill'
  | 'run-command';

export interface SuggestionAction {
  id: string;
  label: string;
  type: ActionType;
  payload: Record<string, string>;
}

// === Suggestions ===

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  layer: AgenticLayer;
  category: SignalCategory | 'cli' | 'methodology';
  maturityTrigger: MaturityLevel[];
  actionType?: 'scaffold' | 'navigate' | 'link';
  actionPayload?: string;
  actions?: SuggestionAction[];   // FEAT-032: executable action buttons
}

// === GraphContext (in-memory whiteboard/SDD state passed to scan) ===

export interface GraphContext {
  nodeCount: number;
  nodesByType: Record<string, number>;
  edgeCount: number;
  featureCount: number;
  featuresByStatus: Record<string, number>;
}

// === ArchitectureSummary (lightweight broadcast to all tabs) ===

export interface ArchitectureSummary {
  maturityLevel: MaturityLevel | null;
  maturityLabel: string;
  maturityColor: string;
  activeSuggestions: number;
  scanTimestamp: number;
  isScanning: boolean;
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
  graphContext?: GraphContext;
}
