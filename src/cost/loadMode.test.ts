// FEAT-044 T1 — owner-declared load modes (R1, R2, R3).
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({}));
import { resolveLoadMode, LOAD_MODES } from './loadMode.js';
import { validateProfiles } from '../adapters/profileV1.js';
import { validateCompanion } from '../adapters/companionApi.js';
import { DISCOVERY_ONLY } from '../adapters/capabilities.js';

const node = (type: string, path: string, metadata: Record<string, unknown> = {}) => ({ type, metadata: { _filePath: path, ...metadata } });

describe('built-in load mode table (R1)', () => {
    it.each([
        ['claude-code', node('agent', 'CLAUDE.md'), 'always'],
        ['claude-code', node('subagent', '.claude/agents/reviewer.md'), 'delegated'],
        ['claude-code', node('skill', '.claude/skills/lint/SKILL.md'), 'on-trigger'],
        ['harness-sdd', node('subagent', '.agents/subagents/r/SUBAGENT.md'), 'delegated'],
        ['harness-sdd', node('skill', '.agents/skills/lint/SKILL.md'), 'on-trigger'],
        ['harness-sdd', node('steering', '.agents/steering/kiss.md', { applies_to: ['*'] }), 'always'],
        ['harness-sdd', node('steering', '.agents/steering/ts.md', { applies_to: ['implementer'] }), 'delegated'],
        ['harness-sdd', node('hook', '.agents/hooks/on-save.sh'), 'on-event'],
        ['gemini-cli', node('agent', 'GEMINI.md'), 'always'],
        ['gemini-cli', node('skill', '.gemini/commands/review.toml'), 'manual'],
        ['copilot', node('agent', '.github/copilot-instructions.md'), 'always'],
        ['copilot', node('subagent', '.github/instructions/ts.instructions.md', { applyTo: '**/*.ts' }), 'on-trigger'],
        ['copilot', node('subagent', '.github/instructions/all.instructions.md'), 'always'],
        ['copilot', node('skill', '.vscode/prompts/review.prompt.md'), 'manual'],
        ['cursor', node('agent', '.cursorrules'), 'always'],
        ['cursor', node('agent', '.cursor/rules/global.mdc', { alwaysApply: true }), 'always'],
        ['cursor', node('subagent', '.cursor/rules/ts.mdc', { globs: '**/*.ts' }), 'on-trigger'],
        ['cursor', node('subagent', '.cursor/rules/api.mdc', { description: 'Use for API work' }), 'on-trigger'],
        ['cursor', node('subagent', '.cursor/rules/manual.mdc'), 'manual'],
        ['kiro', node('skill', '.kiro/skills/lint/SKILL.md'), 'on-trigger'],
        ['kiro', node('steering', '.kiro/steering/product.md'), 'always'],
        ['kiro', node('steering', '.kiro/steering/api.md', { inclusion: 'fileMatch' }), 'on-trigger'],
        ['kiro', node('steering', '.kiro/steering/notes.md', { inclusion: 'manual' }), 'manual'],
        ['windsurf', node('agent', '.windsurfrules'), 'always'],
        ['opencode', node('subagent', 'opencode.json'), 'delegated'],
    ])('%s %s → %s', (provider, n, expected) => {
        expect(resolveLoadMode(provider, n)).toBe(expected);
    });

    it('yields unknown for resources a provider does not describe', () => {
        expect(resolveLoadMode('opencode', node('agent', 'opencode.json'))).toBe('unknown');
        expect(resolveLoadMode('harness-sdd', node('agent', '.agents/agentic.json'))).toBe('unknown');
        expect(resolveLoadMode(undefined, node('agent', 'CLAUDE.md'))).toBe('unknown');
    });
});

describe('no inferred load mode (R2)', () => {
    it('does not treat a branded file name as a declaration', () => {
        // A workspace profile or companion that claims CLAUDE.md but declares nothing stays unknown.
        expect(resolveLoadMode('team-guides', node('agent', 'CLAUDE.md'))).toBe('unknown');
        expect(resolveLoadMode('acme', node('agent', 'GEMINI.md'))).toBe('unknown');
    });

    it('ignores a load mode written in a built-in format\'s own frontmatter', () => {
        expect(resolveLoadMode('claude-code', node('subagent', '.claude/agents/r.md', { _loadMode: 'always' }))).toBe('delegated');
    });
});

describe('declaration paths (R3)', () => {
    const profile = (entity: Record<string, unknown>) => validateProfiles([{ version: 1, id: 'team', markers: ['m.md'], entities: [{ glob: 'x/*.md', type: 'agent', ...entity }] }], new Set());

    it('keeps version 1 profiles valid with or without the field', () => {
        expect(profile({}).profiles[0].entities[0].loadMode).toBeUndefined();
        expect(profile({ loadMode: 'always' }).profiles[0].entities[0].loadMode).toBe('always');
        expect(profile({ loadMode: 'sometimes' }).diagnostics[0].message).toContain('unknown load mode');
    });

    it('uses a profile or companion declaration for its own resources', () => {
        expect(resolveLoadMode('team', node('agent', 'x/a.md', { _loadMode: 'on-trigger' }))).toBe('on-trigger');
        expect(resolveLoadMode('acme', node('agent', 'x/a.md', { _loadMode: 'whenever' }))).toBe('unknown');
        for (const mode of LOAD_MODES) expect(resolveLoadMode('acme', node('agent', 'x', { _loadMode: mode }))).toBe(mode);
    });

    it('accepts a version 1 companion that declares no load mode', () => {
        expect(() => validateCompanion({ id: 'acme', label: 'ACME', capabilities: { ...DISCOVERY_ONLY }, detect: () => true, parse: () => ({}), watchGlobs: () => [] })).not.toThrow();
    });
});
