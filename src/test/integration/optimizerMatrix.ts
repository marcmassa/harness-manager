// FEAT-043 T4 — Optimizer in a real Extension Host (R1–R7).
// Claude-only, custom-profile, mixed and SDD roots: applicable rules, coverage,
// owner attribution and action availability; unchanged files after scanning;
// a refused fix on a read-only owner and a confirmed native fix as control.
import * as assert from 'node:assert/strict';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import { HarnessConfig } from '../../config/harnessConfig.js';
import { HarnessDashboardProvider } from '../../HarnessDashboardProvider.js';
import { OperationGate } from '../../operations/operationGate.js';
import type { OptimizerReport } from '../../optimizer/types.js';
import { snapshot, fakeContext } from './fixtures.js';

const ROOTS: Record<string, Record<string, string>> = {
    claude: {
        'CLAUDE.md': '# Team instructions\nReview contributions.',
        '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Review contributions to the native workspace.\n---\nRead changed files before preparing a review.',
    },
    custom: {
        'team/agents/index.md': '# Team agents',
        'team/agents/reviewer.md': 'Review contributions. No frontmatter, and none is required.',
        '.harness-dashboard/config.json': JSON.stringify({ profiles: [{ version: 1, id: 'team-guides', label: 'Team guides',
            markers: ['team/agents/index.md'], entities: [{ glob: 'team/agents/*.md', type: 'agent' }] }] }),
    },
    mixed: {
        '.agents/agentic.json': JSON.stringify({ subagents: [{ name: 'reviewer', description: 'Review changes before merge.', role_file: '.agents/subagents/reviewer/SUBAGENT.md' }] }),
        '.agents/subagents/reviewer/SUBAGENT.md': '---\nname: reviewer\ndescription: Review changes before merge.\n---\n## Role\nReview.',
        '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Claude reviewer for the same team.\n---\nReview.',
    },
    sdd: {
        '.agents/agentic.json': JSON.stringify({ subagents: [], skills: [] }),
        '.agents/skills/lint/SKILL.md': '---\nname: linter\ndescription: Use when code changes to run the linter.\n---\n## Usage\nRun the linter.',
    },
};

export const OPTIMIZER_ROOTS = ['claude', 'custom', 'mixed', 'sdd'];

