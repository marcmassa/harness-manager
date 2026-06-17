import * as React from 'react';

export interface EntityFormData {
    entityType: 'subagent' | 'skill' | 'steering' | 'hook';
    name: string;
    description: string;
    // Skill-only fields (Agent Skills spec)
    license?: string;
    compatibility?: string;
    author?: string;
    version?: string;
    // Subagent-only fields
    permissionPreset?: 'read-only' | 'read-write' | 'custom';
    // Steering-only fields
    steeringContent?: string;
    steeringAppliesTo?: string;
    // Hook-only fields
    hookScript?: string;
    hookTrigger?: string;
}

interface EntitySidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateEntity: (entity: EntityFormData) => void;
}

const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px' };
const EASE_SMOOTH = 'cubic-bezier(0.4, 0, 0.2, 1)';

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const EntitySidePanel = ({ isOpen, onClose, onCreateEntity }: EntitySidePanelProps) => {
    const [entityType, setEntityType] = React.useState<'subagent' | 'skill' | 'steering' | 'hook'>('subagent');
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [license, setLicense] = React.useState('');
    const [compatibility, setCompatibility] = React.useState('');
    const [author, setAuthor] = React.useState('');
    const [version, setVersion] = React.useState('');
    const [permissionPreset, setPermissionPreset] = React.useState<string>('read-only');
    const [steeringContent, setSteeringContent] = React.useState('');
    const [steeringAppliesTo, setSteeringAppliesTo] = React.useState('');
    const [hookScript, setHookScript] = React.useState('');
    const [hookTrigger, setHookTrigger] = React.useState('');
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    // Reset form on open/close
    React.useEffect(() => {
        if (isOpen) {
            setEntityType('subagent');
            setName('');
            setDescription('');
            setLicense('');
            setCompatibility('');
            setAuthor('');
            setVersion('');
            setPermissionPreset('read-only');
            setSteeringContent('');
            setSteeringAppliesTo('');
            setHookScript('');
            setHookTrigger('');
            setErrors({});
        }
    }, [isOpen]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Name validation (kebab-case)
        if (!name.trim()) {
            newErrors.name = 'Name is required';
        } else if (!KEBAB_CASE_RE.test(name.trim())) {
            newErrors.name = 'Must be lowercase kebab-case (e.g., my-skill-name)';
        } else if (name.trim().length > 64) {
            newErrors.name = 'Max 64 characters';
        }

        // Description validation (not required for steering/hook)
        if (entityType !== 'steering' && entityType !== 'hook') {
            if (!description.trim()) {
                newErrors.description = 'Description is required';
            } else if (description.trim().length > 1024) {
                newErrors.description = 'Max 1024 characters';
            }
        }

        // Steering-specific validations
        if (entityType === 'steering' && !steeringContent.trim()) {
            newErrors.steeringContent = 'Steering content is required';
        }

        // Hook-specific validations
        if (entityType === 'hook') {
            if (!hookTrigger.trim()) {
                newErrors.hookTrigger = 'Trigger event is required';
            }
            if (!hookScript.trim()) {
                newErrors.hookScript = 'Script content is required';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;

        const base = {
            entityType,
            name: name.trim(),
            description: description.trim(),
        };

        const data: EntityFormData = {
            ...base,
            ...(entityType === 'skill' ? {
                license: license.trim() || undefined,
                compatibility: compatibility.trim() || undefined,
                author: author.trim() || undefined,
                version: version.trim() || undefined,
            } : entityType === 'subagent' ? {
                permissionPreset: permissionPreset as 'read-only' | 'read-write' | 'custom',
            } : entityType === 'steering' ? {
                steeringContent: steeringContent.trim(),
                steeringAppliesTo: steeringAppliesTo.trim() || '*',
            } : {
                hookScript: hookScript.trim(),
                hookTrigger: hookTrigger.trim(),
            }),
        };

        onCreateEntity(data);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay backdrop */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.2)',
                    zIndex: 40,
                    animation: 'fadeIn 0.15s ease-out',
                }}
                onClick={onClose}
            />

            {/* Side panel */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: 'min(420px, 40vw)',
                height: '100vh',
                background: 'var(--vscode-sideBar-background)',
                borderLeft: '2px solid var(--vscode-focusBorder)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideInRight 0.25s ease-out',
            }}>
                {/* Header */}
                <div style={{
                    padding: `${SPACE.md} ${SPACE.lg}`,
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <h3 style={{ margin: 0, fontSize: '1.05em', fontWeight: 600 }}>
                        Add Entity
                    </h3>
                    <div style={{ display: 'flex', gap: SPACE.sm }}>
                        <vscode-button 
                            appearance="icon" 
                            title="Close"
                            onClick={onClose}
                            style={{ width: '28px', height: '28px' }}
                        >
                            <span className="codicon codicon-close"></span>
                        </vscode-button>
                    </div>
                </div>

                {/* Form body */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: SPACE.lg,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.md,
                }}>
                    {/* Entity type selector */}
                    <div>
                        <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                            Entity Type <span style={{ color: 'var(--vscode-errorForeground)' }}>*</span>
                        </label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: SPACE.sm,
                        }}>
                            <vscode-button 
                                appearance={entityType === 'subagent' ? 'primary' : 'secondary'}
                                onClick={() => setEntityType('subagent')}
                            >
                                Sub-agent
                            </vscode-button>
                            <vscode-button 
                                appearance={entityType === 'skill' ? 'primary' : 'secondary'}
                                onClick={() => setEntityType('skill')}
                            >
                                Skill
                            </vscode-button>
                            <vscode-button 
                                appearance={entityType === 'steering' ? 'primary' : 'secondary'}
                                onClick={() => setEntityType('steering')}
                            >
                                Steering
                            </vscode-button>
                            <vscode-button 
                                appearance={entityType === 'hook' ? 'primary' : 'secondary'}
                                onClick={() => setEntityType('hook')}
                            >
                                Hook
                            </vscode-button>
                        </div>
                    </div>

                    {/* Name field */}
                    <div>
                        <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                            Name <span style={{ color: 'var(--vscode-errorForeground)' }}>*</span>
                        </label>
                        <vscode-text-field
                            placeholder={entityType === 'skill' ? 'my-skill-name' : 'my-subagent-name'}
                            value={name}
                            onInput={(e: any) => setName(e.target.value)}
                            style={{ width: '100%' }}
                        />
                        {errors.name && (
                            <div style={{ fontSize: '0.75em', color: 'var(--vscode-errorForeground)', marginTop: SPACE.xs }}>
                                {errors.name}
                            </div>
                        )}
                        <div style={{ fontSize: '0.7em', opacity: 0.4, marginTop: '2px' }}>
                            Lowercase kebab-case (a-z, 0-9, hyphens). Max 64 characters.
                        </div>
                    </div>

                    {/* Description field */}
                    <div>
                        <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                            Description <span style={{ color: 'var(--vscode-errorForeground)' }}>*</span>
                        </label>
                        <vscode-text-area
                            placeholder="Describe the entity's purpose and responsibilities..."
                            value={description}
                            onInput={(e: any) => setDescription(e.target.value)}
                            rows={4}
                            style={{ width: '100%' }}
                        />
                        {errors.description && (
                            <div style={{ fontSize: '0.75em', color: 'var(--vscode-errorForeground)', marginTop: SPACE.xs }}>
                                {errors.description}
                            </div>
                        )}
                        <div style={{ fontSize: '0.7em', opacity: 0.4, marginTop: '2px', textAlign: 'right' }}>
                            {description.length}/1024
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ 
                        height: '1px', 
                        background: 'var(--vscode-panel-border)', 
                        margin: `${SPACE.sm} 0` 
                    }} />

                    {/* Skill-specific fields (Agent Skills spec) */}
                    {entityType === 'skill' && (
                        <>
                            <div style={{ 
                                fontSize: '0.75em', 
                                opacity: 0.5, 
                                textTransform: 'uppercase', 
                                letterSpacing: '1px',
                                fontWeight: 600,
                            }}>
                                Agent Skills Specification (optional)
                            </div>

                            {/* License */}
                            <div>
                                <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                    License
                                </label>
                                <vscode-text-field
                                    placeholder="Apache-2.0, MIT, Proprietary..."
                                    value={license}
                                    onInput={(e: any) => setLicense(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {/* Compatibility */}
                            <div>
                                <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                    Compatibility
                                </label>
                                <vscode-text-field
                                    placeholder="Requires Python 3.14+, git, and network access..."
                                    value={compatibility}
                                    onInput={(e: any) => setCompatibility(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {/* Author & Version */}
                            <div style={{ display: 'flex', gap: SPACE.md }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                        Author
                                    </label>
                                    <vscode-text-field
                                        placeholder="org-name"
                                        value={author}
                                        onInput={(e: any) => setAuthor(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                        Version
                                    </label>
                                    <vscode-text-field
                                        placeholder="1.0.0"
                                        value={version}
                                        onInput={(e: any) => setVersion(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Subagent-specific fields */}
                    {entityType === 'subagent' && (
                        <>
                            <div>
                                <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                    Permission Preset
                                </label>
                                <vscode-dropdown 
                                    value={permissionPreset} 
                                    onChange={(e: any) => setPermissionPreset(e.target.value)}
                                    style={{ width: '100%' }}
                                >
                                    <vscode-option value="read-only">Read-only (default)</vscode-option>
                                    <vscode-option value="read-write">Read-Write</vscode-option>
                                    <vscode-option value="custom">Custom</vscode-option>
                                </vscode-dropdown>
                            </div>
                        </>
                    )}

                    {/* Steering-specific fields */}
                    {entityType === 'steering' && (
                        <>
                            <div>
                                <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                    Applies To
                                </label>
                                <vscode-text-field
                                    placeholder="* (all agents) or agent-name"
                                    value={steeringAppliesTo}
                                    onInput={(e: any) => setSteeringAppliesTo(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: '0.7em', opacity: 0.4, marginTop: '2px' }}>
                                    Use * for global steering, or a specific agent name.
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                    Steering Content <span style={{ color: 'var(--vscode-errorForeground)' }}>*</span>
                                </label>
                                <vscode-text-area
                                    placeholder="Write the steering directive in markdown..."
                                    value={steeringContent}
                                    onInput={(e: any) => setSteeringContent(e.target.value)}
                                    rows={6}
                                    style={{ width: '100%' }}
                                />
                                {errors.steeringContent && (
                                    <div style={{ fontSize: '0.75em', color: 'var(--vscode-errorForeground)', marginTop: SPACE.xs }}>
                                        {errors.steeringContent}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Hook-specific fields */}
                    {entityType === 'hook' && (
                        <>
                            <div>
                                <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                    Trigger Event <span style={{ color: 'var(--vscode-errorForeground)' }}>*</span>
                                </label>
                                <vscode-dropdown 
                                    value={hookTrigger} 
                                    onChange={(e: any) => setHookTrigger(e.target.value)}
                                    style={{ width: '100%' }}
                                >
                                    <vscode-option value="">Select trigger...</vscode-option>
                                    <vscode-option value="on_spec_created">on_spec_created</vscode-option>
                                    <vscode-option value="on_feature_done">on_feature_done</vscode-option>
                                    <vscode-option value="on_session_start">on_session_start</vscode-option>
                                    <vscode-option value="on_session_close">on_session_close</vscode-option>
                                    <vscode-option value="on_approve">on_approve</vscode-option>
                                </vscode-dropdown>
                                {errors.hookTrigger && (
                                    <div style={{ fontSize: '0.75em', color: 'var(--vscode-errorForeground)', marginTop: SPACE.xs }}>
                                        {errors.hookTrigger}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.7em', opacity: 0.4, marginTop: '2px' }}>
                                    When this hook should fire during the SDD workflow.
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.xs, display: 'block' }}>
                                    Script Content <span style={{ color: 'var(--vscode-errorForeground)' }}>*</span>
                                </label>
                                <vscode-text-area
                                    placeholder="#!/usr/bin/env bash&#10;echo 'Hook executed'"
                                    value={hookScript}
                                    onInput={(e: any) => setHookScript(e.target.value)}
                                    rows={6}
                                    style={{ width: '100%' }}
                                />
                                {errors.hookScript && (
                                    <div style={{ fontSize: '0.75em', color: 'var(--vscode-errorForeground)', marginTop: SPACE.xs }}>
                                        {errors.hookScript}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer with action buttons */}
                <div style={{
                    padding: `${SPACE.md} ${SPACE.lg}`,
                    borderTop: '1px solid var(--vscode-panel-border)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: SPACE.sm,
                }}>
                    <vscode-button appearance="secondary" onClick={onClose}>
                        Cancel
                    </vscode-button>
                    <vscode-button onClick={handleSubmit}>
                        Create {entityType === 'skill' ? 'Skill' : entityType === 'steering' ? 'Steering' : entityType === 'hook' ? 'Hook' : 'Sub-agent'}
                    </vscode-button>
                </div>
            </div>
        </>
    );
};
