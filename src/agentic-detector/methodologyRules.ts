// Advisory rules S13+ and graph-context rules (split from advisoryEngine.ts).
import type { SuggestionRule } from './ruleHelpers.js';
import type { SuggestionAction } from './types.js';
import { evidenceOwners } from './evidence.js';
import { activeCategoryCount, hasCategory, hasHarness, hasSDD, currentLevel, isAtOrBelow, isAtOrAbove } from './ruleHelpers.js';

export const METHODOLOGY_RULES: SuggestionRule[] = [
  // S13 — Adopt SDD for governance (generic, L1–L4)
  {
    id: 'adopt-sdd',
    condition: p => !hasSDD(p) && isAtOrAbove(p, 'L1') && isAtOrBelow(p, 'L4'),
    build: () => ({
      title: 'Track work in a governed lifecycle',
      description: 'No feature registry or spec documents were found. Recording features with a lifecycle status and a spec for each lets you trace why each change was made. Any layout works; the Harness SDD scaffold is one option.',
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
      title: 'Your project is ready for a governed lifecycle',
      description: 'All technical layers are in place. A feature registry or spec documents, in any layout, complete L5 (Governed) with lifecycle management and traceability.',
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
      actions: [
        {
          id: 'scaffold-main-agent',
          label: 'Create starter agent',
          type: 'scaffold-agent',
          payload: { name: 'main-agent', description: 'A general-purpose agent for this project.' },
        },
      ] satisfies SuggestionAction[],
    }),
  },

  // Scattered files (1-2 categories) without organized dirs
  {
    id: 'structure-scattered-files',
    condition: p => {
      const active = activeCategoryCount(p);
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

  // FEAT-032: add-claude-md — Claude Code CLI detected, no context-identity files
  {
    id: 'add-claude-md',
    condition: p =>
      p.layers['1'].cliInstalls.some(c => c.cliId === 'claude-code') &&
      // R1: a CLAUDE.md the Claude Code adapter already read is never "missing".
      !evidenceOwners(p, 'context-identity').includes('claude-code') &&
      !hasCategory(p, 'context-identity') &&
      isAtOrAbove(p, 'L1') &&
      isAtOrBelow(p, 'L3'),
    build: () => ({
      title: 'Add a CLAUDE.md project context file',
      description: 'A CLAUDE.md file gives Claude Code essential context about your project — goals, architecture, and conventions. Create one to improve AI assistance quality.',
      impact: 'medium' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'context-identity' as const,
      maturityTrigger: ['L1', 'L2', 'L3'],
      actions: [
        {
          id: 'create-claude-md',
          label: 'Create CLAUDE.md',
          type: 'create-file',
          payload: {
            relPath: 'CLAUDE.md',
            template: '# Project Context\n\n## Overview\n\n<!-- Describe your project here -->\n\n## Architecture\n\n<!-- Describe key architectural decisions -->\n\n## Development Guidelines\n\n<!-- Add conventions and guidelines for AI assistants -->\n',
          },
        },
      ] satisfies SuggestionAction[],
    }),
  },

  // FEAT-032: add-agent-readme — agent-scripts present, no context-identity files
  {
    id: 'add-agent-readme',
    condition: p =>
      hasCategory(p, 'agent-scripts') &&
      !hasCategory(p, 'context-identity') &&
      isAtOrAbove(p, 'L2') &&
      isAtOrBelow(p, 'L3'),
    build: () => ({
      title: 'Add an AGENTS.md to document your agents',
      description: "An AGENTS.md file describes your project's agents, their roles, and how they interact. Create one for better team and AI awareness.",
      impact: 'medium' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'context-identity' as const,
      maturityTrigger: ['L2', 'L3'],
      actions: [
        {
          id: 'create-agents-md',
          label: 'Create AGENTS.md',
          type: 'create-file',
          payload: {
            relPath: 'AGENTS.md',
            template: '# Agents\n\n## Overview\n\nThis project uses agentic AI workflows.\n\n## Agents\n\n<!-- Document each agent here -->\n\n## Skills\n\n<!-- Document reusable skills here -->\n',
          },
        },
      ] satisfies SuggestionAction[],
    }),
  },

  // FEAT-032: use-skill-files — at L1, no skill files exist yet
  {
    id: 'use-skill-files',
    condition: p => !hasCategory(p, 'skills') && currentLevel(p) === 'L1',
    build: () => ({
      title: 'Document reusable behaviours as skill files',
      description: 'Skill files (SKILL.md) describe reusable agent capabilities. Creating skill files enables cross-agent composition and better discoverability.',
      impact: 'medium' as const,
      effort: 'low' as const,
      layer: 2 as const,
      category: 'skills' as const,
      maturityTrigger: ['L1'],
      actions: [
        {
          id: 'scaffold-first-skill',
          label: 'Create my-first-skill',
          type: 'scaffold-skill',
          payload: { name: 'my-first-skill', description: 'A reusable skill for this project.' },
        },
      ] satisfies SuggestionAction[],
    }),
  },

  // S-GC01 — agents mapped in whiteboard but no skill documentation
  {
    id: 'agents-without-skills',
    condition: (p) => {
      const gc = p.graphContext;
      if (!gc) return false;
      return (gc.nodesByType['agent'] ?? 0) >= 2 && (gc.nodesByType['skill'] ?? 0) === 0;
    },
    build: (p) => {
      const agentCount = p.graphContext?.nodesByType['agent'] ?? 0;
      return {
        title: `${agentCount} agents mapped — document them as skill files`,
        description: `The whiteboard shows ${agentCount} agent nodes but no SKILL.md files exist. Document each agent's capabilities as a skill file to enable reuse and cross-agent composition.`,
        impact: 'medium' as const,
        effort: 'low' as const,
        layer: 2 as const,
        category: 'skills' as const,
        maturityTrigger: ['L2', 'L3', 'L4', 'L5'],
        actions: [
          {
            id: 'scaffold-skill-stub',
            label: 'Create skill stub',
            type: 'scaffold-skill',
            payload: { name: 'my-first-skill', description: 'A reusable skill for documenting agent capabilities.' },
          },
        ] satisfies SuggestionAction[],
      };
    },
  },

  // S-GC02 — all features done, sprint is complete
  {
    id: 'sprint-complete',
    condition: (p) => {
      const gc = p.graphContext;
      if (!gc || gc.featureCount === 0) return false;
      return (gc.featuresByStatus['in_progress'] ?? 0) === 0
        && (gc.featuresByStatus['pending'] ?? 0) === 0
        && (gc.featuresByStatus['spec_ready'] ?? 0) === 0
        && (gc.featuresByStatus['done'] ?? 0) >= 5;
    },
    build: (p) => {
      const doneCount = p.graphContext?.featuresByStatus['done'] ?? 0;
      return {
        title: `Sprint complete — ${doneCount} features done`,
        description: `All tracked features are done and nothing is in progress. Consider starting a new sprint, archiving the backlog, or tagging a release.`,
        impact: 'low' as const,
        effort: 'low' as const,
        layer: 3 as const,
        category: 'methodology' as const,
        maturityTrigger: ['L4', 'L5'],
      };
    },
  },
];
