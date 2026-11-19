// AgenticDetector — scan layers, methodology and the full pipeline.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', async () => (await import('./detectorTestHarness.js')).createVscodeMock());

import * as vscode from 'vscode';
import { AgenticDetector } from './agenticDetector.js';
import type { AgenticProfile, MaturityLevel } from './types.js';
import { ROOT, mockFiles, seedWorkspace, makeLog, makeMemento, levelOrder } from './detectorTestHarness.js';

describe('AgenticDetector', () => {
  let log: vscode.LogOutputChannel;
  let memento: vscode.Memento;
  let root: vscode.Uri;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles.clear();
    log = makeLog();
    memento = makeMemento();
    root = vscode.Uri.file(ROOT);
  });

  describe('constructor', () => {
    it('creates an AgenticDetector instance', () => {
      const detector = new AgenticDetector(root, log);
      expect(detector).toBeInstanceOf(AgenticDetector);
      expect(detector.getProfile()).toBeNull();
    });

    it('accepts an optional workspaceState memento', () => {
      const detector = new AgenticDetector(root, log, memento);
      expect(detector).toBeInstanceOf(AgenticDetector);
    });
  });

  describe('scan() — L0 (no signals)', () => {
    it('returns L0 maturity when no files exist', async () => {
      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      expect(profile.maturity.level).toBe('L0');
      expect(profile.layers['1'].cliInstalls).toHaveLength(0);
      expect(profile.layers['2'].categories.every((c: { count: number }) => c.count === 0)).toBe(true);
      expect(profile.layers['3'].methodology.hasMethodology).toBe(false);
      expect(profile.patterns).toHaveLength(0);
      expect(profile.suggestions.length).toBeGreaterThanOrEqual(1); // "No signals detected"
      expect(profile.workspaceRoot).toBe(ROOT);
      expect(profile.scanTimestamp).toBeGreaterThan(0);
    });

    it('emits scanComplete with the profile', async () => {
      const detector = new AgenticDetector(root, log);
      const onScanComplete = vi.fn();
      detector.on('scanComplete', onScanComplete);

      const profile = await detector.scan();

      expect(onScanComplete).toHaveBeenCalledTimes(1);
      expect(onScanComplete).toHaveBeenCalledWith(profile);
    });
  });

  describe('scan() — Layer 1 CLI detection', () => {
    it('detects OpenCode CLI from opencode.json', async () => {
      seedWorkspace({
        'opencode.json': '{}',
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      const clis = profile.layers['1'].cliInstalls;
      expect(clis.length).toBeGreaterThanOrEqual(1);
      const opencode = clis.find(c => c.cliId === 'opencode');
      expect(opencode).toBeDefined();
      expect(opencode!.cliName).toBe('OpenCode');
    });

    it('detects Claude Code from CLAUDE.md', async () => {
      seedWorkspace({
        'CLAUDE.md': '# Claude Code config',
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      const clis = profile.layers['1'].cliInstalls;
      const claude = clis.find(c => c.cliId === 'claude-code');
      expect(claude).toBeDefined();
      expect(claude!.cliName).toBe('Claude Code');
    });

    it('detects multiple CLIs', async () => {
      seedWorkspace({
        'opencode.json': '{}',
        'CLAUDE.md': '# Config',
        '.cursorrules': '',
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      expect(profile.layers['1'].cliInstalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('scan() — Layer 3 methodology detection', () => {
    it('detects Harness SDD from .agents/agentic.json with a feature registry', async () => {
      seedWorkspace({
        '.agents/agentic.json': JSON.stringify({ subagents: [], version: 1 }),
        'feature_list.json': JSON.stringify({ features: [] }),
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      expect(profile.layers['3'].methodology.hasMethodology).toBe(true);
      expect(profile.layers['3'].methodology.methodologyName).toBe('Harness SDD');
    });

    // FEAT-042 R3: a manifest declares roles; a lifecycle needs feature or spec records.
    it('does not treat a Harness SDD manifest alone as a governed lifecycle', async () => {
      seedWorkspace({ '.agents/agentic.json': JSON.stringify({ subagents: [], version: 1 }) });
      const profile = await new AgenticDetector(root, log).scan();
      expect(profile.layers['3'].methodology.hasMethodology).toBe(false);
    });

    it('detects spec documents in any layout as a governed lifecycle', async () => {
      seedWorkspace({ '.kiro/specs/login/requirements.md': '# Login' });
      const profile = await new AgenticDetector(root, log).scan();
      expect(profile.layers['3'].methodology.methodologyName).toBe('Spec documents');
    });

    it('detects Custom SDD from feature_list.json', async () => {
      seedWorkspace({
        'feature_list.json': JSON.stringify({ features: [] }),
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      expect(profile.layers['3'].methodology.hasMethodology).toBe(true);
      expect(profile.layers['3'].methodology.methodologyName).toBe('Custom SDD');
    });
  });

  describe('scan() — full pipeline integration', () => {
    it('runs the full scan pipeline end-to-end', async () => {
      // Seed workspace with files that trigger multiple signal categories
      seedWorkspace({
        'prompts/code-review.md': '---\nrole: reviewer\n---\nReview all PRs',
        'rules/typescript.md': 'Always use strict typing.',
        'rules/react.md': 'Use functional components.',
        'rules/testing.md': 'Write tests for all features.',
        '.agents/agentic.json': JSON.stringify({ subagents: [] }),
        '.agents/subagents/implementer/SUBAGENT.md': '# Implementer',
        '.agents/subagents/reviewer/SUBAGENT.md': '# Reviewer',
        '.agents/steering/kiss-principle.md': '# KISS Principle',
        '.agents/commands/status.md': '# Status Command',
        'tools/eslint.json': '{}',
        'skills/typescript/SKILL.md': '# TypeScript Skill',
        'mcp.json': JSON.stringify({ servers: {} }),
        'agent-scripts/build.sh': 'echo build',
        'agent-scripts/test.sh': 'echo test',
        'agent-scripts/deploy.sh': 'echo deploy',
        'opencode.json': '{}',
        'feature_list.json': JSON.stringify({ features: [{ id: 'FEAT-001', status: 'done' }] }),
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      // Pipeline ran without error and produced a valid profile
      expect(profile.workspaceRoot).toBe(ROOT);
      expect(profile.scanTimestamp).toBeGreaterThan(0);

      // CLI detection should find at least OpenCode
      const opencode = profile.layers['1'].cliInstalls.find(c => c.cliId === 'opencode');
      expect(opencode).toBeDefined();

      // Harness signals should be detected in Layer 2
      const harnessSignals = profile.layers['2'].categories
        .flatMap(c => c.matches)
        .filter(m => m.matchedPattern.startsWith('harness-'));
      expect(harnessSignals.length).toBeGreaterThanOrEqual(1);

      // Methodology should detect SDD (feature_list.json present)
      expect(profile.layers['3'].methodology.hasMethodology).toBe(true);

      // At least one architecture pattern should be detected
      expect(profile.patterns.length).toBeGreaterThanOrEqual(1);
    });

    // FEAT-042 review H1: the manifest's root node is not instructions; AGENTS.md is.
    it('reaches L2 with Harness but no CLI', async () => {
      seedWorkspace({
        'AGENTS.md': '# Agents\nHow this team works.',
        '.agents/agentic.json': JSON.stringify({ subagents: [] }),
        '.agents/subagents/spec-author/SUBAGENT.md': '# Spec Author',
        '.agents/subagents/implementer/SUBAGENT.md': '# Implementer',
        '.agents/steering/rules.md': '# Rules',
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      // Harness detected but no CLI → should be at least L2
      expect(levelOrder(profile.maturity.level)).toBeGreaterThanOrEqual(2);
    });

    it('generates suggestions for an L1 project', async () => {
      seedWorkspace({
        'prompts/code-review.md': '---\nrole: reviewer\n---\nReview PRs',
        'opencode.json': '{}',
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      // L1 should have actionable suggestions (organize prompts, etc.)
      expect(profile.suggestions.length).toBeGreaterThan(0);
    });
  });
});
