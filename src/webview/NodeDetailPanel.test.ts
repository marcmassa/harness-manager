// FEAT-041 T3 (R3) — the detail panel renders the host's ownership decision,
// and the split of index.tsx keeps the panel rendering from the shared context.
import { beforeAll, describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ResourceOwnership } from '../operations/operationGate.js';

type Panel = typeof import('./NodeDetailPanel.js').NodeDetailPanel;
let NodeDetailPanel: Panel;

beforeAll(async () => {
    // vscodeApi.ts acquires the webview API at import time.
    (globalThis as Record<string, unknown>).window = { acquireVsCodeApi: () => ({ postMessage: () => undefined }) };
    ({ NodeDetailPanel } = await import('./NodeDetailPanel.js'));
});

const node = {
    id: 'claude-code::reviewer',
    type: 'subagent',
    data: { label: 'reviewer', metadata: { description: 'Review changes.', _filePath: '.claude/agents/reviewer.md' } },
};

const ownership = (deleteAllowed: boolean): Record<string, ResourceOwnership> => ({
    [node.id]: {
        providerId: 'claude-code',
        providerLabel: 'Claude Code',
        nativePath: '.claude/agents/reviewer.md',
        operations: [
            { op: 'editing.updateMetadata', label: 'Edit description', available: deleteAllowed, reason: deleteAllowed ? undefined : 'Claude Code resources are read-only for "Edit description".' },
            { op: 'editing.deleteEntity', label: 'Delete', available: deleteAllowed, reason: deleteAllowed ? undefined : 'Claude Code resources are read-only for "Delete".' },
            { op: 'editing.linkSkill', label: 'Save skill links', available: true, viewLocal: !deleteAllowed },
        ],
    },
});

function render(own: Record<string, ResourceOwnership>): string {
    const noop = () => undefined;
    const ctx = {
        selectedNode: node, setSelectedNode: noop, ownership: own, mdContent: null, mdLoading: false,
        detailTab: 'description', setDetailTab: noop, isDetailPanelCollapsed: false, setIsDetailPanelCollapsed: noop,
        data: { graph: { nodes: [], edges: [] }, milestones: [], errors: [] },
    };
    return renderToStaticMarkup(React.createElement(NodeDetailPanel, { ctx: ctx as never }));
}

describe('NodeDetailPanel (R3)', () => {
    it('shows provider, native path and each operation with its reason', () => {
        const html = render(ownership(false));
        expect(html).toContain('Claude Code');
        expect(html).toContain('.claude/agents/reviewer.md');
        expect(html).toContain('Claude Code resources are read-only for &quot;Delete&quot;.');
        expect(html).toContain('(view only, not written to files)');
        expect(html).toMatch(/<button[^>]*title="Delete is not available for this resource"[^>]*disabled=""/);
        expect(html).toMatch(/<textarea[^>]*readonly=""/i);
    });

    it('enables Delete and editing when the host allows them', () => {
        const html = render(ownership(true));
        expect(html).toMatch(/<button[^>]*title="Delete"(?![^>]*disabled)[^>]*>/);
        expect(html).not.toMatch(/<textarea[^>]*readonly=""/i);
    });

    it('treats unknown ownership as not allowed', () => {
        const html = render({});
        expect(html).toMatch(/title="Delete is not available for this resource"[^>]*disabled=""/);
        expect(html).not.toContain('Native path:');
    });
});
