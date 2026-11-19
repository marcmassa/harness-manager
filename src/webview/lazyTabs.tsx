// FEAT-045 T6 (R19) — tabs load on first display. The shell and the active tab
// render first; every other tab's code is a separate chunk fetched when it is
// first shown, then kept mounted so its state survives tab switches.
import * as React from 'react';
import { vscode } from './vscodeApi.js';

export const WhiteboardTab = React.lazy(() => import('./WhiteboardTab.js'));
export const TimelineTab = React.lazy(() => import('./FeatureSpecPanel.js').then(m => ({ default: m.FeatureSpecPanel })));
export const AdvisoryTab = React.lazy(() => import('./AdvisoryPanel.js').then(m => ({ default: m.AdvisoryPanel })));
export const OptimizerTab = React.lazy(() => import('./OptimizerPanel.js').then(m => ({ default: m.OptimizerPanel })));
export const RunAgentOverlay = React.lazy(() => import('./RunAgentPanel.js').then(m => ({ default: m.RunAgentPanel })));
export const TemplateOverlay = React.lazy(() => import('./ArchitectureTemplatePanel.js').then(m => ({ default: m.ArchitectureTemplatePanel })));
export const WizardOverlay = React.lazy(() => import('./AgentBuilderWizard.js').then(m => ({ default: m.AgentBuilderWizard })));

/** Tells the host a tab's chunk loaded and mounted (Extension Host evidence for R19). */
const Ready = ({ tab }: { tab: string }) => {
    React.useEffect(() => { vscode.postMessage?.({ type: 'tabReady', tab }); }, [tab]);
    return null;
};

const Loading = () => <div style={{ padding: '16px', opacity: 0.6, fontSize: '0.85em' }}>Loading…</div>;

/** Mount `children` once the tab has been shown; never before. */
export const TabBoundary = ({ tab, visited, children }: { tab: string; visited: ReadonlySet<string>; children: React.ReactNode }) =>
    visited.has(tab) ? <React.Suspense fallback={<Loading />}>{children}<Ready tab={tab} /></React.Suspense> : null;

/** Tabs shown so far, starting with the active one. */
export function useVisitedTabs(activeTab: string): ReadonlySet<string> {
    const [visited, setVisited] = React.useState<ReadonlySet<string>>(() => new Set([activeTab]));
    React.useEffect(() => {
        setVisited(v => (v.has(activeTab) ? v : new Set([...v, activeTab])));
    }, [activeTab]);
    return visited;
}
