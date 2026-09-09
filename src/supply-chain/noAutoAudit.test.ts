/**
 * FEAT-036 T13 — grep-style source audit (R6, R13).
 *
 * Proves the ONLY code path to `npm audit` is the user-triggered one:
 * `runNpmAudit` may be referenced solely by its definition
 * (src/supply-chain/auditRunner.ts) and the detector's explicit
 * `runAudit()` method (called by AdvisoryCoordinator from the panel
 * button / palette command). Nothing inside the scan path —
 * AgenticDetector.scan(), the scanner, or any watcher — may reference it.
 *
 * Also proves the supply-chain layer performs zero network I/O (R13).
 *
 * @requirement R6  user-triggered only
 * @requirement R13 no HTTP from extension code
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** All non-test .ts/.tsx files under src/. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'fixtures') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(SRC_ROOT);
  return out;
}

const ALLOWED_AUDIT_REFERENCERS = new Set([
  'supply-chain/auditRunner.ts',       // the definition (the only execFile of npm audit)
  'agentic-detector/agenticDetector.ts', // the explicit runAudit() user entry point
]);

describe('FEAT-036 R6 — npm audit is user-triggered only', () => {
  it('runNpmAudit is referenced ONLY by auditRunner.ts and agenticDetector.ts', () => {
    const offenders = sourceFiles()
      .filter(f => readFileSync(f, 'utf8').includes('runNpmAudit'))
      .map(f => relative(SRC_ROOT, f).replace(/\\/g, '/'))
      .filter(rel => !ALLOWED_AUDIT_REFERENCERS.has(rel));
    expect(offenders).toEqual([]);
  });

  it('agenticDetector.ts references runAudit exactly once (its own definition — scan() never calls it)', () => {
    const src = readFileSync(join(SRC_ROOT, 'agentic-detector/agenticDetector.ts'), 'utf8');
    const calls = src.match(/this\.runAudit\s*\(/g) ?? [];
    expect(calls).toEqual([]);
  });

  it('no file except auditRunner spawns the npm audit argv', () => {
    const offenders = sourceFiles()
      .filter(f => /\[\s*'audit'\s*,\s*'--json'\s*\]/.test(readFileSync(f, 'utf8')))
      .map(f => relative(SRC_ROOT, f).replace(/\\/g, '/'))
      .filter(rel => rel !== 'supply-chain/auditRunner.ts');
    expect(offenders).toEqual([]);
  });
});

describe('FEAT-036 R13 — zero network I/O in the supply-chain layer', () => {
  it('supply-chain sources import no http/https/fetch-based modules', () => {
    const scDir = join(SRC_ROOT, 'supply-chain');
    for (const f of readdirSync(scDir)) {
      if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
      const src = readFileSync(join(scDir, f), 'utf8');
      expect(src, `${f} must not import node:http`).not.toMatch(/from\s+['"]node:https?['"]/);
      expect(src, `${f} must not import node-fetch/got/axios`).not.toMatch(/from\s+['"](node-fetch|got|axios)/);
    }
  });

  it('the only child_process module in supply-chain is auditRunner.ts', () => {
    const users = readdirSync(join(SRC_ROOT, 'supply-chain'))
      .filter((f: string) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f: string) => readFileSync(join(SRC_ROOT, 'supply-chain', f), 'utf8').includes("require('node:child_process'")
        || readFileSync(join(SRC_ROOT, 'supply-chain', f), 'utf8').includes('from \'node:child_process\'')
        || readFileSync(join(SRC_ROOT, 'supply-chain', f), 'utf8').includes('from "node:child_process"'));
    expect(users).toEqual(['auditRunner.ts']);
  });
});
