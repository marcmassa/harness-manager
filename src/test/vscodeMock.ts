// The one in-memory `vscode` mock for unit tests (FEAT-048 R2).
// Usage: vi.mock('vscode', async () => (await import('../test/vscodeMock.js')).createVscodeMock());
// Tests seed files with `seedWorkspace`, settings with `mockConfiguration`, and
// read the watchers the code under test created from `mockWatchers`.
import { vi } from 'vitest';

type UriLike = { fsPath?: string; path?: string };

export const ROOT = '/workspace';
/** Seeded files, keyed by normalized absolute path. */
export const mockFiles = new Map<string, string>();
/** Optional `stat().size` overrides; the content length is the default. */
export const mockSizes = new Map<string, number>();
/** Values returned by `getConfiguration(...).get(key)`; unset keys return the fallback. */
export const mockConfiguration = new Map<string, unknown>();

export interface MockWatcher {
  pattern: unknown;
  onDidChange: (cb: () => void) => void;
  onDidCreate: (cb: () => void) => void;
  onDidDelete: (cb: () => void) => void;
  fire: (event: 'change' | 'create' | 'delete') => void;
  dispose: () => void;
}
/** Every watcher created through `workspace.createFileSystemWatcher`, in order. */
export const mockWatchers: MockWatcher[] = [];

export const normalize = (input: string) => input.replace(/\\/g, '/').replace(/\/+/g, '/');
const keyOf = (uri: UriLike) => normalize(uri.fsPath ?? uri.path ?? '');

export const toUri = (fsPath: string) => {
  const n = normalize(fsPath);
  return { fsPath: n, path: n, scheme: 'file', with: vi.fn(), toString: () => 'file://' + n };
};

/** Glob to RegExp with `**`, `*`, `?` and `{a,b}` support, matched against a relative path. */
export function globToRegExp(glob: string): RegExp {
  let pattern = '^';
  let braceDepth = 0;
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { pattern += '(?:.*/)?'; i += 2; continue; }
      pattern += '.*'; i += 1; continue;
    }
    if (ch === '*') { pattern += '[^/]*'; continue; }
    if (ch === '?') { pattern += '.'; continue; }
    if (ch === '{') { pattern += '(?:'; braceDepth++; continue; }
    if (ch === '}' && braceDepth > 0) { pattern += ')'; braceDepth--; continue; }
    if (ch === ',' && braceDepth > 0) { pattern += '|'; continue; }
    pattern += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(pattern + '$');
}

export function seedWorkspace(files: Record<string, string>): void {
  mockFiles.clear();
  mockSizes.clear();
  for (const [filePath, content] of Object.entries(files)) {
    const absolute = filePath.startsWith('/') ? filePath : `${ROOT}/${filePath}`;
    mockFiles.set(normalize(absolute), content);
  }
}

/** A path with seeded descendants is a directory (2); any other seeded path is a file (1). */
function stat(uri: UriLike): { type: number; size: number } {
  const key = keyOf(uri);
  for (const filePath of mockFiles.keys()) {
    if (filePath.startsWith(`${key}/`)) return { type: 2, size: 0 };
  }
  const content = mockFiles.get(key);
  if (content === undefined) throw new Error(`ENOENT: ${key}`);
  return { type: 1, size: mockSizes.get(key) ?? content.length };
}

function createWatcher(pattern: unknown): MockWatcher {
  const callbacks: Partial<Record<'change' | 'create' | 'delete', () => void>> = {};
  const watcher: MockWatcher = {
    pattern,
    onDidChange: vi.fn((cb: () => void) => { callbacks.change = cb; }),
    onDidCreate: vi.fn((cb: () => void) => { callbacks.create = cb; }),
    onDidDelete: vi.fn((cb: () => void) => { callbacks.delete = cb; }),
    fire: event => callbacks[event]?.(),
    dispose: vi.fn(),
  };
  mockWatchers.push(watcher);
  return watcher;
}

export function createVscodeMock() {
  class RelativePattern {
    constructor(
      public readonly baseUri: { fsPath: string; path: string },
      public readonly pattern: string,
    ) {}
  }

  class Disposable {
    constructor(private readonly callOnDispose: () => void) {}
    public dispose(): void { this.callOnDispose(); }
  }

  const workspace = {
    fs: {
      readFile: vi.fn(async (uri: UriLike) => {
        const key = keyOf(uri);
        const value = mockFiles.get(key);
        if (value === undefined) throw new Error(`ENOENT: ${key}`);
        return Buffer.from(value, 'utf8');
      }),
      stat: vi.fn(async (uri: UriLike) => stat(uri)),
    },
    findFiles: vi.fn(async (pattern: RelativePattern | string, _exclude?: unknown, _maxResults?: number) => {
      const base = typeof pattern === 'string' ? ROOT : keyOf(pattern.baseUri) || ROOT;
      const regexp = globToRegExp(typeof pattern === 'string' ? pattern : pattern.pattern);
      return [...mockFiles.keys()]
        .filter(filePath => filePath.startsWith(`${base}/`) && regexp.test(filePath.slice(base.length + 1)))
        .map(toUri);
    }),
    asRelativePath: vi.fn((file: UriLike | string) => {
      const full = typeof file === 'string' ? normalize(file) : keyOf(file);
      return full.startsWith(`${ROOT}/`) ? full.slice(ROOT.length + 1) : full;
    }),
    getConfiguration: vi.fn((_section?: string) => ({
      get: (key: string, fallback?: unknown) => (mockConfiguration.has(key) ? mockConfiguration.get(key) : fallback),
      has: vi.fn(() => false),
      inspect: vi.fn(() => undefined),
      update: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    createFileSystemWatcher: vi.fn(createWatcher),
  };

  const Uri = {
    file: (fsPath: string) => toUri(fsPath),
    joinPath: (base: UriLike, ...parts: string[]) => toUri([keyOf(base), ...parts].join('/')),
    parse: (str: string) => toUri(str),
  };

  return {
    Uri,
    RelativePattern,
    Disposable,
    FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 },
    ThemeIcon: vi.fn((id: string) => ({ id })),
    ThemeColor: vi.fn((id: string) => ({ id })),
    workspace,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    TreeItem: vi.fn(),
    EventEmitter: vi.fn(() => ({ event: vi.fn(), fire: vi.fn() })),
  };
}