export async function run(): Promise<void> {
    const workspace = vscode.workspace.workspaceFolders![0].uri;
    const log = vscode.window.createOutputChannel('Optimizer matrix test', { log: true });
    const seen: Record<string, unknown> = {};
    try {
        // Each layout is opened as its own workspace folder (OPTIMIZER_ROOT): source
        // paths are relative to the workspace folder, as in real use.
        const name = process.env.OPTIMIZER_ROOT ?? '';
        const files = ROOTS[name];
        assert.ok(files, `unknown OPTIMIZER_ROOT "${name}"`);
        {
            const root = workspace;
            for (const [rel, content] of Object.entries(files)) {
                await nodeFs.mkdir(path.dirname(path.join(root.fsPath, rel)), { recursive: true });
                await nodeFs.writeFile(path.join(root.fsPath, rel), content);
            }
            const before = await snapshot(root.fsPath);
            const config = new HarnessConfig(log);
            const registry = new AdapterRegistry(createDefaultAdapters(config), log);
            registry.setProfiles((await config.read(root)).profiles);
            const provider = new HarnessDashboardProvider(vscode.Uri.file(path.resolve(__dirname, '../../..')), root, fakeContext(), log, registry);
            const gate = new OperationGate(registry, () => provider.getCachedData() ?? undefined, undefined, () => true);
            provider.setOperationGate(gate);
            const messages: Array<Record<string, unknown>> = [];
            const post = (m: unknown) => { messages.push(m as Record<string, unknown>); };
            const internal = provider as unknown as { _sendDataTo(p: (m: unknown) => void): Promise<void>; _handleWebviewMessage(m: unknown, p: (m: unknown) => void): Promise<void> };
            try {
                await internal._sendDataTo(post);
                const report: OptimizerReport = await provider.optimizerCoordinator.runScan();
                const rulesOn = (id: string) => report.findings.filter(f => f.nodeId === id).map(f => f.ruleId);
                const graph = provider.getCachedData()!.graph.nodes;
                const edit = (id: string) => gate.describe(graph.find(n => n.id === id)!).operations.find(o => o.op === 'editing.reviewedTextEdit');
                seen[name] = { score: report.architectureScore, scored: report.scoredComponents, components: report.components.map(c => [c.nodeId, c.score, c.coverage.evaluated.length]), findings: report.findings.map(f => `${f.nodeId}:${f.ruleId}`) };
                for (const f of report.findings) assert.ok(f.source?.providerId, `${name}: ${f.ruleId} has no owner`);
                assert.deepEqual(await snapshot(root.fsPath), before, `${name}: scanning changed files`);

                if (name === 'claude') {
                    for (const id of ['OPT-S02', 'OPT-S05']) assert.ok(!rulesOn('claude-code::reviewer').includes(id), `claude: ${id}`);
                    assert.equal(edit('claude-code::reviewer')?.available, true);
                }
                if (name === 'custom') {
                    const reviewer = report.components.find(c => c.nodeId === 'team-guides::reviewer');
                    assert.ok(reviewer && reviewer.coverage.skipped.length > 0, 'custom: no convention rule was skipped');
                    assert.ok(!rulesOn('team-guides::reviewer').some(r => r.startsWith('OPT-S')), 'custom: a convention rule ran');
                    assert.equal(edit('team-guides::reviewer')?.available, false, 'custom: a profile resource is editable');
                    messages.length = 0;
                    await internal._handleWebviewMessage({ type: 'applyQuickFix', nodeId: 'team-guides::reviewer', ruleId: 'OPT-H01' }, post);
                    assert.ok(messages.some(m => m.type === 'operationDenied'), 'custom: a fix on a read-only owner was dispatched');
                }
                if (name === 'mixed') {
                    assert.ok(report.components.some(c => c.source?.providerId === 'harness-sdd') && report.components.some(c => c.source?.providerId === 'claude-code'));
                    assert.ok(!report.findings.some(f => f.ruleId === 'OPT-D01'), 'mixed: two owners\' "reviewer" reported as duplicates');
                    messages.length = 0;
                    await internal._handleWebviewMessage({ type: 'delegateFinding', nodeIds: ['claude-code::reviewer', 'gone'] }, post);
                    assert.ok(messages.some(m => m.type === 'operationDenied'), 'mixed: a stale delegation was dispatched');
                }
                assert.deepEqual(await snapshot(root.fsPath), before, `${name}: a refused action changed files`);

                if (name === 'sdd') {
                    // Positive control: a native convention violation with a mechanical fix, confirmed.
                    const s02 = report.findings.find(f => f.ruleId === 'OPT-S02' && f.fix);
                    assert.ok(s02, `sdd: no fixable OPT-S02 (${JSON.stringify(seen[name])})`);
                    const window = vscode.window as unknown as { showInformationMessage: unknown };
                    const original = window.showInformationMessage;
                    try {
                        window.showInformationMessage = async () => 'Apply';
                        messages.length = 0;
                        await internal._handleWebviewMessage({ type: 'applyQuickFix', nodeId: s02.nodeId, ruleId: 'OPT-S02', fix: { type: 'set-frontmatter-field', payload: { key: 'name', value: 'forged' } } }, post);
                    } finally {
                        window.showInformationMessage = original;
                    }
                    assert.ok(messages.some(m => m.type === 'quickFixResult' && m.ok === true), `sdd: ${JSON.stringify(messages)}`);
                    const after = await nodeFs.readFile(path.join(root.fsPath, '.agents/skills/lint/SKILL.md'), 'utf8');
                    assert.match(after, /^name: lint$/m, 'sdd: the host fix was not applied');
                    assert.doesNotMatch(after, /forged/, 'sdd: the client-sent fix was used');
                    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
                }
            } finally {
                config.dispose();
            }
        }
        console.log('FEAT-043 optimizer matrix ' + JSON.stringify(seen));
        console.log(`FEAT-043 optimizer matrix (${name}) passed`);
    } finally {
        log.dispose();
    }
}
