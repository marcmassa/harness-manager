import * as React from 'react';
import type { MarkdownFileContent, DiscoveryMethod } from '../../types.js';

interface MDViewerProps {
    content: MarkdownFileContent | null;
    isLoading: boolean;
    /** Optional node metadata for showing Progressive Disclosure traceability */
    nodeMetadata?: Record<string, any>;
}

export const MDViewer = ({ content, isLoading, nodeMetadata }: MDViewerProps) => {
    if (isLoading) {
        return (
            <div style={{
                padding: '24px',
                textAlign: 'center',
                opacity: 0.5,
                fontStyle: 'italic',
                fontSize: '0.9em',
            }}>
                Loading file content...
            </div>
        );
    }

    if (!content) {
        return (
            <div style={{
                padding: '24px',
                textAlign: 'center',
                opacity: 0.4,
                fontStyle: 'italic',
                fontSize: '0.9em',
            }}>
                Select a node to view its Markdown file
            </div>
        );
    }

    if (!content.exists) {
        return (
            <div style={{
                padding: '24px',
                textAlign: 'center',
                background: 'var(--vscode-inputValidation-warningBackground, #3a2d1a)',
                border: '1px solid var(--vscode-inputValidation-warningBorder, #8a6d2a)',
                borderRadius: '6px',
                margin: '8px',
                color: 'var(--vscode-inputValidation-warningForeground, #d7b85a)',
            }}>
                <div style={{ fontSize: '1.2em', marginBottom: '8px', fontWeight: 600 }}>
                    ⚠ File Not Found
                </div>
                <div style={{ fontSize: '0.85em', opacity: 0.8 }}>
                    No Markdown file found for <code style={{ 
                        background: 'rgba(0,0,0,0.2)', 
                        padding: '2px 6px', 
                        borderRadius: '3px',
                        fontFamily: 'monospace',
                    }}>{content.nodeId}</code>
                </div>
                <div style={{ fontSize: '0.75em', marginTop: '8px', opacity: 0.6 }}>
                    Expected at: <code>{content.filePath}</code>
                </div>
            </div>
        );
    }

    // Render the markdown content as monospace text
    const lines = content.content.split('\n');
    // Limit to 200 lines for performance
    const displayLines = lines.slice(0, 200);
    const truncated = lines.length > 200;

    return (
        <div style={{
            fontFamily: 'var(--vscode-editor-font-family, "Cascadia Code", "Fira Code", monospace)',
            fontSize: 'var(--vscode-editor-font-size, 12px)',
            lineHeight: 1.5,
            padding: '8px 12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowY: 'auto',
            maxHeight: '100%',
            background: 'var(--vscode-editor-background)',
            color: 'var(--vscode-editor-foreground)',
        }}>
            <div style={{
                position: 'sticky',
                top: 0,
                background: 'var(--vscode-sideBar-background)',
                padding: '4px 8px',
                margin: '-8px -12px 8px',
                borderBottom: '1px solid var(--vscode-panel-border)',
                fontSize: '0.75em',
                opacity: 0.5,
                display: 'flex',
                justifyContent: 'space-between',
            }}>
                <span>{content.filePath}</span>
                <span>{lines.length} lines</span>
            </div>

            {/* Progressive Disclosure — discovery trace */}
            {nodeMetadata?._discovery && (
                <div style={{
                    background: nodeMetadata._discovery === 'orphan'
                        ? 'rgba(108, 108, 138, 0.08)'
                        : 'rgba(42, 161, 152, 0.08)',
                    borderLeft: `3px solid ${nodeMetadata._discovery === 'orphan' ? '#6c6c8a' : '#2aa198'}`,
                    padding: '8px 12px',
                    marginBottom: '8px',
                    borderRadius: '0 4px 4px 0',
                }}>
                    <div style={{ opacity: 0.4, fontSize: '0.75em', marginBottom: '4px', letterSpacing: '0.5px' }}>
                        PROGRESSIVE DISCLOSURE
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85em' }}>
                        <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75em',
                            fontWeight: 700,
                            background: nodeMetadata._discovery === 'orphan'
                                ? 'rgba(108, 108, 138, 0.2)'
                                : 'rgba(42, 161, 152, 0.2)',
                            color: nodeMetadata._discovery === 'orphan' ? '#6c6c8a' : '#2aa198',
                        }}>
                            {nodeMetadata._discovery === 'orphan' ? '📡 DISCOVERED' : '🔗 LINKED'}
                        </span>
                        <span style={{ opacity: 0.7, fontSize: '0.8em' }}>
                            {nodeMetadata._discovery === 'orphan'
                                ? 'Available for activation — no subagent currently references this skill.'
                                : 'Explicitly referenced by one or more subagents — active in the skill graph.'}
                        </span>
                    </div>
                </div>
            )}

            {/* YAML frontmatter indicator */}
            {lines[0]?.startsWith('---') && (
                <div style={{
                    background: 'var(--vscode-textBlockQuote-background, rgba(127,127,127,0.1))',
                    borderLeft: '3px solid var(--vscode-textBlockQuote-border, rgba(127,127,127,0.3))',
                    padding: '8px 12px',
                    marginBottom: '8px',
                    borderRadius: '0 4px 4px 0',
                }}>
                    <div style={{ opacity: 0.4, fontSize: '0.8em', marginBottom: '4px' }}>── frontmatter ──</div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {lines.slice(1, lines.indexOf('---', 1) + 1).join('\n')}
                    </pre>
                    <div style={{ opacity: 0.4, fontSize: '0.8em', marginTop: '4px' }}>── body ──</div>
                </div>
            )}

            {/* Body content */}
            {displayLines.map((line, i) => {
                // Simple heading highlighting
                if (line.startsWith('#')) {
                    const level = line.match(/^#+/)?.[0].length || 1;
                    return (
                        <div key={i} style={{
                            fontWeight: level <= 2 ? 700 : 600,
                            fontSize: level <= 2 ? '1.1em' : '1em',
                            marginTop: level <= 2 ? '12px' : '8px',
                            marginBottom: '4px',
                            color: 'var(--vscode-editor-foreground)',
                            opacity: 0.95,
                        }}>
                            {line}
                        </div>
                    );
                }
                // List items
                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                    return (
                        <div key={i} style={{
                            paddingLeft: '16px',
                            opacity: 0.9,
                        }}>
                            {line}
                        </div>
                    );
                }
                return (
                    <div key={i} style={{ opacity: line.trim() === '' ? 0.3 : 0.8 }}>
                        {line}
                    </div>
                );
            })}

            {truncated && (
                <div style={{
                    textAlign: 'center',
                    padding: '12px',
                    opacity: 0.5,
                    fontStyle: 'italic',
                    borderTop: '1px solid var(--vscode-panel-border)',
                    marginTop: '8px',
                }}>
                    ... {lines.length - 200} more lines (file truncated for performance)
                </div>
            )}
        </div>
    );
};
