// FEAT-044 T6 — context cost in a real Extension Host (R1, R4, R5, R8, R10, R13, R15).
// One layout per host (COST_ROOT), each its own workspace folder. Cost
// analysis and the HEAD comparison must leave files and hook sentinels untouched.
import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import { HarnessConfig } from '../../config/harnessConfig.js';
import { HarnessDashboardProvider } from '../../HarnessDashboardProvider.js';
import { OperationGate } from '../../operations/operationGate.js';
import { snapshot, fakeContext } from './fixtures.js';

const SHARED = 'Always run the full test suite before committing, and never push directly to main without a review from someone who knows the code.';
const SENTINEL = 'HOOK-RAN';
const hook = `#!/bin/sh\ntouch "$(git rev-parse --show-toplevel 2>/dev/null || pwd)/${SENTINEL}"\n`;

const LAYOUTS: Record<string, Record<string, string>> = {
    sdd: {
        '.agents/agentic.json': JSON.stringify({ subagents: [{ name: 'reviewer', description: 'Review changes before merge.', role_file: '.agents/subagents/reviewer/SUBAGENT.md' }],
            steering: [{ name: 'team', file: '.agents/steering/team.md', applies_to: ['*'] }], hooks: [{ event: 'on_file_saved', script: '.agents/hooks/save.sh' }] }),
        '.agents/subagents/reviewer/SUBAGENT.md': '---\nname: reviewer\ndescription: Review changes before merge.\n---\n## Role\nReview.',
        '.agents/steering/team.md': `# Team\n\n${SHARED}`,
        '.agents/hooks/save.sh': hook,
    },
    claude: {
        'CLAUDE.md': `# Team\n\n${SHARED}`,
        '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Review changes before merge.\n---\nReview.',
        '.claude/hooks/pre.sh': hook,
    },
    custom: {
        'team/agents/index.md': '# Team agents',
        'team/agents/always.md': `# Always\n\n${SHARED}`,
        '.harness-dashboard/config.json': JSON.stringify({ profiles: [{ version: 1, id: 'team-guides', label: 'Team guides', markers: ['team/agents/index.md'],
            entities: [{ glob: 'team/agents/always.md', type: 'agent', loadMode: 'always' }, { glob: 'team/agents/index.md', type: 'agent' }] }] }),
    },
    mixed: {
        'CLAUDE.md': `# Claude\n\n${SHARED}`,
        '.agents/agentic.json': JSON.stringify({ subagents: [], steering: [{ name: 'team', file: '.agents/steering/team.md', applies_to: ['*'] }] }),
        '.agents/steering/team.md': `# Team\n\n${SHARED}`,
    },
};

export async function run(): Promise<void> {
    const name = process.env.COST_ROOT ?? '';
    const files = LAYOUTS[name];
    assert.ok(files, `unknown COST_ROOT "${name}"`);
    const root = vscode.workspace.workspaceFolders![0].uri;
    for (const [rel, content] of Object.entries(files)) {
        await nodeFs.mkdir(path.dirname(path.join(root.fsPath, rel)), { recursive: true });
        await nodeFs.writeFile(path.join(root.fsPath, rel), content, { mode: rel.endsWith('.sh') ? 0o755 : 0o644 });
    }
    if (name === 'sdd') {
        // A real repository: commit, then grow the always-loaded steering so HEAD differs.
        const git = (...args: string[]) => execFileSync('git', args, { cwd: root.fsPath, stdio: 'pipe' });
        git('init', '-q'); git('config', 'user.email', 't@example.invalid'); git('config', 'user.name', 't');
        git('add', '-A'); git('commit', '-q', '-m', 'init');
        await nodeFs.appendFile(path.join(root.fsPath, '.agents/steering/team.md'), `\n\n${'Document every public function. '.repeat(20)}`);
    }
    const before = await snapshot(root.fsPath, { skipGit: true });
    const log = vscode.window.createOutputChannel('Cost matrix test', { log: true });
    const config = new HarnessConfig(log);
    try {
        const registry = new AdapterRegistry(createDefaultAdapters(config), log);
        registry.setProfiles((await config.read(root)).profiles);
        const provider = new HarnessDashboardProvider(vscode.Uri.file(path.resolve(__dirname, '../../..')), root, fakeContext(), log, registry);
        provider.setOperationGate(new OperationGate(registry, () => provider.getCachedData() ?? undefined, undefined, () => true));
        const messages: Array<Record<string, unknown>> = [];
        const internal = provider as unknown as { _sendDataTo(p: (m: unknown) => void): Promise<void>; _handleWebviewMessage(m: unknown, p: (m: unknown) => void): Promise<void> };
        await internal._sendDataTo(m => { messages.push(m as Record<string, unknown>); });
        const report = await provider.optimizerCoordinator.runScan();
        const cost = report.cost!;
        assert.ok(cost, `${name}: no cost section`);
        const owner = (id: string) => cost.owners.find(o => o.owner === id);
        const k01 = report.findings.filter(f => f.ruleId === 'OPT-K01').map(f => f.source?.providerId).sort();
        await internal._handleWebviewMessage({ type: 'compareCostWithHead' }, m => { messages.push(m as Record<string, unknown>); });
        const comparison = messages.find(m => m.type === 'costComparison')?.comparison as { available: boolean; reason?: string; resources?: Array<{ filePath: string; status: string; delta: number }> };
        console.log(`FEAT-044 cost matrix ${name} ` + JSON.stringify({ total: cost.sessionTotal, owners: cost.owners.map(o => [o.owner, o.baseline, o.catalog, o.evaluated, o.unpriced.length]), k01, comparison }));

        if (name === 'sdd') {
            assert.ok((owner('harness-sdd')?.baseline ?? 0) > 0, 'sdd: always steering not in the baseline');
            assert.equal(comparison.available, true);
            assert.ok(comparison.resources?.some(r => r.filePath === '.agents/steering/team.md' && r.status === 'changed' && r.delta > 0), 'sdd: HEAD growth not reported');
        }
        if (name === 'claude') {
            assert.ok((owner('claude-code')?.baseline ?? 0) > 0, 'claude: CLAUDE.md not in the baseline');
            assert.equal(comparison.available, false, 'claude: a folder without git compared');
        }
        if (name === 'custom') {
            assert.equal(owner('team-guides')?.evaluated, true);
            assert.equal(owner('team-guides')?.unpriced.length, 1, 'custom: the undeclared entity is not unpriced');
            assert.ok(cost.unpricedTokens > 0);
        }
        if (name === 'mixed') assert.deepEqual(k01, ['claude-code', 'harness-sdd'], 'mixed: cross-owner duplication not reported on both');

        assert.deepEqual(await snapshot(root.fsPath, { skipGit: true }), before, `${name}: cost analysis or the HEAD comparison changed files`);
        await assert.rejects(nodeFs.access(path.join(root.fsPath, SENTINEL)), `${name}: a hook ran`);
        console.log(`FEAT-044 cost matrix (${name}) passed`);
    } finally {
        config.dispose();
        log.dispose();
    }
}
