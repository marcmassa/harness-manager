// FEAT-044 T3 — provider-neutral cost findings (R8, R9).
import { describe, expect, it } from 'vitest';
import { scan } from '../optimizer/optimizerEngine.js';
import { DEFAULT_OPTIMIZER_CONFIG, type ComponentSource } from '../optimizer/types.js';
import type { LoadMode } from './loadMode.js';
import { buildCostSection } from './costSection.js';

const SHARED = 'Always run the test suite before committing, and never push directly to main without a review from a teammate who knows the code.';
const comp = (providerId: string, nodeId: string, filePath: string, body: string, loadMode: LoadMode, tokens = 200, type: ComponentSource['nodeType'] = 'agent'): ComponentSource => ({
    nodeId, nodeType: type, label: nodeId, filePath, raw: body, body, frontmatter: {}, exists: true, pathKind: 'file', tokenEstimate: tokens,
    source: { workspaceUri: 'w', providerId, nativeId: nodeId, sourceUri: `file:///w/${filePath}`, loadMode },
});
const findingsOf = (sources: ComponentSource[]) =>
    scan(sources, [], new Set(sources.map(s => s.nodeId)), new Set(sources.map(s => s.filePath)), DEFAULT_OPTIMIZER_CONFIG).findings;

describe('OPT-K01 duplicated always-loaded content (R8, R9)', () => {
    it('reports text copied between CLAUDE.md, a profile AGENTS.md and copilot-instructions, naming every owner', () => {
        const sources = [
            comp('claude-code', 'claude-code::root', 'CLAUDE.md', `# Claude\n\n${SHARED}`, 'always'),
            comp('team-guides', 'team-guides::agents', 'AGENTS.md', `# Agents\n\n${SHARED}`, 'always'),
            comp('copilot', 'copilot::root', '.github/copilot-instructions.md', `# Copilot\n\n${SHARED}`, 'always'),
        ];
        const k01 = findingsOf(sources).filter(f => f.ruleId === 'OPT-K01');
        expect(k01.map(f => f.nodeId).sort()).toEqual(['claude-code::root', 'copilot::root', 'team-guides::agents']);
        const claude = k01.find(f => f.nodeId === 'claude-code::root')!;
        expect(claude.relatedNodeIds?.sort()).toEqual(['copilot::root', 'team-guides::agents']);
        expect(claude.detail).toContain('(team-guides,');
        expect(claude.detail).toContain('(copilot,');
        expect(claude.source?.providerId).toBe('claude-code');
    });

    it('ignores copies within one owner and resources not loaded in every session', () => {
        const sources = [
            comp('claude-code', 'a', 'CLAUDE.md', SHARED, 'always'),
            comp('claude-code', 'b', '.claude/agents/r.md', SHARED, 'delegated', 200, 'subagent'),
            comp('copilot', 'c', '.github/copilot-instructions.md', SHARED, 'unknown'),
        ];
        expect(findingsOf(sources).filter(f => f.ruleId === 'OPT-K01')).toEqual([]);
    });
});

describe('OPT-K02 baseline share and OPT-K03 on-trigger form (R8)', () => {
    it('flags one file holding most of an owner\'s baseline', () => {
        const sources = [comp('claude-code', 'big', 'CLAUDE.md', 'x', 'always', 3000), comp('claude-code', 's', '.claude/x.md', 'y', 'always', 200, 'steering')];
        const k02 = findingsOf(sources).filter(f => f.ruleId === 'OPT-K02');
        expect(k02.map(f => f.nodeId)).toEqual(['big']);
        expect(k02[0]).toMatchObject({ severity: 'info', confidence: 'opinion' });
    });

    it('suggests an on-trigger form only where the owner\'s format has one', () => {
        const sources = [
            comp('cursor', 'cursor::global', '.cursor/rules/global.mdc', 'Rules.', 'always'),
            comp('claude-code', 'claude-code::root', 'CLAUDE.md', 'Rules.', 'always'),
            comp('cursor', 'cursor::ts', '.cursor/rules/ts.mdc', 'Rules.', 'on-trigger', 200, 'subagent'),
        ];
        expect(findingsOf(sources).filter(f => f.ruleId === 'OPT-K03').map(f => f.nodeId)).toEqual(['cursor::global']);
    });
});

describe('cost section (R7, R10)', () => {
    const settings = (values: Record<string, unknown>) => ({ get: <T>(k: string, d: T) => (k in values ? values[k] as T : d) });
    const sources = [comp('claude-code', 'root', 'CLAUDE.md', 'x', 'always', 1000), comp('team-guides', 'g', 'g.md', 'x', 'unknown', 500)];

    it('shows tokens only, with no money, when no price table is configured', () => {
        const cost = buildCostSection(sources, settings({}));
        expect(cost).toMatchObject({ sessionTotal: 1000, unpricedCount: 1, money: [] });
        expect(cost.owners.find(o => o.owner === 'team-guides')).toMatchObject({ evaluated: false });
    });

    it('labels money estimates with the price date and factor', () => {
        const cost = buildCostSection(sources, settings({
            'cost.prices': { date: '2026-11-01', models: { m: { inputPerMTok: 2, family: 'f' } } },
            'cost.calibration': { f: 1.5 },
        }));
        expect(cost.money).toEqual([{ model: 'm', priceDate: '2026-11-01', factor: 1.5, calibrated: true, sessionTokens: 1500, perSession: 0.003 }]);
    });
});
