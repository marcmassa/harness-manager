// FEAT-036 — Supply-Chain Health: serializable data types.
// Pure types only — no vscode, no child_process, no I/O. (R13)

// @requirement R1, R11 — shape of the deterministic workspace report.

/** Tri-state of the user-triggered `npm audit` lifecycle. (R7, R8, R12) */
export type AuditState = 'not-run' | 'unavailable' | 'captured';

/** A stale security override: pinned version is below the patched version. (R9) */
export interface OverridePin {
  name: string;
  pinned: string;
  patched: string;
}

/** A single audit finding classified by dependency scope. (R11) */
export interface ScopedFinding {
  name: string;
  severity: string;
  scope: 'production' | 'development';
  /** Fixed-in version reported by the audit payload, when known. */
  fixVersion: string | null;
}

/** Derived summary of the cached audit payload — never the raw payload. (R7, R11) */
export interface AuditSummary {
  state: AuditState;
  prodCount: number;
  devCount: number;
  staleOverrides: OverridePin[];
  /** Classified findings; exposed alongside the counts per R11. */
  findings: ScopedFinding[];
}

/**
 * Deterministic output of parsing workspace dependency manifests.
 * Pure data; no process launches, no network. (R1, R13, R14)
 */
export interface SupplyChainReport {
  hasPackageJson: boolean;
  /** name -> declared range (direct prod dependencies). (R1) */
  dependencies: Record<string, string>;
  /** name -> declared range (direct dev dependencies). (R1) */
  devDependencies: Record<string, string>;
  /** name -> pinned range from package.json#overrides (may be non-exact). (R1) */
  overrides: Record<string, string>;
  lockfilePresent: boolean;
  /** name -> resolved version from the lockfile, for direct dependencies. (R1) */
  resolvedVersions: Record<string, string>;
  botConfig: { dependabotNpm: boolean; renovate: boolean };
  audit: AuditSummary;
}

/** The empty report returned for non-Node workspaces. (R2) */
export function emptyReport(): SupplyChainReport {
  return {
    hasPackageJson: false,
    dependencies: {},
    devDependencies: {},
    overrides: {},
    lockfilePresent: false,
    resolvedVersions: {},
    botConfig: { dependabotNpm: false, renovate: false },
    audit: emptyAuditSummary('not-run'),
  };
}

/** An empty audit summary for the given state. */
export function emptyAuditSummary(state: AuditState): AuditSummary {
  return { state, prodCount: 0, devCount: 0, staleOverrides: [], findings: [] };
}
