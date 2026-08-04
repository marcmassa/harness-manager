// FEAT-035 — Assisted Component Fixes — delegation task construction (design.md §B, R15, R20)
//
// Pure text assembly. The launch itself belongs to OptimizerCoordinator, which
// may import `vscode`.
//
// Deliberately does NOT reuse `RunNode` from src/run/types.ts. `RunNode.type` is
// `'agent' | 'subagent' | 'skill'` because FEAT-033 runs *agents*; delegation
// targets *files*, including steering and hooks, which is a different thing.
// Widening RunNode to fit would blur what the run panel means.

import type { OptimizerFinding } from './types.js';

export type DelegateScope =
    | { kind: 'finding'; finding: OptimizerFinding }
    | { kind: 'component'; nodeId: string; findings: OptimizerFinding[] }
    | { kind: 'rule'; ruleId: string; findings: OptimizerFinding[] };

export interface DelegateTask {
    text: string;
    /** Every distinct file the agent is permitted to touch. */
    filePaths: string[];
    /** Distinct components, not findings — this is what R20's cap counts. */
    componentCount: number;
}

function findingsOf(scope: DelegateScope): OptimizerFinding[] {
    return scope.kind === 'finding' ? [scope.finding] : scope.findings;
}

/** Distinct, non-empty, in first-seen order so the task text is stable. */
function distinct(values: string[]): string[] {
    return [...new Set(values.filter(v => v.length > 0))];
}

function describeFinding(f: OptimizerFinding): string {
    const where = f.line ? ` (line ${f.line})` : '';
    return `- ${f.filePath}${where} — ${f.ruleId}: ${f.title}\n  ${f.detail}`;
}

/**
 * R15 — build the task handed to a terminal agent. It names every target path
 * and rule, and constrains the agent to those files.
 *
 * The instruction to touch nothing else matters more here than in AI Refine:
 * this mode has no diff preview, so the scope statement in the prompt is the
 * only boundary before the agent writes to the working tree.
 */
export function buildDelegateTask(scope: DelegateScope): DelegateTask {
    const findings = findingsOf(scope);
    const filePaths = distinct(findings.map(f => f.filePath));
    const componentCount = distinct(findings.map(f => f.nodeId)).length;
    const ruleIds = distinct(findings.map(f => f.ruleId));

    const heading =
        scope.kind === 'finding'
            ? `Fix one issue reported by the Harness Component Optimizer.`
            : scope.kind === 'component'
                ? `Fix ${findings.length} issue${findings.length === 1 ? '' : 's'} reported by the Harness Component Optimizer on a single component.`
                : `Fix ${findings.length} occurrence${findings.length === 1 ? '' : 's'} of ${scope.ruleId} across ${componentCount} component${componentCount === 1 ? '' : 's'}.`;

    const text = [
        heading,
        '',
        `Rules involved: ${ruleIds.join(', ')}`,
        '',
        'Findings:',
        ...findings.map(describeFinding),
        '',
        'Change ONLY these files:',
        ...filePaths.map(p => `- ${p}`),
        '',
        'Do not modify any other file. Preserve each file\'s YAML frontmatter and',
        'every field it already declares unless a finding is specifically about the',
        'frontmatter.',
    ].join('\n');

    return { text, filePaths, componentCount };
}
