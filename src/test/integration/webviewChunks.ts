// FEAT-045 T6 (R19) — in a real Extension Host webview, the shell and the
// active tab load first; another tab's chunk loads, under the CSP, only when
// that tab is first shown. Evidence: the webview's `tabReady` messages.
import * as assert from 'node:assert/strict';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import { HarnessConfig } from '../../config/harnessConfig.js';
import { HarnessDashboardProvider } from '../../HarnessDashboardProvider.js';

async function until(condition: () => boolean, what: string, ms = 15000): Promise<void> {
    const deadline = Date.now() + ms;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

export async function run(): Promise<void> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    await nodeFs.writeFile(path.join(root.fsPath, 'CLAUDE.md'), '# Team instructions');
    await nodeFs.mkdir(path.join(root.fsPath, '.claude/agents'), { recursive: true });
    await nodeFs.writeFile(path.join(root.fsPath, '.claude/agents/reviewer.md'), '---\nname: reviewer\ndescription: Review.\n---\nReview.');
    const log = vscode.window.createOutputChannel('Webview chunks test', { log: true });
    const config = new HarnessConfig(log);
    const state = new Map<string, unknown>();
    const context = { workspaceState: { get: (k: string, f?: unknown) => (state.has(k) ? state.get(k) : f), update: async (k: string, v: unknown) => { state.set(k, v); }, keys: () => [...state.keys()] }, subscriptions: [] } as unknown as vscode.ExtensionContext;
    try {
        const provider = new HarnessDashboardProvider(vscode.Uri.file(path.resolve(__dirname, '../../..')), root, context, log, new AdapterRegistry(createDefaultAdapters(config), log));
        await provider.openFullWindowPanel();
        await until(() => provider.readyTabs.has('whiteboard'), 'the whiteboard chunk to load in the panel');
        assert.ok(!provider.readyTabs.has('optimizer') && !provider.readyTabs.has('advisory'), `other tabs loaded early: ${[...provider.readyTabs]}`);
        await provider.openFullWindowPanel('optimizer');
        await until(() => provider.readyTabs.has('optimizer'), 'the optimizer chunk to load on first display');
        assert.ok(!provider.readyTabs.has('advisory'), 'the advisory chunk loaded without being shown');
        await provider.openFullWindowPanel('advisory');
        await until(() => provider.readyTabs.has('advisory'), 'the advisory chunk to load on first display');
        // R5: reveal a panel hidden behind another editor (its webview reloads) on a new tab.
        const doc = await vscode.workspace.openTextDocument({ content: 'hide the panel' });
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Two, preview: false }); // the panel's column
        await new Promise(resolve => setTimeout(resolve, 500));
        await provider.openFullWindowPanel('timeline');
        await until(() => provider.readyTabs.has('timeline'), 'the timeline tab after revealing a hidden panel');
        console.log(`FEAT-045 webview chunks: ${[...provider.readyTabs].join(', ')}`);
        console.log('FEAT-045 webview chunks passed');
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    } finally {
        config.dispose();
        log.dispose();
    }
}
