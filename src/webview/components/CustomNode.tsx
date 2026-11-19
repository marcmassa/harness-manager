import * as React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { HarnessNodeProps } from '../nodeTypes.js';
import { TypeIcon, typeLabel } from './TypeIcon.js';
import { NodeBadges } from './NodeBadges.js';
import { FeatureNode, RoundNodeButton } from './nodeParts.js';
import { NodeLinkPicker, type SkillOption } from './NodeLinkPicker.js';
import { FRAMEWORK_ACCENT_BY_ID } from '../../frameworks.js';
import { SPACE, NODE_STYLES, HANDLE_ACCENT, HANDLE_PILL_BASE, HIDDEN_HANDLE_STYLE, activeNodeShadow, TIER_COLORS } from '../styles.js';

// FEAT-034 R45: tier → chip colour — TIER_COLORS from styles.ts, shared with the Optimizer.

export const CustomNode = ({ id, data, type, selected }: HarnessNodeProps) => {
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
        return <FeatureNode nodeRef={nodeRef} type={type} featId={featId} label={data.label}
            style={{ ...NODE_STYLES[type], cursor: 'pointer', position: 'relative', ...hoverStyle, ...selectedStyle }}
            onHover={setIsHovered} onContextMenu={data.onContextMenu} />;
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

    // FEAT-034 R45: optimizer score for this node, when the report covers it.
    const optimizerScore = data.optimizerScore as
        | { score: number; tier: string; findingCount: number }
        | undefined;

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

            {/* FEAT-034 R45/R46: optimizer score chip. Absent score → no chip,
                so nodes the optimizer does not cover stay visually unchanged. */}
            {optimizerScore && (
                <div
                    title={`Optimizer score ${optimizerScore.score}/100 — tier ${optimizerScore.tier} — ${optimizerScore.findingCount} finding${optimizerScore.findingCount === 1 ? '' : 's'}`}
                    style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        zIndex: 21,
                        minWidth: '22px',
                        height: '15px',
                        padding: '0 5px',
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: 700,
                        lineHeight: 1,
                        letterSpacing: '0.2px',
                        color: '#fff',
                        background: (TIER_COLORS as Record<string, string>)[optimizerScore.tier] ?? '#888',
                        border: '1px solid rgba(0,0,0,0.35)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        pointerEvents: 'auto',
                        userSelect: 'none',
                    }}
                >
                    {optimizerScore.score}
                </div>
            )}

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
                    display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                    {/* FEAT-046 R3: the same icon as the Sources and Findings views */}
                    <TypeIcon type={type} />{typeLabel(type)}
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
                    <RoundNodeButton title="Run agent in terminal" fontSize="12px"
                        background={data.isRunning ? '#63b3ed' : '#2aa198'}
                        onClick={() => data.onRunNode?.(id)}>▶</RoundNodeButton>
                )}

                {/* Redesigned (+) button — always visible on hover */}
                {canOpenLinkPicker && (isHovered || showSkillPicker) && (
                    <RoundNodeButton title={showSkillPicker ? linkPickerCloseTitle : linkPickerTitle} fontSize="18px"
                        background={showSkillPicker
                            ? 'var(--vscode-inputValidation-warningBorder, var(--vscode-debugIcon-breakpointForeground))'
                            : 'var(--vscode-debugIcon-breakpointForeground)'}
                        onClick={() => setShowSkillPicker((previousState: boolean) => !previousState)}>
                        {showSkillPicker ? '×' : '+'}
                    </RoundNodeButton>
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

            <NodeBadges type={type} data={data} />

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

            {showSkillPicker && (
                <NodeLinkPicker pickerRef={pickerRef} header={linkPickerHeader} options={linkOptions} onPick={handleCreateLink} />
            )}
        </div>
    );
};