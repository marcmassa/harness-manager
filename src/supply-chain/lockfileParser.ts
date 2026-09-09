// FEAT-036 T4 — pure package-lock.json parser. No vscode, no I/O.

/** Parsed view of a package-lock.json (lockfileVersion 1/2/3). (R1, R11) */
export interface LockfileModel {
  /** package name -> resolved version (top-level install entry wins). (R1) */
  resolvedVersions: Record<string, string>;
  /**
   * package name -> true when EVERY occurrence in the tree is flagged dev.
   * Packages with no dev metadata are recorded as `false` (conservative:
   * treated as production). Used for scope classification. (R11)
   */
  devByPackage: Record<string, boolean>;
}

/**
 * Parse a package-lock.json content string. Returns `null` for malformed
 * JSON or an unrecognised shape — callers treat that as "no lockfile"
 * per the degradation matrix (no throw). (R1)
 */
export function parseLockfile(content: string): LockfileModel | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const versions = new Map<string, string>();
  const devOccurrences = new Map<string, { total: number; dev: number }>();

  const record = (name: string, version: string | null, dev: boolean) => {
    const occ = devOccurrences.get(name) ?? { total: 0, dev: 0 };
    occ.total += 1;
    if (dev) occ.dev += 1;
    devOccurrences.set(name, occ);
    if (version !== null && !versions.has(name)) versions.set(name, version);
  };

  if (typeof obj['packages'] === 'object' && obj['packages'] !== null) {
    // lockfileVersion 2/3: keys are paths like "node_modules/<name>".
    // Iterate in key order; a top-level entry ("node_modules/<name>") is
    // recorded before any nested duplicate, so the first-wins map keeps
    // the top-level resolution. (R14)
    const packages = obj['packages'] as Record<string, unknown>;
    const topLevel: Array<[string, Record<string, unknown>]> = [];
    const nested: Array<[string, Record<string, unknown>]> = [];
    for (const [key, value] of Object.entries(packages)) {
      if (typeof value !== 'object' || value === null) continue;
      const entry = value as Record<string, unknown>;
      if (!key.startsWith('node_modules/')) continue; // skip the root "" entry
      const name = nameFromPath(key);
      if (!name) continue;
      (key.split('node_modules/').length === 2 ? topLevel : nested).push([name, entry]);
    }
    for (const [name, entry] of [...topLevel, ...nested]) {
      record(name, typeof entry['version'] === 'string' ? entry['version'] : null, entry['dev'] === true);
    }
  } else if (typeof obj['dependencies'] === 'object' && obj['dependencies'] !== null) {
    // lockfileVersion 1: recursive "dependencies" tree.
    walkLegacy(obj['dependencies'] as Record<string, unknown>, record);
  } else {
    return null;
  }

  const devByPackage: Record<string, boolean> = {};
  for (const [name, occ] of [...devOccurrences.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    devByPackage[name] = occ.total > 0 && occ.dev === occ.total;
  }
  return { resolvedVersions: Object.fromEntries(versions), devByPackage };
}

/** Package name of a "node_modules/..." path (handles scoped packages). */
function nameFromPath(key: string): string | null {
  const tail = key.split('node_modules/').pop() ?? '';
  const parts = tail.split('/');
  if (parts[0].startsWith('@') && parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return parts[0] || null;
}

/** Recursively collect v1-style dependency entries. */
function walkLegacy(
  deps: Record<string, unknown>,
  record: (name: string, version: string | null, dev: boolean) => void,
): void {
  for (const [name, value] of Object.entries(deps)) {
    if (typeof value !== 'object' || value === null) continue;
    const entry = value as Record<string, unknown>;
    record(name, typeof entry['version'] === 'string' ? entry['version'] : null, entry['dev'] === true);
    if (typeof entry['dependencies'] === 'object' && entry['dependencies'] !== null) {
      walkLegacy(entry['dependencies'] as Record<string, unknown>, record);
    }
  }
}
