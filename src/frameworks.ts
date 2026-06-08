export interface SupportedFramework {
    id: string;
    label: string;
    signatures: string[];
    accent: string;
}

export const SUPPORTED_FRAMEWORKS: SupportedFramework[] = [
    {
        id: 'harness-sdd',
        label: 'Harness',
        signatures: ['.agents/agentic.json'],
        accent: '#4a7dff',
    },
    {
        id: 'claude-code',
        label: 'Claude Code',
        signatures: ['CLAUDE.md', '.claude/agents/*.md'],
        accent: '#d97706',
    },
    {
        id: 'gemini-cli',
        label: 'Gemini CLI',
        signatures: ['GEMINI.md', '.gemini/commands/*.toml'],
        accent: '#7c3aed',
    },
    {
        id: 'cursor',
        label: 'Cursor',
        signatures: ['.cursorrules', '.cursor/rules/*.mdc'],
        accent: '#0ea5e9',
    },
    {
        id: 'copilot',
        label: 'GitHub Copilot',
        signatures: ['.github/copilot-instructions.md', '.github/instructions/*.instructions.md', '.vscode/prompts/*.prompt.md'],
        accent: '#22c55e',
    },
    {
        id: 'opencode',
        label: 'OpenCode',
        signatures: ['opencode.json', 'opencode.jsonc'],
        accent: '#f97316',
    },
    {
        id: 'windsurf',
        label: 'Windsurf',
        signatures: ['.windsurfrc', '.windsurf/rules/*.md'],
        accent: '#ec4899',
    },
];

export const FRAMEWORK_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
    SUPPORTED_FRAMEWORKS.map((framework) => [framework.id, framework.label])
);

export const FRAMEWORK_ACCENT_BY_ID: Record<string, string> = Object.fromEntries(
    SUPPORTED_FRAMEWORKS.map((framework) => [framework.id, framework.accent])
);

export function frameworkLabel(frameworkId: string): string {
    return FRAMEWORK_LABEL_BY_ID[frameworkId] ?? frameworkId;
}
