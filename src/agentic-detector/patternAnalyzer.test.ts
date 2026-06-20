import { describe, it, expect } from 'vitest';
import { analyze } from './patternAnalyzer.js';
import { makeProfile } from './testUtils.js';

describe('patternAnalyzer — analyze', () => {
  it('returns empty array when no patterns match', () => {
    const profile = makeProfile({ activeCategories: ['prompts'] });
    const result = analyze(profile);
    expect(result).toEqual([]);
  });

  it('detects Tool-Using Single Agent with MCP + tools + scripts', () => {
    const profile = makeProfile({
      activeCategories: ['mcp', 'tools', 'agent-scripts'],
      categoryCounts: { mcp: 1, tools: 2, 'agent-scripts': 1 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'tool-using-single-agent');
    expect(pattern).toBeDefined();
    expect(pattern!.status).toBe('detected');
    expect(pattern!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('does not detect Tool-Using if MCP is missing', () => {
    const profile = makeProfile({
      activeCategories: ['tools', 'agent-scripts'],
      categoryCounts: { tools: 1, 'agent-scripts': 1 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'tool-using-single-agent');
    expect(pattern).toBeUndefined();
  });

  it('detects Pipeline with 2+ scripts and corroborating signals, no MCP', () => {
    const profile = makeProfile({
      activeCategories: ['agent-scripts', 'rules', 'prompts'],
      categoryCounts: { 'agent-scripts': 2, rules: 1, prompts: 1 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'pipeline');
    expect(pattern).toBeDefined();
    expect(pattern!.status).toBe('detected');
  });

  it('does not detect Pipeline when MCP is present', () => {
    const profile = makeProfile({
      activeCategories: ['agent-scripts', 'mcp'],
      categoryCounts: { 'agent-scripts': 2, mcp: 1 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'pipeline');
    expect(pattern).toBeUndefined();
  });

  it('detects Orchestrator-Worker with methodology + scripts + corroborating signals', () => {
    const profile = makeProfile({
      activeCategories: ['agent-methodologies', 'agent-scripts', 'tools', 'mcp'],
      categoryCounts: { 'agent-methodologies': 1, 'agent-scripts': 2, tools: 1, mcp: 1 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'orchestrator-worker');
    expect(pattern).toBeDefined();
    expect(pattern!.status).toBe('detected');
  });

  it('detects Multi-Agent Collaboration with 2+ scripts + context + memory', () => {
    const profile = makeProfile({
      activeCategories: ['agent-scripts', 'context-identity', 'memory'],
      categoryCounts: { 'agent-scripts': 2, 'context-identity': 1, memory: 1 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'multi-agent-collaboration');
    expect(pattern).toBeDefined();
    expect(pattern!.status).toBe('detected');
  });

  it('detects Router with 2+ rules', () => {
    const profile = makeProfile({
      activeCategories: ['rules'],
      categoryCounts: { rules: 3 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'router');
    expect(pattern).toBeDefined();
  });

  it('tentative status when confidence < 0.7', () => {
    // Reflection has base 0.65 — with 0 corroborating signals it stays below 0.7
    const profile = makeProfile({
      activeCategories: ['prompts', 'agent-scripts'],
      categoryCounts: { prompts: 1, 'agent-scripts': 1 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'reflection');
    expect(pattern).toBeDefined();
    expect(pattern!.status).toBe('tentative');
    expect(pattern!.confidence).toBeLessThan(0.7);
  });

  it('returns patterns sorted by confidence descending', () => {
    const profile = makeProfile({
      activeCategories: ['mcp', 'tools', 'agent-scripts', 'agent-methodologies'],
      categoryCounts: { mcp: 1, tools: 1, 'agent-scripts': 2, 'agent-methodologies': 1 },
    });
    const result = analyze(profile);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].confidence).toBeLessThanOrEqual(result[i - 1].confidence);
    }
  });

  it('includes evidence in pattern matches', () => {
    const profile = makeProfile({
      activeCategories: ['mcp', 'tools', 'agent-scripts'],
      categoryCounts: { mcp: 1, tools: 2, 'agent-scripts': 1 },
    });
    const result = analyze(profile);
    const pattern = result.find(p => p.pattern === 'tool-using-single-agent');
    expect(pattern).toBeDefined();
    expect(pattern!.evidence.length).toBeGreaterThan(0);
    expect(pattern!.evidence.some(e => e.includes('mcp'))).toBe(true);
  });
});
