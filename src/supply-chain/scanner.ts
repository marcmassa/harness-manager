// FEAT-036 T8 — supply-chain scanner orchestrator.
// Pure DI over the filesystem (mirrors SignalScanner's {findFiles, readFile}
// injection): every input arrives as a string / presence flag, so the whole
// layer is unit-testable without a VS Code host and fully deterministic.
// (R1, R2, R14)

import type { AuditState, SupplyChainReport } from './types.js';
import { emptyAuditSummary, emptyReport } from './types.js';
import { parsePackageJson } from './packageJsonParser.js';
import { parseLockfile } from './lockfileParser.js';
import { detectBotConfigs } from './botConfigDetector.js';
import { reduceAudit } from './auditReducer.js';

/** Filesystem dependencies, injected by the caller. (R1) */
export interface SupplyChainFsDeps {
  /** Read a workspace-relative file; `null` means absent. */
  readFile(relPath: string): Promise<string | null>;
  /** Presence check for a workspace-relative path. */
  exists(relPath: string): Promise<boolean>;
}

const RENOVATE_CANDIDATES = ['renovate.json', 'renovate.json5', '.renovaterc'];

/**
 * Scan the workspace dependency manifests into a deterministic
 * {@link SupplyChainReport}. (R1)
 *
 * - No `package.json` (or malformed JSON) → empty report, no throw. (R2)
 * - `auditPayload` is ONLY ever the cached JSON of a user-triggered audit;
 *   this function never launches a process and never touches the network.
 *   (R6, R13)
 * - Two calls with identical inputs return deep-equal reports in identical
 *   key order. (R14)
 */
export async function scanWorkspace(
  deps: SupplyChainFsDeps,
  auditPayload: unknown | null,
  auditState: AuditState,
): Promise<SupplyChainReport> {
  const pkgContent = await deps.readFile('package.json');
  const pkg = pkgContent === null ? null : parsePackageJson(pkgContent);

  // Degradation matrix: malformed package.json is treated as absent. (R2)
  if (pkg === null) {
    return { ...emptyReport(), audit: emptyAuditSummary(auditState) };
  }

  const lockContent = await deps.readFile('package-lock.json');
  const lock = lockContent === null ? null : parseLockfile(lockContent);

  // Resolved versions only for direct dependencies (prod + dev). (R1)
  const resolvedVersions: Record<string, string> = {};
  if (lock !== null) {
    for (const name of [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)].sort()) {
      const resolved = lock.resolvedVersions[name];
      if (resolved !== undefined) resolvedVersions[name] = resolved;
    }
  }

  const dependabotYml = (await deps.exists('.github/dependabot.yml'))
    ? await deps.readFile('.github/dependabot.yml')
    : null;
  const dependabotYaml = (await deps.exists('.github/dependabot.yaml'))
    ? await deps.readFile('.github/dependabot.yaml')
    : null;
  let renovatePresent = false;
  for (const candidate of RENOVATE_CANDIDATES) {
    if (await deps.exists(candidate)) {
      renovatePresent = true;
      break;
    }
  }
  const botConfig = detectBotConfigs({ dependabotYml, dependabotYaml, renovatePresent });

  let audit = emptyAuditSummary(auditState);
  if (auditState === 'captured') {
    audit = { state: 'captured', ...reduceAudit({
      payload: auditPayload,
      overrides: pkg.overrides,
      devByPackage: lock?.devByPackage ?? {},
    }) };
  }

  return {
    hasPackageJson: true,
    dependencies: pkg.dependencies,
    devDependencies: pkg.devDependencies,
    overrides: pkg.overrides,
    lockfilePresent: lockContent !== null,
    resolvedVersions,
    botConfig,
    audit,
  };
}
