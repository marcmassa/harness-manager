import * as React from 'react';
import { SPACE } from './styles.js';
import type { FeatureEntry } from './FeatureList.js';

type SpecFile = 'requirements' | 'design' | 'tasks';
type WizardStep = 'create_feature' | 'prompt' | 'review_requirements' | 'review_design' | 'review_tasks' | 'complete';
type VscodeApi = { postMessage?: (msg: unknown) => void };

const STEP_LABELS: Record<WizardStep, string> = {
    create_feature: '0. Create',
    prompt: '1. Prompt',
    review_requirements: '2. Requirements',
    review_design: '3. Design',
    review_tasks: '4. Tasks',
    complete: 'Done',
};

const WIZARD_FILE_MAP: Record<WizardStep, SpecFile | null> = {
    create_feature: null, prompt: null,
    review_requirements: 'requirements', review_design: 'design', review_tasks: 'tasks',
    complete: null,
};

const STEP_ORDER: WizardStep[] = ['create_feature', 'prompt', 'review_requirements', 'review_design', 'review_tasks'];

const NEXT_STEP: Record<WizardStep, WizardStep> = {
    create_feature: 'prompt', prompt: 'review_requirements',
    review_requirements: 'review_design', review_design: 'review_tasks',
    review_tasks: 'complete', complete: 'complete',
};

export interface SpecWizardProps {
    vscode: VscodeApi;
    selectedFeature: FeatureEntry | null;
    onClose: () => void;
}

