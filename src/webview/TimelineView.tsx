import * as React from 'react';
import { Milestone } from '../types.js';

interface Props {
    milestones: Milestone[];
}

const SPACE = { xs: '4px', sm: '8px', md: '16px', lg: '24px' };
const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const EASE_SMOOTH = 'cubic-bezier(0.4, 0, 0.2, 1)';

const STATUS_COLORS: Record<string, string> = {
    'COMPLETED': 'var(--vscode-debugIcon-breakpointForeground)',
    'IN PROGRESS': 'var(--vscode-editorInfo-foreground)',
    'SPEC READY': 'var(--vscode-editorWarning-foreground)',
    'PENDING': 'var(--vscode-descriptionForeground)',
    'DONE': 'var(--vscode-debugIcon-breakpointForeground)',
    'BLOCKED': 'var(--vscode-errorForeground)',
};

const STATUS_ORDER: Record<string, number> = {
    'COMPLETED': 0,
    'DONE': 0,
    'IN PROGRESS': 1,
    'SPEC READY': 2,
    'PENDING': 3,
    'BLOCKED': 4,
};

export const TimelineView = ({ milestones }: Props) => {
    // R5: Empty state illustration
    if (milestones.length === 0) {
        return (
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '60vh',
                gap: SPACE.md,
                padding: SPACE.lg,
                textAlign: 'center',
                color: 'var(--vscode-descriptionForeground)',
                animation: `fadeInUp 0.4s ${EASE_SMOOTH}`,
            }}>
                {/* Illustration: timeline placeholder icon */}
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" opacity="0.35">
                    <circle cx="40" cy="40" r="38" stroke="var(--vscode-panel-border)" strokeWidth="2" strokeDasharray="4,3" />
                    <circle cx="40" cy="40" r="3" fill="var(--vscode-panel-border)" />
                    <line x1="40" y1="43" x2="40" y2="65" stroke="var(--vscode-panel-border)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="20" y1="75" x2="60" y2="75" stroke="var(--vscode-panel-border)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="30" y1="75" x2="30" y2="70" stroke="var(--vscode-panel-border)" strokeWidth="2" strokeLinecap="round" />
                    <line x1="50" y1="75" x2="50" y2="70" stroke="var(--vscode-panel-border)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{ fontWeight: 600, fontSize: '1.15em' }}>No milestones yet</div>
                <p style={{ margin: 0, lineHeight: 1.6, maxWidth: '380px', fontSize: '0.9em' }}>
                    Features from <code style={{ background: 'var(--vscode-textBlockQuote-background)', padding: '2px 6px', borderRadius: '3px' }}>feature_list.json</code> with SDD specs will appear as milestones here as you build.
                </p>
                <ol style={{ 
                    textAlign: 'left', 
                    fontSize: '0.85em', 
                    lineHeight: 2.2,
                    margin: 0,
                    paddingLeft: SPACE.md,
                    opacity: 0.7,
                }}>
                    <li>Create a feature with <code>sdd: true</code> in <code>feature_list.json</code></li>
                    <li>Write the spec in <code>specs/</code></li>
                    <li>It appears here as a new milestone</li>
                </ol>
            </div>
        );
    }

    // Sort: completed/done first (by date desc), then in_progress, spec_ready, pending
    const sorted = [...milestones].sort((a, b) => {
        const orderA = STATUS_ORDER[a.status] ?? 99;
        const orderB = STATUS_ORDER[b.status] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        // Within same status group, sort by date (reverse chronological)
        if (a.date && b.date && a.date !== '—' && b.date !== '—') {
            return b.date.localeCompare(a.date);
        }
        // Non-dated entries go after dated ones
        if (a.date && a.date !== '—') return -1;
        if (b.date && b.date !== '—') return 1;
        return a.featureId.localeCompare(b.featureId);
    });

    const statusLabel = (status: string): string => {
        switch (status) {
            case 'COMPLETED': case 'DONE': return 'Done';
            case 'IN PROGRESS': return 'In Progress';
            case 'SPEC READY': return 'Spec Ready';
            case 'PENDING': return 'Pending';
            case 'BLOCKED': return 'Blocked';
            default: return status;
        }
    };

    const isActive = (status: string) => status === 'IN PROGRESS';

    return (
        <div style={{ padding: SPACE.lg, overflowY: 'auto', height: '100%' }}>
            {/* Summary header — R1 spacing */}
            <div style={{
                display: 'flex', gap: SPACE.sm, marginBottom: SPACE.lg, flexWrap: 'wrap',
                padding: SPACE.sm, background: 'var(--vscode-sideBar-background)',
                border: '1px solid var(--vscode-panel-border)', borderRadius: '4px',
                animation: `fadeInUp 0.35s ${EASE_SMOOTH} both`,
            }}>
                {['COMPLETED', 'IN PROGRESS', 'SPEC READY', 'PENDING'].map(s => {
                    const count = milestones.filter(m => m.status === s || (s === 'COMPLETED' && m.status === 'DONE')).length;
                    if (count === 0) return null;
                    return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, fontSize: '0.85em' }}>
                            <span style={{
                                width: '10px', height: '10px', borderRadius: '50%',
                                background: STATUS_COLORS[s] || STATUS_COLORS['PENDING'],
                                display: 'inline-block'
                            }}></span>
                            <span>{s === 'COMPLETED' ? 'Done' : s === 'IN PROGRESS' ? 'In Progress' : s === 'SPEC READY' ? 'Spec Ready' : 'Pending'}: <strong>{count}</strong></span>
                        </div>
                    );
                })}
            </div>

            {/* Timeline — R1 spacing */}
            <div style={{ borderLeft: '2px solid var(--vscode-focusBorder)', paddingLeft: SPACE.lg, position: 'relative' }}>
                {sorted.map((m, i) => {
                    const color = STATUS_COLORS[m.status] || STATUS_COLORS['PENDING'];
                    const active = isActive(m.status);
                    return (
                        <div
                            key={i}
                            style={{
                                marginBottom: SPACE.lg, position: 'relative',
                                opacity: m.status === 'PENDING' ? 0.6 : 1,
                                animation: `fadeInLeft 0.4s ${EASE_SMOOTH} ${i * 0.06}s both`,
                                transition: `opacity 0.3s ${EASE_SMOOTH}, transform 0.3s ${EASE_SMOOTH}`,
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                            }}
                        >
                            {/* Timeline dot with pulse for active items */}
                            <div style={{
                                position: 'absolute',
                                left: '-35px',
                                top: '6px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: color,
                                border: '3px solid var(--vscode-editor-background)',
                                boxShadow: `0 0 0 2px ${color}`,
                                transition: `transform 0.3s ${EASE_SPRING}, box-shadow 0.3s ${EASE_SMOOTH}`,
                                animation: active ? 'dotPulse 2s ease-in-out infinite' : 'none',
                            }}></div>

                            {/* Feature ID + Status badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: '2px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>{m.title}</span>
                                <vscode-badge style={{
                                    background: color,
                                    color: '#fff',
                                    fontSize: '0.75em',
                                    padding: '2px 8px',
                                    transition: `background 0.3s ${EASE_SMOOTH}`,
                                }}>{statusLabel(m.status)}</vscode-badge>
                            </div>

                            {/* Meta: date/sprint + feature ID */}
                            <div style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: SPACE.sm }}>
                                {m.date && m.date !== '—' ? (
                                    <span>📅 {m.date}</span>
                                ) : (
                                    <span style={{ opacity: 0.5 }}>— no date</span>
                                )}
                                <span style={{ marginLeft: SPACE.sm }}>🏷️ {m.featureId}</span>
                            </div>

                            {/* Description / Outcome */}
                            {m.outcome && (
                                <div style={{
                                    padding: SPACE.sm,
                                    background: 'var(--vscode-sideBar-background)',
                                    border: '1px solid var(--vscode-panel-border)',
                                    borderRadius: '4px',
                                    fontSize: '0.9em',
                                    lineHeight: 1.4,
                                    transition: `border-color 0.2s ${EASE_SMOOTH}, box-shadow 0.2s ${EASE_SMOOTH}`,
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.borderColor = `var(--vscode-focusBorder)`;
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--vscode-panel-border)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                }}
                                >
                                    {m.outcome}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};