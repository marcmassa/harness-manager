/**
 * Unit tests for botConfigDetector (FEAT-036 T5).
 *
 * @requirement R3  dependabot-npm / renovate presence detection
 */

import { describe, it, expect } from 'vitest';
import { detectBotConfigs, declaresNpmEcosystem } from './botConfigDetector.js';
import { fixtureText } from '../test/fixtures/supply-chain/loader.js';
import { DEPENDABOT_TEMPLATE } from './dependabotTemplate.js';

// ─── R3: Dependabot npm ecosystem ────────────────────────────────────────────

describe('detectBotConfigs — dependabot', () => {
  it('detects the npm ecosystem in the fixture config', () => {
    const res = detectBotConfigs({
      dependabotYml: fixtureText('dependabot-present/.github/dependabot.yml'),
      dependabotYaml: null,
      renovatePresent: false,
    });
    expect(res.dependabotNpm).toBe(true);
    expect(res.renovate).toBe(false);
  });

  it('accepts the shipped R4 template itself', () => {
    expect(declaresNpmEcosystem(DEPENDABOT_TEMPLATE)).toBe(true);
  });

  it('a dependabot file WITHOUT the npm ecosystem still counts as missing (R3 wording)', () => {
    const res = detectBotConfigs({
      dependabotYml: 'version: 2\nupdates:\n  - package-ecosystem: github-actions\n    directory: "/"\n',
      dependabotYaml: null,
      renovatePresent: false,
    });
    expect(res.dependabotNpm).toBe(false);
  });

  it('checks the .yaml variant too', () => {
    const res = detectBotConfigs({
      dependabotYml: null,
      dependabotYaml: 'version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: "/"\n',
      renovatePresent: false,
    });
    expect(res.dependabotNpm).toBe(true);
  });

  it('malformed YAML degrades to not-present without throwing', () => {
    expect(() => declaresNpmEcosystem('version: 2\n\tupdates: [')).not.toThrow();
    expect(declaresNpmEcosystem('version: 2\n\tupdates: [')).toBe(false);
  });

  it('null content is not-present', () => {
    expect(declaresNpmEcosystem(null)).toBe(false);
  });
});

// ─── R3: Renovate presence ───────────────────────────────────────────────────

describe('detectBotConfigs — renovate', () => {
  it('presence of a renovate file satisfies the bot requirement', () => {
    const res = detectBotConfigs({ dependabotYml: null, dependabotYaml: null, renovatePresent: true });
    expect(res.renovate).toBe(true);
    expect(res.dependabotNpm).toBe(false);
  });

  it('no config at all → both false', () => {
    const res = detectBotConfigs({ dependabotYml: null, dependabotYaml: null, renovatePresent: false });
    expect(res).toEqual({ dependabotNpm: false, renovate: false });
  });
});
