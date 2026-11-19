// Status badges under a whiteboard node's label (moved from CustomNode.tsx, FEAT-046).
import * as React from 'react';
import type { HarnessNodeProps } from '../nodeTypes.js';
import { SPACE } from '../styles.js';

function formatRelativeTime(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    return `${Math.floor(diffHr / 24)} d ago`;
}

export const NodeBadges = ({ type, data }: { type: string; data: HarnessNodeProps['data'] }) => (
    <>
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
                ▶ {formatRelativeTime(data.lastRunTimestamp as number)}
            </span>
        </div>
    )}

    {/* Suggestion badge — shows on subagents with pending semantic suggestions (FEAT-010, R6) */}
    {(type === 'agent' || type === 'subagent') && (data.suggestedCount ?? 0) > 0 && (
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
            }}>💡 {data.suggestedCount} suggestion{(data.suggestedCount ?? 0) > 1 ? 's' : ''}</span>
        </div>
    )}

    {/* Status badge */}
    {Boolean(data.metadata?.status) && (
        <div style={{ marginTop: SPACE.sm }}>
            <span style={{ 
                fontSize: '0.6em', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                background: 'var(--vscode-badge-background)',
                color: 'var(--vscode-badge-foreground)',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
            }}>{data.metadata.status as string}</span>
        </div>
    )}

    {/* Progressive Disclosure badge: shows discovery stage for skill nodes */}
    {type === 'skill' && Boolean(data.metadata?._discovery) && (
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
    {type === 'skill' && Boolean(data.metadata?._bestOwner) && (
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
                → {(data.metadata._bestOwner as string | undefined)} ({(data.metadata._bestOwnerScore as number | undefined)?.toFixed(2) || '?'})
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
    </>
);
