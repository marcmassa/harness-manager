// FEAT-041 T4 — workspace matrix in a real Extension Host (R1–R8).
// SDD-only, Claude-only, custom-profile, mixed and unrecognized roots: graph,
// Advisory and Optimizer agree on ownership across rescans; discovery leaves
// native files byte-identical and never runs a hook script.
import * as assert from 'node:assert/strict';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import { HarnessConfig } from '../../config/harnessConfig.js';
import { HarnessParser } from '../../harnessParser.js';
import { AgenticDetector } from '../../agentic-detector/agenticDetector.js';
import { loadComponents } from '../../optimizer/componentLoader.js';
import { scan } from '../../optimizer/optimizerEngine.js';
import { DEFAULT_OPTIMIZER_CONFIG } from '../../optimizer/types.js';
import { OperationGate } from '../../operations/operationGate.js';
import type { DashboardData } from '../../types.js';
import { snapshot } from './fixtures.js';

const SENTINEL = 'HOOK-EXECUTED';
const hook = (dir: string) => `#!/bin/sh\ntouch "$(dirname "$0")/${'../'.repeat(dir.split('/').length)}${SENTINEL}"\n`;

const SDD_MANIFEST = JSON.stringify({
    subagents: [{ name: 'reviewer', description: 'Review changes.', role_file: '.agents/subagents/reviewer/SUBAGENT.md' }],
    skills: [{ name: 'lint', description: 'Use when code changes.' }],
    commands: [],
    hooks: [{ event: 'on_file_saved', script: '.agents/hooks/on-save.sh' }],
});

const ROOTS: Record<string, Record<string, string>> = {
    sdd: {
        '.agents/agentic.json': SDD_MANIFEST,
        '.agents/subagents/reviewer/SUBAGENT.md': '---\nname: reviewer\ndescription: Review changes.\n---\n## Role\nReview.',
        '.agents/skills/lint/SKILL.md': '---\nname: lint\ndescription: Use when code changes.\n---\n## Usage\nLint.',
        '.agents/hooks/on-save.sh': hook('.agents/hooks'),
        'feature_list.json': JSON.stringify({ features: [] }),
    },
    claude: {
        'CLAUDE.md': '# Team instructions',
        '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Review changes.\n---\nReview.',
        '.claude/hooks/pre-tool.sh': hook('.claude/hooks'),
    },
    custom: {
        'team/agents/index.md': '# Team agents',
        'team/agents/reviewer.md': '---\nid: reviewer\ntitle: Reviewer\nskills: [lint]\n---\nReview.',
        'team/skills/lint.md': '---\nid: lint\ntitle: Lint\n---\nLint.',
        '.harness-dashboard/config.json': JSON.stringify({ profiles: [{
            version: 1, id: 'team-guides', label: 'Team guides', markers: ['team/agents/index.md'],
            entities: [{ glob: 'team/agents/*.md', type: 'agent', idField: 'id', labelField: 'title' },
                       { glob: 'team/skills/*.md', type: 'skill', idField: 'id', labelField: 'title' }],
            relationships: [{ fromType: 'agent', field: 'skills', toType: 'skill', label: 'uses' }],
        }] }),
    },
    mixed: {
        '.agents/agentic.json': SDD_MANIFEST,
        '.agents/subagents/reviewer/SUBAGENT.md': '---\nname: reviewer\ndescription: Review changes.\n---\n## Role\nReview.',
        '.agents/skills/lint/SKILL.md': '---\nname: lint\ndescription: Use when code changes.\n---\nLint.',
        'CLAUDE.md': '# Team instructions',
        '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Claude reviewer.\n---\nReview.',
        '.claude/hooks/pre-tool.sh': hook('.claude/hooks'),
    },
    unrecognized: {
        'README.md': '# A project without any agent harness',
        'notes/ideas.md': 'Just notes.',
    },
};

const identity = (data: DashboardData) => data.graph.nodes
    .map(n => [n.id, n.source?.providerId, n.source?.nativeId, n.source?.sourceUri].join('|')).sort();

