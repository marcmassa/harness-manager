// FEAT-036 T3 — pure package.json parser. No vscode, no I/O.

/** Parsed view of a package.json manifest. (R1) */
export interface PackageJsonModel {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  overrides: Record<string, string>;
}

/**
 * Parse a package.json content string into the three flat name→range maps.
 * (R1)
 *
 * Returns `null` for malformed JSON or non-object roots — callers treat
 * that as "absent" per the degradation matrix (no throw). (R2)
 *
 * Non-string values inside the maps (e.g. nested override objects) are
 * skipped: npm overrides are matched here as flat name→range maps.
 */
export function parsePackageJson(content: string): PackageJsonModel | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const obj = raw as Record<string, unknown>;
  return {
    dependencies: stringMap(obj['dependencies']),
    devDependencies: stringMap(obj['devDependencies']),
    overrides: stringMap(obj['overrides']),
  };
}

/** Keep only string-valued entries of a record, preserving key order. */
function stringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[key] = v;
  }
  return out;
}
