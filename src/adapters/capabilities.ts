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

const level = (row: string): HarnessCapabilities => {
    const v = row.split(' ') as CapabilityLevel[];
    return Object.fromEntries(CAPABILITY_KEYS.map((key, i) => [key, v[i]])) as HarnessCapabilities;
};

/**
 * Coverage of the built-in adapters, in CAPABILITY_KEYS order. Mirrors the
 * table in docs/byoh/adapter-capabilities.md (a test keeps them equal).
 */
export const BUILTIN_CAPABILITIES: Readonly<Record<string, HarnessCapabilities>> = {
    'harness-sdd': level('supported supported supported unsupported unsupported partial unsupported'),
    'claude-code': level('supported partial partial unsupported partial partial unsupported'),
    'gemini-cli': level('supported partial partial partial partial partial unsupported'),
    cursor: level('supported partial partial unsupported unsupported partial unsupported'),
    copilot: level('supported partial partial unsupported unsupported partial unsupported'),
    opencode: level('partial unsupported unsupported unsupported unsupported unsupported unsupported'),
    kiro: level('partial partial partial unsupported unsupported partial unsupported'),
    windsurf: level('partial partial partial unsupported unsupported partial unsupported'),
};
