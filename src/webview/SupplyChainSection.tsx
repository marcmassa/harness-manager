import * as React from 'react';
import type { AgenticProfile } from '../agentic-detector/types.js';
import { SPACE } from './advisoryParts.js';

export const IconRefresh = () => (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" />
        <polyline points="13.5 2.5 13.5 5.5 10.5 5.5" />
    </svg>
);

// ===== Supply Chain section (FEAT-036 R12) =====

export const AUDIT_STATE_COLORS: Record<string, string> = {
    'not-run': '#888',
    'unavailable': '#d4a017',
    'captured': '#2aa198',
};

/**
 * Deterministic supply-chain summary: prod/dev finding counts, the audit
 * lifecycle badge, and the *user-triggered* Run-npm-audit button (R6 —
 * nothing here runs audit automatically). Hidden for non-Node workspaces.
 */
export const SupplyChainSection = ({
    report,
    onRunAudit,
    isAuditRunning,
}: {
    report: NonNullable<AgenticProfile['supplyChain']>;
    onRunAudit?: () => void;
    isAuditRunning?: boolean;
}) => {
    const state = report.audit.state;
    const stateColor = AUDIT_STATE_COLORS[state] ?? '#888';
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                padding: `${SPACE.xs} ${SPACE.sm}`,
                borderRadius: '6px',
                border: '1px solid var(--vscode-panel-border)',
                background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
                fontSize: '0.75em',
                flexWrap: 'wrap',
            }}
        >
                <span title="Production-scope audit findings (R11)">
                    prod: <b>{report.audit.prodCount}</b>
                </span>
                <span title="Development-scope audit findings (R11)">
                    dev: <b>{report.audit.devCount}</b>
                </span>
                <vscode-badge
                    style={{
                        fontSize: '0.85em',
                        background: `color-mix(in srgb, ${stateColor} 30%, transparent)`,
                    }}
                    title={`npm audit state: ${state} (user-triggered only)`}
                >
                    {isAuditRunning ? 'auditing…' : state}
                </vscode-badge>
                {report.audit.staleOverrides.length > 0 && (
                    <span style={{ opacity: 0.8 }} title="Stale security overrides (R9)">
                        stale overrides: {report.audit.staleOverrides.map(o => o.name).join(', ')}
                    </span>
                )}
                {onRunAudit && (
                    <button
                        type="button"
                        onClick={onRunAudit}
                        disabled={isAuditRunning}
                        title="Run npm audit --json locally (one bounded run; results cached for this session)"
                        style={{
                            marginLeft: 'auto',
                            fontSize: '0.9em',
                            padding: '2px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--vscode-button-border, var(--vscode-focusBorder))',
                            background: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            cursor: isAuditRunning ? 'not-allowed' : 'pointer',
                            opacity: isAuditRunning ? 0.6 : 1,
                        }}
                    >
                        {isAuditRunning ? 'Running…' : 'Run npm audit'}
                    </button>
                )}
        </div>
    );
};

// ===== Panel component =====
