import { classify } from './maturityClassifier.js';
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

  it('generates "migrate-to-steering" at L2 with rules in a single-tool format', () => {
    const profile = makeProfile({
      activeCategories: ['rules', 'prompts', 'tools'],
      categoryCounts: { rules: 2, prompts: 1, tools: 1 },
      cliInstalls: [{ cliId: 'cursor', cliName: 'Cursor', detectedBy: 'test', configFiles: ['.cursorrules'], isActive: true }],
    });
    profile.layers['2'].categories.find(c => c.category === 'rules')!.matches[0].matchedPattern = 'dot-rules-files';
    const result = generate(profile);
    expect(findById(result, 'migrate-to-steering')).toBeDefined();
  });

  // FEAT-042: shared steering is not tool-specific, so nothing to migrate.
  it('does not suggest migrating rules that are already shared', () => {
    const profile = makeProfile({
      activeCategories: ['rules', 'prompts', 'tools'],
      categoryCounts: { rules: 2, prompts: 1, tools: 1 },
      cliInstalls: [{ cliId: 'cursor', cliName: 'Cursor', detectedBy: 'test', configFiles: ['.cursorrules'], isActive: true }],
    });
    expect(findById(generate(profile), 'migrate-to-steering')).toBeUndefined();
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
    const base = makeProfile({
      harnessPresent: true,
      cliInstalls: [{ cliId: 'claude', cliName: 'Claude Code', detectedBy: 'test', configFiles: ['claude.md'], isActive: true }],
    });
    // FEAT-042: the manifest's roles and skills arrive as Harness SDD evidence.
    const profile = { ...base, evidence: ['context-identity', 'agent-methodologies', 'skills'].map(category => ({ category: category as never, providerId: 'harness-sdd', nodeId: category })) };
    profile.maturity = classify(profile);
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
