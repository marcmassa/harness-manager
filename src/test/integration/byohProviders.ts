// FEAT-041 T2 — profile v1 and companion API v1 in a real Extension Host (R1, R5, R6, R7).
import * as assert from 'node:assert/strict';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import type { CompanionAdapterV1, HarnessDashboardApiV1 } from '../../adapters/companionApi.js';
import { HarnessConfig } from '../../config/harnessConfig.js';

const EXTENSION_ID = 'marcmassacapo.harness-dashboard-vscode';

async function until(condition: () => boolean, what: string, ms = 8000): Promise<void> {
    const deadline = Date.now() + ms;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function profileInRealFilesystem(root: vscode.Uri): Promise<void> {
    const outside = await nodeFs.mkdtemp(path.join(tmpdir(), 'dashboard-outside-'));
    const write = (rel: string, content: string) => nodeFs.mkdir(path.dirname(path.join(root.fsPath, rel)), { recursive: true })
        .then(() => nodeFs.writeFile(path.join(root.fsPath, rel), content));
    const log = vscode.window.createOutputChannel('BYOH profile test', { log: true });
    const config = new HarnessConfig(log);
    try {
        await write('guides/agents/index.md', '# Guides');
        await write('guides/agents/reviewer.md', '---\nid: reviewer\ntitle: Reviewer\nskills: [lint]\n---\nReview.');
        await write('guides/skills/lint.md', '---\nid: lint\ntitle: Lint\n---\nLint.');
        await nodeFs.writeFile(path.join(outside, 'leak.md'), '---\nid: leak\n---\nOutside the workspace.');
        await nodeFs.symlink(path.join(outside, 'leak.md'), path.join(root.fsPath, 'guides/skills/leak.md'));
        await write('.harness-dashboard/config.json', JSON.stringify({ profiles: [
            { version: 1, id: 'guides', label: 'Guides', markers: ['guides/agents/index.md'],
              entities: [{ glob: 'guides/agents/*.md', type: 'agent', idField: 'id', labelField: 'title' },
                         { glob: 'guides/skills/*.md', type: 'skill', idField: 'id', labelField: 'title' }],
              relationships: [{ fromType: 'agent', field: 'skills', toType: 'skill', label: 'uses' }] },
            { version: 9, id: 'future', markers: ['x'], entities: [] },
        ] }));
        const before = await nodeFs.readdir(root.fsPath, { recursive: true });

        const registry = new AdapterRegistry(createDefaultAdapters(config), log);
        registry.setProfiles((await config.read(root)).profiles);
        const result = await registry.parse(root);
        const ids = result.graph.nodes.map(node => node.id);
        assert.ok(ids.includes('guides::reviewer') && ids.includes('guides::lint'), ids.join(', '));
        assert.ok(!ids.includes('guides::leak'), 'symlink escaping the root was read');
        assert.ok(result.graph.edges.some(edge => edge.source === 'guides::reviewer' && edge.target === 'guides::lint'));
        const messages = result.errors.map(error => error.message).join('\n');
        assert.match(messages, /outside the workspace root/);
        assert.match(messages, /unknown schema version 9/);
        assert.equal(result.graph.nodes.find(node => node.id === 'guides::lint')?.source?.providerId, 'guides');
        assert.deepEqual(await nodeFs.readdir(root.fsPath, { recursive: true }), before, 'discovery changed workspace files');
    } finally {
        config.dispose();
        log.dispose();
        await nodeFs.rm(outside, { recursive: true, force: true });
    }
}

async function companionAroundDashboard(): Promise<void> {
    const extension = vscode.extensions.getExtension<HarnessDashboardApiV1>(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} not found`);
    const api = await extension.activate();
    assert.equal(api.apiVersion, 1);

    let parses = 0;
    let parsesAfterDispose = 0;
    const disposed = new Set<string>();
    const provider = (id: string): CompanionAdapterV1 => ({
        id, label: id, watchGlobs: () => [],
        capabilities: { discovery: 'supported', hooks: 'unsupported', steering: 'unsupported', commands: 'unsupported',
            agentRuns: 'unsupported', editing: 'unsupported', validation: 'unsupported' },
        detect: () => true,
        parse: () => { parses += 1; if (disposed.has(id)) parsesAfterDispose += 1; return { graph: { nodes: [{ id: `${id}::bot`, type: 'agent', label: 'Bot', metadata: {} }], edges: [] } }; },
    });

    // Before the Dashboard is first opened: registration updates the provider set at once, but
    // FEAT-045 R14/R15 defer the scan until something is shown (no work before the user looks).
    const early = api.registerAdapter(provider('early-companion'));
    assert.throws(() => api.registerAdapter(provider('early-companion')), /already registered/);
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.equal(parses, 0, 'a scan ran before any Dashboard surface was shown');

    // Opening the Dashboard runs the first scan, which reaches the early registration.
    await vscode.commands.executeCommand('harness-dashboard.openDashboard');
    await until(() => parses > 0, 'the first scan after opening the Dashboard');
    const visible = parses;
    const late = api.registerAdapter(provider('late-companion'));
    await until(() => parses > visible, 'a scan after registration with the Dashboard visible');

    for (const [id, registration] of [['early-companion', early], ['late-companion', late]] as const) {
        disposed.add(id);
        registration.dispose();
    }
    // Disposal triggers a rescan; any scan still in flight must not call a disposed provider.
    await new Promise(resolve => setTimeout(resolve, 2500));
    assert.equal(parsesAfterDispose, 0, 'a disposed provider was still parsed');
}

export async function run(): Promise<void> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    await profileInRealFilesystem(root);
    await companionAroundDashboard();
    console.log('FEAT-041 profile and companion providers passed');
}
