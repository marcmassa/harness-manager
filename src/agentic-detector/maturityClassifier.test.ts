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

  // FEAT-042 R3: a Harness SDD manifest is not a level of its own. Its roles
  // and skills arrive as provider evidence, like any other layout's files.
  it('a Harness SDD manifest signal alone gives no level', () => {
    const profile = makeProfile({ activeCategories: ['agent-methodologies'], harnessPresent: true });
    expect(classify(profile).level).toBe('L0');
  });

  it('assigns the same level to equivalent Harness SDD and Claude Code workflows (R3)', () => {
    const evidence = (providerId: string) => [
      { category: 'context-identity' as const, providerId, nodeId: `${providerId}::root` },
      { category: 'agent-methodologies' as const, providerId, nodeId: `${providerId}::reviewer` },
      { category: 'skills' as const, providerId, nodeId: `${providerId}::lint` },
    ];
    const cli = [{ cliId: 'claude-code', cliName: 'Claude Code' }];
    const sdd = classify({ ...makeProfile({ cliInstalls: cli, harnessPresent: true, activeCategories: ['agent-methodologies'] }), evidence: evidence('harness-sdd') });
    const claude = classify({ ...makeProfile({ cliInstalls: cli }), evidence: evidence('claude-code') });
    expect(sdd.level).toBe('L3');
    expect(claude.level).toBe(sdd.level);
    expect(claude.unavailableInputs).toEqual(sdd.unavailableInputs);
  });

  it('names the inputs it could not assess (R4)', () => {
    const result = classify(makeProfile({ cliInstalls: [{ cliId: 'claude-code', cliName: 'Claude Code' }] }));
    expect(result.unavailableInputs).toEqual(expect.arrayContaining([
      'Skills: no file or provider evidence found',
      'Agent CLI: detected from configuration files; the executable was not verified',
      'Governed lifecycle: no feature registry or spec documents found',
    ]));
  });

  it('gives no next-level hint that names a framework', () => {
    const cli = [{ cliId: 'cursor', cliName: 'Cursor' }];
    const profiles = [
      makeProfile(),
      makeProfile({ activeCategories: ['prompts'], categoryCounts: { prompts: 1 } }),
      makeProfile({ activeCategories: ['prompts', 'rules', 'tools'], categoryCounts: { prompts: 1, rules: 1, tools: 1 } }),
      makeProfile({ cliInstalls: cli, activeCategories: ['prompts', 'rules', 'tools'], categoryCounts: { prompts: 1, rules: 1, tools: 1 } }),
      makeProfile({ cliInstalls: cli, activeCategories: ['tools', 'skills', 'mcp'], categoryCounts: { tools: 1, skills: 1, mcp: 1 } }),
    ];
    expect(profiles.map(p => classify(p).level)).toEqual(['L0', 'L1', 'L2', 'L3', 'L4']);
    for (const p of profiles) expect(classify(p).nextLevel?.whatIsNeeded).not.toMatch(/Harness|Claude|Kiro|Cursor|Copilot|SDD/);
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
