// FEAT-036 T7 — pure reducer over a cached `npm audit --json` payload.
// No vscode, no child_process: the payload arrives as an unknown value.
//
// Supports the two npm audit JSON shapes:
//   - auditReportVersion 2 (npm >= 7): `vulnerabilities` map keyed by name,
//     fix version from `fixAvailable.version` / `fixVersion` / `fixedIn`.
//   - auditReportVersion 1 (npm 6): `advisories` map with `findings[]`
//     carrying per-finding `dev` flags.
// Anything else reduces to an empty summary — never throws. (R8, R14)

import type { AuditSummary, OverridePin, ScopedFinding } from './types.js';
import { emptyAuditSummary } from './types.js';
import { compare } from './semverLite.js';

export interface AuditReduceInput {
  /** Parsed JSON of a user-triggered `npm audit --json` run, or null. */
  payload: unknown;
  /** package.json#overrides map (name -> pinned range). (R9) */
  overrides: Record<string, string>;
  /** Lockfile dev flags (name -> every occurrence is dev). (R11) */
  devByPackage: Record<string, boolean>;
}

/**
 * Reduce an audit payload to counts (prod vs dev), classified findings and
 * the stale-override list. (R9, R11)
 *
 * `unavailable` / `not-run` states are produced by the scanner, not here;
 * this function only ever returns the `captured`-shaped data (the caller
 * stamps the state).
 */
export function reduceAudit(input: AuditReduceInput): Omit<AuditSummary, 'state'> {
  const findings = extractFindings(input.payload, input.devByPackage);
  const prodCount = findings.filter(f => f.scope === 'production').length;
  const devCount = findings.filter(f => f.scope === 'development').length;
  const staleOverrides = findStaleOverrides(input.overrides, findings);
  return { prodCount, devCount, staleOverrides, findings };
}

/**
 * Fixed-in version for a package name reported by the audit payload, or
 * null when the payload does not name one. Range strings are skipped by
 * the semverLite compare, so this helper only extracts concrete versions.
 */
export function extractFixVersion(payload: unknown, name: string): string | null {
  const findings = extractFindings(payload, {});
  const best = findings
    .filter(f => f.name === name && f.fixVersion !== null)
    .map(f => f.fixVersion as string)
    .sort(compareVersionsDesc);
  return best[0] ?? null;
}

function compareVersionsDesc(a: string, b: string): number {
  return compare(b, a);
}

// ─── Finding extraction ──────────────────────────────────────────────────────

function extractFindings(payload: unknown, devByPackage: Record<string, boolean>): ScopedFinding[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const obj = payload as Record<string, unknown>;

  const out: ScopedFinding[] = [];

  // auditReportVersion 2
  const vulns = obj['vulnerabilities'];
  if (typeof vulns === 'object' && vulns !== null) {
    for (const [name, value] of Object.entries(vulns as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      const v = value as Record<string, unknown>;
      const severity = typeof v['severity'] === 'string' ? v['severity'] : 'unknown';
      const fixVersion = pickFixVersion(v);
      out.push({
        name,
        severity,
        // v2 payloads carry no dev metadata — classify from the lockfile.
        // Unknown packages are conservatively treated as production. (R11)
        scope: devByPackage[name] === true ? 'development' : 'production',
        fixVersion,
      });
    }
  }

  // auditReportVersion 1
  const advisories = obj['advisories'];
  if (typeof advisories === 'object' && advisories !== null) {
    for (const value of Object.values(advisories as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      const a = value as Record<string, unknown>;
      const name = typeof a['moduleName'] === 'string' ? a['moduleName'] : null;
      if (!name) continue;
      const severity = typeof a['severity'] === 'string' ? a['severity'] : 'unknown';
      const findings = Array.isArray(a['findings']) ? a['findings'] : [];
      const allDev = findings.length > 0 && findings.every(f =>
        typeof f === 'object' && f !== null && (f as Record<string, unknown>)['dev'] === true);
      // v1 findings carry their own dev metadata; fall back to the lock.
      const scope: ScopedFinding['scope'] = allDev || devByPackage[name] === true
        ? 'development' : 'production';
      out.push({ name, severity, scope, fixVersion: pickFixVersion(a) });
    }
  }

  // Deterministic order: by name, then severity, then fixVersion. (R14)
  return out.sort((x, y) =>
    x.name < y.name ? -1 : x.name > y.name ? 1
    : x.severity < y.severity ? -1 : x.severity > y.severity ? 1
    : (x.fixVersion ?? '') < (y.fixVersion ?? '') ? -1 : (x.fixVersion ?? '') > (y.fixVersion ?? '') ? 1 : 0,
  );
}

/** Pick a concrete fixed-in version from a vulnerability/advisory entry. */
function pickFixVersion(entry: Record<string, unknown>): string | null {
  const candidates: unknown[] = [];
  const fa = entry['fixAvailable'];
  if (typeof fa === 'object' && fa !== null) candidates.push((fa as Record<string, unknown>)['version']);
  candidates.push(entry['fixVersion']);
  if (Array.isArray(entry['fixedIn'])) candidates.push(...(entry['fixedIn'] as unknown[]));
  if (Array.isArray(entry['via'])) {
    for (const via of entry['via']) {
      if (typeof via === 'object' && via !== null) {
        const v = via as Record<string, unknown>;
        candidates.push(v['fixVersion']);
        if (Array.isArray(v['fixedIn'])) candidates.push(...(v['fixedIn'] as unknown[]));
      }
    }
  }
  const versions = candidates.filter((c): c is string => typeof c === 'string' && /^\d+(\.\d+)*$/.test(c.trim()));
  versions.sort(compareVersionsDesc);
  return versions[0] ?? null;
}

// ─── Stale-override detection (R9) ───────────────────────────────────────────

function findStaleOverrides(
  overrides: Record<string, string>,
  findings: ScopedFinding[],
): OverridePin[] {
  const fixByName = new Map<string, string>();
  for (const f of findings) {
    if (f.fixVersion === null) continue;
    const current = fixByName.get(f.name);
    if (!current || compare(current, f.fixVersion) === -1) fixByName.set(f.name, f.fixVersion);
  }

  const stale: OverridePin[] = [];
  for (const [name, pinned] of Object.entries(overrides)) {
    const patched = fixByName.get(name);
    if (patched === undefined) continue;
    // compare() returns 0 for range strings — only a strictly-lower plain
    // pin counts as stale. (R9, R14)
    if (compare(pinned, patched) === -1) {
      stale.push({ name, pinned, patched });
    }
  }
  return stale.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Empty summary helper re-exported for the scanner's convenience. */
export function emptySummary(state: 'not-run' | 'unavailable'): AuditSummary {
  return emptyAuditSummary(state);
}
