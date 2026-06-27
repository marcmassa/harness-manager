import * as React from 'react';
import { MDViewer } from './components/MDViewer.js';
import type { MarkdownFileContent } from '../types.js';
import { SPACE } from './styles.js';
import { AiAssistBar } from './AiAssistBar.js';
import { StatusBadge, type FeatureEntry } from './FeatureList.js';

type SpecFile = 'requirements' | 'design' | 'tasks';
type EditState = { featureName: string; file: SpecFile; content: string } | null;
type VscodeApi = { postMessage?: (msg: unknown) => void };

interface TabInfo { key: SpecFile; label: string; }

const TABS: TabInfo[] = [
    { key: 'requirements', label: 'Requirements' },
    { key: 'design', label: 'Design' },
    { key: 'tasks', label: 'Tasks' },
];

const EMPTY_SPEC: MarkdownFileContent = { nodeId: '', filePath: '', content: '', exists: false };

export interface SpecEditorProps {
    feature: FeatureEntry;
    vscode: VscodeApi;
    taskCounts: Record<string, { total: number; done: number }>;
}

export const SpecEditor = ({ feature, vscode, taskCounts }: SpecEditorProps) => {
    const [activeTab, setActiveTab] = React.useState<SpecFile>('requirements');
    const [specContent, setSpecContent] = React.useState<Record<SpecFile, MarkdownFileContent>>({
        requirements: EMPTY_SPEC, design: EMPTY_SPEC, tasks: EMPTY_SPEC,
    });
    const [specLoading, setSpecLoading] = React.useState<Record<SpecFile, boolean>>({
        requirements: false, design: false, tasks: false,
    });
    const [editState, setEditState] = React.useState<EditState>(null);
    const editStateRef = React.useRef<EditState>(null);
    editStateRef.current = editState;
    const [aiLoading, setAiLoading] = React.useState(false);
    const [saveResult, setSaveResult] = React.useState<{ ok: boolean; error?: string } | null>(null);
    const [editGenerating, setEditGenerating] = React.useState(false);

    React.useEffect(() => {
        setActiveTab('requirements');
        setEditState(null);
        setSaveResult(null);
        setSpecContent({ requirements: EMPTY_SPEC, design: EMPTY_SPEC, tasks: EMPTY_SPEC });
        for (const tab of TABS) {
            setSpecLoading(prev => ({ ...prev, [tab.key]: true }));
            vscode.postMessage?.({ type: 'getSpecFile', featureName: feature.name, file: tab.key });
        }
    }, [feature.name]); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const msg = event.data;
            switch (msg.type) {
                case 'specFile': {
                    if (msg.featureName !== feature.name) return;
                    const file = msg.file as SpecFile;
                    const content: MarkdownFileContent = {
                        nodeId: '',
                        filePath: `specs/${msg.featureName}/${file}.md`,
                        content: msg.content,
                        exists: msg.exists,
                    };
                    setSpecContent(prev => ({ ...prev, [file]: content }));
                    setSpecLoading(prev => ({ ...prev, [file]: false }));
                    break;
                }
                case 'saveResult':
                    setSaveResult({ ok: msg.ok, error: msg.error });
                    break;
                case 'aiResult':
                    setAiLoading(false);
                    if (msg.ok && msg.text) {
                        setEditState({ featureName: msg.featureName || feature.name, file: msg.file as SpecFile, content: msg.text });
                    } else {
                        setSaveResult({ ok: false, error: msg.error || 'AI generation failed' });
                    }
                    break;
                case 'featureDescriptionResult': {
                    if ((msg.target || 'createDescription') !== 'editContent') return;
                    setEditGenerating(false);
                    if (msg.ok && msg.text) {
                        const cur = editStateRef.current;
                        if (cur) setEditState({ ...cur, content: msg.text });
                    } else {
                        setSaveResult({ ok: false, error: msg.error || 'AI generation failed' });
                    }
                    break;
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [feature.name]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeContent = specContent[activeTab];

    function handleEnterEditMode(): void {
        setEditState({ featureName: feature.name, file: activeTab, content: specContent[activeTab].content });
        setSaveResult(null);
    }

    function handleSaveEdit(): void {
        if (!editState) return;
        setSaveResult(null);
        vscode.postMessage?.({ type: 'saveSpecFile', featureName: editState.featureName, file: editState.file, content: editState.content });
        setSpecContent(prev => ({ ...prev, [editState!.file]: { ...prev[editState!.file], content: editState!.content, exists: true } }));
        setEditState(null);
    }

    function handleCancelEdit(): void { setEditState(null); setSaveResult(null); }

    function handleCreateFromTemplate(): void {
        setSaveResult(null);
        setSpecLoading(prev => ({ ...prev, [activeTab]: true }));
        vscode.postMessage?.({ type: 'createSpecFile', featureName: feature.name, file: activeTab });
    }

    function handleGenerateWithAI(): void {
        setAiLoading(true);
        setSaveResult(null);
        vscode.postMessage?.({ type: 'generateWithAI', featureName: feature.name, file: activeTab });
    }

    return (
        <>
            {/* Feature header */}
            <div style={{
                padding: `${SPACE.sm} ${SPACE.md}`,
                borderBottom: '1px solid var(--vscode-panel-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexShrink: 0, gap: SPACE.sm,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                    <span style={{ fontSize: '0.7em', fontWeight: 700, opacity: 0.5, fontFamily: 'monospace', flexShrink: 0 }}>
                        {feature.id}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '0.95em', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {feature.title}
                    </h3>
                    <StatusBadge status={feature.status} />
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                        type="button"
                        title="Delete this feature"
                        onClick={() => vscode.postMessage?.({ type: 'deleteFeature', featureId: feature.id })}
                        style={{
                            width: '22px', height: '22px', padding: 0, border: 'none', borderRadius: '4px',
                            background: 'transparent', color: 'var(--vscode-errorForeground, #e86f4a)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0.5, transition: 'opacity 0.15s ease',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Tab strip */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0, height: '32px' }}>
                {TABS.map(tab => (
                    <div
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); if (editState) setEditState(null); }}
                        style={{
                            padding: '0 16px', display: 'flex', alignItems: 'center', cursor: 'pointer',
                            fontSize: '0.75em', fontWeight: activeTab === tab.key ? 700 : 500,
                            letterSpacing: '0.5px', textTransform: 'uppercase',
                            color: activeTab === tab.key
                                ? 'var(--vscode-tab-activeForeground)'
                                : 'var(--vscode-tab-inactiveForeground, var(--vscode-descriptionForeground))',
                            borderBottom: activeTab === tab.key ? '2px solid var(--vscode-focusBorder)' : '2px solid transparent',
                            transition: 'color 0.2s ease, border-color 0.2s ease',
                            userSelect: 'none', gap: '6px',
                        }}
                    >
                        {tab.label}
                        {taskCounts[feature.name] && tab.key === 'tasks' && (
                            <span style={{ fontSize: '0.8em', opacity: 0.6 }}>
                                ({taskCounts[feature.name].done}/{taskCounts[feature.name].total})
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: editState ? '0' : `${SPACE.sm} 0` }}>
                {editState && editState.file === activeTab ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}>
                            <textarea
                                value={editState.content}
                                onChange={(e) => editState && setEditState({ ...editState, content: e.target.value })}
                                style={{
                                    flex: 1, fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                    fontSize: 'var(--vscode-editor-font-size, 12px)', lineHeight: 1.5,
                                    padding: SPACE.md, paddingRight: '28px', border: 'none', resize: 'none',
                                    background: 'var(--vscode-editor-background)', color: 'var(--vscode-editor-foreground)', outline: 'none',
                                }}
                            />
                            <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '2px' }}>
                                <button
                                    type="button"
                                    title="Generate content with AI"
                                    onClick={() => {
                                        if (editGenerating) return;
                                        setAiLoading(true); setSaveResult(null);
                                        vscode.postMessage?.({ type: 'generateWithAI', featureName: feature.name, file: activeTab });
                                    }}
                                    style={{
                                        width: '20px', height: '20px', padding: 0, border: 'none', borderRadius: '3px',
                                        background: editGenerating ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))' : 'var(--vscode-button-background)',
                                        color: 'var(--vscode-button-foreground)', cursor: editGenerating ? 'default' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: editGenerating ? 0.5 : 0.7, transition: 'opacity 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => { if (!editGenerating) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
                                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    title="Refine content with AI"
                                    disabled={!editState.content.trim() || editGenerating}
                                    onClick={() => {
                                        if (!editState.content.trim() || editGenerating) return;
                                        setEditGenerating(true);
                                        vscode.postMessage?.({ type: 'generateFeatureDescription', target: 'editContent', mode: 'refine', title: feature.title, currentDescription: editState.content.trim() });
                                    }}
                                    style={{
                                        width: '20px', height: '20px', padding: 0, border: 'none', borderRadius: '3px',
                                        background: !editState.content.trim() || editGenerating ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))' : 'var(--vscode-button-background)',
                                        color: 'var(--vscode-button-foreground)', cursor: !editState.content.trim() || editGenerating ? 'default' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: !editState.content.trim() || editGenerating ? 0.3 : 0.7, transition: 'opacity 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => { if (editState.content.trim() && !editGenerating) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex', gap: SPACE.sm, padding: SPACE.sm,
                            borderTop: '1px solid var(--vscode-panel-border)',
                            justifyContent: 'flex-end', background: 'var(--vscode-sideBar-background)',
                        }}>
                            {saveResult && !saveResult.ok && (
                                <span style={{ color: '#e86f4a', fontSize: '0.8em', marginRight: 'auto', alignSelf: 'center' }}>
                                    Save failed: {saveResult.error}
                                </span>
                            )}
                            <button type="button" onClick={handleCancelEdit} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--vscode-panel-border)', background: 'transparent', color: 'var(--vscode-foreground)', cursor: 'pointer', fontSize: '0.75em' }}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleSaveEdit} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--vscode-button-border)', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', cursor: 'pointer', fontSize: '0.75em', fontWeight: 600 }}>
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <AiAssistBar
                            existsCurrentFile={activeContent?.exists ?? false}
                            aiLoading={aiLoading}
                            onCreateFromTemplate={handleCreateFromTemplate}
                            onEnterEditMode={handleEnterEditMode}
                            onGenerateWithAI={handleGenerateWithAI}
                        />
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {specLoading[activeTab] ? (
                                <div style={{ padding: SPACE.md, textAlign: 'center', opacity: 0.5, fontStyle: 'italic', fontSize: '0.85em' }}>
                                    Loading...
                                </div>
                            ) : (
                                <MDViewer content={activeContent} isLoading={false} />
                            )}
                        </div>
                    </>
                )}
            </div>

            {saveResult && saveResult.ok && (
                <div style={{ position: 'fixed', bottom: '12px', right: '12px', padding: '8px 16px', borderRadius: '6px', background: 'rgba(42, 161, 152, 0.9)', color: '#fff', fontSize: '0.8em', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100 }}>
                    ✓ Saved
                </div>
            )}
            {saveResult && !saveResult.ok && saveResult.error && (
                <div style={{ position: 'fixed', bottom: '12px', right: '12px', padding: '8px 16px', borderRadius: '6px', background: 'rgba(193, 74, 74, 0.9)', color: '#fff', fontSize: '0.8em', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100, maxWidth: '400px' }}>
                    ✗ {saveResult.error}
                </div>
            )}
        </>
    );
};
