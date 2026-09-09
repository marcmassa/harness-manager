/**
 * Unit tests for lockfileParser (FEAT-036 T4).
 *
 * @requirement R1   resolved versions per package
 * @requirement R11  dev flags per package for scope classification
 */

import { describe, it, expect } from 'vitest';
import { parseLockfile } from './lockfileParser.js';
import { fixtureText } from '../test/fixtures/supply-chain/loader.js';

// ─── R1: lockfileVersion 3 ───────────────────────────────────────────────────

describe('parseLockfile — v3 packages map', () => {
  const model = parseLockfile(fixtureText('node-basic/package-lock.json'))!;

  it('resolves versions for direct and transitive packages', () => {
    expect(model).not.toBeNull();
    expect(model.resolvedVersions['react']).toBe('18.2.0');
    expect(model.resolvedVersions['yaml']).toBe('2.9.0');
    expect(model.resolvedVersions['vitest']).toBe('4.1.8');
  });

  it('flags dev packages per package metadata (R11)', () => {
    expect(model.devByPackage['vitest']).toBe(true);
    expect(model.devByPackage['magic-string']).toBe(true);
    expect(model.devByPackage['react']).toBe(false);
    expect(model.devByPackage['scheduler']).toBe(false);
  });

  it('top-level resolution wins over a nested duplicate', () => {
    const lock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/left-pad': { version: '1.3.0' },
        'node_modules/a/node_modules/left-pad': { version: '1.0.0', dev: true },
      },
    });
    const m = parseLockfile(lock)!;
    expect(m.resolvedVersions['left-pad']).toBe('1.3.0');
    // Not ALL occurrences are dev → conservative production classification.
    expect(m.devByPackage['left-pad']).toBe(false);
  });

  it('handles scoped packages', () => {
    const m = parseLockfile(JSON.stringify({
      lockfileVersion: 3,
      packages: { '': {}, 'node_modules/@vscode/vsce': { version: '3.9.2', dev: true } },
    }))!;
    expect(m.resolvedVersions['@vscode/vsce']).toBe('3.9.2');
    expect(m.devByPackage['@vscode/vsce']).toBe(true);
  });
});

// ─── R1: lockfileVersion 1 fallback ─────────────────────────────────────────

describe('parseLockfile — v1 dependencies tree', () => {
  it('walks nested dependencies and keeps dev flags', () => {
    const m = parseLockfile(JSON.stringify({
      lockfileVersion: 1,
      dependencies: {
        react: { version: '17.0.0' },
        vitest: { version: '4.0.0', dev: true, dependencies: { 'magic-string': { version: '0.30.0', dev: true } } },
      },
    }))!;
    expect(m.resolvedVersions['react']).toBe('17.0.0');
    expect(m.devByPackage['vitest']).toBe(true);
    expect(m.devByPackage['magic-string']).toBe(true);
  });
});

// ─── Degradation ─────────────────────────────────────────────────────────────

describe('parseLockfile — malformed input', () => {
  it('returns null for malformed JSON (no throw)', () => {
    expect(parseLockfile('}{')).toBeNull();
  });

  it('returns null when neither packages nor dependencies exist', () => {
    expect(parseLockfile(JSON.stringify({ name: 'x' }))).toBeNull();
  });
});
