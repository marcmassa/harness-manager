// Helpers for the AgenticDetector suites. The vscode mock itself is the shared one.
// Usage: vi.mock('vscode', async () => (await import('../test/vscodeMock.js')).createVscodeMock());
import { vi } from 'vitest';
import type * as vscode from 'vscode';
import type { MaturityLevel } from './types.js';

export { ROOT, mockFiles, seedWorkspace, createVscodeMock } from '../test/vscodeMock.js';

export function makeLog(): vscode.LogOutputChannel {
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

export function makeMemento(): vscode.Memento {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(<T>(key: string, fallback?: T): T => (store.has(key) ? store.get(key) as T : fallback as T)),
    update: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
    keys: vi.fn(() => Array.from(store.keys())),
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento;
}

export function levelOrder(level: MaturityLevel): number {
  return { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 }[level];
}
