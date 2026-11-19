// FEAT-033 Phase 2 — Architecture Studio toolbar (top-left of the whiteboard)
// with its gear menu (FEAT-048 split; moved verbatim from WhiteboardCanvas.tsx).
import * as React from 'react';

export function WhiteboardToolbar({ onCreateNode, onOpenTemplates }: { onCreateNode?: () => void; onOpenTemplates?: () => void }) {
    // FEAT-033 Phase 2: Gear menu open state
    const [gearMenuOpen, setGearMenuOpen] = React.useState(false);
    return (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 25, display: 'flex', gap: 6, alignItems: 'center' }}>
            {onCreateNode && (
                <button
                    onClick={onCreateNode}
                    title="New Node (Agent Builder Wizard)"
                    style={toolbarBtnStyle}
                >
                    + New
                </button>
            )}
            {onOpenTemplates && (
                <button
                    onClick={onOpenTemplates}
                    title="Architecture Templates"
                    style={toolbarBtnSecondaryStyle}
                >
                    ⊞ Templates
                </button>
            )}
            {/* Gear menu */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setGearMenuOpen(o => !o)}
                    title="Whiteboard actions"
                    style={toolbarBtnSecondaryStyle}
                >
                    ⚙
                </button>
                {gearMenuOpen && (
                    <>
                        {/* Click-outside overlay */}
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                            onClick={() => setGearMenuOpen(false)}
                        />
                        <div style={{
                            position: 'absolute', top: '110%', left: 0, zIndex: 9999,
                            background: 'var(--vscode-dropdown-background)',
                            border: '1px solid var(--vscode-dropdown-border)',
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                            minWidth: 220,
                            padding: '4px 0',
                            animation: 'pickerFadeIn 0.14s ease-out',
                        }}>
                            {[
                                { label: 'Scaffold missing files', cmd: 'harness-dashboard.scaffoldMissing' },
                                { label: 'Sync from filesystem', cmd: 'harness-dashboard.syncFromFilesystem' },
                            ].map(item => (
                                <button
                                    key={item.cmd}
                                    onClick={() => {
                                        const vscode = (window as any).__harness_vscode_api;
                                        if (vscode?.postMessage) {
                                            vscode.postMessage({ type: 'executeVSCodeCommand', command: item.cmd });
                                        }
                                        setGearMenuOpen(false);
                                    }}
                                    style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        padding: '8px 14px', fontSize: '0.84em',
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        color: 'var(--vscode-dropdown-foreground)', fontFamily: 'inherit',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── FEAT-033 Phase 2: Shared toolbar button styles ────────────────────────────
// Primary: same vivid color as vscode-button (consistent with header action buttons)
const toolbarBtnStyle: React.CSSProperties = {
    padding: '5px 13px',
    fontSize: '0.78em',
    fontWeight: 600,
    background: 'var(--vscode-button-background)',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    color: 'var(--vscode-button-foreground)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
    fontFamily: 'inherit',
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
};

// Secondary: neutral widget color for ancillary actions
const toolbarBtnSecondaryStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: '0.78em',
    fontWeight: 600,
    background: 'var(--vscode-editorWidget-background)',
    border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))',
    borderRadius: 7,
    cursor: 'pointer',
    color: 'var(--vscode-foreground)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
    fontFamily: 'inherit',
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
};
