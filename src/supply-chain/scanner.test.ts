/**
 * Unit tests for the supply-chain scanner (FEAT-036 T8).
 * Uses an in-memory SupplyChainFsDeps over the fixture dirs — mirrors how
 * the SignalScanner tests inject findFiles/readFile fakes.
 *
 * @requirement R1   full report for a Node workspace
 * @requirement R2   non-Node workspace → empty report, no error
 * @requirement R14  double scan → byte-identical report
 */

import { describe, it, expect } from 'vitest';
import { scanWorkspace, type SupplyChainFsDeps } from './scanner.js';
import { emptyReport } from './types.js';
import { existsFixture, fixtureText } from '../test/fixtures/supply-chain/loader.js';
import { DEPENDABOT_TEMPLATE } from './dependabotTemplate.js';

/** Filesystem deps backed by the on-disk fixture directory (read-only). */
function fixtureDeps(dirRel: string, extra: Record<string, string> = {}): SupplyChainFsDeps {
  return {
    async readFile(rel) {
      if (rel in extra) return extra[rel];
      return existsFixture(`${dirRel}/${rel}`) ? fixtureText(`${dirRel}/${rel}`) : null;
    },
    async exists(rel) {
      if (rel in extra) return true;
      return existsFixture(`${dirRel}/${rel}`);
    },
  };
}

// ─── R1: Node workspace ──────────────────────────────────────────────────────

describe('scanWorkspace — R1 node-basic fixture', () => {
  it('produces the full deterministic report', async () => {
    const report = await scanWorkspace(fixtureDeps('node-basic'), null, 'not-run');
    expect(report.hasPackageJson).toBe(true);
    expect(report.dependencies).toEqual({ react: '^18.2.0', yaml: '^2.9.0' });
    expect(report.devDependencies).toEqual({ vitest: '^4.1.8' });
    expect(report.overrides).toEqual({ 'form-data': '4.0.6' });
    expect(report.lockfilePresent).toBe(true);
    expect(report.resolvedVersions).toEqual({ react: '18.2.0', vitest: '4.1.8', yaml: '2.9.0' });
    expect(report.botConfig).toEqual({ dependabotNpm: false, renovate: false });
    expect(report.audit.state).toBe('not-run');
  });

  it('keeps declared ranges and lockfilePresent:false without a lockfile', async () => {
    const noLock: SupplyChainFsDeps = {
      readFile: async rel => (rel === 'package.json' ? fixtureText('node-basic/package.json') : null),
      exists: async () => false,
    };
    const report = await scanWorkspace(noLock, null, 'not-run');
    expect(report.lockfilePresent).toBe(false);
    expect(report.dependencies).toEqual({ react: '^18.2.0', yaml: '^2.9.0' });
    expect(report.resolvedVersions).toEqual({});
  });

  it('detects the dependabot-present fixture as bot-configured', async () => {
    const report = await scanWorkspace(fixtureDeps('dependabot-present'), null, 'not-run');
    expect(report.botConfig.dependabotNpm).toBe(true);
  });

  it('a dependabot file without the npm ecosystem still counts as missing', async () => {
    const report = await scanWorkspace(
      fixtureDeps('node-basic', { '.github/dependabot.yml': 'version: 2\nupdates:\n  - package-ecosystem: docker\n    directory: "/"\n' }),
      null, 'not-run',
    );
    expect(report.botConfig.dependabotNpm).toBe(false);
  });
});

// ─── R2: non-Node workspace ──────────────────────────────────────────────────

describe('scanWorkspace — R2 degradation', () => {
  it('returns an empty report for a workspace without package.json', async () => {
    const report = await scanWorkspace(fixtureDeps('no-node'), null, 'not-run');
    expect(report.hasPackageJson).toBe(false);
    expect(report).toEqual(emptyReport());
  });

  it('malformed package.json is treated as absent (no throw)', async () => {
    const deps: SupplyChainFsDeps = {
      readFile: async rel => (rel === 'package.json' ? '{oops' : null),
      exists: async rel => rel === 'package.json',
    };
    await expect(scanWorkspace(deps, null, 'not-run')).resolves.toEqual(emptyReport());
  });

  it('malformed lockfile keeps the report but marks it present with no resolutions', async () => {
    const report = await scanWorkspace(
      fixtureDeps('node-basic', { 'package-lock.json': 'not json' }),
      null, 'not-run',
    );
    expect(report.lockfilePresent).toBe(true);
    expect(report.resolvedVersions).toEqual({});
  });
});

// ─── Audit integration (R9/R11 through the report) ──────────────────────────

describe('scanWorkspace — audit payload integration', () => {
  const stalePayload = JSON.parse(fixtureText('audit-payloads/undici-stale.json'));

  it('reduces a captured audit payload into the report', async () => {
    const report = await scanWorkspace(fixtureDeps('stale-override'), stalePayload, 'captured');
    expect(report.audit.state).toBe('captured');
    expect(report.audit.staleOverrides).toEqual([
      { name: 'undici', pinned: '7.28.0', patched: '7.29.0' },
    ]);
    expect(report.audit.devCount).toBe(1);
    expect(report.audit.prodCount).toBe(0);
  });

  it('unavailable audit → empty summary with the state recorded, payload ignored', async () => {
    const report = await scanWorkspace(fixtureDeps('stale-override'), stalePayload, 'unavailable');
    expect(report.audit).toEqual({ state: 'unavailable', prodCount: 0, devCount: 0, staleOverrides: [], findings: [] });
  });
});

// ─── R14: determinism ────────────────────────────────────────────────────────

describe('scanWorkspace — R14 determinism', () => {
  it('two scans of unchanged input produce byte-identical reports', async () => {
    const payload = JSON.parse(fixtureText('audit-payloads/prod-and-dev.json'));
    const a = await scanWorkspace(fixtureDeps('node-basic'), payload, 'captured');
    const b = await scanWorkspace(fixtureDeps('node-basic'), payload, 'captured');
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ─── Template sanity (T10, R4) ───────────────────────────────────────────────

describe('DEPENDABOT_TEMPLATE — R4 validity', () => {
  it('is parseable YAML declaring npm + github-actions weekly with grouped minor/patch', async () => {
    const { parse } = await import('yaml');
    const doc = parse(DEPENDABOT_TEMPLATE) as {
      version: number;
      updates: Array<Record<string, any>>;
    };
    expect(doc.version).toBe(2);
    const ecosystems = doc.updates.map(u => u['package-ecosystem']);
    expect(ecosystems).toEqual(['npm', 'github-actions']);
    for (const u of doc.updates) {
      expect(u['schedule']).toEqual({ interval: 'weekly' });
      expect(u.directory).toBe('/');
      expect(u.groups['minor-patch']).toEqual({ patterns: ['*'], 'update-types': ['minor', 'patch'] });
      // dev + prod covered by default: no PR-limit kill switch anywhere.
      expect(JSON.stringify(u)).not.toContain('open-pull-requests-limit');
    }
  });
});
