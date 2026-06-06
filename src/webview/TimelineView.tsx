import * as React from 'react';
import { Milestone } from '../types.js';

interface Props {
    milestones: Milestone[];
}

export const TimelineView = ({ milestones }: Props) => {
    if (milestones.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>No milestones recorded in progress.md yet.</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '70vh' }}>
            <div style={{ borderLeft: '2px solid var(--vscode-focusBorder)', paddingLeft: '20px', position: 'relative' }}>
                {milestones.map((m, i) => (
                    <div key={i} style={{ marginBottom: '30px', position: 'relative' }}>
                        <div style={{
                            position: 'absolute',
                            left: '-31px',
                            top: '5px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: m.status === 'COMPLETED' ? 'var(--vscode-debugIcon-breakpointForeground)' : 'var(--vscode-descriptionForeground)',
                            border: '4px solid var(--vscode-editor-background)'
                        }}></div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{m.title}</div>
                        <div style={{ fontSize: '0.85em', opacity: 0.7, marginBottom: '5px' }}>
                            {m.date} | {m.featureId} | <vscode-badge>{m.status}</vscode-badge>
                        </div>
                        {m.outcome && (
                            <div style={{ 
                                padding: '10px', 
                                background: 'var(--vscode-sideBar-background)', 
                                border: '1px solid var(--vscode-panel-border)',
                                fontSize: '0.95em'
                            }}>
                                {m.outcome}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
