import type {
  AgenticProfile,
  MaturityLevel,
  MaturityInfo,
  SignalCategory,
} from './types.js';
import { MATURITY_DEFINITIONS } from './types.js';

/**
 * Signal categories that indicate structured/organized directories
 * vs. scattered single files.
 */
const ORGANIZED_DIR_CATEGORIES: SignalCategory[] = [
  'prompts',
  'rules',
  'skills',
  'tools',
];

/**
 * The "full stack" categories required for L4 (Managed).
 */
const FULL_STACK_CATEGORIES: SignalCategory[] = [
  'tools',
  'skills',
  'mcp',
];

/**
 * Harness-specific signal identifiers from the catalog.
 */
const HARNESS_SIGNAL_IDS = new Set([
  'harness-agentic-json',
  'harness-subagents',
  'harness-agents-md',
  'harness-steering',
  'harness-skills',
  'harness-commands',
  'harness-hooks',
]);

/**
 * Count non-empty signal categories from Layer-2 results.
 */
function countActiveCategories(profile: AgenticProfile): number {
  return profile.layers['2'].categories.filter(c => c.count > 0).length;
}

/**
 * Check if Harness implementation is detected (Layer 2).
 * Harness = existence of .agents/agentic.json or subagents/ structure.
 */
function hasHarness(profile: AgenticProfile): boolean {
  const categories = profile.layers['2'].categories;
  for (const cat of categories) {
    for (const match of cat.matches) {
      if (HARNESS_SIGNAL_IDS.has(match.matchedPattern)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if organized directories exist: at least one of prompts/, rules/,
 * skills/, tools/ directories (not just scattered files).
 */
function hasOrganizedDirectories(profile: AgenticProfile): boolean {
  const categoryMap = new Map<SignalCategory, number>();
  for (const c of profile.layers['2'].categories) {
    categoryMap.set(c.category, c.count);
  }

  // Consider a category "organized" if it has an entry with matching globs
  // that indicate a directory structure. For now, any non-zero count in
  // these categories implies files exist; in a more refined version we'd
  // check if the globs include directory patterns.
  for (const cat of ORGANIZED_DIR_CATEGORIES) {
    if ((categoryMap.get(cat) ?? 0) > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Check if all "full stack" categories have matches (for L4).
 */
function hasFullStack(profile: AgenticProfile): boolean {
  const categoryMap = new Map<SignalCategory, number>();
  for (const c of profile.layers['2'].categories) {
    categoryMap.set(c.category, c.count);
  }

  for (const cat of FULL_STACK_CATEGORIES) {
    if ((categoryMap.get(cat) ?? 0) === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Check if SDD methodology is active (Layer 3).
 */
function hasSDD(profile: AgenticProfile): boolean {
  return profile.layers['3'].methodology.isActive;
}

/**
 * Count Layer-1 CLI installs.
 */
function countCLIInstalls(profile: AgenticProfile): number {
  return profile.layers['1'].cliInstalls.length;
}

/**
 * Determine what's needed to reach the next maturity level.
 */
function nextLevelHint(current: MaturityLevel): { level: MaturityLevel; whatIsNeeded: string } | null {
  switch (current) {
    case 'L0':
      return { level: 'L1', whatIsNeeded: 'Add agentic files such as prompts, rules, or configure an agentic CLI' };
    case 'L1':
      return { level: 'L2', whatIsNeeded: 'Organize agentic files into structured directories (prompts/, rules/, skills/) or adopt the Harness framework' };
    case 'L2':
      return { level: 'L3', whatIsNeeded: 'Install and configure an agentic CLI (Claude Code, Kiro, Cursor, etc.) alongside your implementation' };
    case 'L3':
      return { level: 'L4', whatIsNeeded: 'Add tools, skills, and MCP servers to cover the full agentic stack' };
    case 'L4':
      return { level: 'L5', whatIsNeeded: 'Adopt SDD methodology: add feature_list.json with lifecycle, specs/, and progress/ for full governance' };
    case 'L5':
      return null;
  }
}

/**
 * Classify a project's agentic maturity level based on all three layers.
 *
 * Algorithm (from design.md):
 * 1. Count Layer-1 CLI installs
 * 2. Count non-empty Layer-2 signal categories
 * 3. Check for organized directories (prompts/, rules/, skills/, tools/)
 * 4. Check for Harness implementation
 * 5. Check for tools + skills + mcp all present (full stack)
 * 6. Check for Layer-3 SDD methodology
 * 7. Resolve to highest matching level
 */
export function classify(profile: AgenticProfile): MaturityInfo {
  const cliCount = countCLIInstalls(profile);
  const activeCats = countActiveCategories(profile);
  const organized = hasOrganizedDirectories(profile);
  const harness = hasHarness(profile);
  const fullStack = hasFullStack(profile);
  const sdd = hasSDD(profile);

  let level: MaturityLevel;

  // L5: Full stack + SDD methodology
  if (sdd && cliCount > 0 && activeCats >= 3 && fullStack) {
    level = 'L5';
  }
  // L4: Full stack + CLI + structured (but no SDD)
  else if (cliCount > 0 && activeCats >= 3 && fullStack) {
    level = 'L4';
  }
  // L3: CLI + structured (3+ categories with organized dirs OR Harness)
  else if (cliCount > 0 && (activeCats >= 3 || harness)) {
    level = 'L3';
  }
  // L2: Structured implementation (3+ cats with organized dirs) OR Harness
  else if ((activeCats >= 3 && organized) || harness) {
    level = 'L2';
  }
  // L1: Any signal (1-2 cats, or CLI only, or scattered files)
  else if (activeCats >= 1 || cliCount > 0) {
    level = 'L1';
  }
  // L0: Nothing detected
  else {
    level = 'L0';
  }

  const def = MATURITY_DEFINITIONS[level];

  return {
    level,
    label: def.label,
    description: def.description,
    color: def.color,
    nextLevel: nextLevelHint(level),
  };
}
