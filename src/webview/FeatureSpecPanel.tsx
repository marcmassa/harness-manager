import * as React from 'react';
import { SPACE } from './styles.js';
import { FeatureList, STATUS_COLOURS, STATUS_LABELS, STATUS_SORT_ORDER, type FeatureEntry } from './FeatureList.js';
import { SpecEditor } from './SpecEditor.js';
import { SpecWizard } from './SpecWizard.js';

declare const __harness_vscode_api: any;

export type { FeatureEntry };

export interface FeatureSpecPanelProps {
    milestones?: any[];
    startWizard?: number;
    targetFeature?: string | null;
}

export const FeatureSpecPanel = ({ milestones, startWizard, targetFeature }: FeatureSpecPanelProps) => {
    const vscode = React.useMemo(() => {
        try { return (window as any).__harness_vscode_api ?? (window as any).acquireVsCodeApi?.() ?? {}; }
        catch { return {}; }
    }, []);

    const [features, setFeatures] = React.useState<FeatureEntry[]>([]);
    const [selectedFeature, setSelectedFeature] = React.useState<FeatureEntry | null>(null);
    const [taskCounts, setTaskCounts] = React.useState<Record<string, { total: number; done: number }>>({});
    const [wizardOpen, setWizardOpen] = React.useState(false);
    const [wizardKey, setWizardKey] = React.useState(0);

    const selectedFeatureRef = React.useRef<FeatureEntry | null>(null);
    selectedFeatureRef.current = selectedFeature;

    React.useEffect(() => {
        vscode.postMessage?.({ type: 'getFeatureList' });
        vscode.postMessage?.({ type: 'ready' });

        const handleMessage = (event: MessageEvent) => {
            const msg = event.data;
            switch (msg.type) {
                case 'featureList': {
                    const feats: FeatureEntry[] = msg.features;
                    setFeatures(feats);
                    const counts: Record<string, { total: number; done: number }> = {};
                    for (const f of feats) counts[f.name] = { total: 0, done: 0 };
                    setTaskCounts(counts);
                    for (const feat of feats) {
                        vscode.postMessage?.({ type: 'getSpecFile', featureName: feat.name, file: 'tasks' });
                    }
                    break;
                }
                case 'specFile': {
                    if (msg.file === 'tasks' && msg.exists && msg.featureName) {
                        const total = (msg.content.match(/-\s*\[[\sx]\]\s*\*\*T\d+/g) || []).length;
                        const done = (msg.content.match(/-\s*\[x\]\s*\*\*T\d+/g) || []).length;
                        setTaskCounts(prev => ({ ...prev, [msg.featureName]: { total, done } }));
                    }
                    break;
                }
                case 'featureCreated': {
                    const newFeat: FeatureEntry = msg.feature;
                    setFeatures(prev => [...prev, newFeat]);
                    setSelectedFeature(newFeat);
                    break;
                }
                case 'featureDeleted': {
                    const deletedId = msg.featureId as string;
                    setFeatures(prev => prev.filter(f => f.id !== deletedId));
                    if (selectedFeatureRef.current?.id === deletedId) setSelectedFeature(null);
                    break;
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        if (startWizard && startWizard > 0) {
            setWizardOpen(true);
            setWizardKey(k => k + 1);
        }
    }, [startWizard]);

    React.useEffect(() => {
        if (targetFeature && features.length > 0) {
            const match = features.find(f => f.id === targetFeature);
            if (match) { setSelectedFeature(match); setWizardOpen(false); }
        }
    }, [targetFeature, features]);

    function handleSelectFeature(feature: FeatureEntry): void {
        setSelectedFeature(feature);
        setWizardOpen(false);
    }

    function handleCreateNew(): void {
        setWizardOpen(true);
        setWizardKey(k => k + 1);
    }

    const sortedFeatures = React.useMemo(() => {
        return [...features].sort((a, b) => {
            const diff = (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99);
            if (diff !== 0) return diff;
            const prioOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
            return (prioOrder[a.priority] ?? 99) - (prioOrder[b.priority] ?? 99);
        });
    }, [features]);

    const milestoneOutcomeMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        if (milestones) {
            for (const m of milestones) {
                if (m.featureId && m.outcome) map[m.featureId] = m.outcome;
            }
        }
        return map;
    }, [milestones]);

    const statusCounts = React.useMemo(() => {
        const counts: Record<string, number> = {};
        for (const f of features) { const s = f.status || 'pending'; counts[s] = (counts[s] || 0) + 1; }
        return counts;
    }, [features]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, background: 'var(--vscode-editor-background)', fontFamily: 'var(--vscode-font-family)', fontSize: 'var(--vscode-font-size)' }}>
            <style>{`
                @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes dotPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.25); opacity: 0.7; } }
            `}</style>

            <header style={{ padding: `${SPACE.sm} ${SPACE.md}`, borderBottom: '1px solid var(--vscode-panel-border)', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, background: 'var(--vscode-sideBar-background)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.85em', fontWeight: 600, opacity: 0.8 }}>Specs Manager</h3>
                    <span style={{ fontSize: '0.7em', opacity: 0.4 }}>{features.length} feature{features.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {(Object.entries(STATUS_COLOURS) as [string, string][]).map(([status, colour]) => {
                        const count = statusCounts[status] ?? 0;
                        if (count === 0) return null;
                        return (
                            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65em', fontWeight: 600, opacity: 0.85 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colour, display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ color: colour }}>{count}</span>
                                <span style={{ opacity: 0.6 }}>{STATUS_LABELS[status]}</span>
                            </div>
                        );
                    })}
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                <FeatureList
                    sortedFeatures={sortedFeatures}
                    selectedFeature={selectedFeature}
                    taskCounts={taskCounts}
                    milestoneOutcomeMap={milestoneOutcomeMap}
                    onSelectFeature={handleSelectFeature}
                    onCreateNew={handleCreateNew}
                />

                <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    {wizardOpen ? (
                        <SpecWizard
                            key={wizardKey}
                            vscode={vscode}
                            selectedFeature={selectedFeature}
                            onClose={() => setWizardOpen(false)}
                        />
                    ) : selectedFeature ? (
                        <SpecEditor
                            feature={selectedFeature}
                            vscode={vscode}
                            taskCounts={taskCounts}
                        />
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', opacity: 0.7, fontSize: '0.9em' }}>
                            <div style={{ fontStyle: 'italic' }}>No feature selected</div>
                            <button
                                type="button"
                                onClick={handleCreateNew}
                                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', cursor: 'pointer', fontSize: '0.85em', fontWeight: 600 }}
                            >
                                Create New Feature
                            </button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
