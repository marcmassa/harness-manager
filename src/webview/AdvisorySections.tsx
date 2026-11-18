// Advisory panel: CLI installations and architecture patterns sections.
import * as React from 'react';
import type { PatternMatch } from '../agentic-detector/types.js';
import { SPACE, confidenceLabel } from './advisoryParts.js';

export const ArchitectureSections = ({ cliInstalls, patterns, sectionHeader }: { cliInstalls: any; patterns: any; sectionHeader: any }) => (
        <>
            {/* ===== 3. CLI installs ===== */}
            {cliInstalls.length > 0 && (
                <>
                    {sectionHeader('CLI Installations')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                        {cliInstalls.map((cli: any) => (
                            <div
                                key={cli.cliId}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '3px',
                                    padding: SPACE.sm,
                                    borderRadius: '6px',
                                    border: '1px solid var(--vscode-panel-border)',
                                    background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: SPACE.xs,
                                    }}
                                >
                                    <span style={{ fontWeight: 600, fontSize: '0.85em' }}>
                                        {cli.cliName}
                                    </span>
                                    {cli.isActive && (
                                        <vscode-badge style={{ fontSize: '0.6em' }}>active</vscode-badge>
                                    )}
                                </div>
                                {cli.configFiles && cli.configFiles.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                        {cli.configFiles.map((fp: string) => (
                                            <code
                                                key={fp}
                                                style={{
                                                    fontSize: '0.68em',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    background: 'color-mix(in srgb, var(--vscode-panel-border) 20%, transparent)',
                                                    color: 'var(--vscode-descriptionForeground)',
                                                }}
                                            >
                                                {fp}
                                            </code>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ===== 4. Architecture patterns ===== */}
            {patterns.length > 0 && (
                <>
                    {sectionHeader('Architecture Patterns')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                        {patterns.map((pat: PatternMatch) => (
                            <div
                                key={pat.pattern}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: SPACE.sm,
                                    padding: `${SPACE.xs} ${SPACE.sm}`,
                                    borderRadius: '6px',
                                    border: '1px solid var(--vscode-panel-border)',
                                    background: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
                                }}
                            >
                                {/* Confidence bar */}
                                <div
                                    style={{
                                        width: '4px',
                                        height: '24px',
                                        borderRadius: '2px',
                                        flexShrink: 0,
                                        background: `color-mix(in srgb, var(--vscode-focusBorder) ${
                                            Math.round(pat.confidence * 100)
                                        }%, var(--vscode-panel-border))`,
                                        opacity: 0.75,
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            fontSize: '0.82em',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {pat.label}
                                    </div>
                                    {pat.evidence.length > 0 && (
                                        <div
                                            style={{
                                                fontSize: '0.68em',
                                                opacity: 0.55,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {pat.evidence[0]}
                                            {pat.evidence.length > 1 && ` +${pat.evidence.length - 1} more`}
                                        </div>
                                    )}
                                </div>
                                <span
                                    style={{
                                        fontSize: '0.65em',
                                        fontWeight: 700,
                                        opacity: 0.6,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}
                                >
                                    {confidenceLabel(pat.confidence)}
                                </span>
                                <vscode-badge
                                    style={{
                                        fontSize: '0.6em',
                                        flexShrink: 0,
                                        background:
                                            pat.status === 'detected'
                                                ? 'color-mix(in srgb, var(--vscode-testing-iconPassed) 25%, transparent)'
                                                : 'color-mix(in srgb, var(--vscode-testing-iconQueued) 25%, transparent)',
                                    }}
                                >
                                    {pat.status}
                                </vscode-badge>
                            </div>
                        ))}
                    </div>
                </>
            )}

        </>
);
