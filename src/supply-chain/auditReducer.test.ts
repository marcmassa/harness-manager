/**
 * Unit tests for auditReducer (FEAT-036 T7).
 *
 * @requirement R9   stale-override detection incl. the undici 7.28.0→7.29.0 scenario
 * @requirement R11  prod vs dev scope classification
 * @requirement R14  deterministic, exception-free reduction
 */

import { describe, it, expect } from 'vitest';
import { reduceAudit, extractFixVersion } from './auditReducer.js';
import { fixtureJson } from '../test/fixtures/supply-chain/loader.js';

const undiciStale = fixtureJson('audit-payloads/undici-stale.json');
const prodAndDev = fixtureJson('audit-payloads/prod-and-dev.json');
const clean = fixtureJson('audit-payloads/clean.json');
const legacyV1 = fixtureJson('audit-payloads/legacy-v1.json');

// ─── R9: the exact repo scenario ─────────────────────────────────────────────

describe('reduceAudit — R9 stale override (undici 7.28.0 vs 7.29.0)', () => {
  const summary = reduceAudit({
    payload: undiciStale,
    overrides: { undici: '7.28.0' },
    devByPackage: { undici: true },
  });

  it('names the package, the current pin and the patched version', () => {
    expect(summary.staleOverrides).toEqual([
      { name: 'undici', pinned: '7.28.0', patched: '7.29.0' },
    ]);
  });

  it('classifies the undici finding as development (lock dev flag)', () => {
    expect(summary.devCount).toBe(1);
    expect(summary.prodCount).toBe(0);
    expect(summary.findings[0]).toMatchObject({ name: 'undici', scope: 'development', fixVersion: '7.29.0' });
  });

  it('a pin already at the patched version is NOT stale', () => {
    const s = reduceAudit({ payload: undiciStale, overrides: { undici: '7.29.0' }, devByPackage: { undici: true } });
    expect(s.staleOverrides).toEqual([]);
  });

  it('a pin ABOVE the patched version is NOT stale', () => {
    const s = reduceAudit({ payload: undiciStale, overrides: { undici: '7.30.0' }, devByPackage: {} });
    expect(s.staleOverrides).toEqual([]);
  });

  it('a range pin (non-numeric) is skipped, never flagged stale', () => {
    const s = reduceAudit({ payload: undiciStale, overrides: { undici: '^7.28.0' }, devByPackage: {} });
    expect(s.staleOverrides).toEqual([]);
  });

  it('an override whose package has no audit fixVersion is not stale', () => {
    const s = reduceAudit({ payload: clean, overrides: { undici: '7.28.0' }, devByPackage: {} });
    expect(s.staleOverrides).toEqual([]);
  });
});

// ─── R11: scope classification ───────────────────────────────────────────────

describe('reduceAudit — R11 prod vs dev counts', () => {
  const summary = reduceAudit({
    payload: prodAndDev,
    overrides: {},
    devByPackage: { vitest: true, react: false, yaml: false },
  });

  it('counts production and development findings separately', () => {
    expect(summary.prodCount).toBe(2); // react, yaml
    expect(summary.devCount).toBe(1);  // vitest
  });

  it('exposes the classified findings list', () => {
    expect(summary.findings.map(f => f.name)).toEqual(['react', 'vitest', 'yaml']);
    expect(summary.findings.find(f => f.name === 'yaml')!.fixVersion).toBeNull();
  });

  it('unknown packages default to production (conservative)', () => {
    const s = reduceAudit({ payload: prodAndDev, overrides: {}, devByPackage: {} });
    expect(s.prodCount).toBe(3);
    expect(s.devCount).toBe(0);
  });
});

// ─── legacy v1 payload & degradation ─────────────────────────────────────────

describe('reduceAudit — v1 payload and junk inputs', () => {
  it('uses the dev metadata inside v1 findings', () => {
    const summary = reduceAudit({ payload: legacyV1, overrides: {}, devByPackage: {} });
    expect(summary.devCount).toBe(1);   // undici (findings[].dev === true)
    expect(summary.prodCount).toBe(1);  // postcss
  });

  it('null / non-object payloads reduce to zeros without throwing', () => {
    for (const junk of [null, undefined, 'nope', 42, [], true]) {
      const s = reduceAudit({ payload: junk, overrides: { undici: '7.28.0' }, devByPackage: {} });
      expect(s.prodCount).toBe(0);
      expect(s.devCount).toBe(0);
      expect(s.staleOverrides).toEqual([]);
      expect(s.findings).toEqual([]);
    }
  });

  it('extractFixVersion finds the highest reported fix for a package', () => {
    expect(extractFixVersion(undiciStale, 'undici')).toBe('7.29.0');
    expect(extractFixVersion(undiciStale, 'nope')).toBeNull();
  });

  it('clean payload yields zero counts and no findings', () => {
    const s = reduceAudit({ payload: clean, overrides: {}, devByPackage: {} });
    expect(s).toEqual({ prodCount: 0, devCount: 0, staleOverrides: [], findings: [] });
  });
});

// ─── R14: determinism ────────────────────────────────────────────────────────

describe('reduceAudit — R14 deterministic output', () => {
  it('two reductions of identical input are deep-equal and identically ordered', () => {
    const a = reduceAudit({ payload: prodAndDev, overrides: { vitest: '1.0.0', react: '0.1.0' }, devByPackage: { vitest: true } });
    const b = reduceAudit({ payload: JSON.parse(JSON.stringify(prodAndDev)), overrides: { vitest: '1.0.0', react: '0.1.0' }, devByPackage: { vitest: true } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
