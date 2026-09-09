// FEAT-036 T6 — minimal numeric-dot version comparison.
// Deliberately NOT a full semver implementation: override pins in the wild
// (and npm-audit "fixed-in" values) are concrete `x.y.z` versions. Range
// strings (`^1.2.3`, `>=2`, `*`) are not comparable and are skipped (R9, R14).

const NUMERIC_DOT = /^\d+(\.\d+)*$/;

/** True when `v` is a plain numeric-dot version like `7.28.0` or `1.2`. */
export function isPlainVersion(v: string): boolean {
  return NUMERIC_DOT.test(v.trim());
}

/**
 * Compare two numeric-dot versions segment by segment (missing trailing
 * segments count as 0, so `1.2` equals `1.2.0`).
 *
 * Returns 0 whenever either side is NOT a plain numeric-dot version —
 * range strings are "skipped" per the design, which makes the comparison
 * total and deterministic for any input. (R14)
 */
export function compare(a: string, b: string): -1 | 0 | 1 {
  const sa = splitVersion(a);
  const sb = splitVersion(b);
  if (!sa || !sb) return 0;
  const len = Math.max(sa.length, sb.length);
  for (let i = 0; i < len; i++) {
    const na = sa[i] ?? 0;
    const nb = sb[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

function splitVersion(v: string): number[] | null {
  const trimmed = v.trim();
  if (!NUMERIC_DOT.test(trimmed)) return null;
  return trimmed.split('.').map(Number);
}
