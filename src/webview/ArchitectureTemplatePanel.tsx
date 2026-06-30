// FEAT-033 Phase 2 — Architecture Template Picker Panel (R26)
import * as React from 'react';
import type { ArchitectureTemplate } from '../whiteboard/architectureTemplates.js';

export interface ArchitectureTemplatePanelProps {
    templates: ArchitectureTemplate[];
    onApply: (templateId: string) => void;
    onClose: () => void;
    applying: boolean;
}

export const ArchitectureTemplatePanel = ({
    templates,
    onApply,
    onClose,
    applying,
}: ArchitectureTemplatePanelProps) => {
    const [applyingId, setApplyingId] = React.useState<string | null>(null);

    const handleApply = (id: string) => {
        setApplyingId(id);
        onApply(id);
    };

    // Reset applyingId when applying becomes false
    React.useEffect(() => {
        if (!applying) setApplyingId(null);
    }, [applying]);

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '320px',
            height: '100%',
            background: 'var(--vscode-sideBar-background)',
            borderRight: '1px solid var(--vscode-panel-border)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '6px 0 24px rgba(0,0,0,0.35)',
            animation: 'slideInLeft 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
            {/* Header */}
            <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--vscode-panel-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9em' }}>Architecture Templates</div>
                    <div style={{ fontSize: '0.7em', opacity: 0.55, marginTop: 2 }}>Apply a pre-built agent topology</div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--vscode-foreground)', opacity: 0.7, fontSize: '1em', lineHeight: 1,
                    }}
                >✕</button>
            </div>

            {/* Template cards */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                {templates.length === 0 && (
                    <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: '0.82em', opacity: 0.45 }}>
                        Loading templates…
                    </div>
                )}
                {templates.map(template => (
                    <div
                        key={template.id}
                        style={{
                            marginBottom: 12,
                            border: '1px solid var(--vscode-panel-border)',
                            borderRadius: 8,
                            background: 'var(--vscode-editor-background)',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Card header */}
                        <div style={{ padding: '12px 14px 8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.88em', marginBottom: 4 }}>
                                {template.name}
                            </div>
                            <div style={{ fontSize: '0.76em', opacity: 0.65, lineHeight: 1.45 }}>
                                {template.description}
                            </div>
                        </div>

                        {/* ASCII preview */}
                        <pre style={{
                            margin: '0 14px 8px',
                            padding: '8px 10px',
                            background: 'var(--vscode-dropdown-background)',
                            border: '1px solid var(--vscode-dropdown-border)',
                            borderRadius: 6,
                            fontSize: '0.72em',
                            lineHeight: 1.5,
                            fontFamily: 'var(--vscode-editor-font-family, monospace)',
                            color: 'var(--vscode-foreground)',
                            whiteSpace: 'pre',
                            overflow: 'auto',
                        }}>
                            {template.previewAscii}
                        </pre>

                        {/* Footer: counts + button */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 14px 12px',
                        }}>
                            <div style={{ fontSize: '0.72em', opacity: 0.5 }}>
                                {template.nodeCount} node{template.nodeCount !== 1 ? 's' : ''} · {template.edgeCount} edge{template.edgeCount !== 1 ? 's' : ''}
                            </div>
                            <button
                                onClick={() => handleApply(template.id)}
                                disabled={applying}
                                style={{
                                    padding: '5px 14px',
                                    background: applying && applyingId === template.id ? 'var(--vscode-dropdown-background)' : '#2aa198',
                                    border: 'none', borderRadius: 6, cursor: applying ? 'not-allowed' : 'pointer',
                                    color: '#fff', fontSize: '0.78em', fontWeight: 600,
                                    opacity: applying && applyingId !== template.id ? 0.5 : 1,
                                }}
                            >
                                {applying && applyingId === template.id ? '⟳ Applying…' : 'Apply'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};
