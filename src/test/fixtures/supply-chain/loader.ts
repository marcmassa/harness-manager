// FEAT-036 — shared fixture loader for supply-chain tests.
// Reads fixture files from disk with node:fs only (no vscode host).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '');

/** Absolute path of a fixture relative to src/test/fixtures/supply-chain/. */
export function fixturePath(rel: string): string {
  return join(FIXTURE_ROOT, rel);
}

/** Text content of a fixture file. */
export function fixtureText(rel: string): string {
  return readFileSync(fixturePath(rel), 'utf8');
}

/** Parsed JSON of a fixture file. */
export function fixtureJson(rel: string): unknown {
  return JSON.parse(fixtureText(rel));
}

export function existsFixture(rel: string): boolean {
  return existsSync(fixturePath(rel));
}
