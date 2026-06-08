import { IAgentAdapter } from './IAgentAdapter.js';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js';
import { CopilotAdapter } from './CopilotAdapter.js';
import { CursorAdapter } from './CursorAdapter.js';
import { GeminiCliAdapter } from './GeminiCliAdapter.js';
import { HarnessSddAdapter } from './HarnessSddAdapter.js';
import { OpenCodeAdapter } from './OpenCodeAdapter.js';
import { WindsurfAdapter } from './WindsurfAdapter.js';

export function createDefaultAdapters(): IAgentAdapter[] {
    return [
        new HarnessSddAdapter(),
        new ClaudeCodeAdapter(),
        new GeminiCliAdapter(),
        new CursorAdapter(),
        new CopilotAdapter(),
        new OpenCodeAdapter(),
        new WindsurfAdapter(),
    ];
}

export {
    ClaudeCodeAdapter,
    CopilotAdapter,
    CursorAdapter,
    GeminiCliAdapter,
    HarnessSddAdapter,
    OpenCodeAdapter,
    WindsurfAdapter,
};
