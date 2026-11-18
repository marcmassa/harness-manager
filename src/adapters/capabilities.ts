// FEAT-041 — capability vocabulary from docs/byoh/adapter-capabilities.md.
// Pure: no vscode import.

export type CapabilityLevel = 'supported' | 'partial' | 'unsupported';

export const CAPABILITY_KEYS = [
    'discovery', 'hooks', 'steering', 'commands', 'agentRuns', 'editing', 'validation',
] as const;

export type CapabilityKey = typeof CAPABILITY_KEYS[number];
export type HarnessCapabilities = Record<CapabilityKey, CapabilityLevel>;

const LEVELS = new Set<string>(['supported', 'partial', 'unsupported']);

/** Read-only discovery and nothing else: what a profile v1 provider can do. */
export const DISCOVERY_ONLY: Readonly<HarnessCapabilities> = Object.freeze({
    discovery: 'supported', hooks: 'unsupported', steering: 'unsupported', commands: 'unsupported',
    agentRuns: 'unsupported', editing: 'unsupported', validation: 'unsupported',
});

export function isHarnessCapabilities(value: unknown): value is HarnessCapabilities {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return CAPABILITY_KEYS.every(key => typeof record[key] === 'string' && LEVELS.has(record[key] as string));
}
