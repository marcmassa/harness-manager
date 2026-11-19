// FEAT-041 T4 — real-workspace results for the seven advertised adapters.
// Opt-in: runIntegrationTests runs it only when HARNESS_FIELD_ROOT points at a
// folder holding disposable copies of the sources listed in
// docs/byoh/adapter-capabilities.md. Scripted through the production parser,
// detector and gate; it does not click through the webview.
import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import { HarnessConfig } from '../../config/harnessConfig.js';
import { HarnessParser } from '../../harnessParser.js';
import { AgenticDetector } from '../../agentic-detector/agenticDetector.js';
import type { HarnessNode } from '../../types.js';

interface FieldSource { adapter: string; root: string; expected: string; match(node: HarnessNode): boolean }

const pathOf = (node: HarnessNode) => String(node.metadata._filePath ?? node.metadata._declarationPath ?? '');
const SOURCES: FieldSource[] = [
    { adapter: 'harness-sdd', root: 'harness-sdd-template', expected: 'a subagent declared in .agents/agentic.json', match: n => n.type === 'subagent' },
    { adapter: 'claude-code', root: 'harness-sdd-template', expected: 'CLAUDE.md', match: n => pathOf(n) === 'CLAUDE.md' },
    { adapter: 'gemini-cli', root: 'harness-sdd-template', expected: 'GEMINI.md', match: n => pathOf(n) === 'GEMINI.md' },
    { adapter: 'opencode', root: 'harness-sdd-template', expected: 'opencode.json', match: n => pathOf(n) === 'opencode.json' },
    { adapter: 'kiro', root: 'harness-manager-990470d', expected: 'a Markdown document under .kiro/steering', match: n => /^\.kiro\/steering\/.+\.md$/.test(pathOf(n)) },
    { adapter: 'cursor', root: 'cursor-agents', expected: '.cursor/rules/test-strategy.rules.mdc', match: n => pathOf(n) === '.cursor/rules/test-strategy.rules.mdc' },
    { adapter: 'copilot', root: 'vscode', expected: '.github/copilot-instructions.md', match: n => pathOf(n) === '.github/copilot-instructions.md' },
];

async function manifest(dir: string): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const entry of await nodeFs.readdir(dir, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const file = path.join(entry.parentPath, entry.name);
        out[path.relative(dir, file)] = createHash('sha256').update(await nodeFs.readFile(file)).digest('hex');
    }
    return out;
}

export async function run(): Promise<void> {
    const workspace = vscode.workspace.workspaceFolders![0].uri;
    const log = vscode.window.createOutputChannel('Field validation', { log: true });
    const results: unknown[] = [];
    try {
        // Each source is opened as its own workspace folder, as a user would.
        const root = path.basename(workspace.fsPath);
        {
            const uri = workspace;
            const before = await manifest(uri.fsPath);
            const config = new HarnessConfig(log);
            const registry = new AdapterRegistry(createDefaultAdapters(config), log);
            registry.setProfiles((await config.read(uri)).profiles);
            const parser = new HarnessParser(uri, log, registry);
            const detector = new AgenticDetector(uri, log, undefined, registry);
            try {
                const first = await parser.parse();
                const second = await parser.parse();
                const ids = (d: typeof first) => d.graph.nodes.map(n => `${n.id}|${n.source?.providerId}|${n.source?.sourceUri}`).sort();
                const stable = JSON.stringify(ids(first)) === JSON.stringify(ids(second));
                const advisory = await detector.scan();
                for (const source of SOURCES.filter(s => s.root === root)) {
                    const owned = first.graph.nodes.filter(n => n.source?.providerId === source.adapter);
                    const entity = owned.find(source.match);
                    let opens = false;
                    if (entity?.source?.sourceUri) {
                        try { await vscode.workspace.fs.stat(vscode.Uri.parse(entity.source.sourceUri)); opens = true; } catch { opens = false; }
                    }
                    results.push({
                        adapter: source.adapter, root, expected: source.expected,
                        detected: first.detectedFrameworks?.includes(registry.providerLabel(source.adapter)) ?? false,
                        entity: entity ? { id: entity.id, type: entity.type, path: pathOf(entity) } : null,
                        sourceOpens: opens, nodesOwned: owned.length, stableOnRescan: stable,
                        inAdvisory: !!entity && !!advisory.sources?.some(s => s.sourceUri === entity.source?.sourceUri),
                        result: entity && opens && stable ? 'pass' : 'fail',
                    });
                }
            } finally {
                detector.dispose();
                config.dispose();
            }
            assert.deepEqual(await manifest(uri.fsPath), before, `${root}: discovery changed files`);
        }
        assert.ok(results.length > 0, `no field source is named ${root}`);
        console.log('FEAT-041 field results ' + JSON.stringify({ host: vscode.version, results }));
        console.log('FEAT-041 field validation finished');
    } finally {
        log.dispose();
    }
}
