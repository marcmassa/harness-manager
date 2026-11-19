// SpecWizard step bodies: create-feature form, AI draft review, completion
// (FEAT-048 split; JSX moved verbatim from SpecWizard.tsx).
import * as React from 'react';
import { SPACE } from './styles.js';
import type { FeatureEntry } from './FeatureList.js';

export type WizardStep = 'create_feature' | 'prompt' | 'review_requirements' | 'review_design' | 'review_tasks' | 'complete';
type VscodeApi = { postMessage?: (msg: unknown) => void };

export const aiButtonStyle = (disabled: boolean): React.CSSProperties => ({
    width: '20px', height: '20px', padding: 0, border: 'none', borderRadius: '3px',
    background: disabled ? 'var(--vscode-button-secondaryBackground, rgba(128,128,128,0.3))' : 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)', cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.5 : 0.7, transition: 'opacity 0.15s ease',
});

interface CreateFeatureStepProps {
    vscode: VscodeApi;
    createTitle: string; setCreateTitle: (v: string) => void;
    createDescription: string; setCreateDescription: (v: string) => void;
    createPriority: string; setCreatePriority: (v: string) => void;
    createSprint: string; setCreateSprint: (v: string) => void;
    creatingFeature: boolean;
    descriptionGenerating: boolean; setDescriptionGenerating: (v: boolean) => void;
    handleSubmitCreateFeature: () => void;
}

export function CreateFeatureStep({
    vscode, createTitle, setCreateTitle, createDescription, setCreateDescription,
    createPriority, setCreatePriority, createSprint, setCreateSprint,
    creatingFeature, descriptionGenerating, setDescriptionGenerating, handleSubmitCreateFeature,
}: CreateFeatureStepProps) {
    return (
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
    );
}

interface ReviewStepProps {
    wizardStep: WizardStep;
    wizardGenerating: boolean;
    wizardDraftError: string | null;
    wizardDraftContent: string;
    handleWizardGenerate: () => void;
    handleWizardApprove: () => void;
}

export function ReviewStep({ wizardStep, wizardGenerating, wizardDraftError, wizardDraftContent, handleWizardGenerate, handleWizardApprove }: ReviewStepProps) {
    return (
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
    );
}

export function CompleteStep({ activeTarget, onClose }: { activeTarget: FeatureEntry | null; onClose: () => void }) {
    return (
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
    );
}
