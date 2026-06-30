import * as React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FRAMEWORK_ACCENT_BY_ID } from '../../frameworks.js';
import { SPACE, EASE_SMOOTH, NODE_STYLES, HANDLE_ACCENT, HANDLE_PILL_BASE, HIDDEN_HANDLE_STYLE, activeNodeShadow } from '../styles.js';

interface SkillOption {
    id: string;
    label: string;
    alreadyConnected: boolean;
}

// FEAT-033: Format a Unix timestamp as a relative time string (R15)
function formatRelativeTime(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    return `${Math.floor(diffHr / 24)} d ago`;
}


export const CustomNode = ({ id, data, type, selected }: NodeProps) => {
    const [showSkillPicker, setShowSkillPicker] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const nodeRef = React.useRef<HTMLDivElement>(null);
    const pickerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!showSkillPicker) return;
        const pointerHandler = (e: PointerEvent) => {
            if (
                nodeRef.current &&
                !nodeRef.current.contains(e.target as Node) &&
                pickerRef.current &&
                !pickerRef.current.contains(e.target as Node)
            ) {
                setShowSkillPicker(false);
            }
        };
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowSkillPicker(false);
            }
        };
        document.addEventListener('pointerdown', pointerHandler, true);
        document.addEventListener('keydown', keyHandler);
        return () => {
            document.removeEventListener('pointerdown', pointerHandler, true);
            document.removeEventListener('keydown', keyHandler);
        };
    }, [showSkillPicker]);

    // FEAT-023 R19: node appear/disappear animation is a
    // CSS-only keyframe (`nodeAppear`, 200ms ease-out) attached
    // via the `.node-enter` class on the outer div. The class
    // lives in `index.tsx` and includes a `prefers-reduced-motion`
    // override that disables the animation. No JS state needed
    // for the entrance — the keyframe runs once on mount and
    // `forwards` keeps the final state.

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
        boxShadow: activeNodeShadow(),
        animation: 'activeNodePulse 2.4s ease-in-out infinite',
    } : {};

    // Merge all styles — NO transform on hover/select
    const isMismatch = type === 'skill' && data.metadata?._mismatch === true;
    const mismatchBorderStyle: React.CSSProperties = isMismatch ? {
        border: '2px solid #e86f4a',
        animation: 'mismatchPulse 2s ease-in-out infinite',
    } : {};

    // FEAT node: compact mode — show only FEAT-ID + label, no handles, no badges.
    // The node is purely a navigational shortcut to the Specs Manager tab.
    const isFeatureNode = type === 'feature';
    const featId = isFeatureNode ? (id || data.id || '') : '';

    // For feature nodes, render a minimal compact node
    if (isFeatureNode) {
        return (
            <div
                ref={nodeRef}
                className="harness-node node-enter"
                data-type={type}
                style={{
                    ...NODE_STYLES[type],
                    cursor: 'pointer',
                    position: 'relative',
                    ...hoverStyle,
                    ...selectedStyle,
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onContextMenu={data.onContextMenu}
                title={`Click to open ${featId} in Specs Manager`}
            >
                {/* FEAT ID badge */}
                <span style={{
                    fontSize: '0.62em',
                    fontWeight: 800,
                    letterSpacing: '0.4px',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.15)',
                    color: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                }}>
                    {featId}
                </span>
                {/* Feature title */}
                <span style={{
                    fontSize: '0.78em',
                    fontWeight: 500,
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: 0.88,
                    marginLeft: '6px',
                }}>
                    {data.label}
                </span>
                {/* Hidden handles for edge anchoring only (no visual) */}
                <Handle type="target" position={Position.Top} style={HIDDEN_HANDLE_STYLE} isConnectable={false} />
                <Handle type="source" position={Position.Bottom} style={HIDDEN_HANDLE_STYLE} isConnectable={false} />
            </div>
        );
    }

    // FEAT-012 R7: Orphan node style — dashed border, muted
    const isOrphan = data.metadata?._orphan === true || data.metadata?._discovery === 'orphan';
    const orphanStyle: React.CSSProperties = isOrphan ? {
        border: '2px dashed #888',
        opacity: 0.65,
        filter: 'grayscale(0.5)',
    } : {};

    const frameworkId = typeof data.metadata?._framework === 'string'
        ? data.metadata._framework
        : '';
    const frameworkAccentColor = FRAMEWORK_ACCENT_BY_ID[frameworkId];
    const frameworkAccentStyle: React.CSSProperties = frameworkAccentColor ? {
        borderLeft: `4px solid ${frameworkAccentColor}`,
        boxShadow: `inset 2px 0 0 color-mix(in srgb, ${frameworkAccentColor} 28%, transparent)`,
    } : {};

    // T12 (R7): accent color derived from node type
    const accent = HANDLE_ACCENT[type] ?? '#888888';
    const canLinkThroughPills = data.canLinkThroughPills === true;
    const isLinkSourceArmed = data.isLinkSourceArmed === true;
    const isLinkTargetActive = data.isLinkTargetActive === true;
    const isDragLinkHoverTarget = data.isDragLinkHoverTarget === true;
    // Show pills on hover — users can start a connection without opening the detail panel
    const showSourcePill = canLinkThroughPills && (isHovered || isActive || isLinkSourceArmed);
    const showTargetPill = canLinkThroughPills && (isHovered || isActive || isLinkTargetActive);
    const sourceHandleInteractive = canLinkThroughPills && showSourcePill;
    const targetHandleInteractive = canLinkThroughPills && showTargetPill;
    const dragHoverStyle: React.CSSProperties = isDragLinkHoverTarget ? {
        outline: '3px solid var(--vscode-focusBorder)',
        outlineOffset: '3px',
        boxShadow: [
            '0 0 0 2px var(--vscode-focusBorder)',
            '0 0 0 7px rgba(var(--vscode-focusBorder-rgb, 0, 122, 204), 0.2)',
            '0 0 24px rgba(var(--vscode-focusBorder-rgb, 0, 122, 204), 0.45)',
            '0 10px 28px rgba(0,0,0,0.35)',
        ].join(', '),
    } : {};

    const mergedStyle: React.CSSProperties = { 
        ...NODE_STYLES[type], 
        ...hoverStyle,
        ...selectedStyle,
        ...dragHoverStyle,
        ...activeStyle,
        ...mismatchBorderStyle,
        ...frameworkAccentStyle,
        ...orphanStyle,
        position: 'relative' as const,
        cursor: 'pointer',
    };

    // ===== HANDLE STYLES — redesigned as labeled pill buttons =====
    // The Handle component keeps its drag-to-connect functionality.
    // We keep geometry fixed to avoid cursor/handle drift while interacting.

    const targetPillStyle: React.CSSProperties = {
        ...HANDLE_PILL_BASE,
        background: isLinkTargetActive
            ? 'color-mix(in srgb, var(--vscode-editorWidget-background, #252526) 72%, var(--vscode-focusBorder) 28%)'
            : 'var(--vscode-editorWidget-background, #252526)',
        color: isLinkTargetActive
            ? '#ffffff'
            : 'var(--vscode-editorWidget-foreground, var(--vscode-foreground))',
        border: isLinkTargetActive
            ? `1px solid ${accent}`
            : '1px solid var(--vscode-editorWidget-border, #454545)',
        opacity: 1,
        boxShadow: isLinkTargetActive ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
    };

    const sourcePillStyle: React.CSSProperties = {
        ...HANDLE_PILL_BASE,
        background: isLinkSourceArmed
            ? accent
            : 'var(--vscode-editorWidget-background, #252526)',
        color: isLinkSourceArmed
            ? '#ffffff'
            : 'var(--vscode-editorWidget-foreground, var(--vscode-foreground))',
        border: isLinkSourceArmed
            ? `1px solid ${accent}`
            : '1px solid var(--vscode-editorWidget-border, #454545)',
        opacity: 1,
        boxShadow: isLinkSourceArmed ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
    };

    const linkOptions: SkillOption[] = data.availableLinkTargets || data.availableSkills || [];
    const canOpenLinkPicker = (type === 'subagent' || type === 'agent' || type === 'skill') && linkOptions.length > 0;
    const linkPickerTitle = type === 'skill' ? 'Link to Agent/Sub-agent' : 'Link to a Skill';
    const linkPickerCloseTitle = type === 'skill' ? 'Close Owner List' : 'Close Skills List';
    const linkPickerHeader = type === 'skill' ? 'Available Owners' : 'Available Skills';

    const handleCreateLink = (targetId: string) => {
        setShowSkillPicker(false);
        if (data.onCreateLink) {
            data.onCreateLink(id, targetId);
            return;
        }
        // Backward compatibility
        if (data.onAddSkill) {
            data.onAddSkill(id, targetId);
        }
    };

    return (
        <div
            ref={nodeRef}
            className="harness-node node-enter"
            data-type={type}
            style={mergedStyle}
            onMouseEnter={() => {
                setIsHovered(true);
                if (data.onLinkTargetHoverChange) {
                    data.onLinkTargetHoverChange(id, true);
                }
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                if (data.onLinkTargetHoverChange) {
                    data.onLinkTargetHoverChange(id, false);
                }
            }}
            onMouseUp={() => {
                if (data.onLinkDropOnNode) {
                    data.onLinkDropOnNode(id);
                }
            }}
            onContextMenu={data.onContextMenu}
        >
            {/* Active node badge — pinned top-left corner */}
            {isActive && (
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '10px',
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
            {/* ===== TARGET HANDLE (top) — handle always mounted for edge anchoring, pill visual only when active ===== */}
            <div style={{ position: 'absolute', top: '-28px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showTargetPill && (
                    <div style={targetPillStyle}>
                        <span>{isLinkTargetActive ? '✓' : '↓'}</span>
                        <span>{isLinkTargetActive ? 'LINK' : 'IN'}</span>
                    </div>
                )}
                <Handle
                    type="target"
                    position={Position.Top}
                    style={{
                        ...HIDDEN_HANDLE_STYLE,
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: targetHandleInteractive ? 'auto' : 'none',
                        cursor: targetHandleInteractive ? 'pointer' : 'default',
                    }}
                    isConnectable={targetHandleInteractive}
                    title={!canLinkThroughPills ? 'This node type cannot be linked' : isLinkTargetActive ? 'Click to complete link' : 'Drag a link here'}
                    onClick={(event) => {
                        event.stopPropagation();
                        if (canLinkThroughPills && data.onTargetPillClick) {
                            data.onTargetPillClick(id);
                        }
                    }}
                />
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
                    {type === 'agent' ? '⚡ Agent' : type === 'subagent' ? '▸ Subagent' : type === 'skill' ? '◆ Skill' : type === 'feature' ? '▣ Feature' : type === 'steering' ? '⚙️ Steering' : '🔌 Hook'}
                </div>
                {typeof data.metadata?._frameworkLabel === 'string' && (
                    <div style={{
                        fontSize: '0.56em',
                        letterSpacing: '0.4px',
                        opacity: 0.78,
                        border: '1px solid rgba(128,128,128,0.35)',
                        borderRadius: '10px',
                        padding: '1px 6px',
                        whiteSpace: 'nowrap',
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {data.metadata._frameworkLabel}
                    </div>
                )}

                {/* FEAT-033: ▶ Run button — agent/subagent only, visible on hover/select (R8) */}
                {(type === 'agent' || type === 'subagent') && data.onRunNode && (isHovered || isActive) && (
                    <div
                        title="Run agent in terminal"
                        onClick={(e) => {
                            e.stopPropagation();
                            data.onRunNode(id);
                        }}
                        style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: data.isRunning ? '#63b3ed' : '#2aa198',
                            color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
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
                    >
                        ▶
                    </div>
                )}

                {/* Redesigned (+) button — always visible on hover */}
                {canOpenLinkPicker && (isHovered || showSkillPicker) && (
                    <div
                        title={showSkillPicker ? linkPickerCloseTitle : linkPickerTitle}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowSkillPicker((previousState: boolean) => !previousState);
                        }}
                        style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: showSkillPicker
                                ? 'var(--vscode-inputValidation-warningBorder, var(--vscode-debugIcon-breakpointForeground))'
                                : 'var(--vscode-debugIcon-breakpointForeground)',
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
                    >
                        {showSkillPicker ? '×' : '+'}
                    </div>
                )}
            </div>

            {/* Label */}
            <div style={{ fontWeight: 600, fontSize: '1.05em', lineHeight: 1.3 }}>{data.label}</div>
            {isLinkSourceArmed && (
                <div style={{
                    marginTop: SPACE.xs,
                    fontSize: '0.58em',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    color: accent,
                }}>
                    Click another IN pill to link
                </div>
            )}

            {/* FEAT-033: Last run timestamp badge (R15) */}
            {(type === 'agent' || type === 'subagent') && data.lastRunTimestamp && (
                <div style={{ marginTop: SPACE.xs, display: 'flex', gap: SPACE.xs }}>
                    <span style={{
                        fontSize: '0.55em',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        background: 'rgba(99, 179, 237, 0.12)',
                        color: '#63b3ed',
                        fontWeight: 600,
                        letterSpacing: '0.3px',
                        border: '1px solid rgba(99, 179, 237, 0.25)',
                    }}>
                        ⚡ {formatRelativeTime(data.lastRunTimestamp as number)}
                    </span>
                </div>
            )}

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

            {/* ===== SOURCE HANDLE (bottom) — handle always mounted for edge anchoring, pill visual only when active ===== */}
            <div style={{ position: 'absolute', bottom: '-28px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showSourcePill && (
                    <div style={sourcePillStyle}>
                        <span>{isLinkSourceArmed ? '✕' : '+'}</span>
                        <span>{isLinkSourceArmed ? 'READY' : 'LINK'}</span>
                    </div>
                )}
                <Handle
                    type="source"
                    position={Position.Bottom}
                    style={{
                        ...HIDDEN_HANDLE_STYLE,
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: sourceHandleInteractive ? 'auto' : 'none',
                        cursor: sourceHandleInteractive ? 'pointer' : 'default',
                    }}
                    isConnectable={sourceHandleInteractive}
                    title={!canLinkThroughPills ? 'This node type cannot be linked' : isLinkSourceArmed ? 'Click to cancel link mode' : 'Hover + drag to connect, or click OUT to start click-to-connect'}
                    onClick={(event) => {
                        event.stopPropagation();
                        if (canLinkThroughPills && data.onSourcePillClick) {
                            data.onSourcePillClick(id);
                        }
                    }}
                />
            </div>

            {/* Inline skill picker dropdown */}
            {showSkillPicker && (
                <div
                    ref={pickerRef}
                    className="nodrag nowheel"
                    onWheel={(event) => {
                        event.stopPropagation();
                    }}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                    }}
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
                        minWidth: '280px',
                        maxWidth: '340px',
                        maxHeight: '360px',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
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
                    }}>{linkPickerHeader}</div>
                    {linkOptions.length === 0 && (
                        <div style={{ padding: SPACE.sm, fontSize: '0.85em', opacity: 0.5, textAlign: 'center' }}>
                            No options available
                        </div>
                    )}
                    {linkOptions.map((option, idx) => (
                        <div
                            key={option.id}
                            onClick={(e) => { e.stopPropagation(); if (!option.alreadyConnected) handleCreateLink(option.id); }}
                            style={{
                                padding: `10px 12px`,
                                cursor: option.alreadyConnected ? 'not-allowed' : 'pointer',
                                opacity: option.alreadyConnected ? 0.35 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: SPACE.sm,
                                fontSize: '0.9em',
                                borderBottom: '1px solid var(--vscode-dropdown-border)',
                                animation: `pickerItemFadeIn 0.2s ease-out ${idx * 0.03}s both`,
                                transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => { 
                                if (!option.alreadyConnected) 
                                    (e.currentTarget as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)'; 
                            }}
                            onMouseLeave={(e) => { 
                                (e.currentTarget as HTMLElement).style.background = 'transparent'; 
                            }}
                        >
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: option.alreadyConnected
                                    ? 'var(--vscode-inputValidation-infoBorder)'
                                    : 'var(--vscode-statusBarItem-remoteBackground)',
                                display: 'inline-block',
                                flexShrink: 0,
                            }}></span>
                            <span>{option.label}</span>
                            {option.alreadyConnected && (
                                <span style={{ fontSize: '0.7em', opacity: 0.6, marginLeft: 'auto', flexShrink: 0 }}>✓&nbsp;Linked</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};