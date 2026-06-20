import type {
  AgenticProfile,
  ArchitecturePattern,
  PatternMatch,
  SignalCategory,
  SignalCategoryResult,
} from './types.js';

// ─── Pattern definitions ─────────────────────────────────────────

interface PatternDefinition {
  pattern: ArchitecturePattern;
  label: string;
  baseConfidence: number;
  /** Categories that must have at least this many matches */
  primarySignals: Array<{ category: SignalCategory; minMatches: number }>;
  /** Categories that boost confidence when present */
  corroboratingSignals: SignalCategory[];
  /** Signal IDs (from catalog) that count as corroborating */
  corroboratingSignalIds?: string[];
}

const PATTERNS: PatternDefinition[] = [
  {
    pattern: 'tool-using-single-agent',
    label: 'Tool-Using Single Agent',
    baseConfidence: 0.9,
    primarySignals: [
      { category: 'mcp', minMatches: 1 },
      { category: 'tools', minMatches: 1 },
      { category: 'agent-scripts', minMatches: 1 },
    ],
    corroboratingSignals: ['agent-methodologies'],
    corroboratingSignalIds: ['methodology-imports'],
  },
  {
    pattern: 'pipeline',
    label: 'Pipeline',
    baseConfidence: 0.7,
    primarySignals: [
      { category: 'agent-scripts', minMatches: 2 },
    ],
    corroboratingSignals: ['rules', 'prompts'],
    // Pipeline: has scripts but NO MCP (scripts do sequential file processing)
  },
  {
    pattern: 'orchestrator-worker',
    label: 'Orchestrator-Worker',
    baseConfidence: 0.85,
    primarySignals: [
      { category: 'agent-methodologies', minMatches: 1 },
      { category: 'agent-scripts', minMatches: 1 },
    ],
    corroboratingSignals: ['tools', 'mcp'],
    corroboratingSignalIds: ['methodology-configs'],
  },
  {
    pattern: 'multi-agent-collaboration',
    label: 'Multi-Agent Collaboration',
    baseConfidence: 0.75,
    primarySignals: [
      { category: 'agent-scripts', minMatches: 2 },
    ],
    corroboratingSignals: ['context-identity', 'memory'],
  },
  {
    pattern: 'evaluator-optimizer',
    label: 'Evaluator-Optimizer',
    baseConfidence: 0.7,
    primarySignals: [
      { category: 'prompts', minMatches: 1 },
      { category: 'agent-scripts', minMatches: 1 },
    ],
    corroboratingSignals: ['rules'],
    // Evaluator-optimizer has test/eval patterns + reflection in prompts
  },
  {
    pattern: 'router',
    label: 'Router',
    baseConfidence: 0.7,
    primarySignals: [
      { category: 'rules', minMatches: 2 },
    ],
    corroboratingSignals: ['prompts', 'agent-scripts'],
    // Router: multiple rules with filetype/glob routing + prompt classification
  },
  {
    pattern: 'reflection',
    label: 'Reflection',
    baseConfidence: 0.65,
    primarySignals: [
      { category: 'prompts', minMatches: 1 },
      { category: 'agent-scripts', minMatches: 1 },
    ],
    corroboratingSignals: ['memory', 'context-identity'],
  },
  {
    pattern: 'plan-and-execute',
    label: 'Plan-and-Execute',
    baseConfidence: 0.7,
    primarySignals: [
      { category: 'agent-scripts', minMatches: 1 },
      { category: 'prompts', minMatches: 1 },
    ],
    corroboratingSignals: ['rules', 'tools'],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────

function getCategoryCount(categories: SignalCategoryResult[], cat: SignalCategory): number {
  return categories.find(c => c.category === cat)?.count ?? 0;
}

function getCategoryById(categories: SignalCategoryResult[], cat: SignalCategory): SignalCategoryResult | undefined {
  return categories.find(c => c.category === cat);
}

function hasSignalId(categories: SignalCategoryResult[], signalId: string): boolean {
  for (const cat of categories) {
    for (const match of cat.matches) {
      if (match.matchedPattern === signalId) return true;
    }
  }
  return false;
}

/**
 * Check if a pattern's primary signals are all present.
 */
function hasPrimarySignals(
  def: PatternDefinition,
  categories: SignalCategoryResult[],
  // Additional check for pipeline: must NOT have MCP
  extra?: { noMcp?: boolean },
): boolean {
  for (const primary of def.primarySignals) {
    if (getCategoryCount(categories, primary.category) < primary.minMatches) {
      return false;
    }
  }

  // Pipeline specifically requires NO MCP (scripts do sequential processing, not tool-using)
  if (extra?.noMcp && getCategoryCount(categories, 'mcp') > 0) {
    return false;
  }

  return true;
}

/**
 * Count how many corroborating signals are present.
 */
function countCorroborating(
  def: PatternDefinition,
  categories: SignalCategoryResult[],
): number {
  let count = 0;
  const total = def.corroboratingSignals.length + (def.corroboratingSignalIds?.length ?? 0);

  for (const corr of def.corroboratingSignals) {
    if (getCategoryCount(categories, corr) > 0) {
      count++;
    }
  }

  for (const sigId of def.corroboratingSignalIds ?? []) {
    if (hasSignalId(categories, sigId)) {
      count++;
    }
  }

  // If there are no corroborating signals defined, return full count
  if (total === 0) return 1;
  return count;
}

/**
 * Compute confidence: base × (1 - 0.1 × missingCorroboratingSignals).
 * If no corroborating signals defined, confidence = base.
 */
function computeConfidence(def: PatternDefinition, categories: SignalCategoryResult[]): number {
  const totalCorroborating = def.corroboratingSignals.length + (def.corroboratingSignalIds?.length ?? 0);
  if (totalCorroborating === 0) {
    return def.baseConfidence;
  }

  const present = countCorroborating(def, categories);
  const missing = totalCorroborating - present;
  const confidence = def.baseConfidence * (1 - 0.1 * missing);
  return Math.max(0.1, Math.min(0.99, confidence));
}

/**
 * Analyze signal combinations and identify which architecture patterns
 * are present in the project.
 */
export function analyze(profile: AgenticProfile): PatternMatch[] {
  const categories = profile.layers['2'].categories;
  const results: PatternMatch[] = [];

  for (const def of PATTERNS) {
    // Pipeline is special: no MCP
    const extra = def.pattern === 'pipeline' ? { noMcp: true } : undefined;

    if (!hasPrimarySignals(def, categories, extra)) {
      continue;
    }

    const confidence = computeConfidence(def, categories);
    const status = confidence >= 0.7 ? 'detected' : 'tentative';

    // Build evidence list
    const evidence: string[] = [];
    for (const primary of def.primarySignals) {
      const count = getCategoryCount(categories, primary.category);
      if (count > 0) {
        evidence.push(`${primary.category}: ${count} match${count > 1 ? 'es' : ''}`);
      }
    }

    results.push({
      pattern: def.pattern,
      label: def.label,
      confidence: Math.round(confidence * 100) / 100,
      status,
      evidence,
    });
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}
