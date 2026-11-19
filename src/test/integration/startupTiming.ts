// FEAT-045 T7 (R13, R21) — activation cost and time to first Sources content,
// one Extension Host per layout (STARTUP_ROOT): empty, claude, custom profile.
// A probe companion counts parses: activation alone must start no scan.
import * as assert from 'node:assert/strict';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { CompanionAdapterV1, HarnessDashboardApiV1 } from '../../adapters/companionApi.js';

const EXTENSION_ID = 'marcmassacapo.harness-dashboard-vscode';
const ACTIVATION_BUDGET_MS = 500;

const LAYOUTS: Record<string, Record<string, string>> = {
    empty: {},
    claude: {
        'CLAUDE.md': '# Team instructions',
        '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Review changes.\n---\nReview.',
    },
    custom: {
        'team/agents/index.md': '# Team agents',
        'team/agents/reviewer.md': 'Review contributions.',
        '.harness-dashboard/config.json': JSON.stringify({ profiles: [{ version: 1, id: 'team-guides', label: 'Team guides',
            markers: ['team/agents/index.md'], entities: [{ glob: 'team/agents/*.md', type: 'agent' }] }] }),
    },
};

async function until(condition: () => boolean, what: string, ms = 15000): Promise<void> {
    const deadline = Date.now() + ms;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise(resolve => setTimeout(resolve, 25));
    }
}

export async function run(): Promise<void> {
    const layout = process.env.STARTUP_ROOT ?? 'empty';
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    for (const [rel, content] of Object.entries(LAYOUTS[layout])) {
        await nodeFs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
        await nodeFs.writeFile(path.join(root, rel), content);
    }
    const extension = vscode.extensions.getExtension<HarnessDashboardApiV1>(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} not found`);
    assert.equal(extension.isActive, false, 'activated before anything was shown');

    const started = performance.now();
    const api = await extension.activate();
    const activationMs = performance.now() - started;
    assert.ok(activationMs < ACTIVATION_BUDGET_MS, `activation took ${activationMs.toFixed(0)} ms`);

    let parses = 0;
    const probe: CompanionAdapterV1 = {
        id: 'startup-probe', label: 'Startup probe', watchGlobs: () => [],
        capabilities: { discovery: 'supported', hooks: 'unsupported', steering: 'unsupported', commands: 'unsupported',
            agentRuns: 'unsupported', editing: 'unsupported', validation: 'unsupported' },
        detect: () => false,
        parse: () => { parses += 1; return { graph: { nodes: [], edges: [] } }; },
    };
    const registration = api.registerAdapter(probe);
    let detects = 0;
    const counting = { ...probe, id: 'startup-detect', detect: () => { detects += 1; return false; } };
    const registration2 = api.registerAdapter(counting);
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(parses + detects, 0, 'activation alone started a scan');

    const shown = performance.now();
    await vscode.commands.executeCommand('harness-dashboard.sources.focus');
    await until(() => detects > 0, 'the first scan once Sources is shown');
    await vscode.commands.executeCommand('harness-dashboard.refresh');
    const firstContentMs = performance.now() - shown;

    console.log(`FEAT-045 startup [${layout}]: activation ${activationMs.toFixed(0)} ms; Sources content ${firstContentMs.toFixed(0)} ms after it was shown`);
    console.log(`FEAT-045 startup ${layout} passed`);
    registration.dispose();
    registration2.dispose();
}
