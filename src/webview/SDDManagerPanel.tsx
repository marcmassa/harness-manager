import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { provideVSCodeDesignSystem, allComponents } from '@vscode/webview-ui-toolkit';
import { MDViewer } from './components/MDViewer.js';
import type { MarkdownFileContent } from '../types.js';
import { SPACE } from './styles.js';

provideVSCodeDesignSystem().register(allComponents);

// ===== VS Code API =====
let _vscode: any = null;
try {
    _vscode = (window as any).acquireVsCodeApi?.() ?? (window as any).vscode ?? {};
} catch {
    _vscode = {};
}
const vscode = _vscode;

// ===== Types =====

interface FeatureEntry {
    id: string;
    name: string;
    title: string;
    description: string;
    type: string;
    status: string;
    priority: string;
    agent: string;
    sprint: string;
    sdd: boolean;
}

type SpecFile = 'requirements' | 'design' | 'tasks';

type EditState = {
    featureName: string;
    file: SpecFile;
    content: string;
} | null;

// ===== Status badge colours =====
// Matching the whiteboard's feature-node colour palette (FEAT-024 R2)
const STATUS_COLOURS: Record<string, string> = {
    pending: '#6c6c8a',
    spec_ready: '#d4a84a',
    in_progress: '#4a90d4',
    done: '#2aa198',
    blocked: '#c14a4a',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    spec_ready: 'Spec Ready',
    in_progress: 'In Progress',
    done: 'Done',
    blocked: 'Blocked',
};

// ===== Sub-components =====

const StatusBadge = ({ status }: { status: string }) => {
    const colour = STATUS_COLOURS[status] || '#888';
    return (
        <span
            title={STATUS_LABELS[status] || status}
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.65em',
                fontWeight: 700,
                letterSpacing: '0.5px',
                background: `${colour}22`,
                color: colour,
                border: `1px solid ${colour}44`,
                lineHeight: '1.4',
                whiteSpace: 'nowrap',
            }}
        >
            {STATUS_LABELS[status] || status}
        </span>
    );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
    const colours: Record<string, string> = {
        P0: '#e86f4a',
        P1: '#d4a84a',
        P2: '#6c6c8a',
    };
    const colour = colours[priority] || '#888';
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '0.6em',
                fontWeight: 700,
                background: `${colour}22`,
                color: colour,
                border: `1px solid ${colour}33`,
            }}
        >
            {priority}
        </span>
    );
};

const FeatureCard = ({
    feature,
    selected,
    onClick,
    taskCounts,
}: {
    feature: FeatureEntry;
    selected: boolean;
    onClick: () => void;
    taskCounts: Record<string, { total: number; done: number }>;
}) => {
    const tc = taskCounts[feature.name];
    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            style={{
                padding: `${SPACE.sm} ${SPACE.md}`,
                cursor: 'pointer',
                borderLeft: selected ? `3px solid var(--vscode-focusBorder)` : '3px solid transparent',
                background: selected ? 'var(--vscode-list-hoverBackground)' : 'transparent',
                transition: 'background 0.15s ease, border-color 0.15s ease',
                userSelect: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
            }}
        >
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: SPACE.xs,
            }}>
                <span style={{
                    fontSize: '0.7em',
                    fontWeight: 700,
                    opacity: 0.5,
                    fontFamily: 'monospace',
                }}>
                    {feature.id}
                </span>
                <StatusBadge status={feature.status} />
            </div>
            <div style={{
                fontSize: '0.85em',
                fontWeight: 600,
                lineHeight: 1.3,
                color: 'var(--vscode-editor-foreground)',
            }}>
                {feature.title}
            </div>
            <div style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                marginTop: '2px',
            }}>
                <PriorityBadge priority={feature.priority} />
                {feature.sdd && (
                    <span style={{
                        fontSize: '0.6em',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: 'rgba(42, 161, 152, 0.15)',
                        color: '#2aa198',
                        fontWeight: 600,
                    }}>
                        SDD
                    </span>
                )}
                {tc && (
                    <span style={{
                        fontSize: '0.6em',
                        opacity: 0.6,
                        marginLeft: 'auto',
                    }}>
                        {tc.done}/{tc.total} tasks
                    </span>
                )}
            </div>
        </div>
    );
};

interface TabInfo {
    key: SpecFile;
    label: string;
}

const TABS: TabInfo[] = [
    { key: 'requirements', label: 'Requirements' },
    { key: 'design', label: 'Design' },
    { key: 'tasks', label: 'Tasks' },
];

// ===== Main component =====