export const SpecWizard = ({ vscode, selectedFeature, onClose }: SpecWizardProps) => {
    const [wizardStep, setWizardStep] = React.useState<WizardStep>('create_feature');
    const [wizardTargetFeature, setWizardTargetFeature] = React.useState<FeatureEntry | null>(null);
    const [wizardPrompt, setWizardPrompt] = React.useState('');
    const [wizardGenerating, setWizardGenerating] = React.useState(false);
    const [wizardDraftContent, setWizardDraftContent] = React.useState('');
    const [wizardDraftError, setWizardDraftError] = React.useState<string | null>(null);
    const [wizardContext, setWizardContext] = React.useState('');
    const [createTitle, setCreateTitle] = React.useState('');
    const [createDescription, setCreateDescription] = React.useState('');
    const [createPriority, setCreatePriority] = React.useState('P2');
    const [createSprint, setCreateSprint] = React.useState('Next');
    const [creatingFeature, setCreatingFeature] = React.useState(false);
    const [descriptionGenerating, setDescriptionGenerating] = React.useState(false);
    const [promptGenerating, setPromptGenerating] = React.useState(false);

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const msg = event.data;
            switch (msg.type) {
                case 'featureCreated': {
                    const newFeat: FeatureEntry = msg.feature;
                    setCreatingFeature(false);
                    setWizardTargetFeature(newFeat);
                    setWizardStep('prompt');
                    setWizardPrompt('');
                    setWizardDraftContent('');
                    setWizardDraftError(null);
                    setWizardContext('');
                    setWizardGenerating(false);
                    break;
                }
                case 'specDraftResult':
                    setWizardGenerating(false);
                    if (msg.ok && msg.text) {
                        setWizardDraftContent(msg.text);
                        setWizardDraftError(null);
                    } else {
                        setWizardDraftContent('');
                        setWizardDraftError(msg.error || 'AI generation failed');
                    }
                    break;
                case 'featureDescriptionResult': {
                    const target = msg.target || 'createDescription';
                    if (target === 'createDescription') {
                        setDescriptionGenerating(false);
                        if (msg.ok && msg.text) setCreateDescription(msg.text);
                    } else if (target === 'wizardPrompt') {
                        setPromptGenerating(false);
                        if (msg.ok && msg.text) setWizardPrompt(msg.text);
                    }
                    break;
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const activeTarget = wizardTargetFeature || selectedFeature;

    function handleSubmitCreateFeature(): void {
        if (!createTitle.trim()) return;
        setCreatingFeature(true);
        vscode.postMessage?.({ type: 'createFeature', title: createTitle.trim(), description: createDescription.trim(), priority: createPriority, sprint: createSprint });
    }

    function handleWizardGenerate(): void {
        if (!activeTarget || !wizardPrompt.trim()) return;
        const file = WIZARD_FILE_MAP[wizardStep];
        if (!file) return;
        setWizardGenerating(true);
        setWizardDraftContent('');
        setWizardDraftError(null);
        vscode.postMessage?.({ type: 'generateSpecDraft', featureName: activeTarget.name, file, userPrompt: wizardPrompt.trim(), contextContent: wizardContext || undefined });
    }

    function handleWizardApprove(): void {
        if (!activeTarget) return;
        const newContext = wizardContext + '\n\n' + wizardDraftContent;
        setWizardContext(newContext);
        const next = NEXT_STEP[wizardStep];
        if (next === 'complete') {
            setWizardStep('complete');
            setWizardDraftContent('');
            setWizardDraftError(null);
            return;
        }
        setWizardStep(next);
        setWizardDraftContent('');
        setWizardDraftError(null);
        const nextFile = WIZARD_FILE_MAP[next];
        if (nextFile) {
            setWizardGenerating(true);
            vscode.postMessage?.({ type: 'generateSpecDraft', featureName: activeTarget.name, file: nextFile, userPrompt: wizardPrompt.trim(), contextContent: newContext || undefined });
        }
    }

    const stepStatus = (step: WizardStep): 'active' | 'done' | 'pending' => {
        if (wizardStep === step) return 'active';
        if (wizardStep === 'complete' || STEP_ORDER.indexOf(wizardStep) > STEP_ORDER.indexOf(step)) return 'done';
        return 'pending';
    };

    const aiButtonStyle = (disabled: boolean): React.CSSProperties => ({
        width: '20px', height: '20px', padding: 0, border: 'none', borderRadius: '3px',
        background: disabled ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))' : 'var(--vscode-button-background)',
        color: 'var(--vscode-button-foreground)', cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : 0.7, transition: 'opacity 0.15s ease',
    });

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: '4px', padding: `${SPACE.sm} ${SPACE.md}`, borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0, fontSize: '0.65em', fontWeight: 600, letterSpacing: '0.5px' }}>
                {STEP_ORDER.map((step, i) => {
                    const status = stepStatus(step);
                    return (
                        <div key={step} style={{
                            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px',
                            background: status === 'active' ? 'var(--vscode-button-background)' : 'transparent',
                            color: status === 'active' ? 'var(--vscode-button-foreground)' : status === 'done' ? 'var(--vscode-textLink-foreground)' : 'var(--vscode-disabledForeground)',
                            opacity: status === 'pending' ? 0.4 : 1,
                        }}>
                            {status === 'done' ? '✓' : status === 'active' ? '▸' : '○'}&nbsp;{STEP_LABELS[step]}
                        </div>
                    );
                })}
            </div>

            {/* Wizard body */}
            <div style={{ flex: 1, overflow: 'auto', padding: SPACE.md, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                {/* CREATE FEATURE step */}
                {wizardStep === 'create_feature' && (
                    <>
                        <div style={{ fontSize: '0.85em', fontWeight: 600, opacity: 0.8 }}>Create a new feature</div>
                        <div style={{ fontSize: '0.75em', opacity: 0.6, marginBottom: '8px' }}>
                            Fill in the details to create a new feature in <code>feature_list.json</code>. After creation, you'll write the spec with AI assistance.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.7, display: 'block', marginBottom: '4px' }}>Title *</label>
                                <input
                                    type="text"
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    placeholder="e.g. Dark Mode Toggle"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', fontSize: '0.85em', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.7, display: 'block', marginBottom: '4px' }}>Description</label>
                                <div style={{ position: 'relative' }}>
                                    <textarea
                                        value={createDescription}
                                        onChange={(e) => setCreateDescription(e.target.value)}
                                        placeholder="Briefly describe what this feature does..."
                                        rows={3}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', fontSize: '0.85em', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                    />
                                    <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '2px' }}>
                                        <button type="button" title="Auto-generate description from title"
                                            onClick={() => {
                                                if (!createTitle.trim() || descriptionGenerating) return;
                                                setDescriptionGenerating(true);
                                                vscode.postMessage?.({ type: 'generateFeatureDescription', title: createTitle.trim() });
                                            }}
                                            style={aiButtonStyle(descriptionGenerating || !createTitle.trim())}
                                            onMouseEnter={(e) => { if (!descriptionGenerating && createTitle.trim()) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
                                                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                                            </svg>
                                        </button>
                                        <button type="button" title="Refine description with AI"
                                            disabled={!createDescription.trim() || descriptionGenerating}
                                            onClick={() => {
                                                if (!createDescription.trim() || descriptionGenerating) return;
                                                setDescriptionGenerating(true);
                                                vscode.postMessage?.({ type: 'generateFeatureDescription', mode: 'refine', title: createTitle.trim(), currentDescription: createDescription.trim() });
                                            }}
                                            style={{ ...aiButtonStyle(!createDescription.trim() || descriptionGenerating), opacity: !createDescription.trim() || descriptionGenerating ? 0.3 : 0.7 }}
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
                                    <label style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.7, display: 'block', marginBottom: '4px' }}>Priority</label>
                                    <select value={createPriority} onChange={(e) => setCreatePriority(e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-dropdown-background)', color: 'var(--vscode-dropdown-foreground)', fontSize: '0.85em', outline: 'none', cursor: 'pointer' }}>
                                        <option value="P0">P0 — Critical</option>
                                        <option value="P1">P1 — High</option>
                                        <option value="P2">P2 — Normal</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.7, display: 'block', marginBottom: '4px' }}>Sprint</label>
                                    <input type="text" value={createSprint} onChange={(e) => setCreateSprint(e.target.value)} placeholder="e.g. Sprint 3"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', fontSize: '0.85em', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.sm, marginTop: '8px' }}>
                            <button type="button" onClick={handleSubmitCreateFeature}
                                disabled={creatingFeature || !createTitle.trim()}
                                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: creatingFeature || !createTitle.trim() ? 'var(--vscode-button-secondaryBackground, var(--vscode-panel-border))' : 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', cursor: creatingFeature ? 'default' : 'pointer', fontSize: '0.8em', fontWeight: 600, opacity: creatingFeature ? 0.6 : 1 }}>
                                {creatingFeature ? '⏳ Creating...' : '✨ Create Feature & Start Spec'}
                            </button>
                        </div>
                    </>
                )}

                {/* PROMPT step */}
                {wizardStep === 'prompt' && (
                    <>
                        <div style={{ fontSize: '0.85em', fontWeight: 600, opacity: 0.8 }}>Describe your feature</div>
                        <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}>
                            <textarea
                                value={wizardPrompt}
                                onChange={(e) => setWizardPrompt(e.target.value)}
                                placeholder="e.g. Add a dark mode toggle that persists user preference across sessions..."
                                style={{ flex: 1, minHeight: '120px', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 'var(--vscode-editor-font-size, 12px)', lineHeight: 1.5, padding: SPACE.sm, border: '1px solid var(--vscode-panel-border)', borderRadius: '4px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', resize: 'vertical', outline: 'none' }}
                            />
                            <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '2px' }}>
                                <button type="button" title="Generate prompt from feature title"
                                    onClick={() => {
                                        if (!activeTarget?.title || promptGenerating) return;
                                        setPromptGenerating(true);
                                        vscode.postMessage?.({ type: 'generateFeatureDescription', target: 'wizardPrompt', title: activeTarget.title });
                                    }}
                                    style={aiButtonStyle(promptGenerating)}
                                    onMouseEnter={(e) => { if (!promptGenerating) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
                                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                                    </svg>
                                </button>
                                <button type="button" title="Refine prompt with AI"
                                    disabled={!wizardPrompt.trim() || promptGenerating}
                                    onClick={() => {
                                        if (!wizardPrompt.trim() || promptGenerating) return;
                                        setPromptGenerating(true);
                                        vscode.postMessage?.({ type: 'generateFeatureDescription', target: 'wizardPrompt', mode: 'refine', title: activeTarget?.title || '', currentDescription: wizardPrompt.trim() });
                                    }}
                                    style={{ ...aiButtonStyle(!wizardPrompt.trim() || promptGenerating), opacity: !wizardPrompt.trim() || promptGenerating ? 0.3 : 0.7 }}
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
                            <button type="button" onClick={handleWizardGenerate}
                                disabled={wizardGenerating || !wizardPrompt.trim()}
                                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: wizardGenerating || !wizardPrompt.trim() ? 'var(--vscode-button-secondaryBackground, var(--vscode-panel-border))' : 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', cursor: wizardGenerating ? 'default' : 'pointer', fontSize: '0.8em', fontWeight: 600, opacity: wizardGenerating ? 0.6 : 1 }}>
                                {wizardGenerating ? '⏳ Generating...' : '🚀 Generate Requirements'}
                            </button>
                        </div>
                    </>
                )}

                {/* REVIEW steps */}
                {(wizardStep === 'review_requirements' || wizardStep === 'review_design' || wizardStep === 'review_tasks') && (
                    <>
                        <div style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {wizardStep === 'review_requirements' ? 'Requirements' : wizardStep === 'review_design' ? 'Design' : 'Tasks'} — AI Draft
                        </div>
                        {wizardGenerating ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, fontStyle: 'italic', fontSize: '0.9em' }}>
                                Generating...
                            </div>
                        ) : wizardDraftError ? (
                            <div style={{ padding: SPACE.md, background: 'var(--vscode-inputValidation-errorBackground, rgba(193,74,74,0.1))', border: '1px solid var(--vscode-inputValidation-errorBorder, #c14a4a)', borderRadius: '6px', color: 'var(--vscode-inputValidation-errorForeground, #c14a4a)', fontSize: '0.85em' }}>
                                {wizardDraftError}
                            </div>
                        ) : wizardDraftContent ? (
                            <div style={{ flex: 1, overflow: 'auto', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 'var(--vscode-editor-font-size, 12px)', lineHeight: 1.5, padding: SPACE.sm, border: '1px solid var(--vscode-panel-border)', borderRadius: '4px', background: 'var(--vscode-editor-background)', color: 'var(--vscode-editor-foreground)', whiteSpace: 'pre-wrap' }}>
                                {wizardDraftContent}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, fontStyle: 'italic' }}>
                                Click "Generate" to create this section
                            </div>
                        )}
                        {wizardDraftContent && !wizardGenerating && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.sm, flexShrink: 0 }}>
                                <button type="button" onClick={handleWizardGenerate}
                                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--vscode-panel-border)', background: 'transparent', color: 'var(--vscode-foreground)', cursor: 'pointer', fontSize: '0.75em', fontWeight: 600 }}>
                                    🔄 Regenerate
                                </button>
                                <button type="button" onClick={handleWizardApprove}
                                    style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', cursor: 'pointer', fontSize: '0.75em', fontWeight: 600 }}>
                                    ✓ Approve{wizardStep === 'review_requirements' ? ' & Next → Design' : wizardStep === 'review_design' ? ' & Next → Tasks' : ' & Finish'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* COMPLETE step */}
                {wizardStep === 'complete' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SPACE.md, textAlign: 'center' }}>
                        <div style={{ fontSize: '2em', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(42, 161, 152, 0.15)', color: '#2aa198', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✓
                        </div>
                        <div style={{ fontSize: '1em', fontWeight: 600 }}>Spec Complete!</div>
                        <div style={{ fontSize: '0.85em', opacity: 0.6 }}>
                            All three spec files have been created for <strong>{activeTarget?.title}</strong>. Review them in the tabs above or open in the editor.
                        </div>
                        <button type="button" onClick={onClose}
                            style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', cursor: 'pointer', fontSize: '0.85em', fontWeight: 600 }}>
                            View in Specs Manager
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
