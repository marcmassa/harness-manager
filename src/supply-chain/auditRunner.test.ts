/**
 * Unit tests for auditRunner (FEAT-036 T12).
 *
 * Strategy: create a tmp dir containing an executable stub named `npm`
 * (shebang → process.execPath, so the "stub" is really node) and prepend
 * it to process.env.PATH. The stub's behavior is selected via NPM_STUB_MODE.
 * This exercises the real child_process.execFile edge without requiring npm
 * on PATH and without any network.
 *
 * @requirement R7  single bounded run with 15 s timeout
 * @requirement R8  spawn / timeout / non-JSON all resolve as {ok:false,reason}
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNpmAudit, DEFAULT_AUDIT_TIMEOUT_MS } from './auditRunner.js';

let stubDir: string;
let originalPath: string | undefined;
let emptyBinDir: string;

const STUB = `#!${process.execPath}
const mode = process.env.NPM_STUB_MODE || 'ok';
if (mode === 'ok') {
  // exit code 1 WITH valid JSON = vulnerabilities exist = success payload
  console.log(JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }));
  process.exit(1);
}
if (mode === 'ok-zero') {
  console.log(JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }));
  process.exit(0);
}
if (mode === 'garbage') {
  console.log('this is definitely not JSON');
  process.exit(1);
}
if (mode === 'empty-fail') {
  process.exit(127);
}
if (mode === 'sleep') {
  setTimeout(() => { console.log('{}'); }, 10000);
}
`;

beforeAll(() => {
  stubDir = mkdtempSync(join(tmpdir(), 'sc-npm-stub-'));
  emptyBinDir = mkdtempSync(join(tmpdir(), 'sc-empty-bin-'));
  const npmPath = join(stubDir, 'npm');
  writeFileSync(npmPath, STUB, { mode: 0o755 });
  chmodSync(npmPath, 0o755);
  originalPath = process.env.PATH;
  process.env.PATH = `${stubDir}:${originalPath}`;
});

afterAll(() => {
  process.env.PATH = originalPath;
  rmSync(stubDir, { recursive: true, force: true });
  rmSync(emptyBinDir, { recursive: true, force: true });
});

function withMode(mode: string, fn: () => Promise<void>): Promise<void> {
  const prev = process.env.NPM_STUB_MODE;
  process.env.NPM_STUB_MODE = mode;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.NPM_STUB_MODE;
    else process.env.NPM_STUB_MODE = prev;
  });
}

// ─── R7: happy paths ─────────────────────────────────────────────────────────

describe('runNpmAudit — R7', () => {
  it('resolves ok with a parsed payload when exit=1 but stdout is JSON (vulns exist)', async () => {
    await withMode('ok', async () => {
      const result = await runNpmAudit(stubDir);
      expect(result.ok).toBe(true);
      expect(result.ok && result.payload).toEqual({ auditReportVersion: 2, vulnerabilities: {} });
    });
  });

  it('resolves ok when exit=0 with JSON payload', async () => {
    await withMode('ok-zero', async () => {
      const result = await runNpmAudit(stubDir);
      expect(result.ok).toBe(true);
    });
  });

  it('default timeout is the 15 s bound from R7', () => {
    expect(DEFAULT_AUDIT_TIMEOUT_MS).toBe(15_000);
  });
});

// ─── R8: failure modes resolve, never reject ─────────────────────────────────

describe('runNpmAudit — R8 degradation', () => {
  it('non-JSON stdout → {ok:false, reason:"parse"}', async () => {
    await withMode('garbage', async () => {
      const result = await runNpmAudit(stubDir);
      expect(result).toEqual({ ok: false, reason: 'parse' });
    });
  });

  it('exit without any stdout → {ok:false, reason:"parse"}', async () => {
    await withMode('empty-fail', async () => {
      const result = await runNpmAudit(stubDir);
      expect(result).toEqual({ ok: false, reason: 'parse' });
    });
  });

  it('timeout kills the child and reports reason "timeout"', async () => {
    await withMode('sleep', async () => {
      const result = await runNpmAudit(stubDir, 150);
      expect(result).toEqual({ ok: false, reason: 'timeout' });
    });
  });

  it('npm not on PATH → {ok:false, reason:"spawn"}', async () => {
    const prev = process.env.PATH;
    process.env.PATH = emptyBinDir;
    try {
      const result = await runNpmAudit(stubDir);
      expect(result).toEqual({ ok: false, reason: 'spawn' });
    } finally {
      process.env.PATH = prev;
    }
  });
});
