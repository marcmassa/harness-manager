// FEAT-033: Agent Run Panel — shared types for the run module

export interface RunAdapter {
    readonly id: string;
    readonly name: string;
    readonly cliCommand: string;
    isAvailable(): Promise<boolean>;
    buildCommand(node: RunNode, opts: RunOptions): string;
}

export interface RunNode {
    id: string;
    type: 'agent' | 'subagent' | 'skill';
    name: string;
    filePath: string; // workspace-relative path to SUBAGENT.md / SKILL.md
}

export interface RunOptions {
    task: string;
    featureContext?: string; // pre-fetched spec text (requirements.md excerpt)
    model?: string;
    interactive?: boolean; // default true for claude-code
    extraArgs?: string;
}

export interface RunHistoryEntry {
    nodeId: string;
    nodeName: string;
    adapterId: string;
    taskSnippet: string; // first 80 chars of task
    timestamp: number;
    durationMs?: number; // set when terminal closes
}

export const RUN_HISTORY_KEY = 'harness-dashboard.runHistory';
export const RUN_ADAPTER_KEY = 'harness-dashboard.selectedRunAdapterId';
