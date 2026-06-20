import type { SignalDefinition, ContentPattern } from './types.js';

/**
 * Declarative signal catalog for Layer-2 (implementation) detection.
 * Each entry defines globs and optional content heuristics.
 * Adding a new signal = adding an entry here — no code changes needed.
 */
export const SIGNAL_CATALOG: SignalDefinition[] = [
  // ── Prompts ──────────────────────────────────────────
  {
    id: 'prompt-files',
    category: 'prompts',
    label: 'Prompt Files',
    globs: ['**/*.prompt.md', '**/*.instruction.md'],
  },
  {
    id: 'prompt-dirs',
    category: 'prompts',
    label: 'Prompt Directories',
    globs: ['**/prompts/**', '**/instructions/**', '**/system-prompts/**'],
  },
  {
    id: 'prompt-frontmatter',
    category: 'prompts',
    label: 'Prompt Frontmatter',
    globs: ['**/*.md'],
    maxFiles: 200,
    contentPatterns: [{
      type: 'yaml-frontmatter',
      description: 'prompt metadata (role/expertise/persona)',
      pattern: '^(role|expertise|persona|personality):',
    }],
  },

  // ── Rules ────────────────────────────────────────────
  {
    id: 'dot-rules-files',
    category: 'rules',
    label: 'Rules Files',
    globs: ['**/.cursorrules', '**/.windsurfrules', '**/.clinerules'],
  },
  {
    id: 'rules-dirs',
    category: 'rules',
    label: 'Rules Directories',
    globs: ['**/rules/**/*.md', '**/.rules/**'],
  },
  {
    id: 'rules-mdc',
    category: 'rules',
    label: 'Cursor MDC Rules',
    globs: ['**/*.mdc'],
    contentPatterns: [{
      type: 'yaml-frontmatter',
      description: 'MDC rule with alwaysApply or globs',
      pattern: '^(alwaysApply|globs):',
    }],
  },

  // ── MCP ──────────────────────────────────────────────
  {
    id: 'mcp-config',
    category: 'mcp',
    label: 'MCP Config Files',
    globs: ['**/mcp.json', '**/mcp-servers.json'],
  },
  {
    id: 'mcp-dir',
    category: 'mcp',
    label: 'MCP Directories',
    globs: ['**/.mcp/**', '**/mcp/**'],
  },
  {
    id: 'mcp-content',
    category: 'mcp',
    label: 'MCP Content Matches',
    globs: ['**/*.json'],
    maxFiles: 200,
    contentPatterns: [{
      type: 'json-key',
      description: 'MCP server or transport definition',
      pattern: '"type": "mcp"',
    }],
  },

  // ── Agent Methodologies (Layer-2 frameworks) ─────────
  {
    id: 'methodology-configs',
    category: 'agent-methodologies',
    label: 'Methodology Configs',
    globs: [
      '**/langgraph.json',
      '**/langchain-*.json',
      '**/crewai*.yaml',
      '**/crewai*.yml',
      '**/autogen*.yaml',
      '**/autogen*.yml',
    ],
  },
  {
    id: 'methodology-root-files',
    category: 'agent-methodologies',
    label: 'Agent Root Files',
    globs: ['AI_AGENT.md', 'AGENTS.md', 'AGENT.md'],
  },
  {
    id: 'methodology-imports',
    category: 'agent-methodologies',
    label: 'Methodology Imports',
    globs: ['**/*.py', '**/*.ts', '**/*.js'],
    maxFiles: 200,
    contentPatterns: [{
      type: 'import-statement',
      description: 'agent framework import',
      pattern: '(?:from|import)\\s+(?:openai|anthropic|langchain|crewai|autogen)',
    }],
  },

  // ── Harness implementation signals ───────────────────
  // NOTE: These are Layer-2 signals that detect Harness as an
  // implementation framework, SEPARATE from SDD methodology (Layer 3).
  {
    id: 'harness-agentic-json',
    category: 'agent-methodologies',
    label: 'Harness agentic.json',
    globs: ['.agents/agentic.json'],
  },
  {
    id: 'harness-agents-md',
    category: 'agent-methodologies',
    label: 'Harness AGENTS.md',
    globs: ['AGENTS.md'],
  },
  {
    id: 'harness-subagents',
    category: 'agent-methodologies',
    label: 'Harness Subagents',
    globs: ['.agents/subagents/**'],
  },
  {
    id: 'harness-steering',
    category: 'agent-methodologies',
    label: 'Harness Steering Files',
    globs: ['.agents/steering/**'],
  },
  {
    id: 'harness-skills',
    category: 'agent-methodologies',
    label: 'Harness Skills',
    globs: ['.agents/skills/**'],
  },
  {
    id: 'harness-commands',
    category: 'agent-methodologies',
    label: 'Harness Commands',
    globs: ['.agents/commands/**'],
  },
  {
    id: 'harness-hooks',
    category: 'agent-methodologies',
    label: 'Harness Hooks',
    globs: ['.agents/hooks/**'],
  },

  // ── Tools ────────────────────────────────────────────
  {
    id: 'tool-dirs',
    category: 'tools',
    label: 'Tool Directories',
    globs: ['**/tools/**', '**/tool_definitions/**'],
  },
  {
    id: 'tool-files',
    category: 'tools',
    label: 'Tool Files',
    globs: ['**/*_tool.py', '**/*_tool.ts', '**/*_tool.js'],
  },

  // ── Skills ───────────────────────────────────────────
  {
    id: 'skill-files',
    category: 'skills',
    label: 'SKILL.md Files',
    globs: ['**/SKILL.md', '**/*_SKILL.md'],
  },
  {
    id: 'skill-dirs',
    category: 'skills',
    label: 'Skill Directories',
    globs: ['**/skills/**'],
  },

  // ── Agent scripts ────────────────────────────────────
  {
    id: 'agent-files',
    category: 'agent-scripts',
    label: 'Agent Script Files',
    globs: ['**/*.agent.py', '**/*.agent.ts'],
  },
  {
    id: 'cli-invocations',
    category: 'agent-scripts',
    label: 'CLI Agent Invocations',
    globs: ['**/*.sh', '**/*.bash'],
    maxFiles: 200,
    contentPatterns: [{
      type: 'shell-command',
      description: 'agent CLI invocation',
      pattern: '\\b(opencode|claude|gemini|cursor)\\b',
    }],
  },

  // ── Memory ───────────────────────────────────────────
  {
    id: 'memory-files',
    category: 'memory',
    label: 'Memory Files',
    globs: ['**/memory.json', '**/*.memory.md'],
  },

  // ── Context / Identity ───────────────────────────────
  {
    id: 'context-files',
    category: 'context-identity',
    label: 'Context Files',
    globs: ['CONTEXT.md', 'SOUL.md', 'CHARACTER.md'],
  },
  {
    id: 'identity-frontmatter',
    category: 'context-identity',
    label: 'Identity Frontmatter',
    globs: ['**/*.md'],
    maxFiles: 200,
    contentPatterns: [{
      type: 'yaml-frontmatter',
      description: 'role/personality/persona',
      pattern: '^(role|personality|expertise|character):',
    }],
  },
];

/**
 * Returns all signal definitions for a given category.
 */
export function getSignalsByCategory(category: string): SignalDefinition[] {
  return SIGNAL_CATALOG.filter(s => s.category === category);
}

/**
 * Returns all unique file glob patterns across all signals,
 * useful for setting up file watchers.
 */
export function getAllGlobs(): string[] {
  const set = new Set<string>();
  for (const signal of SIGNAL_CATALOG) {
    for (const glob of signal.globs) {
      set.add(glob);
    }
  }
  return Array.from(set);
}

/**
 * Returns a map of category → globs for targeted re-scans.
 */
export function getGlobsByCategory(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const signal of SIGNAL_CATALOG) {
    if (!map[signal.category]) map[signal.category] = [];
    for (const glob of signal.globs) {
      if (!map[signal.category].includes(glob)) {
        map[signal.category].push(glob);
      }
    }
  }
  return map;
}
