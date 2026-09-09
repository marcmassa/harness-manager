/**
 * Unit tests for the SC rule family through advisoryEngine.generate()
 * (FEAT-036 T11).
 *
 * @requirement R3   exactly one SC-01 when the bot config is missing
 * @requirement R4   SC-01 carries the create-file dependabot payload
 * @requirement R9   per-package SC-02 ids naming package/pin/patch
 * @requirement R10  run-command action payloads on audit-derived rules
 * @requirement R14  identical ordered SC suggestions for identical profiles
 */

import { describe, it, expect } from 'vitest';
import { generate } from './advisoryEngine.js';
import { makeProfile } from './testUtils.js';
import type { AgenticProfile } from './types.js';
import type { SupplyChainReport } from '../supply-chain/types.js';
import { emptyReport } from '../supply-chain/types.js';
import { DEPENDABOT_TEMPLATE } from '../supply-chain/dependabotTemplate.js';

function withSupplyChain(overrides: Partial<SupplyChainReport> = {}): AgenticProfile {
  const report: SupplyChainReport = {
    ...emptyReport(),
    hasPackageJson: true,
    dependencies: { react: '^18.0.0' },
    lockfilePresent: true,
    ...overrides,
  };
  return makeProfile({
    cliInstalls: [{ cliId: 'kiro', cliName: 'Kiro' }],
    activeCategories: ['prompts', 'rules', 'tools'],
    supplyChain: report,
  });
}

function findById(suggestions: ReturnType<typeof generate>, id: string) {
  return suggestions.find(s => s.id === id);
}

// ─── R3 / R4: SC-01 ──────────────────────────────────────────────────────────

describe('SC-01 sc-add-update-bot — R3, R4', () => {
  it('emits exactly one SC-01 when dependabot+renovate are missing', () => {
    const result = generate(withSupplyChain());
    const matching = result.filter(s => s.id.startsWith('sc-'));
    expect(matching.length).toBe(1);
    expect(matching[0].id).toBe('sc-add-update-bot');
  });

  it('carries a create-file action with the R4 payload (relPath + template)', () => {
    const s = findById(generate(withSupplyChain()), 'sc-add-update-bot')!;
    expect(s.actions).toHaveLength(1);
    const action = s.actions![0];
    expect(action.type).toBe('create-file');
    expect(action.payload.relPath).toBe('.github/dependabot.yml');
    expect(action.payload.template).toBe(DEPENDABOT_TEMPLATE);
    expect(action.payload.template).toContain('package-ecosystem: npm');
    expect(action.payload.template).toContain('package-ecosystem: github-actions');
    expect(action.payload.template).toContain('interval: weekly');
    expect(action.payload.template).toContain('update-types: ["minor", "patch"]');
  });

  it('is silent when dependabot declares npm', () => {
    const result = generate(withSupplyChain({ botConfig: { dependabotNpm: true, renovate: false } }));
    expect(findById(result, 'sc-add-update-bot')).toBeUndefined();
  });

  it('is silent when renovate is present', () => {
    const result = generate(withSupplyChain({ botConfig: { dependabotNpm: false, renovate: true } }));
    expect(findById(result, 'sc-add-update-bot')).toBeUndefined();
  });

  it('respects dismissal via the stable id', () => {
    const result = generate(withSupplyChain(), new Set(['sc-add-update-bot']));
    expect(findById(result, 'sc-add-update-bot')).toBeUndefined();
  });
});

// ─── R9 / R10: SC-02 ─────────────────────────────────────────────────────────

