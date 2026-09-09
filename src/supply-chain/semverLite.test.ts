/**
 * Unit tests for semverLite (FEAT-036 T6).
 *
 * @requirement R9   stale-pin comparison (7.28.0 vs 7.29.0)
 * @requirement R14  total, deterministic compare — no exceptions ever
 */

import { describe, it, expect } from 'vitest';
import { compare, isPlainVersion } from './semverLite.js';

describe('semverLite.compare — R9 repo scenario', () => {
  it('7.28.0 < 7.29.0 (the undici stale-override case)', () => {
    expect(compare('7.28.0', '7.29.0')).toBe(-1);
    expect(compare('7.29.0', '7.28.0')).toBe(1);
  });

  it('equal versions compare 0', () => {
    expect(compare('7.29.0', '7.29.0')).toBe(0);
    expect(compare('0.0.0', '0.0.0')).toBe(0);
  });

  it('multi-digit segments compare numerically, not lexically', () => {
    expect(compare('7.9.0', '7.10.0')).toBe(-1);
    expect(compare('1.0.0', '10.0.0')).toBe(-1);
  });

  it('longer version with trailing zeros equals the shorter one', () => {
    expect(compare('1.2', '1.2.0')).toBe(0);
    expect(compare('1.2.0.1', '1.2.0')).toBe(1);
  });

  it('range strings are skipped (compare returns 0)', () => {
    expect(compare('^7.28.0', '7.29.0')).toBe(0);
    expect(compare('>=1.0.0', '2.0.0')).toBe(0);
    expect(compare('*', '1.0.0')).toBe(0);
    expect(compare('', '1.0.0')).toBe(0);
    expect(compare('7.28.0', 'latest')).toBe(0);
  });

  it('prerelease suffixes are treated as ranges (skipped)', () => {
    expect(compare('1.0.0-beta.1', '1.0.0')).toBe(0);
  });

  it('whitespace-tolerant', () => {
    expect(compare(' 7.28.0 ', '7.29.0')).toBe(-1);
  });
});

describe('isPlainVersion', () => {
  it('accepts numeric-dot versions', () => {
    expect(isPlainVersion('7.28.0')).toBe(true);
    expect(isPlainVersion('1')).toBe(true);
  });
  it('rejects ranges and empty strings', () => {
    expect(isPlainVersion('^1.2.3')).toBe(false);
    expect(isPlainVersion('')).toBe(false);
    expect(isPlainVersion('~1.2')).toBe(false);
  });
});
