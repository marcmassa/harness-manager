// FEAT-036 T5 — pure dependency-update-bot config detector.
// No vscode, no I/O: the scanner feeds file contents / presence flags.

import { parse as parseYaml } from 'yaml';

/** Raw inputs gathered by the scanner for bot-config detection. (R3) */
export interface BotConfigInputs {
  /** Content of `.github/dependabot.yml` or null when absent. */
  dependabotYml: string | null;
  /** Content of `.github/dependabot.yaml` or null when absent. */
  dependabotYaml: string | null;
  /** True when ANY of renovate.json / renovate.json5 / .renovaterc exists. */
  renovatePresent: boolean;
}

/** Bot-config presence map stored on the report. (R3) */
export interface BotConfigPresence {
  dependabotNpm: boolean;
  renovate: boolean;
}

/**
 * Detect whether the workspace already configures a dependency-update bot.
 * (R3)
 *
 * - `dependabotNpm`: a `.github/dependabot.yml(.yaml)` whose `updates`
 *   declare the `npm` package-ecosystem. A Dependabot file WITHOUT the npm
 *   ecosystem still counts as missing for npm (degradation matrix).
 * - `renovate`: presence of any Renovate config file (content is not
 *   parsed — presence is enough to satisfy R3).
 *
 * Malformed YAML degrades to "no npm ecosystem" — never throws.
 */
export function detectBotConfigs(inputs: BotConfigInputs): BotConfigPresence {
  return {
    dependabotNpm: declaresNpmEcosystem(inputs.dependabotYml) || declaresNpmEcosystem(inputs.dependabotYaml),
    renovate: inputs.renovatePresent,
  };
}

/** True when a Dependabot YAML document declares `package-ecosystem: npm`. */
export function declaresNpmEcosystem(content: string | null): boolean {
  if (content === null) return false;
  let doc: unknown;
  try {
    doc = parseYaml(content);
  } catch {
    return false;
  }
  if (typeof doc !== 'object' || doc === null) return false;
  const updates = (doc as Record<string, unknown>)['updates'];
  if (!Array.isArray(updates)) return false;
  return updates.some(u =>
    typeof u === 'object' && u !== null
    && (u as Record<string, unknown>)['package-ecosystem'] === 'npm',
  );
}
