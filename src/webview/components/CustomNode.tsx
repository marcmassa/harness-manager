import * as React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px' };
const EASE_SMOOTH = 'cubic-bezier(0.4, 0, 0.2, 1)';

// Distinct visual shapes per type (R2) — improved contrast
const nodeStyles: Record<string, React.CSSProperties> = {
    agent: { 
        background: 'var(--vscode-editor-background)', 
        color: 'var(--vscode-editor-foreground)', 
        padding: SPACE.md, 
        borderRadius: SPACE.sm, 
        border: '2.5px solid var(--vscode-debugIcon-breakpointForeground)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        minWidth: '180px'
    },
    subagent: { 
        background: 'linear-gradient(135deg, var(--vscode-button-background), color-mix(in srgb, var(--vscode-button-background) 85%, black))',
        color: 'var(--vscode-button-foreground)', 
        padding: SPACE.md, 
        borderRadius: SPACE.sm, 
        border: '1.5px solid color-mix(in srgb, var(--vscode-button-background) 70%, var(--vscode-button-foreground))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        minWidth: '160px'
    },
    skill: { 
        background: 'var(--vscode-editor-background)', 
        color: 'var(--vscode-editor-foreground)', 
        padding: '12px 20px', 
        borderRadius: '20px', 
        border: '2px solid var(--vscode-statusBarItem-remoteBackground)',
        minWidth: '140px',
        textAlign: 'center' as const,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    },
    feature: { 
        background: 'linear-gradient(135deg, var(--vscode-activityBarBadge-background), color-mix(in srgb, var(--vscode-activityBarBadge-background) 80%, black))',
        color: 'var(--vscode-activityBarBadge-foreground)', 
        padding: '12px 16px', 
        borderRadius: SPACE.xs, 
        border: '1.5px solid color-mix(in srgb, var(--vscode-activityBarBadge-background) 60%, transparent)',
        minWidth: '160px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    }
};

interface SkillOption {
    id: string;
    label: string;
    alreadyConnected: boolean;
}

export const HANDLE_ACCENT: Record<string, string> = {
    agent:    '#4a7dff',
    subagent: '#4a7dff',
    skill:    '#2aa198',
    feature:  '#888888',
};

export const CustomNode = ({ id, data, type, selected }: NodeProps) => {
    const [showSkillPicker, setShowSkillPicker] = React.useState(false);
    const [entered, setEntered] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const nodeRef = React.useRef<HTMLDivElement>(null);
    const pickerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const timer = setTimeout(() => setEntered(true), 50);
        return () => clearTimeout(timer);
    }, []);

    React.useEffect(() => {
        if (!showSkillPicker) return;
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
                nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
                setShowSkillPicker(false);
            }
        };
        const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
        return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
    }, [showSkillPicker]);

    // Entrance animation
    const entranceStyle: React.CSSProperties = entered ? {
        opacity: 1,
        transform: 'translateY(0)',
        transition: `opacity 0.35s ${EASE_SMOOTH}, box-shadow 0.25s ${EASE_SMOOTH}`,
    } : {
        opacity: 0,
        transform: 'translateY(12px)',
        transition: `opacity 0.35s ${EASE_SMOOTH}`,
    };

    // Hover effect — WITHOUT transform to avoid handle displacement
    // Use outline + box-shadow instead of scale
    const hoverStyle: React.CSSProperties = (isHovered && !selected) ? {
        outline: '2px solid var(--vscode-focusBorder)',
        outlineOffset: '2px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
    } : {};

    // React Flow internal selection (click on canvas)
    const selectedStyle: React.CSSProperties = selected ? {
        outline: '3px solid var(--vscode-focusBorder)',
        outlineOffset: '3px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
    } : {};

    // "Active" = panel is open for this node — persistent feedback independent of RF selection
    const isActive: boolean = data.isActive === true;
    const activeStyle: React.CSSProperties = isActive ? {
        border: '2px solid var(--vscode-focusBorder)',
        // Triple-layer shadow: tight ring + mid glow + outer halo
        boxShadow: [
            '0 0 0 3px var(--vscode-focusBorder)',
            '0 0 0 7px rgba(var(--vscode-focusBorder-rgb, 0, 122, 204), 0.25)',
            '0 0 24px 8px rgba(var(--vscode-focusBorder-rgb, 0, 122, 204), 0.18)',
            '0 12px 40px rgba(0,0,0,0.5)',
        ].join(', '),
        animation: 'activeNodePulse 2.4s ease-in-out infinite',
    } : {};

    // Merge all styles — NO transform on hover/select
    const isMismatch = type === 'skill' && data.metadata?._mismatch === true;
    const mismatchBorderStyle: React.CSSProperties = isMismatch ? {
        border: '2px solid #e86f4a',
        animation: 'mismatchPulse 2s ease-in-out infinite',
    } : {};

    // FEAT-012 R7: Orphan node style — dashed border, muted
    const isOrphan = data.metadata?._orphan === true || data.metadata?._discovery === 'orphan';
    const orphanStyle: React.CSSProperties = isOrphan ? {
        border: '2px dashed #888',
        opacity: 0.65,
        filter: 'grayscale(0.5)',
    } : {};

    const mergedStyle: React.CSSProperties = { 
        ...nodeStyles[type], 
        ...entranceStyle, 
        ...hoverStyle,
        ...selectedStyle,
        ...activeStyle,
        ...mismatchBorderStyle,
        ...orphanStyle,
        position: 'relative' as const,
        cursor: 'pointer',
    };

    // T12 (R7): accent color derived from node type
    const accent = HANDLE_ACCENT[type] ?? '#888888';

    // ===== HANDLE STYLES — redesigned as labeled pill buttons =====
    // The Handle component keeps its drag-to-connect functionality.
    // We overlay a visible pill label that appears on node hover.
    const handlePillBase: React.CSSProperties = {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        padding: isHovered ? '2px 10px' : '2px 6px',
        borderRadius: '12px',
        fontSize: '0.6em',
        fontWeight: 700,
        letterSpacing: '0.8px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',   // the Handle div handles events
        transition: `all 0.2s ${EASE_SMOOTH}`,
        zIndex: 11,
        userSelect: 'none',
    };

    const targetPillStyle: React.CSSProperties = {
        ...handlePillBase,
        top: '-14px',
        // BLOCKER-1 fix: use token-pair remoteBackground/remoteForeground — VS Code guarantees
        // mutual contrast in all themes. Fallback #005f87 gives #fff ratio 7.03:1 (AAA).
        background: isHovered
            ? accent
            : 'var(--vscode-editorWidget-background, #252526)',
        color: isHovered
            ? '#ffffff'
            : 'var(--vscode-editorWidget-foreground, var(--vscode-foreground))',
        border: isHovered
            ? `1px solid ${accent}`
            : '1px solid var(--vscode-editorWidget-border, #454545)',
        opacity: 1,
        boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
    };

    const sourcePillStyle: React.CSSProperties = {
        ...handlePillBase,
        bottom: '-14px',
        // WARNING-1 fix: same token as target pill — consistent visuals + AAA fallback (7.03:1)
        background: isHovered
            ? accent
            : 'var(--vscode-editorWidget-background, #252526)',
        color: isHovered
            ? '#ffffff'
            : 'var(--vscode-editorWidget-foreground, var(--vscode-foreground))',
        border: isHovered
            ? `1px solid ${accent}`
            : '1px solid var(--vscode-editorWidget-border, #454545)',
        opacity: 1,
        boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
    };

    // Invisible handle dot — keeps React Flow connection logic
    const hiddenHandleStyle: React.CSSProperties = {
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'transparent',
        border: 'none',
        opacity: 0,
        zIndex: 12,
        cursor: 'crosshair',
    };

    const availableSkills: SkillOption[] = data.availableSkills || [];
    const canAddSkills = (type === 'agent' || type === 'subagent') && availableSkills.length > 0;

    const handleAddSkill = (skillId: string) => {
        setShowSkillPicker(false);
        // Delegate to parent — it handles both local graph update + vscode persistence
        if (data.onAddSkill) {
            data.onAddSkill(id, skillId);
        }
    };

    return (
        <div
            ref={nodeRef}
            className="harness-node"
            data-type={type}
            style={mergedStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setShowSkillPicker(false); }}
            onContextMenu={data.onContextMenu}
        >
            {/* Active node badge — pinned top-left corner */}
            {isActive && (
                <div style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--vscode-focusBorder)',
                    color: '#fff',
                    fontSize: '0.6em',
                    fontWeight: 700,
                    letterSpacing: '1.5px',
                    padding: '1px 8px',
                    borderRadius: '6px',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    zIndex: 5,
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}>
                    ▶ Viewing
                </div>
            )}
            {/* ===== TARGET HANDLE (top) — pill button ===== */}
            <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={targetPillStyle}>
                    <span>↓</span>
                    {isHovered && <span>IN</span>}
                </div>
                {/* WARNING-3 fix: Handle centered over pill (top:50%) for correct hit area */}
                <Handle type="target" position={Position.Top} style={{ ...hiddenHandleStyle, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            </div>

            {/* Header */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: SPACE.sm,
                borderBottom: '1px solid rgba(128,128,128,0.18)',
                paddingBottom: SPACE.xs,
                gap: SPACE.xs,
            }}>
                <div style={{ 
                    fontSize: '0.6em', 
                    textTransform: 'uppercase', 
                    opacity: 0.65, 
                    letterSpacing: '1.5px',
                    fontWeight: 700,
                }}>
                    {type === 'agent' ? '⚡ Agent' : type === 'subagent' ? '▸ Subagent' : type === 'skill' ? '◆ Skill' : '▣ Feature'}
                </div>

                {/* Redesigned (+) button — always visible on hover */}
                {canAddSkills && isHovered && !showSkillPicker && (
                    <div
                        title="Link to a Skill"
                        onClick={(e) => { e.stopPropagation(); setShowSkillPicker(true); }}
                        style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: 'var(--vscode-debugIcon-breakpointForeground)',
                            color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '18px', fontWeight: 'bold',
                            lineHeight: '1',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                            transition: `all 0.2s ${EASE_SMOOTH}`,
                            flexShrink: 0,
                            animation: 'popIn 0.25s ease-out',
                        }}
                        onMouseEnter={(e) => { 
                            (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.45)';
                        }}
                        onMouseLeave={(e) => { 
                            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
                        }}
                    >+</div>
                )}
            </div>

            {/* Label */}
            <div style={{ fontWeight: 600, fontSize: '1.05em', lineHeight: 1.3 }}>{data.label}</div>

            {/* Suggestion badge — shows on subagents with pending semantic suggestions (FEAT-010, R6) */}
            {(type === 'agent' || type === 'subagent') && data.suggestedCount > 0 && (
                <div style={{ marginTop: SPACE.xs, display: 'flex', gap: SPACE.xs }}>
                    <span style={{ 
                        fontSize: '0.55em', 
                        padding: '2px 6px', 
                        borderRadius: '8px', 
                        background: 'rgba(212, 168, 74, 0.15)',
                        color: '#d4a84a',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        border: '1px solid rgba(212, 168, 74, 0.3)',
                    }}>💡 {data.suggestedCount} suggestion{data.suggestedCount > 1 ? 's' : ''}</span>
                </div>
            )}

            {/* Status badge */}
            {data.metadata?.status && (
                <div style={{ marginTop: SPACE.sm }}>
                    <span style={{ 
                        fontSize: '0.6em', 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        background: 'var(--vscode-badge-background)',
                        color: 'var(--vscode-badge-foreground)',
                        fontWeight: 'bold',
                        letterSpacing: '0.5px',
                    }}>{data.metadata.status}</span>
                </div>
            )}

            {/* Progressive Disclosure badge: shows discovery stage for skill nodes */}
            {type === 'skill' && data.metadata?._discovery && (
                <div style={{ marginTop: SPACE.xs, display: 'flex', gap: SPACE.xs, justifyContent: 'center' }}>
                    {data.metadata._discovery === 'orphan' && (
                        <span style={{ 
                            fontSize: '0.55em', 
                            padding: '2px 6px', 
                            borderRadius: '8px', 
                            background: 'rgba(108, 108, 138, 0.2)',
                            color: '#6c6c8a',
                            fontWeight: 600,
                            letterSpacing: '0.5px',
                            border: '1px solid rgba(108, 108, 138, 0.3)',
                        }}>📡 DISCOVERED</span>
                    )}
                    {data.metadata._discovery === 'linked' && (
                        <span style={{ 
                            fontSize: '0.55em', 
                            padding: '2px 6px', 
                            borderRadius: '8px', 
                            background: 'rgba(42, 161, 152, 0.15)',
                            color: '#2aa198',
                            fontWeight: 600,
                            letterSpacing: '0.5px',
                            border: '1px solid rgba(42, 161, 152, 0.3)',
                        }}>🔗 LINKED</span>
                    )}
                </div>
            )}

            {/* FEAT-011: Best semantic owner badge on skill nodes (R4) */}
            {type === 'skill' && data.metadata?._bestOwner && (
                <div style={{ marginTop: SPACE.xs, display: 'flex', gap: SPACE.xs, justifyContent: 'center' }}>
                    <span style={{
                        fontSize: '0.55em',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        background: 'rgba(42, 161, 152, 0.15)',
                        color: '#2aa198',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        border: '1px solid rgba(42, 161, 152, 0.3)',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        → {data.metadata._bestOwner} ({data.metadata._bestOwnerScore?.toFixed(2) || '?'})
                    </span>
                </div>
            )}

            {/* FEAT-011: Mismatch border on skill nodes (R6) */}
            {type === 'skill' && data.metadata?._mismatch === true && (
                <div style={{
                    marginTop: SPACE.xs,
                    display: 'flex',
                    gap: SPACE.xs,
                    justifyContent: 'center',
                    animation: 'mismatchPulse 2s ease-in-out infinite',
                }}>
                    <span style={{
                        fontSize: '0.55em',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        background: 'rgba(232, 111, 74, 0.15)',
                        color: '#e86f4a',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        border: '1px solid rgba(232, 111, 74, 0.4)',
                    }}>
                        ⚠️ MISMATCH
                    </span>
                </div>
            )}

            {/* ===== SOURCE HANDLE (bottom) — pill button ===== */}
            <div style={{ position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={sourcePillStyle}>
                    <span>+</span>
                    {isHovered && <span>LINK</span>}
                </div>
                {/* WARNING-3 fix: Handle centered over pill (top:50%) for correct hit area */}
                <Handle type="source" position={Position.Bottom} style={{ ...hiddenHandleStyle, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            </div>

            {/* Inline skill picker dropdown */}
            {showSkillPicker && (
                <div
                    ref={pickerRef}
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: SPACE.sm,
                        background: 'var(--vscode-dropdown-background)',
                        border: '1px solid var(--vscode-dropdown-border)',
                        borderRadius: '8px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                        zIndex: 1000,
                        minWidth: '220px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        animation: 'pickerFadeIn 0.2s ease-out',
                    }}>
                    <div style={{
                        padding: `10px ${SPACE.sm}`,
                        fontSize: '0.65em',
                        textTransform: 'uppercase',
                        opacity: 0.5,
                        borderBottom: '1px solid var(--vscode-dropdown-border)',
                        letterSpacing: '1px',
                        fontWeight: 700,
                    }}>Available Skills</div>
                    {availableSkills.length === 0 && (
                        <div style={{ padding: SPACE.sm, fontSize: '0.85em', opacity: 0.5, textAlign: 'center' }}>
                            No skills available
                        </div>
                    )}
                    {availableSkills.map((skill, idx) => (
                        <div
                            key={skill.id}
                            onClick={(e) => { e.stopPropagation(); if (!skill.alreadyConnected) handleAddSkill(skill.id); }}
                            style={{
                                padding: `10px 12px`,
                                cursor: skill.alreadyConnected ? 'not-allowed' : 'pointer',
                                opacity: skill.alreadyConnected ? 0.35 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: SPACE.sm,
                                fontSize: '0.9em',
                                borderBottom: '1px solid var(--vscode-dropdown-border)',
                                animation: `pickerItemFadeIn 0.2s ease-out ${idx * 0.03}s both`,
                                transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => { 
                                if (!skill.alreadyConnected) 
                                    (e.currentTarget as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)'; 
                            }}
                            onMouseLeave={(e) => { 
                                (e.currentTarget as HTMLElement).style.background = 'transparent'; 
                            }}
                        >
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: skill.alreadyConnected
                                    ? 'var(--vscode-inputValidation-infoBorder)'
                                    : 'var(--vscode-statusBarItem-remoteBackground)',
                                display: 'inline-block',
                                flexShrink: 0,
                            }}></span>
                            <span>{skill.label}</span>
                            {skill.alreadyConnected && (
                                <span style={{ fontSize: '0.7em', opacity: 0.6, marginLeft: 'auto', flexShrink: 0 }}>✓&nbsp;Linked</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};