export async function run(): Promise<void> {
    const workspace = vscode.workspace.workspaceFolders![0].uri;
    const log = vscode.window.createOutputChannel('Workspace matrix test', { log: true });
    const results: Record<string, unknown> = {};
    try {
        for (const [name, files] of Object.entries(ROOTS)) {
            const root = vscode.Uri.joinPath(workspace, name);
            for (const [rel, content] of Object.entries(files)) {
                const target = path.join(root.fsPath, rel);
                await nodeFs.mkdir(path.dirname(target), { recursive: true });
                await nodeFs.writeFile(target, content, { mode: rel.endsWith('.sh') ? 0o755 : 0o644 });
            }
            const before = await snapshot(root.fsPath);

            const config = new HarnessConfig(log);
            const registry = new AdapterRegistry(createDefaultAdapters(config), log);
            registry.setProfiles((await config.read(root)).profiles);
            const parser = new HarnessParser(root, log, registry);
            const detector = new AgenticDetector(root, log, undefined, registry);
            try {
                const first = await parser.parse();
                const second = await parser.parse();
                assert.deepEqual(identity(second), identity(first), `${name}: identity changed on rescan`);
                const owners = [...new Set(first.graph.nodes.map(n => n.source?.providerId))].sort();

                const advisory = await detector.scan();
                for (const node of first.graph.nodes.filter(n => n.source?.sourceUri)) {
                    assert.ok(advisory.sources?.some(s => s.sourceUri === node.source!.sourceUri && s.providerId === node.source!.providerId),
                        `${name}: Advisory lost ${node.id}`);
                }
                const sources = await loadComponents(first.graph.nodes, root.fsPath,
                    async rel => new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(root, rel))));
                const report = scan(sources, first.graph.edges.map(e => ({ ...e, label: e.label ?? '' })),
                    new Set(first.graph.nodes.map(n => n.id)), new Set(sources.map(s => s.filePath)), DEFAULT_OPTIMIZER_CONFIG);
                for (const component of report.components) {
                    const node = first.graph.nodes.find(n => n.id === component.nodeId);
                    assert.deepEqual(component.source, node?.source, `${name}: Optimizer lost ownership of ${component.nodeId}`);
                }

                const gate = new OperationGate(registry, () => first, undefined, () => true);
                const writable = first.graph.nodes.filter(n => gate.describe(n).operations.find(o => o.op === 'editing.deleteEntity')?.available);
                results[name] = {
                    owners, nodes: first.graph.nodes.length, writable: writable.map(n => n.id).sort(),
                    errors: first.errors.map(e => e.message),
                };
                assert.deepEqual(await snapshot(root.fsPath), before, `${name}: discovery changed workspace files`);
            } finally {
                detector.dispose();
                config.dispose();
            }
        }
        await assert.rejects(nodeFs.access(path.join(workspace.fsPath, SENTINEL)), `a hook script ran during discovery`);

        const r = results as Record<string, { owners: (string | undefined)[]; nodes: number; writable: string[]; errors: string[] }>;
        assert.deepEqual(r.sdd.owners, ['harness-sdd']);
        assert.ok(r.sdd.writable.length > 0, 'SDD resources should be writable (positive control)');
        assert.deepEqual(r.claude.owners, ['claude-code']);
        assert.deepEqual(r.claude.writable, []);
        assert.deepEqual(r.custom.owners, ['team-guides']);
        assert.deepEqual(r.custom.writable, []);
        assert.deepEqual(r.custom.errors, []);
        assert.deepEqual(r.mixed.owners, ['claude-code', 'harness-sdd']);
        assert.ok(r.mixed.writable.every(id => !id.startsWith('claude-code')), 'a Claude resource became writable in the mixed root');
        assert.equal(r.unrecognized.nodes, 0);
        assert.deepEqual(r.unrecognized.errors, []);
        console.log('FEAT-041 workspace matrix ' + JSON.stringify(results));
        console.log('FEAT-041 workspace matrix passed');
    } finally {
        log.dispose();
    }
}
