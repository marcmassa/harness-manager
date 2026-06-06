import * as React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const nodeStyles: Record<string, React.CSSProperties> = {
    agent: { background: 'var(--vscode-debugIcon-breakpointForeground)', color: 'white', padding: '10px', borderRadius: '5px', border: '1px solid var(--vscode-panel-border)' },
    subagent: { background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', padding: '10px', borderRadius: '5px', border: '1px solid var(--vscode-panel-border)' },
    skill: { background: 'var(--vscode-statusBarItem-remoteBackground)', color: 'white', padding: '10px', borderRadius: '5px', border: '1px solid var(--vscode-panel-border)' },
    feature: { background: 'var(--vscode-activityBarBadge-background)', color: 'var(--vscode-activityBarBadge-foreground)', padding: '10px', borderRadius: '5px', border: '1px solid var(--vscode-panel-border)' }
};

export const CustomNode = ({ data, type }: NodeProps) => {
    return (
        <div style={nodeStyles[type] || nodeStyles.subagent}>
            <Handle type="target" position={Position.Top} />
            <div style={{ fontWeight: 'bold' }}>{data.label}</div>
            <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{type.toUpperCase()}</div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
};
