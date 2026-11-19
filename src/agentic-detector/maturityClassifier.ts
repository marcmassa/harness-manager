import type {
  AgenticProfile,
  MaturityLevel,
  MaturityInfo,
  SignalCategory,
} from './types.js';
import { MATURITY_DEFINITIONS } from './types.js';
import { hasGovernedLifecycle, sharedCategories, unavailableInputs } from './evidence.js';

/**
 * Categories whose presence shows structure rather than scattered files.
 * Provider-parsed resources count: an adapter only reads declared layouts.
 */
const ORGANIZED_CATEGORIES: SignalCategory[] = ['prompts', 'rules', 'skills', 'tools', 'agent-methodologies'];

/** The "full stack" categories required for L4 (Managed). */
const FULL_STACK_CATEGORIES: SignalCategory[] = ['tools', 'skills', 'mcp'];

// FEAT-042 R3: every check reads the shared evidence (evidence.ts), so two
// layouts with equivalent workflows get the same level. There is no
// framework shortcut: a Harness SDD manifest is evidence of roles and skills
// like any other provider's files, not a level of its own.
const countActiveCategories = (profile: AgenticProfile) => sharedCategories(profile).size;
const hasOrganizedStructure = (profile: AgenticProfile) => ORGANIZED_CATEGORIES.some(cat => sharedCategories(profile).has(cat));
const hasFullStack = (profile: AgenticProfile) => FULL_STACK_CATEGORIES.every(cat => sharedCategories(profile).has(cat));
const countCLIInstalls = (profile: AgenticProfile) => profile.layers['1'].cliInstalls.length;

/**
 * Determine what's needed to reach the next maturity level.
 */
function nextLevelHint(current: MaturityLevel): { level: MaturityLevel; whatIsNeeded: string } | null {
  switch (current) {
    case 'L0':
      return { level: 'L1', whatIsNeeded: 'Add agentic files such as prompts, rules, or configure an agentic CLI' };
    case 'L1':
      return { level: 'L2', whatIsNeeded: 'Organize agentic files into a structure your tools read: role definitions, skills or rule directories' };
    case 'L2':
      return { level: 'L3', whatIsNeeded: 'Configure an agent CLI alongside your implementation' };
    case 'L3':
      return { level: 'L4', whatIsNeeded: 'Add tools, skills, and MCP servers to cover the full agentic stack' };
    case 'L4':
      return { level: 'L5', whatIsNeeded: 'Track work in a governed lifecycle: a feature registry or spec documents in any layout' };
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
 * 4. (FEAT-042) No framework shortcut: categories come from shared evidence
 * 5. Check for tools + skills + mcp all present (full stack)
 * 6. Check for a governed lifecycle (feature registry or spec documents)
 * 7. Resolve to highest matching level
 */
export function classify(profile: AgenticProfile): MaturityInfo {
  const cliCount = countCLIInstalls(profile);
  const activeCats = countActiveCategories(profile);
  const organized = hasOrganizedStructure(profile);
  const fullStack = hasFullStack(profile);
  const lifecycle = hasGovernedLifecycle(profile);

  let level: MaturityLevel;

  if (lifecycle && cliCount > 0 && activeCats >= 3 && fullStack) {
    level = 'L5'; // full stack + governed lifecycle
  } else if (cliCount > 0 && activeCats >= 3 && fullStack) {
    level = 'L4'; // full stack + CLI
  } else if (cliCount > 0 && activeCats >= 3) {
    level = 'L3'; // CLI + three active categories
  } else if (activeCats >= 3 && organized) {
    level = 'L2'; // structured implementation
  } else if (activeCats >= 1 || cliCount > 0) {
    level = 'L1'; // any signal
  } else {
    level = 'L0';
  }

  const def = MATURITY_DEFINITIONS[level];

  return {
    level,
    label: def.label,
    description: def.description,
    color: def.color,
    nextLevel: nextLevelHint(level),
    unavailableInputs: unavailableInputs(profile),
  };
}
