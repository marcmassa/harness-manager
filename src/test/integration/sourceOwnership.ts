import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import { HarnessConfig } from '../../config/harnessConfig.js';
import { HarnessParser } from '../../harnessParser.js';
import { AgenticDetector } from '../../agentic-detector/agenticDetector.js';
import { loadComponents } from '../../optimizer/componentLoader.js';
import { scan } from '../../optimizer/optimizerEngine.js';
import { DEFAULT_OPTIMIZER_CONFIG } from '../../optimizer/types.js';
import { mergeLayoutedNodesWithManualPositions } from '../../webview/nodePositionUtils.js';

export async function run(): Promise<void> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    const fs = vscode.workspace.fs;
    const file = (path: string) => vscode.Uri.joinPath(root, path);
    const log = vscode.window.createOutputChannel('Source ownership test', { log: true });
    const config = new HarnessConfig(log);
    const registry = new AdapterRegistry(createDefaultAdapters(config), log);
    const parser = new HarnessParser(root, log, registry);
    const detector = new AgenticDetector(root, log, undefined, registry);
    try {
        await fs.createDirectory(file('.harness-dashboard'));
        await fs.createDirectory(file('team/policies'));
        const files = {
            'CLAUDE.md': '# Local Claude instructions',
            'team/policies/review.md': '# Review policy',
            '.harness-dashboard/config.json': JSON.stringify({ adapters: { 'claude-code': { steeringPath: 'team/policies' } } }),
        };
        for (const [path, content] of Object.entries(files)) {
            await fs.writeFile(file(path), new TextEncoder().encode(content));
        }
        const first = await parser.parse();
        assert.deepEqual(first.detectedFrameworks, ['Claude Code']);
        const policy = first.graph.nodes.find(node => node.metadata._filePath === 'team/policies/review.md');
        assert.ok(policy?.source);
        assert.equal(policy.source.providerId, 'claude-code');
        assert.equal(policy.source.sourceUri, file('team/policies/review.md').toString());
        assert.equal(policy.source.workspaceUri, root.toString());
        const advisory = await detector.scan();
        assert.ok(advisory.sources?.some(source => source.sourceUri === policy.source?.sourceUri && source.providerId === 'claude-code'));

        // Use the same input and scoring path as OptimizerCoordinator.runScan.
        const { graph } = await parser.parse();
        const sources = await loadComponents(graph.nodes, root.fsPath, async path => new TextDecoder().decode(await fs.readFile(file(path))));
        const nodeIds = new Set(graph.nodes.map(node => node.id));
        const report = scan(sources, graph.edges.map(edge => ({ ...edge, label: edge.label ?? '' })),
            nodeIds, new Set(sources.map(source => source.filePath)), DEFAULT_OPTIMIZER_CONFIG);
        assert.deepEqual(report.components.find(component => component.nodeId === policy.id)?.source, policy.source);
        const layout = mergeLayoutedNodesWithManualPositions(graph.nodes.map(node => ({ id: node.id, position: { x: 0, y: 0 } })),
            { 'claude-code::root': { x: 32, y: 16 } });
        assert.deepEqual(layout.nodes.find(node => node.id === 'claude-code::root')?.position, { x: 32, y: 16 });
        for (const [path, content] of Object.entries(files)) {
            assert.equal(new TextDecoder().decode(await fs.readFile(file(path))), content);
        }
        assert.deepEqual((await fs.readDirectory(root)).map(([name]) => name).sort(), ['.harness-dashboard', 'CLAUDE.md', 'team']);
        console.log('FEAT-041 native source ownership passed');
    } finally {
        detector.dispose();
        config.dispose();
        log.dispose();
    }
}
