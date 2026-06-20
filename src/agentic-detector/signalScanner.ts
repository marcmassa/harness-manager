import * as vscode from 'vscode';
import * as path from 'path';
import { SIGNAL_CATALOG, getGlobsByCategory } from './signalCatalog.js';
import { matchContent } from './contentMatcher.js';
import type {
  SignalCategory,
  SignalDefinition,
  SignalMatch,
  SignalCategoryResult,
} from './types.js';

// ─── Excluded directories ────────────────────────────────────────────

export const EXCLUDED_GLOB_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.venv/**',
  '**/__pycache__/**',
  '**/out/**',
  '**/coverage/**',
];

// ─── SignalScanner class ───────────────────────────────────────────

export interface ScanOptions {
  findFiles: (include: vscode.GlobPattern, exclude?: vscode.GlobPattern) => Thenable<vscode.Uri[]>;
  readFile: (uri: vscode.Uri) => Thenable<Uint8Array>;
  rootUri: vscode.Uri;
}

export class SignalScanner {
  constructor(private options: ScanOptions) {}

  /**
   * Scan all signal categories in parallel.
   */
  async scanAllCategories(): Promise<SignalCategoryResult[]> {
    const excludeGlob = `{${EXCLUDED_GLOB_PATTERNS.join(',')}}`;
    const promises = SIGNAL_CATALOG.map(signal =>
      this.scanSignal(signal, excludeGlob),
    );
    const results = await Promise.all(promises);

    // Merge per-category: same category may have multiple signal definitions
    const categoryMap = new Map<SignalCategory, SignalCategoryResult>();

    for (const result of results) {
      if (!result) continue;
      const existing = categoryMap.get(result.category);
      if (existing) {
        existing.matches.push(...result.matches);
        existing.count += result.count;
        existing.truncated = existing.truncated || result.truncated;
      } else {
        categoryMap.set(result.category, {
          category: result.category,
          label: result.label,
          matches: [...result.matches],
          count: result.count,
          truncated: result.truncated,
        });
      }
    }

    return Array.from(categoryMap.values());
  }

  /**
   * Re-scan a single category (used by file watcher).
   */
  async scanCategory(category: SignalCategory): Promise<SignalCategoryResult | null> {
    const signals = SIGNAL_CATALOG.filter(s => s.category === category);
    if (signals.length === 0) return null;

    const excludeGlob = `{${EXCLUDED_GLOB_PATTERNS.join(',')}}`;
    const promises = signals.map(s => this.scanSignal(s, excludeGlob));
    const results = await Promise.all(promises);

    const filtered = results.filter((r): r is SignalCategoryResult => r !== null);
    if (filtered.length === 0) return null;

    const merged: SignalCategoryResult = {
      category,
      label: filtered[0].label,
      matches: [],
      count: 0,
      truncated: false,
    };

    for (const r of filtered) {
      merged.matches.push(...r.matches);
      merged.count += r.count;
      merged.truncated = merged.truncated || r.truncated;
    }

    return merged;
  }

  /**
   * Get all unique glob patterns for file watcher subscriptions.
   */
  getWatchGlobs(): string[] {
    return getAllWatchGlobs();
  }

  /**
   * Get globs grouped by category for targeted re-scans.
   */
  getGlobsByCategory(): Record<string, string[]> {
    return getGlobsByCategory();
  }

  // ── Private ──

  private async scanSignal(
    signal: SignalDefinition,
    excludeGlob: string,
  ): Promise<SignalCategoryResult | null> {
    const maxFiles = signal.maxFiles ?? 200;
    const uris: vscode.Uri[] = [];

    // Scan each glob pattern up to the max
    for (const glob of signal.globs) {
      if (uris.length >= maxFiles) break;
      const remaining = maxFiles - uris.length;
      // Use a more specific glob pattern for VS Code findFiles
      const results = await this.options.findFiles(
        new vscode.RelativePattern(this.options.rootUri, glob),
        excludeGlob,
      );
      for (const uri of results) {
        if (uris.length >= maxFiles) break;
        uris.push(uri);
      }
    }

    if (uris.length === 0) return null;

    const truncated = uris.length >= maxFiles;
    const matches: SignalMatch[] = [];

    // For signals with content patterns, read files and check
    if (signal.contentPatterns && signal.contentPatterns.length > 0) {
      const contentPromises = uris.map(async (uri) => {
        try {
          const bytes = await this.options.readFile(uri);
          const content = new TextDecoder().decode(bytes);
          const contentMatches = matchContent(uri.fsPath, content, signal);
          return contentMatches;
        } catch {
          return [] as SignalMatch[];
        }
      });
      const contentResults = await Promise.all(contentPromises);
      for (const cm of contentResults) {
        matches.push(...cm);
      }
    } else {
      // Simple glob match — all files are matches
      for (const uri of uris) {
        matches.push({
          filePath: uri.fsPath,
          category: signal.category,
          matchedPattern: signal.id,
          confidence: 'high',
          evidence: path.basename(uri.fsPath),
          layer: 2,
        });
      }
    }

    return {
      category: signal.category,
      label: signal.label,
      matches,
      count: matches.length,
      truncated,
    };
  }
}

// ── Watch globs helper ─────────────────────────────────────────────

function getAllWatchGlobs(): string[] {
  const set = new Set<string>();
  for (const signal of SIGNAL_CATALOG) {
    // Only use non-content-pattern globs for watching (content patterns
    // scan all .md/.json etc. — too broad for watchers)
    if (signal.contentPatterns && signal.contentPatterns.length > 0) continue;
    for (const glob of signal.globs) {
      set.add(glob);
    }
  }
  return Array.from(set);
}
