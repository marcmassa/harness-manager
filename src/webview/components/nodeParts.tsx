// Small parts of a whiteboard node (moved from CustomNode.tsx, FEAT-046).
import * as React from 'react';
import { Handle, Position } from '@xyflow/react';
import { EASE_SMOOTH, HIDDEN_HANDLE_STYLE } from '../styles.js';

/** The round header button (Run, link picker): one style, two uses. */
export const RoundNodeButton = ({ title, background, fontSize, onClick, children }: {
    title: string; background: string; fontSize: string; onClick: () => void; children: React.ReactNode;
}) => (
    <div
        title={title}
        onClick={e => { e.stopPropagation(); onClick(); }}
        style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize, fontWeight: 'bold',
            lineHeight: '1',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            transition: `all 0.2s ${EASE_SMOOTH}`,
            flexShrink: 0,
            animation: 'popIn 0.25s ease-out',
        }}
        onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.15)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.45)';
        }}
        onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
        }}
    >
        {children}
    </div>
);

/** A feature node: FEAT id and title only, a shortcut to the Specs Manager. */
export const FeatureNode = ({ nodeRef, type, featId, label, style, onHover, onContextMenu }: {
    nodeRef: React.RefObject<HTMLDivElement | null>; type: string; featId: string; label: React.ReactNode;
    style: React.CSSProperties; onHover: (hovered: boolean) => void; onContextMenu?: React.MouseEventHandler;
}) => (
    <div
        ref={nodeRef}
        className="harness-node node-enter"
        data-type={type}
        style={style}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onContextMenu={onContextMenu}
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
            {label}
        </span>
        {/* Hidden handles for edge anchoring only (no visual) */}
        <Handle type="target" position={Position.Top} style={HIDDEN_HANDLE_STYLE} isConnectable={false} />
        <Handle type="source" position={Position.Bottom} style={HIDDEN_HANDLE_STYLE} isConnectable={false} />
    </div>
);
