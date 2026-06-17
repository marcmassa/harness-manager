import * as React from 'react';
import { MDViewer } from './components/MDViewer.js';
import type { MarkdownFileContent } from '../types.js';
import { SPACE } from './styles.js';

// ===== Reuse VS Code API from parent webview =====
declare const __harness_vscode_api: any;

// ===== Types =====

export interface FeatureEntry {
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

/** Sort order: done first (by sprint/priority), then active, then pending */
const STATUS_SORT_ORDER: Record<string, number> = {
    done: 0,
    in_progress: 1,
    spec_ready: 2,
    pending: 3,
    blocked: 4,
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
    outcome,
    index,
}: {
    feature: FeatureEntry;
    selected: boolean;
    onClick: () => void;
    taskCounts: Record<string, { total: number; done: number }>;
    outcome?: string;
    index: number;
}) => {
    const tc = taskCounts[feature.name];
    const colour = STATUS_COLOURS[feature.status] || '#888';
    const isLast = false; // We can't know in isolation, but the container handles borders

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            style={{
                display: 'flex',
                cursor: 'pointer',
                userSelect: 'none',
                animation: `fadeInLeft 0.3s ease-out ${index * 0.04}s both`,
                transition: 'background 0.15s ease',
                background: selected ? 'var(--vscode-list-hoverBackground)' : 'transparent',
            }}
        >
            {/* Timeline gutter — dot + vertical line */}
            <div style={{
                width: '28px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
            }}>
                {/* Vertical timeline line */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '13px',
                    width: '2px',
                    background: 'var(--vscode-panel-border)',
                    opacity: 0.4,
                }} />
                {/* Status dot */}
                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: colour,
                    marginTop: '16px',
                    flexShrink: 0,
                    boxShadow: selected
                        ? `0 0 0 3px ${colour}44`
                        : 'none',
                    animation: feature.status === 'in_progress' || feature.status === 'spec_ready'
                        ? 'dotPulse 2s ease-in-out infinite'
                        : 'none',
                    transition: 'box-shadow 0.2s ease',
                }} />
            </div>

            {/* Card content */}
            <div style={{
                flex: 1,
                minWidth: 0,
                padding: `${SPACE.sm} ${SPACE.md} ${SPACE.sm} ${SPACE.sm}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                borderBottom: '1px solid var(--vscode-panel-border)',
                borderLeft: selected ? `2px solid ${colour}` : '2px solid transparent',
                transition: 'border-color 0.2s ease',
            }}>
                {/* Row 1: ID + status + sprint */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: SPACE.xs,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{
                            fontSize: '0.65em',
                            fontWeight: 700,
                            opacity: 0.45,
                            fontFamily: 'monospace',
                            letterSpacing: '0.3px',
                        }}>
                            {feature.id}
                        </span>
                        <StatusBadge status={feature.status} />
                    </div>
                    {feature.sprint && (
                        <span style={{
                            fontSize: '0.6em',
                            opacity: 0.4,
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            letterSpacing: '0.3px',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                        }}>
                            {feature.sprint}
                        </span>
                    )}
                </div>

                {/* Row 2: Title */}
                <div style={{
                    fontSize: '0.85em',
                    fontWeight: 600,
                    lineHeight: 1.3,
                    color: 'var(--vscode-editor-foreground)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}>
                    {feature.title}
                </div>

                {/* Row 3: Badges + tasks */}
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                    marginTop: '1px',
                }}>
                    <PriorityBadge priority={feature.priority} />
                    {feature.sdd && (
                        <span style={{
                            fontSize: '0.55em',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: 'rgba(42, 161, 152, 0.15)',
                            color: '#2aa198',
                            fontWeight: 700,
                            letterSpacing: '0.3px',
                        }}>
                            SDD
                        </span>
                    )}
                    {tc && (
                        <span style={{
                            fontSize: '0.6em',
                            opacity: 0.55,
                            marginLeft: 'auto',
                        }}>
                            {tc.done}/{tc.total} tasks
                        </span>
                    )}
                </div>

                {/* Row 4: Milestone outcome (if available) */}
                {outcome && (
                    <div style={{
                        fontSize: '0.65em',
                        opacity: 0.5,
                        lineHeight: 1.3,
                        marginTop: '2px',
                        fontStyle: 'italic',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}>
                        {outcome}
                    </div>
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

export interface FeatureSpecPanelProps {
    milestones?: any[];
    startWizard?: number;
    targetFeature?: string | null; // FEAT node click → select this feature (e.g. "FEAT-001")
}

export const FeatureSpecPanel = ({ milestones, startWizard, targetFeature }: FeatureSpecPanelProps) => {
    const vscode = React.useMemo(() => {
        try {
            return (window as any).__harness_vscode_api ?? (window as any).acquireVsCodeApi?.() ?? {};
        } catch {
            return {};
        }
    }, []);

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
    const editStateRef = React.useRef<EditState>(null);
    editStateRef.current = editState;
    const selectedFeatureRef = React.useRef<FeatureEntry | null>(null);
    selectedFeatureRef.current = selectedFeature;
    const [aiLoading, setAiLoading] = React.useState(false);
    const [saveResult, setSaveResult] = React.useState<{ ok: boolean; error?: string } | null>(null);
    const [taskCounts, setTaskCounts] = React.useState<Record<string, { total: number; done: number }>>({});

    // ===== Wizard states =====
    type WizardStep = 'create_feature' | 'prompt' | 'review_requirements' | 'review_design' | 'review_tasks' | 'complete';

    const [wizardOpen, setWizardOpen] = React.useState(false);
    const [wizardStep, setWizardStep] = React.useState<WizardStep>('prompt');

    // React to external "start wizard" signal (from header button)
    React.useEffect(() => {
        if (startWizard && startWizard > 0) {
            // Start with the "create feature" form so user can set title/description
            // before the AI generation steps
            setWizardOpen(true);
            setWizardStep('create_feature');
            setCreateTitle('');
            setCreateDescription('');
            setCreatePriority('P2');
            setCreateSprint('Next');
            setWizardPrompt('');
            setWizardDraftContent('');
            setWizardDraftError(null);
            setWizardContext('');
            setWizardGenerating(false);
        }
    }, [startWizard]);

    // React to external "select feature" signal (from FEAT node click in whiteboard)
    React.useEffect(() => {
        if (targetFeature && features.length > 0) {
            const match = features.find(f => f.id === targetFeature);
            if (match) {
                setSelectedFeature(match);
                setActiveTab('requirements');
            }
        }
    }, [targetFeature, features]);

    const [wizardPrompt, setWizardPrompt] = React.useState('');
    const [wizardGenerating, setWizardGenerating] = React.useState(false);
    const [wizardDraftContent, setWizardDraftContent] = React.useState('');
    const [wizardDraftError, setWizardDraftError] = React.useState<string | null>(null);
    const [wizardContext, setWizardContext] = React.useState(''); // accumulated approved content across steps
    const [wizardTargetFeature, setWizardTargetFeature] = React.useState<FeatureEntry | null>(null);
    // Create-feature form state
    const [createTitle, setCreateTitle] = React.useState('');
    const [createDescription, setCreateDescription] = React.useState('');
    const [createPriority, setCreatePriority] = React.useState('P2');
    const [createSprint, setCreateSprint] = React.useState('Next');
    const [creatingFeature, setCreatingFeature] = React.useState(false);
    const [descriptionGenerating, setDescriptionGenerating] = React.useState(false);
    const [promptGenerating, setPromptGenerating] = React.useState(false);
    const [editGenerating, setEditGenerating] = React.useState(false);

    // Load feature list on mount
    React.useEffect(() => {
        vscode.postMessage?.({ type: 'getFeatureList' });
        vscode.postMessage?.({ type: 'ready' });

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
                            vscode.postMessage?.({
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
                case 'specDraftResult': {
                    setWizardGenerating(false);
                    if (msg.ok && msg.text) {
                        setWizardDraftContent(msg.text);
                        setWizardDraftError(null);
                    } else {
                        setWizardDraftContent('');
                        setWizardDraftError(msg.error || 'AI generation failed');
                    }
                    break;
                }
                case 'featureDescriptionResult': {
                    const target = msg.target || 'createDescription';
                    // Clear loading for the appropriate target
                    if (target === 'createDescription') setDescriptionGenerating(false);
                    else if (target === 'wizardPrompt') setPromptGenerating(false);
                    else if (target === 'editContent') setEditGenerating(false);
                    if (msg.ok && msg.text) {
                        if (target === 'createDescription') {
                            setCreateDescription(msg.text);
                        } else if (target === 'wizardPrompt') {
                            setWizardPrompt(msg.text);
                        } else if (target === 'editContent') {
                            // Use ref to avoid stale closure
                            const currentEdit = editStateRef.current;
                            if (currentEdit) {
                                setEditState({ ...currentEdit, content: msg.text });
                            }
                        }
                    } else {
                        setSaveResult({ ok: false, error: msg.error || 'AI generation failed' });
                    }
                    break;
                }
                case 'featureCreated': {
                    const newFeat: FeatureEntry = msg.feature;
                    setCreatingFeature(false);
                    // Add to feature list and select it
                    setFeatures(prev => [...prev, newFeat]);
                    setSelectedFeature(newFeat);
                    setWizardTargetFeature(newFeat);
                    // Move to the prompt step
                    setWizardStep('prompt');
                    setWizardPrompt('');
                    setWizardDraftContent('');
                    setWizardDraftError(null);
                    setWizardContext('');
                    setWizardGenerating(false);
                    break;
                }
                case 'featureDeleted': {
                    const deletedId = msg.featureId as string;
                    setFeatures(prev => prev.filter(f => f.id !== deletedId));
                    // Deselect if we were viewing the deleted feature
                    if (selectedFeatureRef.current?.id === deletedId) {
                        setSelectedFeature(null);
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
            vscode.postMessage?.({
                type: 'getSpecFile',
                featureName: selectedFeature.name,
                file: tab.key,
            });
        }
    }, [selectedFeature]);

    function handleSelectFeature(feature: FeatureEntry): void {
        setSelectedFeature(feature);
        setActiveTab('requirements');
        setWizardOpen(false); // Close wizard when navigating to another feature
    }

    function handleOpenInEditor(filePath: string): void {
        vscode.postMessage?.({ type: 'openInEditor', filePath });
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
        vscode.postMessage?.({
            type: 'saveSpecFile',
            featureName: editState.featureName,
            file: editState.file,
            content: editState.content,
        });
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

    function handleCreateFromTemplate(): void {
        if (!selectedFeature) return;
        setSaveResult(null);
        setSpecLoading(prev => ({ ...prev, [activeTab]: true }));
        vscode.postMessage?.({
            type: 'createSpecFile',
            featureName: selectedFeature.name,
            file: activeTab,
        });
    }

    function handleDeleteFeature(feature: FeatureEntry): void {
        vscode.postMessage?.({
            type: 'deleteFeature',
            featureId: feature.id,
        });
    }

    function handleGenerateWithAI(): void {
        if (!selectedFeature) return;
        setAiLoading(true);
        setSaveResult(null);
        vscode.postMessage?.({
            type: 'generateWithAI',
            featureName: selectedFeature.name,
            file: activeTab,
        });
    }

    function handleEditContentChange(newContent: string): void {
        if (!editState) return;
        setEditState({ ...editState, content: newContent });
    }

    // ===== Wizard handlers =====

    function handleOpenWizard(): void {
        setWizardOpen(true);
        setWizardStep('prompt');
        setWizardPrompt('');
        setWizardDraftContent('');
        setWizardDraftError(null);
        setWizardContext('');
        setWizardGenerating(false);
    }

    function handleCloseWizard(): void {
        setWizardOpen(false);
    }

    function handleSubmitCreateFeature(): void {
        if (!createTitle.trim()) return;
        setCreatingFeature(true);
        vscode.postMessage?.({
            type: 'createFeature',
            title: createTitle.trim(),
            description: createDescription.trim(),
            priority: createPriority,
            sprint: createSprint,
        });
    }

    const WIZARD_FILE_MAP: Record<WizardStep, SpecFile | null> = {
        create_feature: null,
        prompt: null,
        review_requirements: 'requirements',
        review_design: 'design',
        review_tasks: 'tasks',
        complete: null,
    };

    function handleWizardGenerate(): void {
        const target = wizardTargetFeature || selectedFeature;
        if (!target || !wizardPrompt.trim()) return;
        const file = WIZARD_FILE_MAP[wizardStep];
        if (!file) return;
        setWizardGenerating(true);
        setWizardDraftContent('');
        setWizardDraftError(null);
        vscode.postMessage?.({
            type: 'generateSpecDraft',
            featureName: target.name,
            file,
            userPrompt: wizardPrompt.trim(),
            contextContent: wizardContext || undefined,
        });
    }

    function handleWizardApprove(): void {
        const target = wizardTargetFeature || selectedFeature;
        if (!target) return;

        // Append approved content to accumulated context
        const newContext = wizardContext + '\n\n' + wizardDraftContent;
        setWizardContext(newContext);

        // Move to next step
        const nextStep: Record<WizardStep, WizardStep> = {
            prompt: 'review_requirements',
            review_requirements: 'review_design',
            review_design: 'review_tasks',
            review_tasks: 'complete',
            complete: 'complete',
        };
        const next = nextStep[wizardStep];
        if (next === 'complete') {
            setWizardStep('complete');
            setWizardDraftContent('');
            setWizardDraftError(null);
            return;
        }

        // Advance step and auto-generate next file
        setWizardStep(next);
        setWizardDraftContent('');
        setWizardDraftError(null);

        const nextFile = WIZARD_FILE_MAP[next];
        if (nextFile) {
            setWizardGenerating(true);
            vscode.postMessage?.({
                type: 'generateSpecDraft',
                featureName: target.name,
                file: nextFile,
                userPrompt: wizardPrompt.trim(),
                contextContent: newContext || undefined,
            });
        }
    }

    function handleWizardRegenerate(): void {
        handleWizardGenerate();
    }

    // ===== Derived data =====

    const activeContent = specContent[activeTab];

    /** Features sorted by status: done → in_progress → spec_ready → pending → blocked */
    const sortedFeatures = React.useMemo(() => {
        return [...features].sort((a, b) => {
            const orderA = STATUS_SORT_ORDER[a.status] ?? 99;
            const orderB = STATUS_SORT_ORDER[b.status] ?? 99;
            if (orderA !== orderB) return orderA - orderB;
            // Within same status, sort by priority (P0 first)
            const prioOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
            return (prioOrder[a.priority] ?? 99) - (prioOrder[b.priority] ?? 99);
        });
    }, [features]);

    /** Build milestone outcome lookup keyed by feature name */
    const milestoneOutcomeMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        if (milestones) {
            for (const m of milestones) {
                if (m.featureId && m.outcome) {
                    // Store the LAST milestone outcome for each feature
                    map[m.featureId] = m.outcome;
                }
            }
        }
        return map;
    }, [milestones]);

    /** Status counts for the summary bar */
    const statusCounts = React.useMemo(() => {
        const counts: Record<string, number> = { pending: 0, spec_ready: 0, in_progress: 0, done: 0, blocked: 0 };
        for (const f of features) {
            if (counts[f.status] !== undefined) counts[f.status]++;
        }
        return counts;
    }, [features]);

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            background: 'var(--vscode-editor-background)',
            fontFamily: 'var(--vscode-font-family)',
            fontSize: 'var(--vscode-font-size)',
        }}>
            {/* Timeline animation keyframes */}
            <style>{`
                @keyframes fadeInLeft {
                    from { opacity: 0; transform: translateX(-8px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes dotPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50%      { transform: scale(1.25); opacity: 0.7; }
                }
            `}</style>
            {/* Timeline summary bar */}
            <header style={{
                padding: `${SPACE.sm} ${SPACE.md}`,
                borderBottom: '1px solid var(--vscode-panel-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                flexShrink: 0,
                background: 'var(--vscode-sideBar-background)',
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <h3 style={{ margin: 0, fontSize: '0.85em', fontWeight: 600, opacity: 0.8 }}>
                        Specs Manager
                    </h3>
                    <span style={{ fontSize: '0.7em', opacity: 0.4 }}>
                        {features.length} feature{features.length !== 1 ? 's' : ''}
                    </span>
                </div>
                {/* Status pill bar */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                }}>
                    {(Object.entries(STATUS_COLOURS) as [string, string][]).map(([status, colour]) => {
                        const count = statusCounts[status] ?? 0;
                        if (count === 0) return null;
                        return (
                            <div key={status} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.65em',
                                fontWeight: 600,
                                opacity: 0.85,
                            }}>
                                <span style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: colour,
                                    display: 'inline-block',
                                    flexShrink: 0,
                                }} />
                                <span style={{ color: colour }}>{count}</span>
                                <span style={{ opacity: 0.6 }}>{STATUS_LABELS[status]}</span>
                            </div>
                        );
                    })}
                </div>
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
                    width: '220px',
                    borderRight: '1px solid var(--vscode-panel-border)',
                    overflowY: 'auto',
                    flexShrink: 0,
                    background: 'var(--vscode-sideBar-background)',
                }}>
                    {sortedFeatures.length === 0 && (
                        <div style={{
                            padding: SPACE.md,
                            textAlign: 'center',
                            opacity: 0.6,
                            fontSize: '0.85em',
                        }}>
                            <div style={{ fontStyle: 'italic', marginBottom: '12px' }}>
                                No features found
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setWizardOpen(true);
                                    setWizardStep('create_feature');
                                    setCreateTitle('');
                                    setCreateDescription('');
                                    setCreatePriority('P2');
                                    setCreateSprint('Next');
                                    setWizardPrompt('');
                                    setWizardDraftContent('');
                                    setWizardDraftError(null);
                                    setWizardContext('');
                                    setWizardGenerating(false);
                                }}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'var(--vscode-button-background)',
                                    color: 'var(--vscode-button-foreground)',
                                    cursor: 'pointer',
                                    fontSize: '0.8em',
                                    fontWeight: 600,
                                }}
                            >
                                Create New Feature
                            </button>
                        </div>
                    )}
                    {sortedFeatures.map((feature, idx) => (
                        <FeatureCard
                            key={feature.id}
                            feature={feature}
                            selected={selectedFeature?.id === feature.id}
                            onClick={() => handleSelectFeature(feature)}
                            taskCounts={taskCounts}
                            outcome={milestoneOutcomeMap[feature.id]}
                            index={idx}
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
                    {wizardOpen ? (
                        /* ===== Wizard UI (takes over the main area) ===== */
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            minHeight: 0,
                        }}>
                            {/* Step indicator */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '4px',
                                        padding: `${SPACE.sm} ${SPACE.md}`,
                                        borderBottom: '1px solid var(--vscode-panel-border)',
                                        flexShrink: 0,
                                        fontSize: '0.65em',
                                        fontWeight: 600,
                                        letterSpacing: '0.5px',
                                    }}>
                                        {(['create_feature', 'prompt', 'review_requirements', 'review_design', 'review_tasks'] as WizardStep[]).map((step, i) => {
                                            const stepLabels: Record<WizardStep, string> = {
                                                create_feature: '0. Create',
                                                prompt: '1. Prompt',
                                                review_requirements: '2. Requirements',
                                                review_design: '3. Design',
                                                review_tasks: '4. Tasks',
                                                complete: 'Done',
                                            };
                                            const status = wizardStep === step ? 'active'
                                                : (wizardStep === 'complete' || ['create_feature', 'prompt', 'review_requirements', 'review_design', 'review_tasks'].indexOf(wizardStep) > i) ? 'done'
                                                : 'pending';
                                            return (
                                                <div key={step} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 10px',
                                                    borderRadius: '4px',
                                                    background: status === 'active' ? 'var(--vscode-button-background)' : 'transparent',
                                                    color: status === 'active' ? 'var(--vscode-button-foreground)' :
                                                        status === 'done' ? 'var(--vscode-textLink-foreground)' :
                                                        'var(--vscode-disabledForeground)',
                                                    opacity: status === 'pending' ? 0.4 : 1,
                                                }}>
                                                    {status === 'done' ? '✓' : status === 'active' ? '▸' : '○'}
                                                    &nbsp;{stepLabels[step]}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Wizard body */}
                                    <div style={{
                                        flex: 1,
                                        overflow: 'auto',
                                        padding: SPACE.md,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: SPACE.md,
                                    }}>
                                        {/* CREATE FEATURE step */}
                                        {wizardStep === 'create_feature' && (
                                            <>
                                                <div style={{ fontSize: '0.85em', fontWeight: 600, opacity: 0.8 }}>
                                                    Create a new feature
                                                </div>
                                                <div style={{ fontSize: '0.75em', opacity: 0.6, marginBottom: '8px' }}>
                                                    Fill in the details to create a new feature in <code>feature_list.json</code>.
                                                    After creation, you'll write the spec with AI assistance.
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.7, display: 'block', marginBottom: '4px' }}>
                                                            Title *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={createTitle}
                                                            onChange={(e) => setCreateTitle(e.target.value)}
                                                            placeholder="e.g. Dark Mode Toggle"
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px 12px',
                                                                borderRadius: '4px',
                                                                border: '1px solid var(--vscode-panel-border)',
                                                                background: 'var(--vscode-input-background)',
                                                                color: 'var(--vscode-input-foreground)',
                                                                fontSize: '0.85em',
                                                                outline: 'none',
                                                                boxSizing: 'border-box',
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.7, display: 'block', marginBottom: '4px' }}>
                                                            Description
                                                        </label>
                                                        <div style={{ position: 'relative' }}>
                                                            <textarea
                                                                value={createDescription}
                                                                onChange={(e) => setCreateDescription(e.target.value)}
                                                                placeholder="Briefly describe what this feature does..."
                                                                rows={3}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '8px 12px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid var(--vscode-panel-border)',
                                                                    background: 'var(--vscode-input-background)',
                                                                    color: 'var(--vscode-input-foreground)',
                                                                    fontSize: '0.85em',
                                                                    outline: 'none',
                                                                    resize: 'vertical',
                                                                    fontFamily: 'inherit',
                                                                    boxSizing: 'border-box',
                                                                }}
                                                            />
                                                            {/* Top-right AI action buttons */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '4px',
                                                                right: '4px',
                                                                display: 'flex',
                                                                gap: '2px',
                                                            }}>
                                                                <button
                                                                    type="button"
                                                                    title="Auto-generate description from title"
                                                                    onClick={() => {
                                                                        if (!createTitle.trim() || descriptionGenerating) return;
                                                                        setDescriptionGenerating(true);
                                                                        vscode.postMessage?.({
                                                                            type: 'generateFeatureDescription',
                                                                            title: createTitle.trim(),
                                                                        });
                                                                    }}
                                                                    style={{
                                                                        width: '20px',
                                                                        height: '20px',
                                                                        padding: 0,
                                                                        border: 'none',
                                                                        borderRadius: '3px',
                                                                        background: descriptionGenerating
                                                                            ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))'
                                                                            : 'var(--vscode-button-background)',
                                                                        color: 'var(--vscode-button-foreground)',
                                                                        cursor: descriptionGenerating || !createTitle.trim() ? 'default' : 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        opacity: descriptionGenerating ? 0.5 : 0.7,
                                                                        transition: 'opacity 0.15s ease',
                                                                    }}
                                                                    onMouseEnter={(e) => { if (!descriptionGenerating && createTitle.trim()) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
                                                                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    title="Refine description with AI"
                                                                    disabled={!createDescription.trim() || descriptionGenerating}
                                                                    onClick={() => {
                                                                        if (!createDescription.trim() || descriptionGenerating) return;
                                                                        setDescriptionGenerating(true);
                                                                        vscode.postMessage?.({
                                                                            type: 'generateFeatureDescription',
                                                                            mode: 'refine',
                                                                            title: createTitle.trim(),
                                                                            currentDescription: createDescription.trim(),
                                                                        });
                                                                    }}
                                                                    style={{
                                                                        width: '20px',
                                                                        height: '20px',
                                                                        padding: 0,
                                                                        border: 'none',
                                                                        borderRadius: '3px',
                                                                        background: !createDescription.trim() || descriptionGenerating
                                                                            ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))'
                                                                            : 'var(--vscode-button-background)',
                                                                        color: 'var(--vscode-button-foreground)',
                                                                        cursor: !createDescription.trim() || descriptionGenerating ? 'default' : 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        opacity: !createDescription.trim() || descriptionGenerating ? 0.3 : 0.7,
                                                                        transition: 'opacity 0.15s ease',
                                                                    }}
                                                                    onMouseEnter={(e) => { if (createDescription.trim() && !descriptionGenerating) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '12px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.7, display: 'block', marginBottom: '4px' }}>
                                                                Priority
                                                            </label>
                                                            <select
                                                                value={createPriority}
                                                                onChange={(e) => setCreatePriority(e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '8px 12px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid var(--vscode-panel-border)',
                                                                    background: 'var(--vscode-dropdown-background)',
                                                                    color: 'var(--vscode-dropdown-foreground)',
                                                                    fontSize: '0.85em',
                                                                    outline: 'none',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                <option value="P0">P0 — Critical</option>
                                                                <option value="P1">P1 — High</option>
                                                                <option value="P2">P2 — Normal</option>
                                                            </select>
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.7, display: 'block', marginBottom: '4px' }}>
                                                                Sprint
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={createSprint}
                                                                onChange={(e) => setCreateSprint(e.target.value)}
                                                                placeholder="e.g. Sprint 3"
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '8px 12px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid var(--vscode-panel-border)',
                                                                    background: 'var(--vscode-input-background)',
                                                                    color: 'var(--vscode-input-foreground)',
                                                                    fontSize: '0.85em',
                                                                    outline: 'none',
                                                                    boxSizing: 'border-box',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.sm, marginTop: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={handleSubmitCreateFeature}
                                                        disabled={creatingFeature || !createTitle.trim()}
                                                        style={{
                                                            padding: '6px 16px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: creatingFeature || !createTitle.trim()
                                                                ? 'var(--vscode-button-secondaryBackground, var(--vscode-panel-border))'
                                                                : 'var(--vscode-button-background)',
                                                            color: 'var(--vscode-button-foreground)',
                                                            cursor: creatingFeature ? 'default' : 'pointer',
                                                            fontSize: '0.8em',
                                                            fontWeight: 600,
                                                            opacity: creatingFeature ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {creatingFeature ? '⏳ Creating...' : '✨ Create Feature & Start Spec'}
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {/* PROMPT step */}
                                        {wizardStep === 'prompt' && (
                                            <>
                                                <div style={{ fontSize: '0.85em', fontWeight: 600, opacity: 0.8 }}>
                                                    Describe your feature
                                                </div>
                                                <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}>
                                                    <textarea
                                                        value={wizardPrompt}
                                                        onChange={(e) => setWizardPrompt(e.target.value)}
                                                        placeholder="e.g. Add a dark mode toggle that persists user preference across sessions..."
                                                        style={{
                                                            flex: 1,
                                                            minHeight: '120px',
                                                            fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                                            fontSize: 'var(--vscode-editor-font-size, 12px)',
                                                            lineHeight: 1.5,
                                                            padding: SPACE.sm,
                                                            border: '1px solid var(--vscode-panel-border)',
                                                            borderRadius: '4px',
                                                            background: 'var(--vscode-input-background)',
                                                            color: 'var(--vscode-input-foreground)',
                                                            resize: 'vertical',
                                                            outline: 'none',
                                                        }}
                                                    />
                                                    {/* Top-right AI action buttons */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        display: 'flex',
                                                        gap: '2px',
                                                    }}>
                                                        <button
                                                            type="button"
                                                            title="Generate prompt from feature title"
                                                            onClick={() => {
                                                                const target = wizardTargetFeature || selectedFeature;
                                                                if (!target?.title || promptGenerating) return;
                                                                setPromptGenerating(true);
                                                                vscode.postMessage?.({
                                                                    type: 'generateFeatureDescription',
                                                                    target: 'wizardPrompt',
                                                                    title: target.title,
                                                                });
                                                            }}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                padding: 0,
                                                                border: 'none',
                                                                borderRadius: '3px',
                                                                background: promptGenerating
                                                                    ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))'
                                                                    : 'var(--vscode-button-background)',
                                                                color: 'var(--vscode-button-foreground)',
                                                                cursor: promptGenerating ? 'default' : 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: promptGenerating ? 0.5 : 0.7,
                                                                transition: 'opacity 0.15s ease',
                                                            }}
                                                            onMouseEnter={(e) => { if (!promptGenerating) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
                                                                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Refine prompt with AI"
                                                            disabled={!wizardPrompt.trim() || promptGenerating}
                                                            onClick={() => {
                                                                if (!wizardPrompt.trim() || promptGenerating) return;
                                                                setPromptGenerating(true);
                                                                vscode.postMessage?.({
                                                                    type: 'generateFeatureDescription',
                                                                    target: 'wizardPrompt',
                                                                    mode: 'refine',
                                                                    title: (wizardTargetFeature || selectedFeature)?.title || '',
                                                                    currentDescription: wizardPrompt.trim(),
                                                                });
                                                            }}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                padding: 0,
                                                                border: 'none',
                                                                borderRadius: '3px',
                                                                background: !wizardPrompt.trim() || promptGenerating
                                                                    ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))'
                                                                    : 'var(--vscode-button-background)',
                                                                color: 'var(--vscode-button-foreground)',
                                                                cursor: !wizardPrompt.trim() || promptGenerating ? 'default' : 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: !wizardPrompt.trim() || promptGenerating ? 0.3 : 0.7,
                                                                transition: 'opacity 0.15s ease',
                                                            }}
                                                            onMouseEnter={(e) => { if (wizardPrompt.trim() && !promptGenerating) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.sm }}>
                                                    <button
                                                        type="button"
                                                        onClick={handleWizardGenerate}
                                                        disabled={wizardGenerating || !wizardPrompt.trim()}
                                                        style={{
                                                            padding: '6px 16px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: wizardGenerating || !wizardPrompt.trim()
                                                                ? 'var(--vscode-button-secondaryBackground, var(--vscode-panel-border))'
                                                                : 'var(--vscode-button-background)',
                                                            color: 'var(--vscode-button-foreground)',
                                                            cursor: wizardGenerating ? 'default' : 'pointer',
                                                            fontSize: '0.8em',
                                                            fontWeight: 600,
                                                            opacity: wizardGenerating ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {wizardGenerating ? '⏳ Generating...' : '🚀 Generate Requirements'}
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {/* REVIEW steps */}
                                        {(wizardStep === 'review_requirements' || wizardStep === 'review_design' || wizardStep === 'review_tasks') && (
                                            <>
                                                <div style={{
                                                    fontSize: '0.75em',
                                                    fontWeight: 600,
                                                    opacity: 0.6,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '1px',
                                                }}>
                                                    {wizardStep === 'review_requirements' ? 'Requirements' :
                                                     wizardStep === 'review_design' ? 'Design' : 'Tasks'} — AI Draft
                                                </div>

                                                {wizardGenerating ? (
                                                    <div style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        opacity: 0.5,
                                                        fontStyle: 'italic',
                                                        fontSize: '0.9em',
                                                    }}>
                                                        Generating...
                                                    </div>
                                                ) : wizardDraftError ? (
                                                    <div style={{
                                                        padding: SPACE.md,
                                                        background: 'var(--vscode-inputValidation-errorBackground, rgba(193,74,74,0.1))',
                                                        border: '1px solid var(--vscode-inputValidation-errorBorder, #c14a4a)',
                                                        borderRadius: '6px',
                                                        color: 'var(--vscode-inputValidation-errorForeground, #c14a4a)',
                                                        fontSize: '0.85em',
                                                    }}>
                                                        {wizardDraftError}
                                                    </div>
                                                ) : wizardDraftContent ? (
                                                    <div style={{
                                                        flex: 1,
                                                        overflow: 'auto',
                                                        fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                                        fontSize: 'var(--vscode-editor-font-size, 12px)',
                                                        lineHeight: 1.5,
                                                        padding: SPACE.sm,
                                                        border: '1px solid var(--vscode-panel-border)',
                                                        borderRadius: '4px',
                                                        background: 'var(--vscode-editor-background)',
                                                        color: 'var(--vscode-editor-foreground)',
                                                        whiteSpace: 'pre-wrap',
                                                    }}>
                                                        {wizardDraftContent}
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        opacity: 0.4,
                                                        fontStyle: 'italic',
                                                    }}>
                                                        Click "Generate" to create this section
                                                    </div>
                                                )}

                                                {wizardDraftContent && !wizardGenerating && (
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                        gap: SPACE.sm,
                                                        flexShrink: 0,
                                                    }}>
                                                        <button
                                                            type="button"
                                                            onClick={handleWizardRegenerate}
                                                            style={{
                                                                padding: '6px 14px',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--vscode-panel-border)',
                                                                background: 'transparent',
                                                                color: 'var(--vscode-foreground)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75em',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            🔄 Regenerate
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleWizardApprove}
                                                            style={{
                                                                padding: '6px 14px',
                                                                borderRadius: '6px',
                                                                border: 'none',
                                                                background: 'var(--vscode-button-background)',
                                                                color: 'var(--vscode-button-foreground)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75em',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            ✓ Approve
                                                            {wizardStep === 'review_requirements' ? ' & Next → Design' :
                                                             wizardStep === 'review_design' ? ' & Next → Tasks' :
                                                             ' & Finish'}
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* COMPLETE step */}
                                        {wizardStep === 'complete' && (
                                            <div style={{
                                                flex: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: SPACE.md,
                                                textAlign: 'center',
                                            }}>
                                                <div style={{
                                                    fontSize: '2em',
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '50%',
                                                    background: 'rgba(42, 161, 152, 0.15)',
                                                    color: '#2aa198',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    ✓
                                                </div>
                                                <div style={{ fontSize: '1em', fontWeight: 600 }}>
                                                    Spec Complete!
                                                </div>
                                                <div style={{ fontSize: '0.85em', opacity: 0.6 }}>
                                                    All three spec files have been created for <strong>{(wizardTargetFeature || selectedFeature)?.title}</strong>.
                                                    Review them in the tabs above or open in the editor.
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleCloseWizard}
                                                    style={{
                                                        padding: '8px 20px',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        background: 'var(--vscode-button-background)',
                                                        color: 'var(--vscode-button-foreground)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85em',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    View in Specs Manager
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : selectedFeature ? (
                                /* ===== Feature header + tabs ===== */
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
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                title="Delete this feature"
                                                onClick={() => handleDeleteFeature(selectedFeature)}
                                                style={{
                                                    width: '22px',
                                                    height: '22px',
                                                    padding: 0,
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    background: 'transparent',
                                                    color: 'var(--vscode-errorForeground, #e86f4a)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: 0.5,
                                                    transition: 'opacity 0.15s ease',
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
                                                <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}>
                                                    <textarea
                                                        value={editState.content}
                                                        onChange={(e) => handleEditContentChange(e.target.value)}
                                                        style={{
                                                            flex: 1,
                                                            fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                                            fontSize: 'var(--vscode-editor-font-size, 12px)',
                                                            lineHeight: 1.5,
                                                            padding: SPACE.md,
                                                            paddingRight: '28px', /* room for AI buttons */
                                                            border: 'none',
                                                            resize: 'none',
                                                            background: 'var(--vscode-editor-background)',
                                                            color: 'var(--vscode-editor-foreground)',
                                                            outline: 'none',
                                                        }}
                                                    />
                                                    {/* Top-right AI action buttons for edit textarea */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        display: 'flex',
                                                        gap: '2px',
                                                    }}>
                                                        <button
                                                            type="button"
                                                            title="Generate content with AI"
                                                            onClick={() => {
                                                                if (!selectedFeature || editGenerating) return;
                                                                setAiLoading(true);
                                                                setSaveResult(null);
                                                                vscode.postMessage?.({
                                                                    type: 'generateWithAI',
                                                                    featureName: selectedFeature.name,
                                                                    file: activeTab,
                                                                });
                                                            }}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                padding: 0,
                                                                border: 'none',
                                                                borderRadius: '3px',
                                                                background: editGenerating
                                                                    ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))'
                                                                    : 'var(--vscode-button-background)',
                                                                color: 'var(--vscode-button-foreground)',
                                                                cursor: editGenerating ? 'default' : 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: editGenerating ? 0.5 : 0.7,
                                                                transition: 'opacity 0.15s ease',
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
                                                                vscode.postMessage?.({
                                                                    type: 'generateFeatureDescription',
                                                                    target: 'editContent',
                                                                    mode: 'refine',
                                                                    title: selectedFeature?.title || '',
                                                                    currentDescription: editState.content.trim(),
                                                                });
                                                            }}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                padding: 0,
                                                                border: 'none',
                                                                borderRadius: '3px',
                                                                background: !editState.content.trim() || editGenerating
                                                                    ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))'
                                                                    : 'var(--vscode-button-background)',
                                                                color: 'var(--vscode-button-foreground)',
                                                                cursor: !editState.content.trim() || editGenerating ? 'default' : 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: !editState.content.trim() || editGenerating ? 0.3 : 0.7,
                                                                transition: 'opacity 0.15s ease',
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
                                                    {!activeContent?.exists && (
                                                        <button
                                                            type="button"
                                                            onClick={handleCreateFromTemplate}
                                                            style={{
                                                                padding: '4px 10px',
                                                                borderRadius: '4px',
                                                                border: '1px solid var(--vscode-button-border)',
                                                                background: 'var(--vscode-button-background)',
                                                                color: 'var(--vscode-button-foreground)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.72em',
                                                                fontWeight: 600,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                            }}
                                                        >
                                                            ✨ Create from Template
                                                        </button>
                                                    )}
                                                    {activeContent?.exists && (
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
                                                    )}
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
                            ) : (
                                /* ===== Empty state — no feature selected ===== */
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '16px',
                                    opacity: 0.7,
                                    fontSize: '0.9em',
                                }}>
                                    <div style={{ fontStyle: 'italic' }}>
                                        No feature selected
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setWizardOpen(true);
                                            setWizardStep('create_feature');
                                            setCreateTitle('');
                                            setCreateDescription('');
                                            setCreatePriority('P2');
                                            setCreateSprint('Next');
                                            setWizardPrompt('');
                                            setWizardDraftContent('');
                                            setWizardDraftError(null);
                                            setWizardContext('');
                                            setWizardGenerating(false);
                                        }}
                                        style={{
                                            padding: '8px 20px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            background: 'var(--vscode-button-background)',
                                            color: 'var(--vscode-button-foreground)',
                                            cursor: 'pointer',
                                            fontSize: '0.85em',
                                            fontWeight: 600,
                                        }}
                                    >
                                        Create New Feature
                                    </button>
                                </div>
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
