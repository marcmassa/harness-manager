// FEAT-045 T6 (R19) — tabs mount on first display; the entry imports no tab directly.
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

vi.mock('./vscodeApi.js', () => ({ vscode: { postMessage: vi.fn() } }));
const { TabBoundary } = await import('./lazyTabs.js');

describe('lazy tabs (R19)', () => {
    it('renders nothing for a tab that has not been shown', () => {
        expect(renderToStaticMarkup(React.createElement(TabBoundary, { tab: 'optimizer', visited: new Set(['whiteboard']) }, React.createElement('p', null, 'opt')))).toBe('');
        expect(renderToStaticMarkup(React.createElement(TabBoundary, { tab: 'whiteboard', visited: new Set(['whiteboard']) }, React.createElement('p', null, 'wb')))).toContain('wb');
    });

    it('keeps every tab and React Flow out of the shell imports', () => {
        const app = readFileSync('src/webview/App.tsx', 'utf8');
        for (const m of ['WhiteboardCanvas', 'FeatureSpecPanel', 'AdvisoryPanel', 'OptimizerPanel', 'RunAgentPanel', 'AgentBuilderWizard', 'ArchitectureTemplatePanel', '@xyflow/react']) {
            expect(app).not.toMatch(new RegExp(`^import .*['/]${m.replace('/', '\\/')}(\\.js)?';`, 'm'));
        }
        expect(readFileSync('esbuild.js', 'utf8')).toMatch(/splitting: true/);
    });
});
