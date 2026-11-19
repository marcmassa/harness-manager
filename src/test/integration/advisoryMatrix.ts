// FEAT-042 T4 — Advisory in a real Extension Host (R1–R7).
// Foreign-only, custom-profile, mixed and SDD-only roots: matched native
// evidence, owner-scoped findings, supported actions only, unchanged files
// after scanning, and the host decision on dispatched actions.
import * as assert from 'node:assert/strict';
import { promises as nodeFs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AdapterRegistry } from '../../adapters/AdapterRegistry.js';
import { createDefaultAdapters } from '../../adapters/index.js';
import { HarnessConfig } from '../../config/harnessConfig.js';
import { AgenticDetector } from '../../agentic-detector/agenticDetector.js';
import { HarnessDashboardProvider } from '../../HarnessDashboardProvider.js';
import { OperationGate } from '../../operations/operationGate.js';
import type { AgenticProfile } from '../../agentic-detector/types.js';

const PROFILE = JSON.stringify({ profiles: [{
    version: 1, id: 'team-guides', label: 'Team guides', markers: ['team/agents/index.md'],
    entities: [{ glob: 'team/agents/*.md', type: 'agent', idField: 'id', labelField: 'title' },
               { glob: 'team/skills/*.md', type: 'skill', idField: 'id', labelField: 'title' }],
}] });

const ROOTS: Record<string, Record<string, string>> = {
    claude: {
        'CLAUDE.md': '# Team instructions\nReview contributions.',
        '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Review contributions.\n---\nRead changed files.',
    },
    custom: {
        'team/agents/index.md': '# Team agents',
        'team/agents/reviewer.md': '---\nid: reviewer\ntitle: Reviewer\n---\nReview.',
        'team/skills/lint.md': '---\nid: lint\ntitle: Lint\n---\nLint.',
        '.harness-dashboard/config.json': PROFILE,
    },
    mixed: {
        '.agents/agentic.json': JSON.stringify({ subagents: [{ name: 'reviewer', description: 'Review.', role_file: '.agents/subagents/reviewer/SUBAGENT.md' }] }),
        '.agents/subagents/reviewer/SUBAGENT.md': '---\nname: reviewer\ndescription: Review.\n---\nReview.',
        'CLAUDE.md': '# Team instructions',
        '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Claude reviewer.\n---\nReview.',
    },
    sdd: {
        '.agents/agentic.json': JSON.stringify({ subagents: [{ name: 'reviewer', description: 'Review.', role_file: '.agents/subagents/reviewer/SUBAGENT.md' }] }),
        '.agents/subagents/reviewer/SUBAGENT.md': '---\nname: reviewer\ndescription: Review.\n---\nReview.',
    },
};

async function snapshot(dir: string): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const entry of await nodeFs.readdir(dir, { recursive: true, withFileTypes: true })) {
        if (entry.isFile()) out[path.relative(dir, path.join(entry.parentPath, entry.name))] = await nodeFs.readFile(path.join(entry.parentPath, entry.name), 'utf8');
    }
    return out;
}

function fakeContext(): vscode.ExtensionContext {
    const state = new Map<string, unknown>();
    return { workspaceState: {
        get: (k: string, f?: unknown) => (state.has(k) ? state.get(k) : f),
        update: async (k: string, v: unknown) => { state.set(k, v); },
        keys: () => [...state.keys()],
    }, subscriptions: [] } as unknown as vscode.ExtensionContext;
}

const SDD_SCAFFOLDS = new Set(['scaffold-agent', 'scaffold-skill']);
const actionTypes = (profile: AgenticProfile) => profile.suggestions.flatMap(s => (s.actions ?? []).map(a => a.type));

