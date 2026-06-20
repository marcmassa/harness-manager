import { describe, it, expect } from 'vitest';
import { classify } from './maturityClassifier.js';
import { makeProfile } from './testUtils.js';

describe('maturityClassifier — classify', () => {
  it('L0: returns L0 for empty profile', () => {
    const profile = makeProfile();
    const result = classify(profile);
    expect(result.level).toBe('L0');
    expect(result.label).toBe('None');
  });

  it('L1: returns L1 with a single signal category and no CLI', () => {
    const profile = makeProfile({
      activeCategories: ['prompts'],
      categoryCounts: { prompts: 2 },
    });
    const result = classify(profile);
    expect(result.level).toBe('L1');
    expect(result.label).toBe('Ad-hoc');
  });

  it('L1: returns L1 with CLI installed but no implementation', () => {
    const profile = makeProfile({
      cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code' }],
    });
    const result = classify(profile);
    expect(result.level).toBe('L1');
  });

  it('L2: returns L2 with 3+ categories and organized directories', () => {
    const profile = makeProfile({
      activeCategories: ['prompts', 'rules', 'tools'],
      categoryCounts: { prompts: 3, rules: 2, tools: 1 },
    });
    const result = classify(profile);
    expect(result.level).toBe('L2');
    expect(result.label).toBe('Structured');
  });

  it('L2: returns L2 when Harness is detected', () => {
    const profile = makeProfile({
      activeCategories: ['agent-methodologies'],
      harnessPresent: true,
    });
    const result = classify(profile);
    expect(result.level).toBe('L2');
  });

  it('L3: returns L3 with CLI + structured implementation', () => {
    const profile = makeProfile({
      cliInstalls: [{ cliId: 'kiro', cliName: 'Kiro IDE' }],
      activeCategories: ['prompts', 'rules', 'tools'],
      categoryCounts: { prompts: 3, rules: 2, tools: 1 },
    });
    const result = classify(profile);
    expect(result.level).toBe('L3');
    expect(result.label).toBe('Integrated');
  });

  it('L4: returns L4 with CLI + full stack (tools + skills + mcp)', () => {
    const profile = makeProfile({
      cliInstalls: [{ cliId: 'cursor', cliName: 'Cursor' }],
      activeCategories: ['prompts', 'rules', 'tools', 'skills', 'mcp', 'agent-scripts'],
      categoryCounts: { prompts: 3, rules: 2, tools: 1, skills: 2, mcp: 1, 'agent-scripts': 1 },
    });
    const result = classify(profile);
    expect(result.level).toBe('L4');
    expect(result.label).toBe('Managed');
  });

  it('L5: returns L5 with CLI + full stack + SDD', () => {
    const profile = makeProfile({
      cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code' }],
      activeCategories: ['prompts', 'rules', 'tools', 'skills', 'mcp', 'agent-scripts'],
      categoryCounts: { prompts: 3, rules: 2, tools: 1, skills: 2, mcp: 1, 'agent-scripts': 1 },
      sddActive: true,
    });
    const result = classify(profile);
    expect(result.level).toBe('L5');
    expect(result.label).toBe('Governed');
  });

  it('L5: does NOT reach L5 without SDD even if all else is present', () => {
    const profile = makeProfile({
      cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code' }],
      activeCategories: ['prompts', 'rules', 'tools', 'skills', 'mcp', 'agent-scripts'],
      categoryCounts: { prompts: 3, rules: 2, tools: 1, skills: 2, mcp: 1, 'agent-scripts': 1 },
      sddActive: false,
    });
    const result = classify(profile);
    expect(result.level).toBe('L4'); // Harness alone (without SDD) caps at L4
  });

  it('nextLevel is null for L5', () => {
    const profile = makeProfile({
      cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code' }],
      activeCategories: ['prompts', 'rules', 'tools', 'skills', 'mcp', 'agent-scripts'],
      categoryCounts: { prompts: 3, rules: 2, tools: 1, skills: 2, mcp: 1, 'agent-scripts': 1 },
      sddActive: true,
    });
    const result = classify(profile);
    expect(result.nextLevel).toBeNull();
  });

  it('nextLevel is non-null for L0', () => {
    const profile = makeProfile();
    const result = classify(profile);
    expect(result.nextLevel).not.toBeNull();
    expect(result.nextLevel!.level).toBe('L1');
  });

  it('has color for every level', () => {
    const levels = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as const;
    for (const targetLevel of levels) {
      // Build a profile that should hit this level
      const profile = makeProfile({
        cliInstalls: targetLevel === 'L0' || targetLevel === 'L1' ? [] : [{ cliId: 'test', cliName: 'Test' }],
        activeCategories:
          targetLevel === 'L0' ? [] :
          targetLevel === 'L1' ? ['prompts'] :
          ['prompts', 'rules', 'tools', 'skills', 'mcp', 'agent-scripts'],
        categoryCounts:
          targetLevel === 'L0' ? {} :
          targetLevel === 'L1' ? { prompts: 1 } :
          { prompts: 3, rules: 2, tools: 1, skills: 2, mcp: 1, 'agent-scripts': 1 },
        harnessPresent: targetLevel === 'L2' ? true : undefined,
        sddActive: targetLevel === 'L5',
      });
      const result = classify(profile);
      expect(result.color).toBeTruthy();
      expect(result.color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    }
  });
});
