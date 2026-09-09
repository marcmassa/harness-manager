/**
 * Unit tests for packageJsonParser (FEAT-036 T3).
 * Pure function fed string inputs — no VS Code host.
 *
 * @requirement R1  deps / devDeps / overrides maps
 * @requirement R2  malformed JSON treated as absent (null), never throws
 */

import { describe, it, expect } from 'vitest';
import { parsePackageJson } from './packageJsonParser.js';
import { fixtureText } from '../test/fixtures/supply-chain/loader.js';

// ─── R1: happy path ──────────────────────────────────────────────────────────

describe('parsePackageJson — R1 maps', () => {
  it('parses dependencies, devDependencies and overrides as flat maps', () => {
    const model = parsePackageJson(fixtureText('node-basic/package.json'));
    expect(model).not.toBeNull();
    expect(model!.dependencies).toEqual({ react: '^18.2.0', yaml: '^2.9.0' });
    expect(model!.devDependencies).toEqual({ vitest: '^4.1.8' });
    expect(model!.overrides).toEqual({ 'form-data': '4.0.6' });
  });

  it('returns empty maps when sections are absent', () => {
    const model = parsePackageJson(JSON.stringify({ name: 'x' }));
    expect(model).toEqual({ dependencies: {}, devDependencies: {}, overrides: {} });
  });

  it('skips non-string override values (nested override objects)', () => {
    const model = parsePackageJson(JSON.stringify({
      overrides: { undici: '7.28.0', nested: { a: '1' } },
    }));
    expect(model!.overrides).toEqual({ undici: '7.28.0' });
  });

  it('preserves declared key order (deterministic — R14)', () => {
    const model = parsePackageJson(JSON.stringify({
      dependencies: { zzz: '1', aaa: '2' },
    }));
    expect(Object.keys(model!.dependencies)).toEqual(['zzz', 'aaa']);
  });
});

// ─── R2: degradation ─────────────────────────────────────────────────────────

describe('parsePackageJson — R2 malformed input', () => {
  it('returns null for malformed JSON (no throw)', () => {
    expect(() => parsePackageJson('{ not json')).not.toThrow();
    expect(parsePackageJson('{ not json')).toBeNull();
  });

  it('returns null for non-object roots', () => {
    expect(parsePackageJson('[]')).toBeNull();
    expect(parsePackageJson('"hello"')).toBeNull();
    expect(parsePackageJson('null')).toBeNull();
  });
});
