import * as React from 'react';
import { SPACE } from './styles.js';

export interface FeatureEntry {
    id: string;
    name: string;
    title: string;
    description: string;
    type: string;
    status: string;
    priority: string;
    agent: string;
    sprint: string;
    sdd: boolean;
    source?: 'json' | 'filesystem';
}

export const STATUS_COLOURS: Record<string, string> = {
    pending: '#6c6c8a',
    spec_ready: '#d4a84a',
    in_progress: '#4a90d4',
    done: '#2aa198',
    blocked: '#c14a4a',
    discovered: '#6c8ab6',
};

export const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    spec_ready: 'Spec Ready',
    in_progress: 'In Progress',
    done: 'Done',
    blocked: 'Blocked',
    discovered: 'Discovered',
};

export const STATUS_SORT_ORDER: Record<string, number> = {
    done: 0,
    in_progress: 1,
    spec_ready: 2,
    pending: 3,
    blocked: 4,
    discovered: 5,
};

export const StatusBadge = ({ status }: { status: string }) => {
    const colour = STATUS_COLOURS[status] || '#888';
    return (
        <span
            title={STATUS_LABELS[status] || status}
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.65em',
                fontWeight: 700,
                letterSpacing: '0.5px',
                background: `${colour}22`,
                color: colour,
                border: `1px solid ${colour}44`,
                lineHeight: '1.4',
                whiteSpace: 'nowrap',
            }}
        >
            {STATUS_LABELS[status] || status}
        </span>
    );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
    const colours: Record<string, string> = { P0: '#e86f4a', P1: '#d4a84a', P2: '#6c6c8a' };
    const colour = colours[priority] || '#888';
    return (
        <span style={{
            display: 'inline-block', padding: '1px 6px', borderRadius: '4px',
            fontSize: '0.6em', fontWeight: 700,
            background: `${colour}22`, color: colour, border: `1px solid ${colour}33`,
        }}>
            {priority}
        </span>
    );
};

const FeatureCard = ({
    feature, selected, onClick, taskCounts, outcome, index,
}: {
    feature: FeatureEntry;
    selected: boolean;
    onClick: () => void;
    taskCounts: Record<string, { total: number; done: number }>;
    outcome?: string;
    index: number;
}) => {
    const tc = taskCounts[feature.name];
    const colour = STATUS_COLOURS[feature.status] || '#888';
    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            style={{
                display: 'flex', cursor: 'pointer', userSelect: 'none',
                animation: `fadeInLeft 0.3s ease-out ${index * 0.04}s both`,
                transition: 'background 0.15s ease',
                background: selected ? 'var(--vscode-list-hoverBackground)' : 'transparent',
            }}
        >
            <div style={{ width: '28px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '13px', width: '2px', background: 'var(--vscode-panel-border)', opacity: 0.4 }} />
                <div style={{
                    position: 'relative', zIndex: 1, width: '14px', height: '14px', borderRadius: '50%',
                    background: colour, marginTop: '16px', flexShrink: 0,
                    boxShadow: selected ? `0 0 0 3px ${colour}44` : 'none',
                    animation: feature.status === 'in_progress' || feature.status === 'spec_ready' ? 'dotPulse 2s ease-in-out infinite' : 'none',
                    transition: 'box-shadow 0.2s ease',
                }} />
            </div>
            <div style={{
                flex: 1, minWidth: 0, padding: `${SPACE.sm} ${SPACE.md} ${SPACE.sm} ${SPACE.sm}`,
                display: 'flex', flexDirection: 'column', gap: '3px',
                borderBottom: '1px solid var(--vscode-panel-border)',
                borderLeft: selected ? `2px solid ${colour}` : '2px solid transparent',
                transition: 'border-color 0.2s ease',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.xs }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.65em', fontWeight: 700, opacity: 0.45, fontFamily: 'monospace', letterSpacing: '0.3px' }}>
                            {feature.id}
                        </span>
                        <StatusBadge status={feature.status} />
                    </div>
                    {feature.sprint && (
                        <span style={{ fontSize: '0.6em', opacity: 0.4, fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.3px', textTransform: 'uppercase', flexShrink: 0 }}>
                            {feature.sprint}
                        </span>
                    )}
                </div>
                <div style={{
                    fontSize: '0.85em', fontWeight: 600, lineHeight: 1.3,
                    color: 'var(--vscode-editor-foreground)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                    {feature.title}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '1px' }}>
                    <PriorityBadge priority={feature.priority} />
                    {feature.sdd && (
                        <span style={{ fontSize: '0.55em', padding: '1px 5px', borderRadius: '3px', background: 'rgba(42, 161, 152, 0.15)', color: '#2aa198', fontWeight: 700, letterSpacing: '0.3px' }}>
                            SDD
                        </span>
                    )}
                    {feature.source === 'filesystem' && (
                        <span style={{ fontSize: '0.55em', padding: '1px 5px', borderRadius: '3px', background: 'rgba(108, 138, 182, 0.15)', color: '#6c8ab6', fontWeight: 700, letterSpacing: '0.3px' }}>
                            DISCOVERED
                        </span>
                    )}
                    {tc && (
                        <span style={{ fontSize: '0.6em', opacity: 0.55, marginLeft: 'auto' }}>
                            {tc.done}/{tc.total} tasks
                        </span>
                    )}
                </div>
                {outcome && (
                    <div style={{
                        fontSize: '0.65em', opacity: 0.5, lineHeight: 1.3, marginTop: '2px', fontStyle: 'italic',
                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                        {outcome}
                    </div>
                )}
            </div>
        </div>
    );
};

export interface FeatureListProps {
    sortedFeatures: FeatureEntry[];
    selectedFeature: FeatureEntry | null;
    taskCounts: Record<string, { total: number; done: number }>;
    milestoneOutcomeMap: Record<string, string>;
    onSelectFeature: (feature: FeatureEntry) => void;
    onCreateNew: () => void;
}

export const FeatureList = ({ sortedFeatures, selectedFeature, taskCounts, milestoneOutcomeMap, onSelectFeature, onCreateNew }: FeatureListProps) => {
    return (
        <aside style={{
            width: '220px', borderRight: '1px solid var(--vscode-panel-border)',
            overflowY: 'auto', flexShrink: 0, background: 'var(--vscode-sideBar-background)',
        }}>
            {sortedFeatures.length === 0 && (
                <div style={{ padding: SPACE.md, textAlign: 'center', opacity: 0.6, fontSize: '0.85em' }}>
                    <div style={{ fontStyle: 'italic', marginBottom: '12px' }}>No features found</div>
                    <button
                        type="button"
                        onClick={onCreateNew}
                        style={{
                            padding: '6px 14px', borderRadius: '6px', border: 'none',
                            background: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            cursor: 'pointer', fontSize: '0.8em', fontWeight: 600,
                        }}
                    >
                        Create New Feature
                    </button>
                </div>
            )}
            {sortedFeatures.map((feature, idx) => (
                <FeatureCard
                    key={feature.id}
                    feature={feature}
                    selected={selectedFeature?.id === feature.id}
                    onClick={() => onSelectFeature(feature)}
                    taskCounts={taskCounts}
                    outcome={milestoneOutcomeMap[feature.id]}
                    index={idx}
                />
            ))}
        </aside>
    );
};
