// FEAT-042 T1 — attributed evidence, rule classification and maturity (R1–R4).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', async () => (await import('./detectorTestHarness.js')).createVscodeMock());

import * as vscode from 'vscode';
import { AgenticDetector } from './agenticDetector.js';
import { ROOT, makeLog, mockFiles, seedWorkspace } from './detectorTestHarness.js';
import { evidenceFromGraph, sharedCategories } from './evidence.js';
import { CORE_RULES } from './advisoryRules.js';
import { METHODOLOGY_RULES } from './methodologyRules.js';
import { RULE_CLASSIFICATION, classifyRule } from './ruleScopes.js';
import { SUPPORTED_FRAMEWORKS } from '../frameworks.js';
import type { HarnessNode } from '../types.js';

const scan = () => new AgenticDetector(vscode.Uri.file(ROOT), makeLog()).scan();

beforeEach(() => {
    vi.clearAllMocks();
    mockFiles.clear();
});

describe('evidence (R1)', () => {
    it('maps provider resources to shared categories by declared type', () => {
        const node = (id: string, type: HarnessNode['type'], providerId: string): HarnessNode =>
            ({ id, type, label: id, metadata: {}, source: { workspaceUri: 'w', providerId, nativeId: id } });
        expect(evidenceFromGraph([
            node('claude-code::root', 'agent', 'claude-code'),
            node('reviewer', 'subagent', 'harness-sdd'),
            node('lint', 'skill', 'team-guides'),
            node('kiss', 'steering', 'kiro'),
            node('on-save', 'hook', 'harness-sdd'),
        ]).map(e => [e.category, e.providerId])).toEqual([
            ['context-identity', 'claude-code'],
            ['agent-methodologies', 'harness-sdd'],
            ['skills', 'team-guides'],
            ['rules', 'kiro'],
        ]);
    });

    it('never recommends a CLAUDE.md the Claude Code adapter already read', async () => {
        seedWorkspace({
            'CLAUDE.md': '# Team instructions\nReview contributions.',
            '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Review contributions.\n---\nRead changed files.',
        });
        const profile = await scan();
        expect(profile.evidence).toEqual(expect.arrayContaining([
            expect.objectContaining({ category: 'context-identity', providerId: 'claude-code' }),
            expect.objectContaining({ category: 'agent-methodologies', providerId: 'claude-code' }),
        ]));
        const ids = profile.suggestions.map(s => s.id);
        for (const missing of ['add-claude-md', 'add-context-identity', 'cli-without-impl']) expect(ids).not.toContain(missing);
    });
});

describe('maturity across layouts (R3, R4)', () => {
    it('gives equivalent Harness SDD and Claude Code workflows the same level', async () => {
        seedWorkspace({
            '.agents/agentic.json': JSON.stringify({ subagents: [{ name: 'reviewer', description: 'Review.', role_file: '.agents/subagents/reviewer/SUBAGENT.md' }], skills: [{ name: 'lint', description: 'Lint.' }] }),
            '.agents/subagents/reviewer/SUBAGENT.md': '---\nname: reviewer\ndescription: Review.\n---\nReview.',
            '.agents/skills/lint/SKILL.md': '---\nname: lint\ndescription: Lint.\n---\nLint.',
            'opencode.json': '{}',
        });
        const sdd = await scan();
        mockFiles.clear();
        seedWorkspace({
            'CLAUDE.md': '# Instructions',
            '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Review.\n---\nReview.',
            '.claude/skills/lint/SKILL.md': '---\nname: lint\ndescription: Lint.\n---\nLint.',
            'opencode.json': '{}',
        });
        const claude = await scan();
        expect([...sharedCategories(claude)].sort()).toEqual([...sharedCategories(sdd)].sort());
        expect(claude.maturity.level).toBe(sdd.maturity.level);
        expect(claude.maturity.unavailableInputs).toEqual(sdd.maturity.unavailableInputs);
    });

    it('reports an unknown root as unassessed inputs, not as defects', async () => {
        seedWorkspace({ 'README.md': '# A project', 'notes/ideas.md': 'Just notes.' });
        const profile = await scan();
        expect(profile.evidence).toEqual([]);
        expect(profile.maturity.level).toBe('L0');
        expect(profile.maturity.unavailableInputs).toEqual(expect.arrayContaining([
            'Project instructions: no file or provider evidence found',
            'Agent CLI: no configuration found',
        ]));
    });
});

describe('rule classification (R2)', () => {
    it('classifies every rule, naming a known provider for provider rules', () => {
        const providers = new Set(SUPPORTED_FRAMEWORKS.map(f => f.id));
        for (const rule of [...CORE_RULES, ...METHODOLOGY_RULES]) {
            const entry = RULE_CLASSIFICATION[rule.id];
            expect(entry, rule.id).toBeDefined();
            expect(entry.evidence.length, rule.id).toBeGreaterThan(0);
            if (entry.scope.kind === 'provider') expect(providers.has(entry.scope.providerId), rule.id).toBe(true);
        }
        expect(Object.keys(RULE_CLASSIFICATION).sort()).toEqual([...CORE_RULES, ...METHODOLOGY_RULES].map(r => r.id).sort());
        expect(classifyRule('sc-stale-override-lodash').scope).toEqual({ kind: 'optional' });
    });
});