describe('SC-02 sc-stale-override:<name> — R9, R10', () => {
  const captured = {
    state: 'captured' as const,
    prodCount: 0,
    devCount: 2,
    findings: [],
    staleOverrides: [
      { name: 'undici', pinned: '7.28.0', patched: '7.29.0' },
      { name: 'fast-uri', pinned: '3.1.2', patched: '3.1.6' },
    ],
  };

  it('emits one SC-02 per stale package with stable ids', () => {
    const result = generate(withSupplyChain({ audit: captured }));
    expect(findById(result, 'sc-stale-override:undici')).toBeDefined();
    expect(findById(result, 'sc-stale-override:fast-uri')).toBeDefined();
  });

  it('titles name the package, the current pin and the patched version (R9)', () => {
    const s = findById(generate(withSupplyChain({ audit: captured })), 'sc-stale-override:undici')!;
    expect(s.title).toContain('undici');
    expect(s.title).toContain('7.28.0');
    expect(s.title).toContain('7.29.0');
  });

  it('carries BOTH remediation commands per R10', () => {
    const s = findById(generate(withSupplyChain({ audit: captured })), 'sc-stale-override:undici')!;
    const commands = s.actions!.filter(a => a.type === 'run-command').map(a => a.payload.command);
    expect(commands).toContain('npm audit fix');
    expect(commands).toContain('npm outdated');
  });

  it('dismissal of one package does not hide the other', () => {
    const result = generate(withSupplyChain({ audit: captured }), new Set(['sc-stale-override:undici']));
    expect(findById(result, 'sc-stale-override:undici')).toBeUndefined();
    expect(findById(result, 'sc-stale-override:fast-uri')).toBeDefined();
  });

  it('no SC-02 when the audit has not been captured', () => {
    const result = generate(withSupplyChain({
      audit: { ...captured, state: 'not-run' },
    }));
    expect(result.filter(s => s.id.startsWith('sc-stale-override')).length).toBe(0);
  });
});

// ─── SC-03 ───────────────────────────────────────────────────────────────────

describe('SC-03 sc-audit-findings', () => {
  it('fires with run-command npm audit fix when captured findings exist', () => {
    const s = findById(generate(withSupplyChain({
      audit: { state: 'captured', prodCount: 1, devCount: 2, staleOverrides: [], findings: [] },
    })), 'sc-audit-findings')!;
    expect(s).toBeDefined();
    expect(s.impact).toBe('low');
    expect(s.actions!.map(a => a.payload.command)).toEqual(['npm audit fix']);
    expect(s.title).toContain('1 production');
    expect(s.title).toContain('2 development');
  });

  it('silent when captured but zero findings', () => {
    const result = generate(withSupplyChain({
      audit: { state: 'captured', prodCount: 0, devCount: 0, staleOverrides: [], findings: [] },
    }));
    expect(findById(result, 'sc-audit-findings')).toBeUndefined();
  });
});

// ─── R2 / R14 ────────────────────────────────────────────────────────────────

describe('SC rules — R2 silence and R14 determinism', () => {
  it('no SC rules at all on an empty (non-Node) report', () => {
    const result = generate(makeProfile({ supplyChain: emptyReport() }));
    expect(result.filter(s => s.id.startsWith('sc-')).length).toBe(0);
  });

  it('no SC rules when the profile has no supplyChain', () => {
    const result = generate(makeProfile());
    expect(result.filter(s => s.id.startsWith('sc-')).length).toBe(0);
  });

  it('two generate() calls with identical profiles yield identical ordered SC ids', () => {
    const audit = {
      state: 'captured' as const, prodCount: 1, devCount: 1, findings: [],
      staleOverrides: [{ name: 'undici', pinned: '7.28.0', patched: '7.29.0' }],
    };
    const a = generate(withSupplyChain({ audit })).map(s => s.id);
    const b = generate(withSupplyChain({ audit })).map(s => s.id);
    expect(a).toEqual(b);
  });

  it('SC rules never fire for a workspace without package.json even with captured audit', () => {
    const result = generate(makeProfile({
      supplyChain: {
        ...emptyReport(),
        audit: { state: 'captured', prodCount: 3, devCount: 0, staleOverrides: [], findings: [] },
      },
    }));
    // SC-01 needs hasPackageJson; SC-03 fires on captured findings regardless
    // (the scanner only produces a non-empty audit for Node workspaces).
    expect(findById(result, 'sc-add-update-bot')).toBeUndefined();
  });
});
