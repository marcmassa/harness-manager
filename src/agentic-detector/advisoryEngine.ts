import type {
  AgenticProfile,
  Suggestion,
  SignalCategory,
  SignalCategoryResult,
  MaturityLevel,
} from './types.js';

// ─── Suggestion rule definition ────────────────────────────────────────────

interface SuggestionRule {
  id: string;
  condition: (profile: AgenticProfile) => boolean;
  build: (profile: AgenticProfile) => Omit<Suggestion, 'id'>;
}

// ─── Helper: check if a category has matches ────────────────────────────────

function hasCategory(profile: AgenticProfile, cat: SignalCategory): boolean {
  return profile.layers['2'].categories.some(c => c.category === cat && c.count > 0);
}

function countCategory(profile: AgenticProfile, cat: SignalCategory): number {
  return profile.layers['2'].categories.find(c => c.category === cat)?.count ?? 0;
}

function hasCLI(profile: AgenticProfile): boolean {
  return profile.layers['1'].cliInstalls.length > 0;
}

function hasHarness(profile: AgenticProfile): boolean {
  // Harness is detected when agent-methodologies has harness-* signal matches
  const cat = profile.layers['2'].categories.find(c => c.category === 'agent-methodologies');
  if (!cat) return false;
  return cat.matches.some(m => m.matchedPattern.startsWith('harness-'));
}

function hasSDD(profile: AgenticProfile): boolean {
  return profile.layers['3'].methodology.isActive;
}

function currentLevel(profile: AgenticProfile): MaturityLevel {
  return profile.maturity.level;
}

function isAtOrBelow(profile: AgenticProfile, maxLevel: MaturityLevel): boolean {
  const levels: MaturityLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  return levels.indexOf(currentLevel(profile)) <= levels.indexOf(maxLevel);
}

function isAtOrAbove(profile: AgenticProfile, minLevel: MaturityLevel): boolean {
  const levels: MaturityLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  return levels.indexOf(currentLevel(profile)) >= levels.indexOf(minLevel);
}

function isBetween(profile: AgenticProfile, min: MaturityLevel, max: MaturityLevel): boolean {
  const levels: MaturityLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  const idx = levels.indexOf(currentLevel(profile));
  return idx >= levels.indexOf(min) && idx <= levels.indexOf(max);
}

// ─── Suggestion rules (S01–S15 from design.md) ──────────────────────────────

