import { describe, it, expect } from 'vitest';
import { generate } from './advisoryEngine.js';
import { makeProfile } from './testUtils.js';

// ─── Helper: get suggestion ids ─────────────────────────────────────────────

function ids(suggestions: ReturnType<typeof generate>): string[] {
  return suggestions.map(s => s.id);
}

function findById(suggestions: ReturnType<typeof generate>, id: string) {
  return suggestions.find(s => s.id === id);
}

// ─── L0: No signals ─────────────────────────────────────────────────────────

describe('L0 — No signals', () => {
  it('generates "no-signals-detected" for L0 profile', () => {
    const profile = makeProfile(); // L0 by default
    const result = generate(profile);
    const suggestion = findById(result, 'no-signals-detected');
    expect(suggestion).toBeDefined();
    expect(suggestion!.impact).toBe('high');
    expect(suggestion!.effort).toBe('low');
    expect(suggestion!.layer).toBe(2);
    expect(suggestion!.maturityTrigger).toEqual(['L0']);
  });

  it('returns only the L0 suggestion for empty profile', () => {
    const profile = makeProfile();
    const result = generate(profile);
    // Only no-signals-detected should fire at L0
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('no-signals-detected');
  });
});

// ─── L1: Ad-hoc ─────────────────────────────────────────────────────────────

describe('L1 — Ad-hoc signals', () => {
  it('generates "organize-prompts" when prompts are detected', () => {
    const profile = makeProfile({
      activeCategories: ['prompts'],
      categoryCounts: { prompts: 2 },
      // Make maturity L1 by adding a CLI (1 cat + CLI → L1)
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'organize-prompts')).toBeDefined();
  });

  it('generates "organize-rules" when rules are detected', () => {
    const profile = makeProfile({
      activeCategories: ['rules'],
      categoryCounts: { rules: 2 },
      cliInstalls: [{ cliId: 'cursor', cliName: 'Cursor', detectedBy: 'test', configFiles: ['.cursorrules'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'organize-rules')).toBeDefined();
  });

  it('generates "cli-without-impl" when CLI is installed but no impl files', () => {
    const profile = makeProfile({
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'cli-without-impl')).toBeDefined();
  });

  it('generates "structure-scattered-files" for L1 with 1-2 categories', () => {
    const profile = makeProfile({
      activeCategories: ['prompts'],
      categoryCounts: { prompts: 1 },
    });
    const result = generate(profile);
    expect(findById(result, 'structure-scattered-files')).toBeDefined();
  });

  it('generates "adopt-sdd" for L1', () => {
    const profile = makeProfile({
      activeCategories: ['prompts'],
      categoryCounts: { prompts: 2 },
    });
    const result = generate(profile);
    expect(findById(result, 'adopt-sdd')).toBeDefined();
  });
});

// ─── L2: Structured ─────────────────────────────────────────────────────────

describe('L2 — Structured', () => {
  it('generates "impl-without-cli" when structured but no CLI', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'skills', 'tools'],
      categoryCounts: { prompts: 3, rules: 2, skills: 1, tools: 1 },
    });
    const result = generate(profile);
    expect(findById(result, 'impl-without-cli')).toBeDefined();
  });

  it('generates "add-mcp" when CLI + tools present but no MCP', () => {
    const profile = makeProfile({
      activeCategories: ['tools', 'prompts', 'rules'],
      categoryCounts: { tools: 2, prompts: 1, rules: 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'add-mcp')).toBeDefined();
  });

  it('generates "migrate-to-steering" at L2 with rules', () => {
    const profile = makeProfile({
      activeCategories: ['rules', 'prompts', 'tools'],
      categoryCounts: { rules: 2, prompts: 1, tools: 1 },
      cliInstalls: [{ cliId: 'cursor', cliName: 'Cursor', detectedBy: 'test', configFiles: ['.cursorrules'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'migrate-to-steering')).toBeDefined();
  });

  it('generates "mcp-without-agents" when MCP present but no agent scripts', () => {
    const profile = makeProfile({
      activeCategories: ['mcp', 'tools', 'prompts', 'rules'],
      categoryCounts: { mcp: 1, tools: 2, prompts: 1, rules: 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'mcp-without-agents')).toBeDefined();
  });

  it('generates "tools-without-skills" when tools present but no skills', () => {
    const profile = makeProfile({
      activeCategories: ['tools', 'prompts', 'rules'],
      categoryCounts: { tools: 2, prompts: 1, rules: 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'tools-without-skills')).toBeDefined();
  });

  it('generates "harness-without-sdd" when Harness detected but no SDD', () => {
    const profile = makeProfile({
      harnessPresent: true,
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'harness-without-sdd')).toBeDefined();
  });
});

// ─── L3: Integrated ─────────────────────────────────────────────────────────

describe('L3 — Integrated', () => {
  it('generates "split-into-subagents" when 3+ tools and 1+ scripts', () => {
    const profile = makeProfile({
      activeCategories: ['agent-scripts', 'tools', 'prompts', 'rules'],
      categoryCounts: { 'agent-scripts': 1, tools: 3, prompts: 1, rules: 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'split-into-subagents')).toBeDefined();
  });

  it('generates "extract-shared-prompts" when 2+ scripts and prompts', () => {
    const profile = makeProfile({
      activeCategories: ['agent-scripts', 'prompts', 'rules', 'tools'],
      categoryCounts: { 'agent-scripts': 2, prompts: 3, rules: 1, tools: 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'extract-shared-prompts')).toBeDefined();
  });

  it('generates "add-context-identity" when context-identity is missing', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'tools', 'mcp', 'agent-scripts', 'skills'],
      categoryCounts: { prompts: 1, rules: 1, tools: 2, mcp: 1, 'agent-scripts': 1, skills: 1 },
      cliInstalls: [{ cliId: 'k惯例', cliName: 'Kiro', detectedBy: 'test', configFiles: ['.kiro/'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'add-context-identity')).toBeDefined();
  });
});

// ─── L4: Managed ────────────────────────────────────────────────────────────

describe('L4 — Managed', () => {
  it('generates "add-memory-layer" at L4 without memory', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'tools', 'mcp', 'skills', 'agent-scripts'],
      categoryCounts: { prompts: 1, rules: 1, tools: 2, mcp: 1, skills: 1, 'agent-scripts': 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'add-memory-layer')).toBeDefined();
  });

  it('generates "ready-for-sdd" at L4 without SDD', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'tools', 'mcp', 'skills', 'agent-scripts'],
      categoryCounts: { prompts: 1, rules: 1, tools: 2, mcp: 1, skills: 1, 'agent-scripts': 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    expect(findById(result, 'ready-for-sdd')).toBeDefined();
  });

  it('does NOT generate "ready-for-sdd" when SDD is already present', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'tools', 'mcp', 'skills', 'agent-scripts'],
      categoryCounts: { prompts: 1, rules: 1, tools: 2, mcp: 1, skills: 1, 'agent-scripts': 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
      sddActive: true,
    });
    const result = generate(profile);
    expect(findById(result, 'ready-for-sdd')).toBeUndefined();
  });
});

