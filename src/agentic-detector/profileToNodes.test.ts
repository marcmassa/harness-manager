import { describe, it, expect } from 'vitest';
import { profileToDiscoveredNodes } from './profileToNodes.js';
import type { AgenticProfile } from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMinimalProfile(overrides?: Partial<AgenticProfile>): AgenticProfile {
  return {
    workspaceRoot: '/test/workspace',
    scanTimestamp: Date.now(),
    layers: {
      '1': { cliInstalls: [] },
      '2': { categories: [] },
      '3': {
        methodology: {
          hasMethodology: false,
          methodologyName: null,
          methodologyVersion: null,
          configFile: null,
          isActive: false,
          layer: 3,
        },
      },
    },
    maturity: { level: 'L0', label: '', description: '', color: '', nextLevel: null },
    patterns: [],
    suggestions: [],
    dismissedSuggestionIds: [],
    acknowledgedNodeIds: [],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('profileToDiscoveredNodes', () => {
  it('should return empty nodes and edges for an empty profile', () => {
    const profile = createMinimalProfile();
    const result = profileToDiscoveredNodes(profile);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('should create a cli-install node for each detected CLI (Layer 1)', () => {
    const profile = createMinimalProfile({
      layers: {
        '1': {
          cliInstalls: [
            {
              cliId: 'opencode',
              cliName: 'OpenCode',
              detectedBy: 'agentic-detector',
              configFiles: ['opencode.json'],
              isActive: true,
              layer: 1,
            },
            {
              cliId: 'claude-code',
              cliName: 'Claude Code',
              detectedBy: 'agentic-detector',
              configFiles: ['CLAUDE.md'],
              isActive: true,
              layer: 1,
            },
          ],
        },
        '2': { categories: [] },
        '3': {
          methodology: {
            hasMethodology: false,
            methodologyName: null,
            methodologyVersion: null,
            configFile: null,
            isActive: false,
            layer: 3,
          },
        },
      },
    });

    const result = profileToDiscoveredNodes(profile);
    const cliNodes = result.nodes.filter((n) => n.type === 'cli-install');
    expect(cliNodes).toHaveLength(2);
    expect(cliNodes[0].label).toBe('OpenCode');
    expect(cliNodes[1].label).toBe('Claude Code');
    expect(cliNodes[0].metadata?._layer).toBe(1);
  });

  it('should create discovered nodes for signal categories (Layer 2)', () => {
    const profile = createMinimalProfile({
      layers: {
        '1': { cliInstalls: [] },
        '2': {
          categories: [
            {
              category: 'skills',
              label: 'Skills',
              count: 1,
              truncated: false,
              matches: [
                {
                  filePath: '.agents/skills/ears-requirements/SKILL.md',
                  category: 'skills',
                  matchedPattern: 'skill: ears-requirements',
                  confidence: 'high',
                  evidence: 'Found skill file at .agents/skills/ears-requirements/SKILL.md',
                  layer: 2,
                },
              ],
            },
            {
              category: 'prompts',
              label: 'Prompts',
              count: 1,
              truncated: false,
              matches: [
                {
                  filePath: '.agents/prompts/system.md',
                  category: 'prompts',
                  matchedPattern: 'prompt: system',
                  confidence: 'medium',
                  evidence: 'Found prompt file at .agents/prompts/system.md',
                  layer: 2,
                },
              ],
            },
          ],
        },
        '3': {
          methodology: {
            hasMethodology: false,
            methodologyName: null,
            methodologyVersion: null,
            configFile: null,
            isActive: false,
            layer: 3,
          },
        },
      },
    });

    const result = profileToDiscoveredNodes(profile);
    const skillNodes = result.nodes.filter((n) => n.type === 'discovered-skill');
    const resourceNodes = result.nodes.filter((n) => n.type === 'discovered-resource');

    expect(skillNodes).toHaveLength(1);
    expect(skillNodes[0].label).toBe('ears-requirements');
    expect(skillNodes[0].metadata?._layer).toBe(2);

    expect(resourceNodes.length).toBeGreaterThanOrEqual(1);
    expect(resourceNodes[0].metadata?._layer).toBe(2);
  });

  it('should create discovered-agent node when methodology is active (Layer 3)', () => {
    const profile = createMinimalProfile({
      layers: {
        '1': { cliInstalls: [] },
        '2': { categories: [] },
        '3': {
          methodology: {
            hasMethodology: true,
            methodologyName: 'Harness SDD',
            methodologyVersion: null,
            configFile: '/test/workspace/.agents/agentic.json',
            isActive: true,
            layer: 3,
          },
        },
      },
    });

    const result = profileToDiscoveredNodes(profile);
    const agentNodes = result.nodes.filter((n) => n.type === 'discovered-agent');
    expect(agentNodes).toHaveLength(1);
    expect(agentNodes[0].label).toBe('Harness SDD');
    expect(agentNodes[0].metadata?._layer).toBe(3);
    expect(agentNodes[0].metadata?._isHarness).toBe(true);
    expect(agentNodes[0].metadata?._isSDD).toBe(true);
  });

  it('should create inferred edges between CLI and methodology', () => {
    const profile = createMinimalProfile({
      layers: {
        '1': {
          cliInstalls: [
            {
              cliId: 'opencode',
              cliName: 'OpenCode',
              detectedBy: 'agentic-detector',
              configFiles: ['opencode.json'],
              isActive: true,
              layer: 1,
            },
          ],
        },
        '2': { categories: [] },
        '3': {
          methodology: {
            hasMethodology: true,
            methodologyName: 'Custom SDD',
            methodologyVersion: null,
            configFile: '/test/workspace/feature_list.json',
            isActive: true,
            layer: 3,
          },
        },
      },
    });

    const result = profileToDiscoveredNodes(profile);
    const inferredEdges = result.edges.filter((e) => e.label === 'inferred');
    expect(inferredEdges.length).toBeGreaterThanOrEqual(1);

    // CLI → methodology edge
    const cliToMeth = inferredEdges.find(
      (e) =>
        e.source.startsWith('discovered-cli-') &&
        e.target.startsWith('discovered-methodology-'),
    );
    expect(cliToMeth).toBeDefined();
    expect(cliToMeth?.metadata?._layer).toBe('1→3');
  });

  it('should respect acknowledgedNodeIds', () => {
    const profile = createMinimalProfile({
      layers: {
        '1': {
          cliInstalls: [
            {
              cliId: 'opencode',
              cliName: 'OpenCode',
              detectedBy: 'agentic-detector',
              configFiles: ['opencode.json'],
              isActive: true,
              layer: 1,
            },
          ],
        },
        '2': { categories: [] },
        '3': {
          methodology: {
            hasMethodology: false,
            methodologyName: null,
            methodologyVersion: null,
            configFile: null,
            isActive: false,
            layer: 3,
          },
        },
      },
    });

    const result = profileToDiscoveredNodes(profile, new Set());
    const cliNode = result.nodes.find((n) => n.type === 'cli-install')!;
    // Without acknowledgment, _acknowledged should be false
    expect(cliNode.metadata?._acknowledged).toBe(false);
  });

  it('should mark Harness-related nodes with _isHarness flag', () => {
    const profile = createMinimalProfile({
      layers: {
        '1': { cliInstalls: [] },
        '2': {
          categories: [
            {
              category: 'agent-methodologies',
              label: 'Agent Methodologies',
              count: 1,
              truncated: false,
              matches: [
                {
                  filePath: '.agents/agentic.json',
                  category: 'agent-methodologies',
                  matchedPattern: 'config: Harness SDD Bootstrap',
                  confidence: 'high',
                  evidence: 'Found .agents/agentic.json — Harness SDD configuration',
                  layer: 2,
                },
              ],
            },
          ],
        },
        '3': {
          methodology: {
            hasMethodology: true,
            methodologyName: 'Harness SDD',
            methodologyVersion: null,
            configFile: '/test/workspace/.agents/agentic.json',
            isActive: true,
            layer: 3,
          },
        },
      },
    });

    const result = profileToDiscoveredNodes(profile);
    const harnessNodes = result.nodes.filter((n) => n.metadata?._isHarness === true);
    expect(harnessNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should aggregate multiple signal matches into a single logical node', () => {
    const profile = createMinimalProfile({
      layers: {
        '1': { cliInstalls: [] },
        '2': {
          categories: [
            {
              category: 'skills',
              label: 'Skills',
              count: 2,
              truncated: false,
              matches: [
                {
                  filePath: '.agents/skills/ears-requirements/SKILL.md',
                  category: 'skills',
                  matchedPattern: 'skill: ears-requirements',
                  confidence: 'high',
                  evidence: 'Found skill file at .agents/skills/ears-requirements/SKILL.md',
                  layer: 2,
                },
                {
                  filePath: '.agents/skills/ears-requirements/SKILL.md',
                  category: 'skills',
                  matchedPattern: 'skill: ears-requirements',
                  confidence: 'medium',
                  evidence: 'YAML frontmatter confirmed skill: ears-requirements',
                  layer: 2,
                },
              ],
            },
          ],
        },
        '3': {
          methodology: {
            hasMethodology: false,
            methodologyName: null,
            methodologyVersion: null,
            configFile: null,
            isActive: false,
            layer: 3,
          },
        },
      },
    });

    const result = profileToDiscoveredNodes(profile);
    const skillNodes = result.nodes.filter((n) => n.type === 'discovered-skill');
    // Two matches with the same logical key → one node
    expect(skillNodes).toHaveLength(1);
    // Evidence should be merged
    const evidence = skillNodes[0].metadata?._evidence as string;
    expect(evidence).toContain('Found skill file');
    expect(evidence).toContain('YAML frontmatter');
  });

  it('should not create duplicate inferred edges', () => {
    const profile = createMinimalProfile({
      layers: {
        '1': {
          cliInstalls: [
            {
              cliId: 'opencode',
              cliName: 'OpenCode',
              detectedBy: 'agentic-detector',
              configFiles: ['opencode.json'],
              isActive: true,
              layer: 1,
            },
          ],
        },
        '2': {
          categories: [
            {
              category: 'tools',
              label: 'Tools',
              count: 1,
              truncated: false,
              matches: [
                {
                  filePath: '.agents/tools/search.json',
                  category: 'tools',
                  matchedPattern: 'tool: search',
                  confidence: 'high',
                  evidence: 'Found tool definition at .agents/tools/search.json',
                  layer: 2,
                },
              ],
            },
          ],
        },
        '3': {
          methodology: {
            hasMethodology: false,
            methodologyName: null,
            methodologyVersion: null,
            configFile: null,
            isActive: false,
            layer: 3,
          },
        },
      },
    });

    const result = profileToDiscoveredNodes(profile);
    const edgeKeys = new Set(result.edges.map((e) => `${e.source}::${e.target}`));
    expect(edgeKeys.size).toBe(result.edges.length);
  });
});
