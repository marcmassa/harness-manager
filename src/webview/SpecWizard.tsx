import * as React from 'react';
import { SPACE } from './styles.js';
import type { FeatureEntry } from './FeatureList.js';
import { AiIconButton } from './components/AiIconButton.js';
import { CreateFeatureStep, ReviewStep, CompleteStep, type WizardStep } from './SpecWizardSteps.js';

type SpecFile = 'requirements' | 'design' | 'tasks';
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
                    <CreateFeatureStep
                        vscode={vscode}
                        createTitle={createTitle} setCreateTitle={setCreateTitle}
                        createDescription={createDescription} setCreateDescription={setCreateDescription}
                        createPriority={createPriority} setCreatePriority={setCreatePriority}
                        createSprint={createSprint} setCreateSprint={setCreateSprint}
                        creatingFeature={creatingFeature}
                        descriptionGenerating={descriptionGenerating} setDescriptionGenerating={setDescriptionGenerating}
                        handleSubmitCreateFeature={handleSubmitCreateFeature}
                    />
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
                                <AiIconButton kind="generate" title="Generate prompt from feature title" disabled={promptGenerating}
                                    onClick={() => {
                                        if (!activeTarget?.title || promptGenerating) return;
                                        setPromptGenerating(true);
                                        vscode.postMessage?.({ type: 'generateFeatureDescription', target: 'wizardPrompt', title: activeTarget.title });
                                    }}
                                />
                                <AiIconButton kind="refine" title="Refine prompt with AI" disabled={!wizardPrompt.trim() || promptGenerating}
                                    onClick={() => {
                                        if (!wizardPrompt.trim() || promptGenerating) return;
                                        setPromptGenerating(true);
                                        vscode.postMessage?.({ type: 'generateFeatureDescription', target: 'wizardPrompt', mode: 'refine', title: activeTarget?.title || '', currentDescription: wizardPrompt.trim() });
                                    }}
                                />
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
                    <ReviewStep
                        wizardStep={wizardStep}
                        wizardGenerating={wizardGenerating}
                        wizardDraftError={wizardDraftError}
                        wizardDraftContent={wizardDraftContent}
                        handleWizardGenerate={handleWizardGenerate}
                        handleWizardApprove={handleWizardApprove}
                    />
                )}

                {/* COMPLETE step */}
                {wizardStep === 'complete' && (
                    <CompleteStep activeTarget={activeTarget} onClose={onClose} />
                )}
            </div>
        </div>
    );
};
