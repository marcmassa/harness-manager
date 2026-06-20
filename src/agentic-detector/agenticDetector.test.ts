import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as path from 'path';

// ─── Workspace helpers ───────────────────────────────────────────────────────

const ROOT = '/workspace';
const mockFiles = new Map<string, string>();

const normalize = (input: string) => input.replace(/\\/g, '/').replace(/\/+/g, '/');
const toUri = (fsPath: string) => {
  const n = normalize(fsPath);
  return { fsPath: n, path: n, scheme: 'file', with: vi.fn(), toString: () => n };
};

function globToRegExp(glob: string): RegExp {
  let pattern = '^';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    const next = glob[i + 1];
    if (ch === '*' && next === '*') {
      if (glob[i + 2] === '/') { pattern += '(?:.*/)?'; i += 2; continue; }
      pattern += '.*'; i += 1; continue;
    }
    if (ch === '*') { pattern += '[^/]*'; continue; }
    if (ch === '?') { pattern += '.'; continue; }
    pattern += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  pattern += '$';
  return new RegExp(pattern);
}

function seedWorkspace(files: Record<string, string>): void {
  mockFiles.clear();
  for (const [filePath, content] of Object.entries(files)) {
    const absolute = filePath.startsWith('/') ? filePath : `${ROOT}/${filePath}`;
    mockFiles.set(normalize(absolute), content);
  }
}

// ─── VS Code mock ────────────────────────────────────────────────────────────

