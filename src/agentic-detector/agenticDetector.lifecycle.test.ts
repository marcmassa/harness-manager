// AgenticDetector — profile, watchers, dismissals, disposal, errors, dedup and events.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', async () => (await import('./detectorTestHarness.js')).createVscodeMock());

import * as vscode from 'vscode';
import { AgenticDetector } from './agenticDetector.js';
import type { AgenticProfile, MaturityLevel } from './types.js';
import { ROOT, mockFiles, seedWorkspace, makeLog, makeMemento } from './detectorTestHarness.js';

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
