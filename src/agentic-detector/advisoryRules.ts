// Advisory rules S01–S12: shared structure findings (split from advisoryEngine.ts).
import type { SuggestionRule } from './ruleHelpers.js';
import type { SignalCategory, SuggestionAction } from './types.js';
import { hasToolSpecificRules, hasCategory, countCategory, hasCLI, isAtOrBelow, isAtOrAbove } from './ruleHelpers.js';

const IMPLEMENTATION: SignalCategory[] = ['prompts', 'rules', 'context-identity', 'agent-methodologies', 'skills'];

export const CORE_RULES: SuggestionRule[] = [
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
      actions: [
        {
          id: 'create-prompts-dir',
          label: 'Create prompts/',
          type: 'create-directory',
          payload: { relPath: 'prompts' },
        },
        {
          id: 'create-system-prompt',
          label: 'Add prompts/system.md',
          type: 'create-file',
          payload: {
            relPath: 'prompts/system.md',
            template: '# System Prompt\n\nYou are a helpful AI assistant.\n',
          },
        },
      ] satisfies SuggestionAction[],
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
    // FEAT-042: instructions, roles and skills are implementation too, in any layout.
    condition: p => hasCLI(p) && !IMPLEMENTATION.some(cat => hasCategory(p, cat)) && isAtOrAbove(p, 'L1') && isAtOrBelow(p, 'L2'),
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
    condition: p => hasToolSpecificRules(p) && isAtOrAbove(p, 'L2') && isAtOrBelow(p, 'L3'),
    build: () => ({
      title: 'Share tool-specific rules with your other agents',
      description: 'Rules kept in one tool\'s format (.cursorrules, .clinerules, Cursor or Windsurf rule files) only reach that tool. If you use more than one agent, keep the shared rules in a file each of them reads.',
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
];
