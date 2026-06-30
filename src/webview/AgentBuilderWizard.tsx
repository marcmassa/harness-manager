// FEAT-033 Phase 2 — Agent Builder Wizard (R17–R21) + unified entity creation
import * as React from 'react';

export type WizardNodeType = 'subagent' | 'agent' | 'skill' | 'steering' | 'hook' | 'feature-spec';

export interface AgentBuilderWizardProps {
    existingNodeIds: string[];
    existingSkills: Array<{ id: string; name: string }>;
    onClose: () => void;
    onCreated: () => void;
    onGenerateSpec: () => void;
    pendingAiCapabilities: string[] | null;
    onClearAiCapabilities: () => void;
    lmModels: Array<{ family: string; name: string; vendor: string }>;
    /** Pre-selects a node type when the wizard opens. */
    initialType?: WizardNodeType;
}

// Steps by type:
// agent/subagent: 0(Type+Name) → 1(Role+Caps) → 2(Connections) → 3(Preview)
// skill:          0 → 1(Role+Extras) → 3(Preview)
// steering:       0 → 1(Content+AppliesTo) → [Create directly]
// hook:           0 → 1(Trigger+Script)    → [Create directly]
// feature-spec:   0 → immediate onGenerateSpec

function buildAgentPreview(name: string, displayName: string, nodeType: WizardNodeType, role: string, capabilities: string[]): string {
    const caps = capabilities.length > 0 ? capabilities.map(c => `- ${c}`).join('\n') : '- ';
    return `---
name: ${name}
type: ${nodeType}
mode: subagent
description: ${role}
---

# ${displayName || name}

${role}

## Capabilities

${caps}

## Instructions

You are ${name}. Your role is to...

## Output Format

Return results as...`;
}