export async function run(): Promise<void> {
    const workspace = vscode.workspace.workspaceFolders![0].uri;
    const log = vscode.window.createOutputChannel('Advisory matrix test', { log: true });
    const seen: Record<string, unknown> = {};
    try {
        for (const [name, files] of Object.entries(ROOTS)) {
            const root = vscode.Uri.joinPath(workspace, name);
            for (const [rel, content] of Object.entries(files)) {
                await nodeFs.mkdir(path.dirname(path.join(root.fsPath, rel)), { recursive: true });
                await nodeFs.writeFile(path.join(root.fsPath, rel), content);
            }
            const before = await snapshot(root.fsPath);
            const config = new HarnessConfig(log);
            const registry = new AdapterRegistry(createDefaultAdapters(config), log);
            registry.setProfiles((await config.read(root)).profiles);
            const detector = new AgenticDetector(root, log, fakeContext().workspaceState, registry);
            const provider = new HarnessDashboardProvider(vscode.Uri.file(path.resolve(__dirname, '../../..')), root, fakeContext(), log, registry);
            const gate = new OperationGate(registry, () => provider.getCachedData() ?? undefined, undefined, () => true);
            provider.setOperationGate(gate);
            provider.setAgenticDetector(detector, () => undefined);
            const messages: Array<Record<string, unknown>> = [];
            const post = (m: unknown) => { messages.push(m as Record<string, unknown>); };
            const internal = provider as unknown as {
                _sendDataTo(p: (m: unknown) => void): Promise<void>;
                _handleWebviewMessage(m: unknown, p: (m: unknown) => void): Promise<void>;
            };
            try {
                await internal._sendDataTo(post);
                const profile = await detector.scan();
                const owners = [...new Set((profile.evidence ?? []).map(e => e.providerId))].sort();
                const ids = profile.suggestions.map(s => s.id);
                seen[name] = { level: profile.maturity.level, owners, findings: ids, actions: actionTypes(profile) };
                assert.deepEqual(await snapshot(root.fsPath), before, `${name}: scanning changed workspace files`);
                for (const s of profile.suggestions) assert.ok(s.scope, `${name}: ${s.id} has no scope`);

                if (name === 'claude') {
                    assert.deepEqual(owners, ['claude-code']);
                    for (const id of ['add-claude-md', 'add-context-identity', 'cli-without-impl']) assert.ok(!ids.includes(id), `claude: ${id}`);
                    assert.ok(!actionTypes(profile).some(t => SDD_SCAFFOLDS.has(t)), 'claude: an SDD scaffold was offered');
                    messages.length = 0;
                    await internal._handleWebviewMessage({ type: 'executeAdvisoryAction', suggestionId: 'use-skill-files', actionId: 'scaffold-first-skill' }, post);
                    assert.ok(messages.some(m => m.type === 'advisoryActionResult' && m.ok === false), 'claude: a stale or foreign action ran');
                }
                if (name === 'custom') assert.deepEqual(owners, ['team-guides']);
                if (name === 'mixed') {
                    assert.deepEqual(owners, ['claude-code', 'harness-sdd']);
                    messages.length = 0;
                    await internal._handleWebviewMessage({ type: 'applyHarnessSDD' }, post);
                    assert.match(String(messages.find(m => m.type === 'operationDenied')?.reason), /already set up/);
                }
                assert.deepEqual(await snapshot(root.fsPath), before, `${name}: a denied action changed files`);

                if (name === 'sdd') {
                    // Positive control: a native Harness SDD scaffold the engine offered.
                    const skill = profile.suggestions.find(s => s.actions?.some(a => a.type === 'scaffold-skill'));
                    assert.ok(skill, 'sdd: no skill scaffold offered');
                    const action = skill.actions!.find(a => a.type === 'scaffold-skill')!;
                    messages.length = 0;
                    await internal._handleWebviewMessage({ type: 'executeAdvisoryAction', suggestionId: skill.id, actionId: action.id }, post);
                    assert.ok(messages.some(m => m.type === 'advisoryActionResult' && m.ok === true), `sdd: ${JSON.stringify(messages)}`);
                    await nodeFs.access(path.join(root.fsPath, `.agents/skills/${action.payload.name}/SKILL.md`));
                }
            } finally {
                detector.dispose();
                config.dispose();
            }
        }
        console.log('FEAT-042 advisory matrix ' + JSON.stringify(seen));
        console.log('FEAT-042 advisory matrix passed');
    } finally {
        log.dispose();
    }
}