const RULES: SuggestionRule[] = [
  // S01 — Unstructured prompts
  {
    id: 'organize-prompts',
    condition: p => hasCategory(p, 'prompts') && isAtOrAbove(p, 'L1') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Organize prompt files into a dedicated directory',
      description: 'Move prompt/instruction files into a `prompts/` directory to keep them discoverable and maintainable.',
      impact: 'medium' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'prompts' as const,
      maturityTrigger: ['L1', 'L2', 'L3', 'L4'],
    }),
  },

  // S02 — Unstructured rules
  {
    id: 'organize-rules',
    condition: p => hasCategory(p, 'rules') && isAtOrAbove(p, 'L1') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Consolidate rules into a dedicated directory',
      description: 'Gather rule files into a `rules/` directory for better organization and cross-CLI portability.',
      impact: 'medium' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'rules' as const,
      maturityTrigger: ['L1', 'L2', 'L3', 'L4'],
    }),
  },

  // S03 — CLI installed but no implementation
  {
    id: 'cli-without-impl',
    condition: p => hasCLI(p) && !hasCategory(p, 'prompts') && !hasCategory(p, 'rules') && isAtOrAbove(p, 'L1') && isAtOrBelow(p, 'L2'),
    build: (p) => {
      const cliName = p.layers['1'].cliInstalls[0]?.cliName ?? 'your CLI';
      return {
        title: `Add custom prompts and rules for ${cliName}`,
        description: `${cliName} is installed but has no custom prompts or rules. Define how ${cliName} should behave in your project.`,
        impact: 'high' as const,
        effort: 'medium' as const,
        layer: 1 as const,
        category: 'cli' as const,
        maturityTrigger: ['L1', 'L2'],
      };
    },
  },

  // S04 — Structured impl but no CLI
  {
    id: 'impl-without-cli',
    condition: p => !hasCLI(p) && isAtOrAbove(p, 'L2') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Install and configure an agentic CLI',
      description: 'You have structured agentic files but no CLI install detected. Configure Claude Code, Kiro, Cursor, or another agentic CLI to run them.',
      impact: 'high' as const,
      effort: 'low' as const,
      layer: 1 as const,
      category: 'cli' as const,
      maturityTrigger: ['L2', 'L3', 'L4'],
    }),
  },

  // S05 — CLI + impl but no MCP
  {
    id: 'add-mcp',
    condition: p => hasCLI(p) && hasCategory(p, 'tools') && !hasCategory(p, 'mcp') && isAtOrAbove(p, 'L2') && isAtOrBelow(p, 'L3'),
    build: () => ({
      title: 'Add MCP servers to your agent stack',
      description: 'MCP (Model Context Protocol) servers give your agents access to tools and data sources. Add an mcp.json configuration.',
      impact: 'high' as const,
      effort: 'medium' as const,
      layer: 2 as const,
      category: 'mcp' as const,
      maturityTrigger: ['L2', 'L3'],
    }),
  },

  // S06 — CLI-specific rules → platform-agnostic steering
  {
    id: 'migrate-to-steering',
    condition: p => hasCategory(p, 'rules') && isAtOrAbove(p, 'L2') && isAtOrBelow(p, 'L3'),
    build: () => ({
      title: 'Migrate CLI-specific rules to platform-agnostic steering files',
      description: 'CLI-specific files like .cursorrules or .clinerules only work with one tool. Extract shared rules into steering/ files that work across any agentic CLI.',
      impact: 'medium' as const,
      effort: 'medium' as const,
      layer: 2 as const,
      category: 'rules' as const,
      maturityTrigger: ['L2', 'L3'],
    }),
  },

  // S07 — MCP without agent definitions
  {
    id: 'mcp-without-agents',
    condition: p => hasCategory(p, 'mcp') && !hasCategory(p, 'agent-scripts') && isAtOrAbove(p, 'L2') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Define agents that use your MCP tools',
      description: 'MCP servers are configured but no agent scripts are detected. Create agent scripts that consume those MCP tools.',
      impact: 'high' as const,
      effort: 'medium' as const,
      layer: 2 as const,
      category: 'agent-scripts' as const,
      maturityTrigger: ['L2', 'L3', 'L4'],
    }),
  },

  // S08 — Tools without skill docs
  {
    id: 'tools-without-skills',
    condition: p => hasCategory(p, 'tools') && !hasCategory(p, 'skills') && isAtOrAbove(p, 'L2') && isAtOrBelow(p, 'L3'),
    build: () => ({
      title: 'Document tools as reusable skill files',
      description: 'Tool definitions are present but no skill files exist. Document each tool as a SKILL.md for reusability across agents.',
      impact: 'medium' as const,
      effort: 'medium' as const,
      layer: 2 as const,
      category: 'skills' as const,
      maturityTrigger: ['L2', 'L3'],
    }),
  },

  // S09 — Single agent script with many tools → split into subagents
  {
    id: 'split-into-subagents',
    condition: p => {
      const scriptCount = countCategory(p, 'agent-scripts');
      const toolCount = countCategory(p, 'tools');
      return scriptCount >= 1 && toolCount >= 3 && isAtOrAbove(p, 'L2') && isAtOrBelow(p, 'L4');
    },
    build: () => ({
      title: 'Split into specialized subagents',
      description: 'A single agent manages 3+ tools. Consider splitting into specialized subagents, each with focused tools and responsibilities.',
      impact: 'high' as const,
      effort: 'high' as const,
      layer: 2 as const,
      category: 'agent-scripts' as const,
      maturityTrigger: ['L2', 'L3', 'L4'],
    }),
  },

  // S10 — Scripts share prompt patterns
  {
    id: 'extract-shared-prompts',
    condition: p => countCategory(p, 'agent-scripts') >= 2 && hasCategory(p, 'prompts') && isAtOrAbove(p, 'L2') && isAtOrBelow(p, 'L3'),
    build: () => ({
      title: 'Extract shared prompts into reusable skill files',
      description: 'Multiple agent scripts reference similar patterns. Extract shared prompts into SKILL.md files for consistency and reuse.',
      impact: 'medium' as const,
      effort: 'medium' as const,
      layer: 2 as const,
      category: 'skills' as const,
      maturityTrigger: ['L2', 'L3'],
    }),
  },

  // S11 — No memory layer at L4
  {
    id: 'add-memory-layer',
    condition: p => !hasCategory(p, 'memory') && isAtOrAbove(p, 'L4') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Add memory and state management',
      description: 'At the Managed maturity level, adding memory/state files enables agent continuity across sessions and improves reliability.',
      impact: 'medium' as const,
      effort: 'medium' as const,
      layer: 2 as const,
      category: 'memory' as const,
      maturityTrigger: ['L4'],
    }),
  },

  // S12 — No context/identity files at L3+
  {
    id: 'add-context-identity',
    condition: p => !hasCategory(p, 'context-identity') && isAtOrAbove(p, 'L3') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Add context and identity files',
      description: 'Context files (CONTEXT.md, SOUL.md) define your agent\'s persona and project awareness. Add them for consistent agent behaviour.',
      impact: 'medium' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'context-identity' as const,
      maturityTrigger: ['L3', 'L4'],
    }),
  },

  // S13 — Adopt SDD for governance (generic, L1–L4)
  {
    id: 'adopt-sdd',
    condition: p => !hasSDD(p) && isAtOrAbove(p, 'L1') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Apply SDD methodology for lifecycle governance',
      description: 'Add feature_list.json with lifecycle statuses, specs/ with requirements/design/tasks, and progress/ tracking to govern your agentic workflow.',
      impact: 'high' as const,
      effort: 'high' as const,
      layer: 3 as const,
      category: 'methodology' as const,
      actionType: 'scaffold' as const,
      actionPayload: 'harness-sdd',
      maturityTrigger: ['L1', 'L2', 'L3', 'L4'],
    }),
  },

  // S14 — Ready for SDD (L4 conditions met, no SDD)
  {
    id: 'ready-for-sdd',
    condition: p => !hasSDD(p) && isAtOrAbove(p, 'L4') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Your project is ready for SDD governance',
      description: 'All technical layers are in place. Add SDD methodology to achieve L5 (Governed) with full lifecycle management and traceability.',
      impact: 'high' as const,
      effort: 'high' as const,
      layer: 3 as const,
      category: 'methodology' as const,
      actionType: 'scaffold' as const,
      actionPayload: 'harness-sdd',
      maturityTrigger: ['L4'],
    }),
  },

  // S15 — L5 but incomplete (delegated — placeholder message)
  {
    id: 'l5-incomplete',
    condition: p => {
      if (currentLevel(p) !== 'L5') return false;
      // Check if SDD is "incomplete" (feature_list or specs missing key parts)
      const methodology = p.layers['3'].methodology;
      return methodology.hasMethodology === false;
    },
    build: () => ({
      title: 'Review governance completeness',
      description: 'L5 requires active spec lifecycle. Ensure feature_list.json has sdd:true entries with lifecycle statuses and specs/ contains requirements, design, and tasks for each feature.',
      impact: 'medium' as const,
      effort: 'medium' as const,
      layer: 3 as const,
      category: 'methodology' as const,
      maturityTrigger: ['L5'],
    }),
  },

  // ─── Additional suggestions beyond S01–S15 ────────────────────────────────

  // L0: No signals at all
  {
    id: 'no-signals-detected',
    condition: p => currentLevel(p) === 'L0',
    build: () => ({
      title: 'No agentic patterns detected',
      description: 'Your workspace has no agentic signals. Learn about agentic AI architectures and how to structure your project for AI-assisted development.',
      impact: 'high' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'prompts' as const,
      actionType: 'navigate' as const,
      actionPayload: 'https://docs.harness-manager.dev/getting-started',
      maturityTrigger: ['L0'],
    }),
  },

  // Scattered files (1-2 categories) without organized dirs
  {
    id: 'structure-scattered-files',
    condition: p => {
      const active = p.layers['2'].categories.filter(c => c.count > 0).length;
      return active >= 1 && active <= 2 && currentLevel(p) === 'L1';
    },
    build: () => ({
      title: 'Organize files into dedicated directories',
      description: 'Files are scattered without structure. Use directories like prompts/, rules/, and skills/ to organize your agentic configuration.',
      impact: 'low' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'rules' as const,
      maturityTrigger: ['L1'],
    }),
  },

  // Harness detected but no SDD (more specific than S13)
  {
    id: 'harness-without-sdd',
    condition: p => hasHarness(p) && !hasSDD(p) && isAtOrAbove(p, 'L2'),
    build: () => ({
      title: 'Complete your Harness setup with SDD governance',
      description: 'Harness implementation is detected but SDD methodology is absent. Add feature_list.json, specs/, and progress/ to achieve full lifecycle governance (L5).',
      impact: 'high' as const,
      effort: 'medium' as const,
      layer: 3 as const,
      category: 'methodology' as const,
      actionType: 'scaffold' as const,
      actionPayload: 'harness-sdd',
      maturityTrigger: ['L2', 'L3', 'L4'],
    }),
  },
];