// ─── L5: Governed ───────────────────────────────────────────────────────────

describe('L5 — Governed', () => {
  it('does not generate "l5-incomplete" when SDD is fully active', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'tools', 'mcp', 'skills', 'agent-scripts'],
      categoryCounts: { prompts: 1, rules: 1, tools: 2, mcp: 1, skills: 2, 'agent-scripts': 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
      sddActive: true,
    });
    const result = generate(profile);
    // l5-incomplete condition checks methodology active, so with sddActive=true it won't fire
    expect(findById(result, 'l5-incomplete')).toBeUndefined();
  });
});

// ─── Dismissal ──────────────────────────────────────────────────────────────

describe('Suggestion dismissal', () => {
  it('filters out dismissed suggestion IDs', () => {
    const profile = makeProfile({
      activeCategories: ['prompts'],
      categoryCounts: { prompts: 2 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const dismissed = new Set<string>(['organize-prompts']);
    const result = generate(profile, dismissed);
    expect(findById(result, 'organize-prompts')).toBeUndefined();
  });

  it('still generates non-dismissed suggestions', () => {
    const profile = makeProfile({
      activeCategories: ['agent-scripts', 'memory'],
      categoryCounts: { 'agent-scripts': 1, memory: 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const dismissed = new Set<string>(['adopt-sdd']);
    const result = generate(profile, dismissed);
    // Other L1 suggestions should still be present (like organize-prompts, organize-rules, etc.)
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles empty dismissed set gracefully', () => {
    const profile = makeProfile();
    const dismissed = new Set<string>();
    const result = generate(profile, dismissed);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles undefined dismissed set gracefully', () => {
    const profile = makeProfile();
    const result = generate(profile, undefined);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── Priority ordering ──────────────────────────────────────────────────────

describe('Priority ordering', () => {
  it('returns high-impact suggestions before medium and low', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules'],
      categoryCounts: { prompts: 2, rules: 2 },
    });
    const result = generate(profile);
    // All high-impact suggestions should come before medium
    const highImpact: string[] = [];
    const mediumImpact: string[] = [];
    for (const s of result) {
      if (s.impact === 'high') highImpact.push(s.id);
      if (s.impact === 'medium') mediumImpact.push(s.id);
    }
    // Find the last high-impact index and first medium-impact index
    const lastHigh = result.map(s => s.id).lastIndexOf(highImpact[highImpact.length - 1]);
    const firstMedium = result.map(s => s.id).indexOf(mediumImpact[0]);
    if (highImpact.length > 0 && mediumImpact.length > 0) {
      expect(lastHigh).toBeLessThan(firstMedium);
    }
  });

  it('sorts low-effort before high-effort within same impact', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'tools', 'mcp', 'skills', 'agent-scripts'],
      categoryCounts: { prompts: 1, rules: 1, tools: 2, mcp: 1, skills: 1, 'agent-scripts': 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    const result = generate(profile);
    // Find suggestions with matching impact
    const highSuggestions = result.filter(s => s.impact === 'high');
    for (let i = 1; i < highSuggestions.length; i++) {
      const prevEffort = ['low', 'medium', 'high'].indexOf(highSuggestions[i - 1].effort);
      const currEffort = ['low', 'medium', 'high'].indexOf(highSuggestions[i].effort);
      expect(prevEffort).toBeLessThanOrEqual(currEffort);
    }
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('does not crash on malformed profile with missing categories', () => {
    const profile = makeProfile();
    // Remove all categories
    profile.layers['2'].categories = [];
    const result = generate(profile);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array when no rules match', () => {
    // Can't really happen since L0 always matches no-signals-detected,
    // but test the generate function doesn't crash
    const profile = makeProfile();
    const result = generate(profile, new Set<string>(['no-signals-detected']));
    // With no-signals-detected dismissed, nothing should fire at L0
    expect(result).toEqual([]);
  });

  it('every suggestion has required fields', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'skills', 'tools'],
      categoryCounts: { prompts: 3, rules: 2, skills: 1, tools: 1 },
    });
    const result = generate(profile);
    for (const s of result) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(s.impact);
      expect(['high', 'medium', 'low']).toContain(s.effort);
      expect([1, 2, 3]).toContain(s.layer);
      expect(Array.isArray(s.maturityTrigger)).toBe(true);
    }
  });
});

// ─── FEAT-031: Graph-aware rules ─────────────────────────────────────────────

describe('S-GC01 — agents-without-skills', () => {
  it('fires when whiteboard has ≥2 agents and 0 skills', () => {
    const profile = makeProfile({
      activeCategories: ['agent-methodologies', 'agent-scripts'],
      categoryCounts: { 'agent-methodologies': 2, 'agent-scripts': 1 },
      graphContext: { nodeCount: 5, nodesByType: { agent: 3, subagent: 2 }, edgeCount: 3, featureCount: 0, featuresByStatus: {} },
    });
    const result = generate(profile);
    const suggestion = findById(result, 'agents-without-skills');
    expect(suggestion).toBeDefined();
    expect(suggestion!.category).toBe('skills');
    expect(suggestion!.title).toContain('3 agents');
  });

  it('does NOT fire when skills exist in whiteboard', () => {
    const profile = makeProfile({
      activeCategories: ['agent-methodologies'],
      categoryCounts: { 'agent-methodologies': 2 },
      graphContext: { nodeCount: 6, nodesByType: { agent: 3, skill: 2 }, edgeCount: 2, featureCount: 0, featuresByStatus: {} },
    });
    const result = generate(profile);
    expect(findById(result, 'agents-without-skills')).toBeUndefined();
  });

  it('does NOT fire when graphContext is absent', () => {
    const profile = makeProfile({
      activeCategories: ['agent-methodologies'],
      categoryCounts: { 'agent-methodologies': 2 },
    });
    const result = generate(profile);
    expect(findById(result, 'agents-without-skills')).toBeUndefined();
  });

  it('does NOT fire when fewer than 2 agents', () => {
    const profile = makeProfile({
      graphContext: { nodeCount: 1, nodesByType: { agent: 1 }, edgeCount: 0, featureCount: 0, featuresByStatus: {} },
    });
    const result = generate(profile);
    expect(findById(result, 'agents-without-skills')).toBeUndefined();
  });
});

describe('S-GC02 — sprint-complete', () => {
  it('fires when all features are done (≥5) and none in_progress', () => {
    const profile = makeProfile({
      sddActive: true,
      activeCategories: ['agent-methodologies', 'skills', 'tools', 'mcp'],
      categoryCounts: { 'agent-methodologies': 3, skills: 2, tools: 2, mcp: 1 },
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: [], isActive: true }],
      graphContext: { nodeCount: 30, nodesByType: { feature: 10 }, edgeCount: 15, featureCount: 10, featuresByStatus: { done: 10 } },
    });
    const result = generate(profile);
    const suggestion = findById(result, 'sprint-complete');
    expect(suggestion).toBeDefined();
    expect(suggestion!.title).toContain('10 features done');
  });

  it('does NOT fire when features are in_progress', () => {
    const profile = makeProfile({
      sddActive: true,
      graphContext: { nodeCount: 10, nodesByType: { feature: 8 }, edgeCount: 5, featureCount: 8, featuresByStatus: { done: 7, in_progress: 1 } },
    });
    const result = generate(profile);
    expect(findById(result, 'sprint-complete')).toBeUndefined();
  });

  it('does NOT fire when fewer than 5 features are done', () => {
    const profile = makeProfile({
      sddActive: true,
      graphContext: { nodeCount: 4, nodesByType: { feature: 4 }, edgeCount: 2, featureCount: 4, featuresByStatus: { done: 4 } },
    });
    const result = generate(profile);
    expect(findById(result, 'sprint-complete')).toBeUndefined();
  });

  it('does NOT fire when graphContext is absent', () => {
    const profile = makeProfile({ sddActive: true });
    const result = generate(profile);
    expect(findById(result, 'sprint-complete')).toBeUndefined();
  });
});
