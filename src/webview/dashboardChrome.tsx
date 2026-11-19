import * as React from 'react';
import { SUPPORTED_FRAMEWORKS } from '../frameworks.js';
import { SPACE } from './styles.js';
import { vscode } from './vscodeApi.js';


export const SkeletonLoading = () => (
    <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        background: 'var(--vscode-editor-background)',
    }}>
        <header style={{ 
            padding: SPACE.sm, 
            borderBottom: '1px solid var(--vscode-panel-border)' 
        }}>
            <div className="skeleton-shimmer" style={{ 
                width: '180px', 
                height: '14px', 
                borderRadius: '4px',
                background: 'var(--vscode-skeleton-background)',
                marginBottom: SPACE.sm,
                opacity: 0.5,
                animation: 'shimmer 1.8s ease-in-out infinite',
            }} />
            <div className="skeleton-shimmer" style={{ 
                width: '300px', 
                height: '24px', 
                borderRadius: '4px',
                background: 'var(--vscode-skeleton-background)',
                opacity: 0.3,
                animation: 'shimmer 1.8s ease-in-out infinite 0.3s',
            }} />
        </header>
        <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
        }}>
            <vscode-progress-ring />
        </div>
    </div>
);
// ── Shared action button style: vivid vscode-button color + compact toolbar shape ──
export const harnessActionBtnStyle: React.CSSProperties = {
    padding: '5px 13px',
    fontSize: '0.78em',
    fontWeight: 600,
    background: 'var(--vscode-button-background)',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    color: 'var(--vscode-button-foreground)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
    fontFamily: 'inherit',
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
};

export const FRAMEWORK_SIGNATURES: Array<{ label: string; signatures: string }> = SUPPORTED_FRAMEWORKS.map((framework) => ({
    label: framework.label,
    signatures: framework.signatures.join(', '),
}));

export const FrameworkBadge = ({ frameworks }: { frameworks: string[] }) => {
    if (frameworks.length === 0) return null;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.xs,
                maxWidth: '460px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                padding: '2px',
            }}
            title={`Detected frameworks: ${frameworks.join(' · ')}`}
        >
            {frameworks.map((framework) => (
                <span
                    key={framework}
                    style={{
                        fontSize: '0.68em',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        border: '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border))',
                        background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
                        color: 'var(--vscode-editorWidget-foreground, var(--vscode-foreground))',
                        fontWeight: 600,
                        letterSpacing: '0.2px',
                        flexShrink: 0,
                    }}
                >
                    {framework}
                </span>
            ))}
        </div>
    );
};

/** Small maturity level pill shown in the tab header — visible from all tabs (FEAT-031). */
export const MaturityBadge = ({ summary }: { summary: { maturityLevel: string | null; maturityLabel: string; maturityColor: string; isScanning: boolean } }) => {
    if (!summary.maturityLevel && !summary.isScanning) return null;
    const color = summary.maturityColor || '#888';
    return (
        <div
            title={summary.isScanning ? 'Scanning architecture…' : `Maturity: ${summary.maturityLevel} — ${summary.maturityLabel}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.65em',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                background: summary.isScanning
                    ? 'color-mix(in srgb, var(--vscode-panel-border) 30%, transparent)'
                    : `color-mix(in srgb, ${color} 18%, var(--vscode-sideBar-background))`,
                border: `1px solid color-mix(in srgb, ${summary.isScanning ? 'var(--vscode-panel-border)' : color} 40%, transparent)`,
                color: summary.isScanning ? 'var(--vscode-descriptionForeground)' : color,
                letterSpacing: '0.3px',
                flexShrink: 0,
                transition: 'all 0.2s ease',
            }}
        >
            {summary.isScanning ? (
                <>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', opacity: 0.6, animation: 'pulse 1s infinite' }} />
                    scanning
                </>
            ) : (
                summary.maturityLevel
            )}
        </div>
    );
};

export const EmptyState = () => (
    <div
        style={{
            margin: SPACE.lg,
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '10px',
            padding: SPACE.lg,
            background: 'color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background))',
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
        }}
    >
        <div>
            <div style={{ fontSize: '1.05em', fontWeight: 700, marginBottom: SPACE.xs }}>
                No agent framework detected
            </div>
            <div style={{ opacity: 0.78, lineHeight: 1.45 }}>
                Add one of the supported framework files to this workspace and the graph will load automatically.
            </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
            {FRAMEWORK_SIGNATURES.map((framework) => (
                <div
                    key={framework.label}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr',
                        gap: SPACE.sm,
                        padding: `${SPACE.xs} 0`,
                        borderBottom: '1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent)',
                    }}
                >
                    <span style={{ fontWeight: 600 }}>{framework.label}</span>
                    <code style={{ opacity: 0.82 }}>{framework.signatures}</code>
                </div>
            ))}
        </div>
    </div>
);