// ─── Priority comparator ────────────────────────────────────────────────────

const IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const EFFORT_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };
const LEVEL_ORDER: Record<MaturityLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };

function suggestionPriority(s: Suggestion): number[] {
  const impactRank = IMPACT_ORDER[s.impact] ?? 99;
  const effortRank = EFFORT_ORDER[s.effort] ?? 99;
  // Lower maturity first (help lower levels first) — but only as tiebreaker
  const minTriggerLevel = Math.min(...s.maturityTrigger.map(l => LEVEL_ORDER[l] ?? 99));
  return [impactRank, effortRank, minTriggerLevel];
}

function byPriority(a: Suggestion, b: Suggestion): number {
  const pa = suggestionPriority(a);
  const pb = suggestionPriority(b);
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate improvement suggestions for an AgenticProfile.
 *
 * @param profile       The scanned agentic profile
 * @param dismissedIds  Set of suggestion IDs that the user has dismissed (optional)
 * @returns             Sorted, deduped, maturity-gated Suggestion[]
 */
export function generate(
  profile: AgenticProfile,
  dismissedIds?: Set<string>,
): Suggestion[] {
  const dismissed = dismissedIds ?? new Set<string>();

  const suggestions: Suggestion[] = [];

  for (const rule of RULES) {
    if (dismissed.has(rule.id)) continue;

    try {
      if (rule.condition(profile)) {
        const base = rule.build(profile);
        suggestions.push({ id: rule.id, ...base });
      }
    } catch {
      // If a rule errors, skip it gracefully
    }
  }

  // Dedup by id (should never happen, but be safe)
  const seen = new Set<string>();
  const unique = suggestions.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  return unique.sort(byPriority);
}
