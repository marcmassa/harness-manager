// The inline link picker of a whiteboard node (moved from CustomNode.tsx, FEAT-046).
import * as React from 'react';
import { SPACE } from '../styles.js';

export interface SkillOption {
    id: string;
    label: string;
    alreadyConnected: boolean;
}

export const NodeLinkPicker = ({ pickerRef, header, options, onPick }: {
    pickerRef: React.RefObject<HTMLDivElement | null>;
    header: string;
    options: SkillOption[];
    onPick: (targetId: string) => void;
}) => (
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
            }}>{header}</div>
            {options.length === 0 && (
                <div style={{ padding: SPACE.sm, fontSize: '0.85em', opacity: 0.5, textAlign: 'center' }}>
                    No options available
                </div>
            )}
            {options.map((option, idx) => (
                <div
                    key={option.id}
                    onClick={(e) => { e.stopPropagation(); if (!option.alreadyConnected) onPick(option.id); }}
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
);