const SDDManagerApp = () => {
    const [features, setFeatures] = React.useState<FeatureEntry[]>([]);
    const [selectedFeature, setSelectedFeature] = React.useState<FeatureEntry | null>(null);
    const [activeTab, setActiveTab] = React.useState<SpecFile>('requirements');
    const [specContent, setSpecContent] = React.useState<Record<SpecFile, MarkdownFileContent>>({
        requirements: { nodeId: '', filePath: '', content: '', exists: false },
        design: { nodeId: '', filePath: '', content: '', exists: false },
        tasks: { nodeId: '', filePath: '', content: '', exists: false },
    });
    const [specLoading, setSpecLoading] = React.useState<Record<SpecFile, boolean>>({
        requirements: false,
        design: false,
        tasks: false,
    });
    const [editState, setEditState] = React.useState<EditState>(null);
    const [aiLoading, setAiLoading] = React.useState(false);
    const [aiAvailable, setAiAvailable] = React.useState(false);
    const [saveResult, setSaveResult] = React.useState<{ ok: boolean; error?: string } | null>(null);
    const [taskCounts, setTaskCounts] = React.useState<Record<string, { total: number; done: number }>>({});

    // Load feature list on mount
    React.useEffect(() => {
        vscode.postMessage({ type: 'getFeatureList' });
        vscode.postMessage({ type: 'ready' });

        const handleMessage = (event: MessageEvent) => {
            const msg = event.data;
            switch (msg.type) {
                case 'featureList': {
                    const feats: FeatureEntry[] = msg.features;
                    setFeatures(feats);
                    // Compute task counts from tasks.md files (mark tasks with [x])
                    const counts: Record<string, { total: number; done: number }> = {};
                    for (const f of feats) {
                        counts[f.name] = { total: 0, done: 0 };
                    }
                    setTaskCounts(counts);
                    // Fetch task counts in the background
                    if (feats.length > 0) {
                        for (const feat of feats) {
                            vscode.postMessage({
                                type: 'getSpecFile',
                                featureName: feat.name,
                                file: 'tasks',
                            });
                        }
                    }
                    break;
                }
                case 'specFile': {
                    const file = msg.file as SpecFile;
                    const featureName = msg.featureName;
                    const content: MarkdownFileContent = {
                        nodeId: '',
                        filePath: `specs/${featureName}/${file}.md`,
                        content: msg.content,
                        exists: msg.exists,
                    };
                    setSpecContent(prev => ({ ...prev, [file]: content }));
                    setSpecLoading(prev => ({ ...prev, [file]: false }));

                    // If this is a tasks file, parse task counts
                    if (file === 'tasks' && msg.exists && featureName) {
                        const total = (msg.content.match(/-\s*\[[\sx]\]\s*\*\*T\d+/g) || []).length;
                        const done = (msg.content.match(/-\s*\[x\]\s*\*\*T\d+/g) || []).length;
                        setTaskCounts(prev => ({
                            ...prev,
                            [featureName]: { total, done },
                        }));
                    }
                    break;
                }
                case 'saveResult': {
                    setSaveResult({ ok: msg.ok, error: msg.error });
                    break;
                }
                case 'aiResult': {
                    setAiLoading(false);
                    if (msg.ok && msg.text) {
                        const file = msg.file as SpecFile;
                        // Put the AI response into edit mode
                        setEditState({
                            featureName: msg.featureName || '',
                            file,
                            content: msg.text,
                        });
                    } else {
                        setSaveResult({ ok: false, error: msg.error || 'AI generation failed' });
                    }
                    break;
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Fetch spec files when a feature is selected
    React.useEffect(() => {
        if (!selectedFeature) return;
        setEditState(null);
        setSaveResult(null);
        for (const tab of TABS) {
            setSpecLoading(prev => ({ ...prev, [tab.key]: true }));
            vscode.postMessage({
                type: 'getSpecFile',
                featureName: selectedFeature.name,
                file: tab.key,
            });
        }
    }, [selectedFeature]);

    function handleSelectFeature(feature: FeatureEntry): void {
        setSelectedFeature(feature);
        setActiveTab('requirements');
    }

    function handleOpenInEditor(filePath: string): void {
        vscode.postMessage({ type: 'openInEditor', filePath });
    }

    function handleEnterEditMode(): void {
        if (!selectedFeature) return;
        const content = specContent[activeTab];
        setEditState({
            featureName: selectedFeature.name,
            file: activeTab,
            content: content.content,
        });
        setSaveResult(null);
    }

    function handleSaveEdit(): void {
        if (!editState) return;
        setSaveResult(null);
        vscode.postMessage({
            type: 'saveSpecFile',
            featureName: editState.featureName,
            file: editState.file,
            content: editState.content,
        });
        // Optimistically update the view
        setSpecContent(prev => ({
            ...prev,
            [editState!.file]: {
                ...prev[editState!.file],
                content: editState!.content,
                exists: true,
            },
        }));
        setEditState(null);
    }

    function handleCancelEdit(): void {
        setEditState(null);
        setSaveResult(null);
    }

    function handleGenerateWithAI(): void {
        if (!selectedFeature) return;
        setAiLoading(true);
        setSaveResult(null);
        vscode.postMessage({
            type: 'generateWithAI',
            featureName: selectedFeature.name,
            file: activeTab,
        });
    }

    function handleEditContentChange(newContent: string): void {
        if (!editState) return;
        setEditState({ ...editState, content: newContent });
    }

    // ===== Render =====

    const activeContent = specContent[activeTab];

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--vscode-editor-background)',
            fontFamily: 'var(--vscode-font-family)',
            fontSize: 'var(--vscode-font-size)',
        }}>
            {/* Header */}
            <header style={{
                padding: `${SPACE.sm} ${SPACE.md}`,
                borderBottom: '1px solid var(--vscode-panel-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
            }}>
                <h2 style={{ margin: 0, fontSize: '1em', fontWeight: 600 }}>
                    SDD Manager
                </h2>
                <span style={{ fontSize: '0.75em', opacity: 0.5 }}>
                    {features.length} feature{features.length !== 1 ? 's' : ''}
                </span>
            </header>

            {/* Main content area */}
            <div style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                minHeight: 0,
            }}>
                {/* Sidebar — left */}
                <aside style={{
                    width: '240px',
                    borderRight: '1px solid var(--vscode-panel-border)',
                    overflowY: 'auto',
                    flexShrink: 0,
                    background: 'var(--vscode-sideBar-background)',
                }}>
                    {features.length === 0 && (
                        <div style={{
                            padding: SPACE.md,
                            textAlign: 'center',
                            opacity: 0.5,
                            fontSize: '0.85em',
                            fontStyle: 'italic',
                        }}>
                            No features found
                        </div>
                    )}
                    {features.map(feature => (
                        <FeatureCard
                            key={feature.id}
                            feature={feature}
                            selected={selectedFeature?.id === feature.id}
                            onClick={() => handleSelectFeature(feature)}
                            taskCounts={taskCounts}
                        />
                    ))}
                </aside>

                {/* Detail — right */}
                <main style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    minWidth: 0,
                }}>
                    {!selectedFeature && (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.4,
                            fontStyle: 'italic',
                            fontSize: '0.9em',
                        }}>
                            Select a feature to view its spec files
                        </div>
                    )}

                    {selectedFeature && (
                        <>
                            {/* Feature header */}
                            <div style={{
                                padding: `${SPACE.sm} ${SPACE.md}`,
                                borderBottom: '1px solid var(--vscode-panel-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexShrink: 0,
                                gap: SPACE.sm,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                                    <span style={{
                                        fontSize: '0.7em',
                                        fontWeight: 700,
                                        opacity: 0.5,
                                        fontFamily: 'monospace',
                                        flexShrink: 0,
                                    }}>
                                        {selectedFeature.id}
                                    </span>
                                    <h3 style={{
                                        margin: 0,
                                        fontSize: '0.95em',
                                        fontWeight: 600,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {selectedFeature.title}
                                    </h3>
                                    <StatusBadge status={selectedFeature.status} />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleOpenInEditor(`specs/${selectedFeature.name}/${activeTab}.md`)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--vscode-button-border, var(--vscode-panel-border))',
                                        background: 'var(--vscode-button-background)',
                                        color: 'var(--vscode-button-foreground)',
                                        cursor: 'pointer',
                                        fontSize: '0.75em',
                                        fontWeight: 600,
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                    }}
                                >
                                    Open in Editor
                                </button>
                            </div>

                            {/* Tab strip */}
                            <div style={{
                                display: 'flex',
                                borderBottom: '1px solid var(--vscode-panel-border)',
                                flexShrink: 0,
                                height: '32px',
                            }}>
                                {TABS.map(tab => (
                                    <div
                                        key={tab.key}
                                        onClick={() => {
                                            setActiveTab(tab.key);
                                            // Exit edit mode on tab switch
                                            if (editState) setEditState(null);
                                        }}
                                        style={{
                                            padding: '0 16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            fontSize: '0.75em',
                                            fontWeight: activeTab === tab.key ? 700 : 500,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                            color: activeTab === tab.key
                                                ? 'var(--vscode-tab-activeForeground)'
                                                : 'var(--vscode-tab-inactiveForeground, var(--vscode-descriptionForeground))',
                                            borderBottom: activeTab === tab.key
                                                ? '2px solid var(--vscode-focusBorder)'
                                                : '2px solid transparent',
                                            transition: 'color 0.2s ease, border-color 0.2s ease',
                                            userSelect: 'none',
                                            gap: '6px',
                                        }}
                                    >
                                        {tab.label}
                                        {taskCounts[selectedFeature.name] && tab.key === 'tasks' && (
                                            <span style={{
                                                fontSize: '0.8em',
                                                opacity: 0.6,
                                            }}>
                                                ({taskCounts[selectedFeature.name].done}/{taskCounts[selectedFeature.name].total})
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Tab content */}
                            <div style={{
                                flex: 1,
                                overflow: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: editState ? '0' : `${SPACE.sm} 0`,
                            }}>
                                {/* Edit mode */}
                                {editState && editState.file === activeTab ? (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%',
                                    }}>
                                        <textarea
                                            value={editState.content}
                                            onChange={(e) => handleEditContentChange(e.target.value)}
                                            style={{
                                                flex: 1,
                                                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                                fontSize: 'var(--vscode-editor-font-size, 12px)',
                                                lineHeight: 1.5,
                                                padding: SPACE.md,
                                                border: 'none',
                                                resize: 'none',
                                                background: 'var(--vscode-editor-background)',
                                                color: 'var(--vscode-editor-foreground)',
                                                outline: 'none',
                                            }}
                                        />
                                        <div style={{
                                            display: 'flex',
                                            gap: SPACE.sm,
                                            padding: SPACE.sm,
                                            borderTop: '1px solid var(--vscode-panel-border)',
                                            justifyContent: 'flex-end',
                                            background: 'var(--vscode-sideBar-background)',
                                        }}>
                                            {saveResult && !saveResult.ok && (
                                                <span style={{
                                                    color: '#e86f4a',
                                                    fontSize: '0.8em',
                                                    marginRight: 'auto',
                                                    alignSelf: 'center',
                                                }}>
                                                    Save failed: {saveResult.error}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--vscode-panel-border)',
                                                    background: 'transparent',
                                                    color: 'var(--vscode-foreground)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75em',
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveEdit}
                                                style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--vscode-button-border)',
                                                    background: 'var(--vscode-button-background)',
                                                    color: 'var(--vscode-button-foreground)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75em',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* View mode */
                                    <>
                                        {/* Action bar */}
                                        <div style={{
                                            display: 'flex',
                                            gap: SPACE.sm,
                                            padding: `0 ${SPACE.md} ${SPACE.sm}`,
                                            flexShrink: 0,
                                            alignItems: 'center',
                                        }}>
                                            <button
                                                type="button"
                                                onClick={handleEnterEditMode}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--vscode-panel-border)',
                                                    background: 'transparent',
                                                    color: 'var(--vscode-foreground)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.72em',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                }}
                                            >
                                                ✏ Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleGenerateWithAI}
                                                disabled={aiLoading}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--vscode-button-border)',
                                                    background: aiLoading
                                                        ? 'var(--vscode-button-secondaryBackground, var(--vscode-panel-border))'
                                                        : 'var(--vscode-button-background)',
                                                    color: aiLoading
                                                        ? 'var(--vscode-button-secondaryForeground, var(--vscode-disabledForeground))'
                                                        : 'var(--vscode-button-foreground)',
                                                    cursor: aiLoading ? 'default' : 'pointer',
                                                    fontSize: '0.72em',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    opacity: aiLoading ? 0.6 : 1,
                                                }}
                                            >
                                                {aiLoading ? '⏳ Generating...' : '🤖 Generate with AI'}
                                            </button>
                                        </div>

                                        {/* Spec content */}
                                        <div style={{ flex: 1, overflow: 'auto' }}>
                                            {specLoading[activeTab] ? (
                                                <div style={{
                                                    padding: SPACE.md,
                                                    textAlign: 'center',
                                                    opacity: 0.5,
                                                    fontStyle: 'italic',
                                                    fontSize: '0.85em',
                                                }}>
                                                    Loading...
                                                </div>
                                            ) : (
                                                <MDViewer
                                                    content={activeContent}
                                                    isLoading={false}
                                                />
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* Global save result toast */}
            {saveResult && saveResult.ok && (
                <div style={{
                    position: 'fixed',
                    bottom: '12px',
                    right: '12px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'rgba(42, 161, 152, 0.9)',
                    color: '#fff',
                    fontSize: '0.8em',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.2s ease-out',
                    zIndex: 100,
                }}>
                    ✓ Saved
                </div>
            )}
            {saveResult && !saveResult.ok && saveResult.error && (
                <div style={{
                    position: 'fixed',
                    bottom: '12px',
                    right: '12px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'rgba(193, 74, 74, 0.9)',
                    color: '#fff',
                    fontSize: '0.8em',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.2s ease-out',
                    zIndex: 100,
                    maxWidth: '400px',
                }}>
                    ✗ {saveResult.error}
                </div>
            )}
        </div>
    );
};

// ===== Mount =====
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<SDDManagerApp />);
}
