// Shared vscode mock and helpers for the AgenticDetector suites.
// Usage: vi.mock('vscode', async () => (await import('./detectorTestHarness.js')).createVscodeMock());
import { vi } from 'vitest';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { MaturityLevel } from './types.js';

// ─── Workspace helpers ───────────────────────────────────────────────────────

export const ROOT = '/workspace';
export const mockFiles = new Map<string, string>();

export const normalize = (input: string) => input.replace(/\\/g, '/').replace(/\/+/g, '/');
export const toUri = (fsPath: string) => {
  const n = normalize(fsPath);
  return { fsPath: n, path: n, scheme: 'file', with: vi.fn(), toString: () => n };
};

export function globToRegExp(glob: string): RegExp {
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

export function seedWorkspace(files: Record<string, string>): void {
  mockFiles.clear();
  for (const [filePath, content] of Object.entries(files)) {
    const absolute = filePath.startsWith('/') ? filePath : `${ROOT}/${filePath}`;
    mockFiles.set(normalize(absolute), content);
  }
}

// ─── VS Code mock ────────────────────────────────────────────────────────────


export function createVscodeMock() {
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
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

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