function buildSkillPreview(name: string, role: string): string {
    return `name\n\n${name}\n\ndescription\n\n${role}\n\n# ${name}\n\n## Philosophy\n\n${role}\n\nThe goal is to [state the single clear outcome this skill produces].\n\n## When to use this skill\n\n- Use when you need to [primary trigger]\n- **Do NOT use** when [counter-indication]\n\n## Phases\n\n### Phase 1: Understand the context\n\n1. Read the relevant files and understand the current state\n2. Identify the specific goal and any constraints\n\n**Completion criteria:** You can state in one sentence what needs to happen and why.\n\n### Phase 2: Execute\n\n1. [Step 1 — concrete action]\n2. [Step 2 — concrete action]\n\n**Completion criteria:** [What must be true before moving on]\n\n## Anti-patterns\n\n- **DO NOT** skip Phase 1 — acting on assumptions causes rework\n\n## Checklist\n\n- [ ] Phase 1 complete — goal clearly stated\n- [ ] Phase 2 complete — execution done`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const AgentBuilderWizard = ({
    existingNodeIds,
    existingSkills,
    onClose,
    onCreated,
    onGenerateSpec,
    pendingAiCapabilities,
    onClearAiCapabilities,
    lmModels,
    initialType,
}: AgentBuilderWizardProps) => {
    const [advancedMode, setAdvancedMode] = React.useState(false);
    const [step, setStep] = React.useState(0);
    const [nodeType, setNodeType] = React.useState<WizardNodeType>(initialType ?? 'subagent');

    // Common fields
    const [name, setName] = React.useState('');
    const [displayName, setDisplayName] = React.useState('');

    // Agent/subagent fields
    const [role, setRole] = React.useState('');
    const [capabilities, setCapabilities] = React.useState<string[]>([]);
    const [capInput, setCapInput] = React.useState('');
    const [connectSkillIds, setConnectSkillIds] = React.useState<string[]>([]);
    const [permissionPreset, setPermissionPreset] = React.useState<'read-only' | 'read-write'>('read-only');
    const [previewContent, setPreviewContent] = React.useState('');

    // Skill-specific
    const [skillDescription, setSkillDescription] = React.useState('');
    const [license, setLicense] = React.useState('');
    const [compatibility, setCompatibility] = React.useState('');

    // Steering-specific
    const [steeringContent, setSteeringContent] = React.useState('');
    const [steeringAppliesTo, setSteeringAppliesTo] = React.useState('*');

    // Hook-specific
    const [hookTrigger, setHookTrigger] = React.useState('');
    const [hookScript, setHookScript] = React.useState('');

    // AI generation
    const [aiLoading, setAiLoading] = React.useState(false);
    const [selectedModelFamily, setSelectedModelFamily] = React.useState('');
    const aiTimeoutRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);

    // Validation
    const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

    const vscode = (window as any).__harness_vscode_api;

    // Consume AI capabilities
    React.useEffect(() => {
        if (pendingAiCapabilities !== null && aiLoading) {
            setCapabilities(pendingAiCapabilities);
            setAiLoading(false);
            onClearAiCapabilities();
            if (aiTimeoutRef.current !== null) {
                window.clearTimeout(aiTimeoutRef.current);
                aiTimeoutRef.current = null;
            }
        }
    }, [pendingAiCapabilities, aiLoading, onClearAiCapabilities]);

    // Build preview when entering preview step (guided) or when requested (advanced)
    const refreshPreview = React.useCallback(() => {
        if (nodeType === 'skill') {
            setPreviewContent(buildSkillPreview(name, skillDescription));
        } else {
            setPreviewContent(buildAgentPreview(name, displayName, nodeType, role, capabilities));
        }
    }, [name, displayName, nodeType, role, capabilities, skillDescription]);

    React.useEffect(() => {
        if (step === 3) refreshPreview();
    }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset step when switching to guided mode (go back to step 0)
    const handleToggleMode = () => {
        setFieldErrors({});
        if (advancedMode) {
            setStep(0);
        }
        setAdvancedMode(v => !v);
    };

    // ── Step computation (guided) ────────────────────────────────────────────
    const hasConnectionsStep = nodeType === 'agent' || nodeType === 'subagent';
    const hasPreviewStep = nodeType !== 'steering' && nodeType !== 'hook' && nodeType !== 'feature-spec';
    const maxSteps = nodeType === 'steering' || nodeType === 'hook' ? 2
        : nodeType === 'skill' ? 3
        : 4;

    const STEP_LABELS: string[] = nodeType === 'steering'
        ? ['Type & Name', 'Content & Rules']
        : nodeType === 'hook'
        ? ['Type & Name', 'Trigger & Script']
        : nodeType === 'skill'
        ? ['Type & Name', 'Role & Details', 'Preview']
        : ['Type & Name', 'Role & Capabilities', 'Connections', 'Preview'];

    const isLastStep = step === maxSteps - 1;

    // ── Validation ──────────────────────────────────────────────────────────
    const validateCommon = (errs: Record<string, string>) => {
        if (nodeType === 'feature-spec') return;
        if (!name.trim()) { errs.name = 'Name is required'; return; }
        if (!/^[a-z0-9-]+$/.test(name)) { errs.name = 'Use lowercase letters, digits and hyphens only'; return; }
        if (existingNodeIds.includes(name)) { errs.name = `"${name}" already exists in the graph`; }
    };

    const validateTypeSpecific = (errs: Record<string, string>) => {
        if (nodeType === 'agent' || nodeType === 'subagent') {
            if (role.length < 20) errs.role = `At least 20 characters required (${role.length}/20)`;
        }
        if (nodeType === 'skill') {
            if (skillDescription.length < 20) errs.skillDescription = `At least 20 characters required (${skillDescription.length}/20)`;
        }
        if (nodeType === 'steering') {
            if (!steeringContent.trim()) errs.steeringContent = 'Steering content is required';
        }
        if (nodeType === 'hook') {
            if (!hookTrigger.trim()) errs.hookTrigger = 'Trigger event is required';
            if (!hookScript.trim()) errs.hookScript = 'Script content is required';
        }
    };

    const validateStep = (s: number): Record<string, string> => {
        const errs: Record<string, string> = {};
        if (s === 0) { validateCommon(errs); return errs; }
        if (s === 1) { validateTypeSpecific(errs); return errs; }
        return errs;
    };

    const validateAll = (): Record<string, string> => {
        const errs: Record<string, string> = {};
        validateCommon(errs);
        validateTypeSpecific(errs);
        return errs;
    };

    // ── Navigation (guided) ─────────────────────────────────────────────────
    const handleNext = () => {
        if (nodeType === 'feature-spec') { onGenerateSpec(); onClose(); return; }
        const errs = validateStep(step);
        if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
        setFieldErrors({});
        if (step === 1 && nodeType === 'skill') {
            setStep(3); // skip connections
        } else {
            setStep(s => s + 1);
        }
    };

    const handleBack = () => {
        setFieldErrors({});
        if (step === 3 && nodeType === 'skill') { setStep(1); }
        else { setStep(s => s - 1); }
    };

    // ── Create ───────────────────────────────────────────────────────────────
    const handleCreate = () => {
        if (advancedMode) {
            const errs = validateAll();
            if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
        }
        if (!vscode?.postMessage) return;
        switch (nodeType) {
            case 'steering':
                vscode.postMessage({ type: 'createSteering', name, description: steeringContent,
                    content: steeringContent, appliesTo: steeringAppliesTo || '*' });
                break;
            case 'hook':
                vscode.postMessage({ type: 'createHook', name, description: hookScript,
                    scriptContent: hookScript, triggerEvent: hookTrigger });
                break;
            case 'skill':
                vscode.postMessage({ type: 'createNodeFromWizard', nodeType: 'skill', name,
                    displayName: displayName || name, description: skillDescription,
                    capabilities: [], connectSkillIds: [], previewContent,
                    license: license || undefined, compatibility: compatibility || undefined });
                break;
            default:
                vscode.postMessage({ type: 'createNodeFromWizard', nodeType, name,
                    displayName: displayName || name, description: role,
                    capabilities, connectSkillIds, previewContent,
                    permissionPreset });
        }
        onCreated();
    };

    // ── AI generation ─────────────────────────────────────────────────────────
    const handleGenerateAI = () => {
        if (!vscode?.postMessage) return;
        setAiLoading(true);
        const modelFamily = selectedModelFamily || (lmModels.length === 1 ? lmModels[0].family : '');
        vscode.postMessage({ type: 'generateAgentDescription', name, role, nodeType, modelFamily });
        if (aiTimeoutRef.current !== null) window.clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = window.setTimeout(() => {
            setAiLoading(false);
            aiTimeoutRef.current = null;
        }, 10_000);
    };

    const addCapability = () => {
        const val = capInput.trim();
        if (val && !capabilities.includes(val)) setCapabilities(prev => [...prev, val]);
        setCapInput('');
    };

    const toggleSkill = (skillId: string) =>
        setConnectSkillIds(prev => prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]);

    const stepIdx = step === 3 && nodeType === 'skill' ? 2 : step;

    // Shared props for step components
    const agentRoleProps = {
        role, setRole, capabilities, capInput, setCapInput,
        addCapability, removeCapability: (cap: string) => setCapabilities(prev => prev.filter(c => c !== cap)),
        aiLoading, onGenerateAI: handleGenerateAI, fieldErrors,
        lmModels, selectedModelFamily, onModelFamilyChange: setSelectedModelFamily,
    };
    const skillProps = {
        description: skillDescription, setDescription: setSkillDescription,
        license, setLicense, compatibility, setCompatibility, fieldErrors,
    };
    const steeringProps = {
        content: steeringContent, setContent: setSteeringContent,
        appliesTo: steeringAppliesTo, setAppliesTo: setSteeringAppliesTo, fieldErrors,
    };
    const hookProps = {
        trigger: hookTrigger, setTrigger: setHookTrigger,
        script: hookScript, setScript: setHookScript, fieldErrors,
    };

    const showModeToggle = nodeType !== 'feature-spec' && (step === 0 || advancedMode);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onClose}>
            <div style={{ background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)',
                borderRadius: '12px', width: '580px', maxWidth: '93vw', maxHeight: '88vh',
                display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ margin: 0, fontSize: '1.05em', fontWeight: 700 }}>New Node</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Mode toggle — only visible at step 0 or in advanced mode */}
                            {showModeToggle && (
                                <div style={{ display: 'flex', background: 'var(--vscode-dropdown-background)',
                                    border: '1px solid var(--vscode-dropdown-border)', borderRadius: 20,
                                    overflow: 'hidden', fontSize: '0.72em' }}>
                                    <button onClick={() => advancedMode && handleToggleMode()}
                                        style={{ padding: '4px 12px', border: 'none', cursor: advancedMode ? 'pointer' : 'default',
                                            background: !advancedMode ? 'var(--vscode-focusBorder)' : 'transparent',
                                            color: !advancedMode ? '#fff' : 'var(--vscode-foreground)',
                                            fontFamily: 'inherit', fontWeight: !advancedMode ? 600 : 400,
                                            transition: 'all 0.15s ease' }}>
                                        Guided
                                    </button>
                                    <button onClick={() => !advancedMode && handleToggleMode()}
                                        style={{ padding: '4px 12px', border: 'none', cursor: !advancedMode ? 'pointer' : 'default',
                                            background: advancedMode ? 'var(--vscode-focusBorder)' : 'transparent',
                                            color: advancedMode ? '#fff' : 'var(--vscode-foreground)',
                                            fontFamily: 'inherit', fontWeight: advancedMode ? 600 : 400,
                                            transition: 'all 0.15s ease' }}>
                                        Advanced
                                    </button>
                                </div>
                            )}
                            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                                color: 'var(--vscode-foreground)', fontSize: '1.1em', opacity: 0.7, lineHeight: 1 }}>✕</button>
                        </div>
                    </div>

                    {/* Step indicators — guided mode only */}
                    {!advancedMode && nodeType !== 'feature-spec' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {STEP_LABELS.map((label, idx) => {
                                const active = idx === stepIdx;
                                const done = idx < stepIdx;
                                return (
                                    <React.Fragment key={idx}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                                background: active ? 'var(--vscode-focusBorder)' : done ? '#2aa198' : 'var(--vscode-dropdown-border)',
                                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.68em', fontWeight: 700 }}>
                                                {done ? '✓' : idx + 1}
                                            </div>
                                            <span style={{ fontSize: '0.7em', fontWeight: active ? 700 : 400,
                                                opacity: active ? 1 : done ? 0.7 : 0.4, whiteSpace: 'nowrap' }}>{label}</span>
                                        </div>
                                        {idx < STEP_LABELS.length - 1 && (
                                            <div style={{ flex: 1, height: 1, background: 'var(--vscode-dropdown-border)', opacity: 0.35, minWidth: 8 }} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                    {/* Advanced mode breadcrumb */}
                    {advancedMode && (
                        <div style={{ fontSize: '0.72em', opacity: 0.5 }}>All fields · create directly</div>
                    )}
                </div>

                {/* Body */}
                <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto', minHeight: 0 }}>
                    {/* ── Advanced mode: all fields on one page ── */}
                    {advancedMode ? (
                        <AdvancedForm
                            nodeType={nodeType} setNodeType={v => { setNodeType(v); setFieldErrors({}); }}
                            name={name} setName={setName}
                            displayName={displayName} setDisplayName={setDisplayName}
                            permissionPreset={permissionPreset} setPermissionPreset={setPermissionPreset}
                            existingNodeIds={existingNodeIds}
                            existingSkills={existingSkills}
                            connectSkillIds={connectSkillIds} toggleSkill={toggleSkill}
                            agentRoleProps={agentRoleProps}
                            skillProps={skillProps}
                            steeringProps={steeringProps}
                            hookProps={hookProps}
                            previewContent={previewContent} setPreviewContent={setPreviewContent}
                            onRefreshPreview={refreshPreview}
                            fieldErrors={fieldErrors}
                        />
                    ) : (
                        <>
                            {/* ── Guided mode: step by step ── */}
                            {step === 0 && (
                                <Step0
                                    nodeType={nodeType} setNodeType={v => { setNodeType(v); setFieldErrors({}); }}
                                    name={name} setName={setName}
                                    displayName={displayName} setDisplayName={setDisplayName}
                                    permissionPreset={permissionPreset} setPermissionPreset={setPermissionPreset}
                                    fieldErrors={fieldErrors}
                                />
                            )}
                            {step === 1 && (nodeType === 'agent' || nodeType === 'subagent') && (
                                <StepAgentRole {...agentRoleProps} />
                            )}
                            {step === 1 && nodeType === 'skill' && (
                                <StepSkillDetails {...skillProps} />
                            )}
                            {step === 1 && nodeType === 'steering' && (
                                <StepSteering {...steeringProps} />
                            )}
                            {step === 1 && nodeType === 'hook' && (
                                <StepHook {...hookProps} />
                            )}
                            {step === 2 && hasConnectionsStep && (
                                <StepConnections existingSkills={existingSkills}
                                    connectSkillIds={connectSkillIds} toggleSkill={toggleSkill} />
                            )}
                            {step === 3 && hasPreviewStep && (
                                <StepPreview previewContent={previewContent}
                                    setPreviewContent={setPreviewContent} nodeType={nodeType} />
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 24px 18px', borderTop: '1px solid var(--vscode-panel-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    {advancedMode ? (
                        <>
                            <button onClick={onClose}
                                style={{ padding: '6px 18px', background: 'transparent',
                                    border: '1px solid var(--vscode-panel-border)', borderRadius: 6,
                                    cursor: 'pointer', color: 'var(--vscode-foreground)', fontSize: '0.85em' }}>
                                Cancel
                            </button>
                            {nodeType === 'feature-spec' ? (
                                <button onClick={() => { onGenerateSpec(); onClose(); }}
                                    style={{ padding: '6px 22px', background: 'var(--vscode-button-background)',
                                        border: 'none', borderRadius: 6, cursor: 'pointer',
                                        color: 'var(--vscode-button-foreground)', fontSize: '0.85em', fontWeight: 600 }}>
                                    ✨ Open Spec Wizard
                                </button>
                            ) : (
                                <button onClick={handleCreate}
                                    style={{ padding: '6px 22px', background: '#2aa198', border: 'none',
                                        borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: '0.85em', fontWeight: 600 }}>
                                    Create
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <button onClick={step === 0 ? onClose : handleBack}
                                style={{ padding: '6px 18px', background: 'transparent',
                                    border: '1px solid var(--vscode-panel-border)', borderRadius: 6,
                                    cursor: 'pointer', color: 'var(--vscode-foreground)', fontSize: '0.85em' }}>
                                {step === 0 ? 'Cancel' : 'Back'}
                            </button>
                            {!isLastStep || nodeType === 'feature-spec' ? (
                                <button onClick={handleNext}
                                    style={{ padding: '6px 22px', background: 'var(--vscode-button-background)',
                                        border: 'none', borderRadius: 6, cursor: 'pointer',
                                        color: 'var(--vscode-button-foreground)', fontSize: '0.85em', fontWeight: 600 }}>
                                    {nodeType === 'feature-spec' ? '✨ Open Spec Wizard' : 'Next'}
                                </button>
                            ) : (
                                <button onClick={handleCreate}
                                    style={{ padding: '6px 22px', background: '#2aa198', border: 'none',
                                        borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: '0.85em', fontWeight: 600 }}>
                                    Create
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Advanced Form: all fields on a single scrollable page ─────────────────────

interface AdvancedFormProps {
    nodeType: WizardNodeType; setNodeType: (t: WizardNodeType) => void;
    name: string; setName: (n: string) => void;
    displayName: string; setDisplayName: (d: string) => void;
    permissionPreset: 'read-only' | 'read-write'; setPermissionPreset: (p: 'read-only' | 'read-write') => void;
    existingNodeIds: string[];
    existingSkills: Array<{ id: string; name: string }>;
    connectSkillIds: string[]; toggleSkill: (id: string) => void;
    agentRoleProps: Parameters<typeof StepAgentRole>[0];
    skillProps: Parameters<typeof StepSkillDetails>[0];
    steeringProps: Parameters<typeof StepSteering>[0];
    hookProps: Parameters<typeof StepHook>[0];
    previewContent: string; setPreviewContent: (v: string) => void;
    onRefreshPreview: () => void;
    fieldErrors: Record<string, string>;
}

const AdvancedForm = ({
    nodeType, setNodeType,
    name, setName,
    displayName, setDisplayName,
    permissionPreset, setPermissionPreset,
    existingSkills, connectSkillIds, toggleSkill,
    agentRoleProps, skillProps, steeringProps, hookProps,
    previewContent, setPreviewContent, onRefreshPreview,
    fieldErrors,
}: AdvancedFormProps) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Type compact selector */}
            <div>
                <div style={labelStyle}>Type</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {TYPE_GROUPS.flatMap(g => g.opts).map(opt => (
                        <button key={opt.value} onClick={() => setNodeType(opt.value)}
                            style={{ padding: '6px 12px', fontSize: '0.8em', fontFamily: 'inherit',
                                border: `2px solid ${nodeType === opt.value ? 'var(--vscode-focusBorder)' : 'var(--vscode-dropdown-border)'}`,
                                borderRadius: 20, cursor: 'pointer',
                                background: nodeType === opt.value
                                    ? 'color-mix(in srgb, var(--vscode-focusBorder) 15%, var(--vscode-editor-background))'
                                    : 'var(--vscode-dropdown-background)',
                                color: 'var(--vscode-foreground)', fontWeight: nodeType === opt.value ? 700 : 400 }}>
                            {opt.icon} {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {nodeType !== 'feature-spec' && (
                <>
                    {/* Identity */}
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 2 }}>
                            <label style={labelStyle} htmlFor="adv-name">
                                ID / slug <span style={{ color: '#e86f4a' }}>*</span>
                            </label>
                            <input id="adv-name" type="text" value={name}
                                onChange={e => setName(e.target.value.toLowerCase())}
                                placeholder="e.g. review-agent"
                                style={{ ...inputStyle, borderColor: fieldErrors.name ? '#e86f4a' : undefined }} />
                            {fieldErrors.name && <div style={inlineErrorStyle}>{fieldErrors.name}</div>}
                        </div>
                        <div style={{ flex: 3 }}>
                            <label style={labelStyle} htmlFor="adv-display">
                                Display name <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span>
                            </label>
                            <input id="adv-display" type="text" value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                placeholder={name || 'Human-readable name'} style={inputStyle} />
                        </div>
                    </div>

                    {/* Permission preset — agent/subagent only */}
                    {(nodeType === 'subagent' || nodeType === 'agent') && (
                        <div>
                            <div style={labelStyle}>File permissions</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['read-only', 'read-write'] as const).map(preset => (
                                    <button key={preset} onClick={() => setPermissionPreset(preset)}
                                        style={{ flex: 1, padding: '6px 10px',
                                            border: `2px solid ${permissionPreset === preset ? 'var(--vscode-focusBorder)' : 'var(--vscode-dropdown-border)'}`,
                                            borderRadius: 7,
                                            background: permissionPreset === preset
                                                ? 'color-mix(in srgb, var(--vscode-focusBorder) 12%, var(--vscode-editor-background))'
                                                : 'var(--vscode-dropdown-background)',
                                            cursor: 'pointer', color: 'var(--vscode-foreground)', fontFamily: 'inherit', fontSize: '0.82em' }}>
                                        {preset === 'read-only' ? '🔒 Read-only' : '✏️ Read-write'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Type-specific content */}
                    {(nodeType === 'agent' || nodeType === 'subagent') && (
                        <>
                            <Divider label="Role & Capabilities" />
                            <StepAgentRole {...agentRoleProps} />
                            <Divider label="Skill connections" />
                            <StepConnections existingSkills={existingSkills}
                                connectSkillIds={connectSkillIds} toggleSkill={toggleSkill} />
                            <Divider label="SUBAGENT.md preview" action={
                                <button onClick={onRefreshPreview}
                                    style={{ ...tinyBtnStyle }}>↻ Refresh</button>
                            } />
                            <StepPreview previewContent={previewContent}
                                setPreviewContent={setPreviewContent} nodeType={nodeType} />
                        </>
                    )}

                    {nodeType === 'skill' && (
                        <>
                            <Divider label="Role & Details" />
                            <StepSkillDetails {...skillProps} />
                            <Divider label="SKILL.md preview" action={
                                <button onClick={onRefreshPreview}
                                    style={{ ...tinyBtnStyle }}>↻ Refresh</button>
                            } />
                            <StepPreview previewContent={previewContent}
                                setPreviewContent={setPreviewContent} nodeType={nodeType} />
                        </>
                    )}

                    {nodeType === 'steering' && (
                        <>
                            <Divider label="Content & Rules" />
                            <StepSteering {...steeringProps} />
                        </>
                    )}

                    {nodeType === 'hook' && (
                        <>
                            <Divider label="Trigger & Script" />
                            <StepHook {...hookProps} />
                        </>
                    )}
                </>
            )}

            {nodeType === 'feature-spec' && (
                <div style={{ padding: '24px 0', textAlign: 'center', opacity: 0.6, fontSize: '0.9em' }}>
                    This action opens the Feature Spec wizard. No additional fields needed.
                </div>
            )}
        </div>
    );
};

// ── Step 0: Type & Name ───────────────────────────────────────────────────────

const TYPE_GROUPS: Array<{
    label?: string;
    opts: Array<{ value: WizardNodeType; label: string; desc: string; icon: string }>;
}> = [
    {
        label: 'Agent nodes',
        opts: [
            { value: 'subagent', label: 'Subagent', desc: 'Specialized agent with a focused role', icon: '🤖' },
            { value: 'agent', label: 'Agent', desc: 'Top-level primary agent', icon: '⚡' },
            { value: 'skill', label: 'Skill', desc: 'Reusable capability module', icon: '🔧' },
        ],
    },
    {
        label: 'Architecture nodes',
        opts: [
            { value: 'steering', label: 'Steering', desc: 'Global or scoped rules injected into agent context', icon: '🎯' },
            { value: 'hook', label: 'Hook', desc: 'Script that runs on lifecycle events', icon: '🪝' },
        ],
    },
    {
        label: 'Actions',
        opts: [
            { value: 'feature-spec', label: 'Generate Feature Spec', desc: 'Open the spec wizard to create requirements, design and tasks', icon: '📋' },
        ],
    },
];

const Step0 = ({
    nodeType, setNodeType,
    name, setName,
    displayName, setDisplayName,
    permissionPreset, setPermissionPreset,
    fieldErrors,
}: {
    nodeType: WizardNodeType; setNodeType: (t: WizardNodeType) => void;
    name: string; setName: (n: string) => void;
    displayName: string; setDisplayName: (d: string) => void;
    permissionPreset: 'read-only' | 'read-write'; setPermissionPreset: (p: 'read-only' | 'read-write') => void;
    fieldErrors: Record<string, string>;
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
            <div style={labelStyle}>What do you want to create?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {TYPE_GROUPS.map(group => (
                    <div key={group.label}>
                        {group.label && (
                            <div style={{ fontSize: '0.68em', fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.6px', opacity: 0.45, marginBottom: 7 }}>{group.label}</div>
                        )}
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {group.opts.map(opt => (
                                <button key={opt.value} onClick={() => setNodeType(opt.value)}
                                    style={{ flex: 1, minWidth: opt.value === 'feature-spec' ? '100%' : 110,
                                        padding: '9px 12px',
                                        border: `2px solid ${nodeType === opt.value ? 'var(--vscode-focusBorder)' : 'var(--vscode-dropdown-border)'}`,
                                        borderRadius: 8,
                                        background: nodeType === opt.value
                                            ? 'color-mix(in srgb, var(--vscode-focusBorder) 12%, var(--vscode-editor-background))'
                                            : opt.value === 'feature-spec'
                                            ? 'color-mix(in srgb, #2aa198 8%, var(--vscode-editor-background))'
                                            : 'var(--vscode-dropdown-background)',
                                        cursor: 'pointer', color: 'var(--vscode-foreground)',
                                        textAlign: 'left', fontFamily: 'inherit' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.85em' }}>{opt.icon} {opt.label}</div>
                                    <div style={{ fontSize: '0.7em', opacity: 0.6, marginTop: 2 }}>{opt.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {nodeType !== 'feature-spec' && (
            <>
                <div>
                    <label style={labelStyle} htmlFor="wiz-name">
                        ID / slug <span style={{ color: '#e86f4a' }}>*</span>
                        <span style={{ fontWeight: 400, opacity: 0.55, marginLeft: 6 }}>a-z, 0-9, hyphens</span>
                    </label>
                    <input id="wiz-name" type="text" value={name}
                        onChange={e => setName(e.target.value.toLowerCase())}
                        placeholder="e.g. review-agent"
                        style={{ ...inputStyle, borderColor: fieldErrors.name ? '#e86f4a' : undefined }} />
                    {fieldErrors.name && <div style={inlineErrorStyle}>{fieldErrors.name}</div>}
                </div>

                <div>
                    <label style={labelStyle} htmlFor="wiz-display">
                        Display name <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span>
                    </label>
                    <input id="wiz-display" type="text" value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder={name || 'Human-readable name'} style={inputStyle} />
                </div>

                {(nodeType === 'subagent' || nodeType === 'agent') && (
                    <div>
                        <div style={labelStyle}>File permissions</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['read-only', 'read-write'] as const).map(preset => (
                                <button key={preset} onClick={() => setPermissionPreset(preset)}
                                    style={{ flex: 1, padding: '7px 10px',
                                        border: `2px solid ${permissionPreset === preset ? 'var(--vscode-focusBorder)' : 'var(--vscode-dropdown-border)'}`,
                                        borderRadius: 7,
                                        background: permissionPreset === preset
                                            ? 'color-mix(in srgb, var(--vscode-focusBorder) 12%, var(--vscode-editor-background))'
                                            : 'var(--vscode-dropdown-background)',
                                        cursor: 'pointer', color: 'var(--vscode-foreground)', fontFamily: 'inherit', fontSize: '0.82em' }}>
                                    {preset === 'read-only' ? '🔒 Read-only' : '✏️ Read-write'}
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: '0.7em', opacity: 0.45, marginTop: 5 }}>
                            {permissionPreset === 'read-only'
                                ? 'Agent can read all files, edit only progress/ and feature_list.json'
                                : 'Agent can read and edit all files in the workspace'}
                        </div>
                    </div>
                )}
            </>
        )}
    </div>
);

// ── Step: Agent Role & Capabilities ──────────────────────────────────────────

const StepAgentRole = ({
    role, setRole, capabilities, capInput, setCapInput,
    addCapability, removeCapability, aiLoading, onGenerateAI,
    fieldErrors, lmModels, selectedModelFamily, onModelFamilyChange,
}: {
    role: string; setRole: (r: string) => void;
    capabilities: string[]; capInput: string; setCapInput: (v: string) => void;
    addCapability: () => void; removeCapability: (cap: string) => void;
    aiLoading: boolean; onGenerateAI: () => void;
    fieldErrors: Record<string, string>;
    lmModels: Array<{ family: string; name: string; vendor: string }>;
    selectedModelFamily: string; onModelFamilyChange: (f: string) => void;
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
            <label style={labelStyle} htmlFor="wiz-role">
                Role description <span style={{ color: '#e86f4a' }}>*</span>
                <span style={{ fontWeight: 400, opacity: 0.55, marginLeft: 6 }}>min. 20 chars</span>
            </label>
            <textarea id="wiz-role" value={role} onChange={e => setRole(e.target.value)} rows={4}
                placeholder="Describe what this agent does, its responsibilities, and constraints..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit',
                    borderColor: fieldErrors.role ? '#e86f4a' : undefined }} />
            {fieldErrors.role
                ? <div style={inlineErrorStyle}>{fieldErrors.role}</div>
                : <div style={{ fontSize: '0.7em', opacity: 0.45, marginTop: 4, textAlign: 'right' }}>{role.length} / 20 min chars</div>}
        </div>

        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={labelStyle}>Capabilities</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lmModels.length > 1 && (
                        <select value={selectedModelFamily} onChange={e => onModelFamilyChange(e.target.value)}
                            title="AI provider for generation"
                            style={{ fontSize: '0.72em', padding: '3px 6px',
                                background: 'var(--vscode-dropdown-background)',
                                border: '1px solid var(--vscode-dropdown-border)',
                                borderRadius: 5, color: 'var(--vscode-dropdown-foreground)',
                                cursor: 'pointer', maxWidth: 140 }}>
                            <option value="">Auto</option>
                            {lmModels.map(m => (
                                <option key={m.family} value={m.family}>{m.name || `${m.vendor} / ${m.family}`}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={onGenerateAI}
                        disabled={aiLoading || role.length < 10 || lmModels.length === 0}
                        title={lmModels.length === 0 ? 'No AI provider available' : 'Generate capabilities with AI'}
                        style={{ padding: '4px 12px', fontSize: '0.75em',
                            background: 'color-mix(in srgb, var(--vscode-focusBorder) 15%, var(--vscode-editor-background))',
                            border: '1px solid var(--vscode-focusBorder)', borderRadius: 6,
                            cursor: (aiLoading || role.length < 10 || lmModels.length === 0) ? 'not-allowed' : 'pointer',
                            color: 'var(--vscode-focusBorder)', fontFamily: 'inherit', fontWeight: 600,
                            opacity: (role.length < 10 || lmModels.length === 0) ? 0.4 : 1 }}>
                        {aiLoading ? '⟳ Generating…' : '✨ Generate with AI'}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 32, marginBottom: 8 }}>
                {capabilities.map(cap => (
                    <span key={cap} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 999,
                        background: 'color-mix(in srgb, #2aa198 14%, var(--vscode-editor-background))',
                        border: '1px solid #2aa198', fontSize: '0.78em', color: '#2aa198' }}>
                        {cap}
                        <button onClick={() => removeCapability(cap)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                                color: '#2aa198', padding: 0, lineHeight: 1, fontSize: '0.9em' }}>✕</button>
                    </span>
                ))}
                {capabilities.length === 0 && <span style={{ fontSize: '0.75em', opacity: 0.4 }}>No capabilities added yet</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={capInput} onChange={e => setCapInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCapability(); } }}
                    placeholder="Add a capability and press Enter..."
                    style={{ ...inputStyle, flex: 1, margin: 0 }} />
                <button onClick={addCapability}
                    style={{ padding: '6px 14px', background: 'var(--vscode-button-background)',
                        border: 'none', borderRadius: 6, cursor: 'pointer',
                        color: 'var(--vscode-button-foreground)', fontSize: '0.82em' }}>Add</button>
            </div>
        </div>
    </div>
);

// ── Step: Skill Details ───────────────────────────────────────────────────────

const StepSkillDetails = ({
    description, setDescription, license, setLicense, compatibility, setCompatibility, fieldErrors,
}: {
    description: string; setDescription: (v: string) => void;
    license: string; setLicense: (v: string) => void;
    compatibility: string; setCompatibility: (v: string) => void;
    fieldErrors: Record<string, string>;
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
            <label style={labelStyle} htmlFor="wiz-skill-desc">
                Description <span style={{ color: '#e86f4a' }}>*</span>
                <span style={{ fontWeight: 400, opacity: 0.55, marginLeft: 6 }}>What this skill does (min. 20 chars)</span>
            </label>
            <textarea id="wiz-skill-desc" value={description} onChange={e => setDescription(e.target.value)}
                rows={4} placeholder="Describe what this skill does and when to use it..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit',
                    borderColor: fieldErrors.skillDescription ? '#e86f4a' : undefined }} />
            {fieldErrors.skillDescription
                ? <div style={inlineErrorStyle}>{fieldErrors.skillDescription}</div>
                : <div style={{ fontSize: '0.7em', opacity: 0.45, marginTop: 4, textAlign: 'right' }}>{description.length} / 20 min chars</div>}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="wiz-license">License <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span></label>
                <input id="wiz-license" type="text" value={license} onChange={e => setLicense(e.target.value)}
                    placeholder="e.g. MIT" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="wiz-compat">Compatibility <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span></label>
                <input id="wiz-compat" type="text" value={compatibility} onChange={e => setCompatibility(e.target.value)}
                    placeholder="e.g. claude-code, gemini-cli" style={inputStyle} />
            </div>
        </div>
    </div>
);

// ── Step: Steering Content ────────────────────────────────────────────────────

const StepSteering = ({
    content, setContent, appliesTo, setAppliesTo, fieldErrors,
}: {
    content: string; setContent: (v: string) => void;
    appliesTo: string; setAppliesTo: (v: string) => void;
    fieldErrors: Record<string, string>;
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
            <label style={labelStyle} htmlFor="wiz-steering-content">
                Steering content <span style={{ color: '#e86f4a' }}>*</span>
            </label>
            <textarea id="wiz-steering-content" value={content} onChange={e => setContent(e.target.value)}
                rows={8} placeholder="Rules, guidelines or context injected into agent prompts..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: '0.82em',
                    borderColor: fieldErrors.steeringContent ? '#e86f4a' : undefined }} />
            {fieldErrors.steeringContent && <div style={inlineErrorStyle}>{fieldErrors.steeringContent}</div>}
        </div>
        <div>
            <label style={labelStyle} htmlFor="wiz-applies-to">
                Applies to <span style={{ fontWeight: 400, opacity: 0.55 }}>glob pattern — which agents receive this steering</span>
            </label>
            <input id="wiz-applies-to" type="text" value={appliesTo} onChange={e => setAppliesTo(e.target.value)}
                placeholder="* (all agents), *.ts, subagents/**" style={inputStyle} />
        </div>
    </div>
);

// ── Step: Hook Trigger & Script ───────────────────────────────────────────────

const StepHook = ({
    trigger, setTrigger, script, setScript, fieldErrors,
}: {
    trigger: string; setTrigger: (v: string) => void;
    script: string; setScript: (v: string) => void;
    fieldErrors: Record<string, string>;
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
            <label style={labelStyle} htmlFor="wiz-hook-trigger">
                Trigger event <span style={{ color: '#e86f4a' }}>*</span>
            </label>
            <input id="wiz-hook-trigger" type="text" value={trigger} onChange={e => setTrigger(e.target.value)}
                placeholder="e.g. PreToolUse, PostToolUse, Stop, Notification"
                style={{ ...inputStyle, borderColor: fieldErrors.hookTrigger ? '#e86f4a' : undefined }} />
            {fieldErrors.hookTrigger && <div style={inlineErrorStyle}>{fieldErrors.hookTrigger}</div>}
            <div style={{ fontSize: '0.7em', opacity: 0.45, marginTop: 5 }}>
                Claude Code hook events: PreToolUse · PostToolUse · Stop · Notification
            </div>
        </div>
        <div>
            <label style={labelStyle} htmlFor="wiz-hook-script">
                Script content <span style={{ color: '#e86f4a' }}>*</span>
            </label>
            <textarea id="wiz-hook-script" value={script} onChange={e => setScript(e.target.value)}
                rows={8} placeholder="#!/bin/bash&#10;# Your hook script..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: '0.82em',
                    borderColor: fieldErrors.hookScript ? '#e86f4a' : undefined }} />
            {fieldErrors.hookScript && <div style={inlineErrorStyle}>{fieldErrors.hookScript}</div>}
        </div>
    </div>
);

// ── Step: Connections ─────────────────────────────────────────────────────────

const StepConnections = ({
    existingSkills, connectSkillIds, toggleSkill,
}: {
    existingSkills: Array<{ id: string; name: string }>;
    connectSkillIds: string[]; toggleSkill: (id: string) => void;
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={labelStyle}>Connect to existing skills <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span></div>
        {existingSkills.length === 0 && (
            <div style={{ fontSize: '0.82em', opacity: 0.5, padding: '12px 0' }}>
                No skills in this workspace yet. You can connect skills later via the whiteboard.
            </div>
        )}
        {existingSkills.map(skill => (
            <label key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: connectSkillIds.includes(skill.id)
                    ? 'color-mix(in srgb, #2aa198 10%, var(--vscode-editor-background))'
                    : 'var(--vscode-dropdown-background)',
                border: `1px solid ${connectSkillIds.includes(skill.id) ? '#2aa198' : 'var(--vscode-dropdown-border)'}`,
                borderRadius: 7, cursor: 'pointer', fontSize: '0.85em', transition: 'all 0.14s ease' }}>
                <input type="checkbox" checked={connectSkillIds.includes(skill.id)}
                    onChange={() => toggleSkill(skill.id)} style={{ accentColor: '#2aa198' }} />
                <span>{skill.name || skill.id}</span>
                <span style={{ opacity: 0.45, fontSize: '0.8em', marginLeft: 'auto' }}>{skill.id}</span>
            </label>
        ))}
    </div>
);

// ── Step: Preview & Create ────────────────────────────────────────────────────

const StepPreview = ({
    previewContent, setPreviewContent, nodeType,
}: {
    previewContent: string; setPreviewContent: (v: string) => void; nodeType: WizardNodeType;
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
            <div style={labelStyle}>
                {nodeType === 'skill' ? 'SKILL.md' : 'SUBAGENT.md'} preview
                <span style={{ fontWeight: 400, opacity: 0.55, marginLeft: 6 }}>(editable)</span>
            </div>
            <textarea value={previewContent} onChange={e => setPreviewContent(e.target.value)} rows={18}
                style={{ ...inputStyle, fontFamily: 'var(--vscode-editor-font-family, monospace)',
                    fontSize: '0.78em', resize: 'vertical' }} />
        </div>
        <div style={{ fontSize: '0.75em', opacity: 0.5 }}>
            Edit the preview above before creating. This content will be written as the agent file.
        </div>
    </div>
);

// ── Divider with label ────────────────────────────────────────────────────────

const Divider = ({ label, action }: { label: string; action?: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
        <div style={{ fontSize: '0.68em', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.6px', opacity: 0.45, whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ flex: 1, height: 1, background: 'var(--vscode-dropdown-border)', opacity: 0.3 }} />
        {action}
    </div>
);

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.78em', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7, marginBottom: 6,
};

const inlineErrorStyle: React.CSSProperties = {
    fontSize: '0.76em', color: '#e86f4a', marginTop: 5,
    display: 'flex', alignItems: 'center', gap: 4,
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px',
    background: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border, var(--vscode-dropdown-border))',
    borderRadius: 6, color: 'var(--vscode-input-foreground)',
    fontSize: '0.88em', boxSizing: 'border-box', outline: 'none',
};

const tinyBtnStyle: React.CSSProperties = {
    padding: '2px 8px', fontSize: '0.7em', background: 'transparent',
    border: '1px solid var(--vscode-dropdown-border)', borderRadius: 4,
    cursor: 'pointer', color: 'var(--vscode-foreground)', fontFamily: 'inherit', opacity: 0.7,
};
