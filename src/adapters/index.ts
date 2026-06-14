import { IAgentAdapter } from './IAgentAdapter.js';
import {
    ConfigurationRegistry,
    initConfigurationRegistry,
} from './ConfigurationRegistry.js';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js';
import { CopilotAdapter } from './CopilotAdapter.js';
import { CursorAdapter } from './CursorAdapter.js';
import { GeminiCliAdapter } from './GeminiCliAdapter.js';
import { HarnessSddAdapter } from './HarnessSddAdapter.js';
import { KiroAdapter } from './KiroAdapter.js';
import { OpenCodeAdapter } from './OpenCodeAdapter.js';
import { WindsurfAdapter } from './WindsurfAdapter.js';

// Delegate to the singleton's own storage so callers in
// `extension.ts` and tests see the same instance.
export function getConfigurationRegistry(): ConfigurationRegistry {
    return ConfigurationRegistry.getInstance();
}

export function disposeConfigurationRegistry(): void {
    ConfigurationRegistry.resetInstance();
}

export function createDefaultAdapters(): IAgentAdapter[] {
    // Ensure the singleton is constructed before any adapter
    // is built, so `watchGlobs()` can read the registry
    // without a `getInstance` call deferring the construction.
    getConfigurationRegistry();

    return [
        new HarnessSddAdapter(),
        new ClaudeCodeAdapter(),
        new GeminiCliAdapter(),
        new CursorAdapter(),
        new OpenCodeAdapter(),
        new CopilotAdapter(),
        new WindsurfAdapter(),
        new KiroAdapter(),
    ];
}

export {
    ClaudeCodeAdapter,
    ConfigurationRegistry,
    CopilotAdapter,
    CursorAdapter,
    GeminiCliAdapter,
    HarnessSddAdapter,
    initConfigurationRegistry,
    KiroAdapter,
    OpenCodeAdapter,
    WindsurfAdapter,
};
