import * as React from 'react';

export interface EntityFormData {
    entityType: 'subagent' | 'skill';
    name: string;
    description: string;
    // Skill-only fields (Agent Skills spec)
    license?: string;
    compatibility?: string;
    author?: string;
    version?: string;
    // Subagent-only fields
    permissionPreset?: 'read-only' | 'read-write' | 'custom';
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
    const [entityType, setEntityType] = React.useState<'subagent' | 'skill'>('subagent');
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [license, setLicense] = React.useState('');
    const [compatibility, setCompatibility] = React.useState('');
    const [author, setAuthor] = React.useState('');
    const [version, setVersion] = React.useState('');
    const [permissionPreset, setPermissionPreset] = React.useState<string>('read-only');
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

        // Description validation
        if (!description.trim()) {
            newErrors.description = 'Description is required';
        } else if (description.trim().length > 1024) {
            newErrors.description = 'Max 1024 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;

        onCreateEntity({
            entityType,
            name: name.trim(),
            description: description.trim(),
            ...(entityType === 'skill' ? {
                license: license.trim() || undefined,
                compatibility: compatibility.trim() || undefined,
                author: author.trim() || undefined,
                version: version.trim() || undefined,
            } : {
                permissionPreset: permissionPreset as 'read-only' | 'read-write' | 'custom',
            }),
        });
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
                        <div style={{ display: 'flex', gap: SPACE.sm }}>
                            <vscode-button 
                                appearance={entityType === 'subagent' ? 'primary' : 'secondary'}
                                onClick={() => setEntityType('subagent')}
                                style={{ flex: 1 }}
                            >
                                Sub-agent
                            </vscode-button>
                            <vscode-button 
                                appearance={entityType === 'skill' ? 'primary' : 'secondary'}
                                onClick={() => setEntityType('skill')}
                                style={{ flex: 1 }}
                            >
                                Skill
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
                        Create {entityType === 'skill' ? 'Skill' : 'Sub-agent'}
                    </vscode-button>
                </div>
            </div>
        </>
    );
};