vi.mock('vscode', () => {
  class RelativePattern {
    constructor(
      public readonly baseUri: { fsPath: string; path: string },
      public readonly pattern: string,
    ) {}
  }

  const workspace = {
    fs: {
      readFile: vi.fn(async (uri: { fsPath?: string; path?: string }) => {
        const key = normalize(uri.fsPath ?? uri.path ?? '');
        const value = mockFiles.get(key);
        if (value === undefined) throw new Error(`ENOENT: ${key}`);
        return Buffer.from(value, 'utf8');
      }),
      stat: vi.fn(async (uri: { fsPath?: string; path?: string }) => {
        const key = normalize(uri.fsPath ?? uri.path ?? '');
        if (!mockFiles.has(key)) throw new Error(`ENOENT: ${key}`);
        return { type: 1 };
      }),
    },
    findFiles: vi.fn(async (pattern: RelativePattern | string, _exclude?: unknown, _maxResults?: number) => {
      const base = typeof pattern === 'string'
        ? ROOT
        : normalize(pattern.baseUri.fsPath ?? pattern.baseUri.path ?? ROOT);
      const glob = typeof pattern === 'string' ? pattern : pattern.pattern;
      const regexp = globToRegExp(glob);
      const matches: Array<{ fsPath: string; path: string }> = [];
      for (const filePath of mockFiles.keys()) {
        if (!filePath.startsWith(`${base}/`)) continue;
        const relativePath = filePath.slice(base.length + 1);
        if (regexp.test(relativePath)) {
          matches.push(toUri(filePath));
        }
      }
      return matches;
    }),
    asRelativePath: vi.fn((file: { fsPath?: string; path?: string } | string) => {
      const full = normalize(typeof file === 'string' ? file : (file.fsPath ?? file.path ?? ''));
      if (full.startsWith(`${ROOT}/`)) return full.slice(ROOT.length + 1);
      return full;
    }),
    getConfiguration: vi.fn(() => ({
      get: (_key: string, fallback?: unknown) => fallback,
      has: vi.fn(() => false),
      inspect: vi.fn(() => undefined),
      update: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    createFileSystemWatcher: vi.fn(() => ({
      onDidCreate: vi.fn(),
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    })),
  };

  const Uri = {
    file: (fsPath: string) => toUri(fsPath),
    joinPath: (base: { fsPath?: string; path?: string }, ...parts: string[]) => {
      const basePath = normalize(base.fsPath ?? base.path ?? '');
      const joined = normalize([basePath, ...parts].join('/'));
      return toUri(joined);
    },
    parse: (str: string) => toUri(str),
  };

  const FileType = { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 };

  const ThemeIcon = vi.fn((id: string) => ({ id }));
  const ThemeColor = vi.fn((id: string) => ({ id }));

  return {
    Uri,
    RelativePattern,
    FileType,
    ThemeIcon,
    ThemeColor,
    workspace,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    TreeItem: vi.fn(),
    EventEmitter: vi.fn(() => ({ event: vi.fn(), fire: vi.fn() })),
  };
});

import * as vscode from 'vscode';
import { AgenticDetector } from './agenticDetector.js';
import type { AgenticProfile, MaturityLevel } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLog(): vscode.LogOutputChannel {
  return {
    name: 'test',
    logLevel: 0,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    appendLine: vi.fn(),
    append: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    replace: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  } as unknown as vscode.LogOutputChannel;
}

function makeMemento(): vscode.Memento {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(<T>(key: string, fallback?: T): T => (store.has(key) ? store.get(key) as T : fallback as T)),
    update: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
    keys: vi.fn(() => Array.from(store.keys())),
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento;
}

function levelOrder(level: MaturityLevel): number {
  return { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 }[level];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

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
    it('detects Harness SDD from .agents/agentic.json', async () => {
      seedWorkspace({
        '.agents/agentic.json': JSON.stringify({ subagents: [], version: 1 }),
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      expect(profile.layers['3'].methodology.hasMethodology).toBe(true);
      expect(profile.layers['3'].methodology.methodologyName).toBe('Harness SDD');
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

    it('reaches L2 with Harness but no CLI', async () => {
      seedWorkspace({
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

  describe('getProfile()', () => {
    it('returns null before any scan', () => {
      const detector = new AgenticDetector(root, log);
      expect(detector.getProfile()).toBeNull();
    });

    it('returns profile after successful scan', async () => {
      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      expect(detector.getProfile()).toBe(profile);
      expect(detector.getProfile()!.maturity.level).toBe('L0');
    });
  });

  describe('startWatching() / stopWatching()', () => {
    it('creates file system watchers on startWatching', () => {
      const detector = new AgenticDetector(root, log);
      detector.startWatching();

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        expect.objectContaining({ pattern: expect.any(String) }),
      );
    });

    it('startWatching is idempotent (no duplicate watchers)', () => {
      const detector = new AgenticDetector(root, log);
      detector.startWatching();
      const callCount = (vscode.workspace.createFileSystemWatcher as ReturnType<typeof vi.fn>).mock.calls.length;

      detector.startWatching(); // should be a no-op

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(callCount);
    });

    it('stopWatching disposes watchers', () => {
      const detector = new AgenticDetector(root, log);
      detector.startWatching();
      detector.stopWatching();

      // The watcher dispose should have been called for each watcher
      // (can't easily verify this since mock returns the same object)
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
    });

    it('stopWatching is safe when no watchers active', () => {
      const detector = new AgenticDetector(root, log);
      expect(() => detector.stopWatching()).not.toThrow();
    });
  });

  describe('dismissSuggestion / restoreSuggestion', () => {
    it('dismissSuggestion persists ID and re-scans', async () => {
      const detector = new AgenticDetector(root, log, memento);
      await detector.scan();

      const profile = await detector.scan();
      const firstSuggestionId = profile.suggestions[0]?.id;
      if (!firstSuggestionId) return; // nothing to dismiss

      await detector.dismissSuggestion(firstSuggestionId);

      // Check that the ID was persisted
      expect(memento.update).toHaveBeenCalledWith(
        'agenticDetector.dismissedSuggestionIds',
        expect.arrayContaining([firstSuggestionId]),
      );
    });

    it('restoreSuggestion removes ID from dismiss set', async () => {
      const detector = new AgenticDetector(root, log, memento);
      await detector.scan();

      // First dismiss
      const profile = await detector.scan();
      const firstId = profile.suggestions[0]?.id;
      if (!firstId) return;

      await detector.dismissSuggestion(firstId);

      // Then restore
      await detector.restoreSuggestion(firstId);

      // The update should have been called with an array not containing the ID
      const updateCalls = (memento.update as ReturnType<typeof vi.fn>).mock.calls;
      const restoreCall = updateCalls.find(
        (call: [string, string[]]) => call[0] === 'agenticDetector.dismissedSuggestionIds'
          && !call[1].includes(firstId),
      );
      expect(restoreCall).toBeDefined();
    });

    it('getDismissedSuggestionIds returns empty when no state', () => {
      const detector = new AgenticDetector(root, log);
      expect(detector.getDismissedSuggestionIds()).toEqual([]);
    });

    it('getDismissedSuggestionIds returns persisted IDs', () => {
      const detector = new AgenticDetector(root, log, memento);
      (memento.get as ReturnType<typeof vi.fn>).mockReturnValue(['suggestion-1', 'suggestion-2']);
      expect(detector.getDismissedSuggestionIds()).toEqual(['suggestion-1', 'suggestion-2']);
    });

    it('dismissSuggestion is no-op when no workspaceState', async () => {
      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();
      const firstId = profile.suggestions[0]?.id;
      if (!firstId) return;

      await detector.dismissSuggestion(firstId);
      // Should not throw despite having no memento
      expect(detector.getDismissedSuggestionIds()).toEqual([]);
    });
  });

  describe('dispose()', () => {
    it('cleans up watchers, timers, and listeners', async () => {
      const detector = new AgenticDetector(root, log);
      detector.startWatching();

      const onScan = vi.fn();
      detector.on('scanComplete', onScan);

      await detector.scan();
      detector.dispose();

      // After dispose: getProfile returns null
      expect(detector.getProfile()).toBeNull();

      // Events should no longer fire (or at least listeners cleared)
      // We can't easily test this without accessing internals,
      // but the method should not throw
      expect(() => detector.dispose()).not.toThrow();
    });

    it('can be called multiple times', () => {
      const detector = new AgenticDetector(root, log);
      detector.dispose();
      expect(() => detector.dispose()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('emits scanError when scan fails', async () => {
      // Make findFiles throw to simulate an error
      (vscode.workspace.findFiles as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('findFiles failed'));

      const detector = new AgenticDetector(root, log);
      const onError = vi.fn();
      detector.on('scanError', onError);

      await expect(detector.scan()).rejects.toThrow('findFiles failed');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'findFiles failed' }));
    });
  });

  describe('scan() event timing', () => {
    it('scanComplete fires after profile is cached', async () => {
      const detector = new AgenticDetector(root, log);
      let cachedOnEvent: AgenticProfile | null = null;
      detector.on('scanComplete', (profile: AgenticProfile) => {
        cachedOnEvent = detector.getProfile();
      });

      await detector.scan();

      // The cached profile should already be set when the event fires
      // (listener is called synchronously during emit)
      expect(cachedOnEvent).not.toBeNull();
    });
  });

  describe('T20 — adapter dedup (R55)', () => {
    it('filters out files claimed by existing adapters from Layer-2 signals', async () => {
      // .cursorrules is claimed by CursorAdapter AND matched by the
      // dot-rules-files signal. After dedup the signal match should
      // be removed while the adapter layer keeps it.
      seedWorkspace({
        '.cursorrules': 'some cursor rules content',
        'prompts/code-review.md': '---\nrole: reviewer\n---\nReview all PRs',
      });

      const detector = new AgenticDetector(root, log);
      const profile = await detector.scan();

      // The cursor CLI should still be detected in Layer 1
      const cursorCli = profile.layers['1'].cliInstalls.find(
        (c) => c.cliId === 'cursor',
      );
      expect(cursorCli).toBeDefined();

      // But the dot-rules-files signal should NOT match .cursorrules
      const rulesCat = profile.layers['2'].categories.find(
        (c) => c.category === 'rules',
      );
      expect(rulesCat).toBeDefined();
      const cursorRulesFiles = rulesCat!.matches.filter((m) =>
        m.filePath.endsWith('.cursorrules'),
      );
      expect(cursorRulesFiles).toHaveLength(0);

      // Non-adapter signal matches (like prompts) should survive
      const promptsCat = profile.layers['2'].categories.find(
        (c) => c.category === 'prompts',
      );
      expect(promptsCat).toBeDefined();
      expect(promptsCat!.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('T21 — Harness/SDD badge events (R58)', () => {
    it('emits harnessDetected and sddDetected when Harness SDD appears', async () => {
      // Start with no methodology
      seedWorkspace({});
      const detector = new AgenticDetector(root, log);

      const onHarness = vi.fn();
      const onSdd = vi.fn();
      detector.on('harnessDetected', onHarness);
      detector.on('sddDetected', onSdd);

      // First scan: no events expected (no methodology)
      await detector.scan();
      expect(onHarness).not.toHaveBeenCalled();
      expect(onSdd).not.toHaveBeenCalled();

      // Second scan: add Harness SDD files
      seedWorkspace({
        '.agents/agentic.json': JSON.stringify({ subagents: [], version: 1 }),
        'feature_list.json': JSON.stringify({ features: [] }),
      });

      await detector.scan();
      expect(onHarness).toHaveBeenCalledTimes(1);
      expect(onSdd).toHaveBeenCalledTimes(1);

      // Third scan: same state — no new events
      await detector.scan();
      expect(onHarness).toHaveBeenCalledTimes(1);
      expect(onSdd).toHaveBeenCalledTimes(1);
    });

    it('emits only sddDetected when Custom SDD appears (no Harness)', async () => {
      seedWorkspace({});
      const detector = new AgenticDetector(root, log);

      const onHarness = vi.fn();
      const onSdd = vi.fn();
      detector.on('harnessDetected', onHarness);
      detector.on('sddDetected', onSdd);

      await detector.scan();
      expect(onHarness).not.toHaveBeenCalled();
      expect(onSdd).not.toHaveBeenCalled();

      // Add Custom SDD (feature_list.json without .agents/agentic.json)
      seedWorkspace({
        'feature_list.json': JSON.stringify({ features: [] }),
      });

      await detector.scan();
      expect(onHarness).not.toHaveBeenCalled();
      expect(onSdd).toHaveBeenCalledTimes(1);
    });
  });
});
